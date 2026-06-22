package library

import (
	"archive/zip"
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"io"
	"io/fs"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"

	"cozyroom/internal/domain"
	repo "cozyroom/internal/repository/postgres"
)

func id8Ebook(s string) string {
	h := sha256.Sum256([]byte(s))
	return hex.EncodeToString(h[:4])
}

func ScanEbooks(db *sql.DB, ebooksDir, coversDir string) error {
	ebooksRepo := repo.NewEbookRepo(db)
	_ = os.MkdirAll(coversDir, 0755)

	err := filepath.WalkDir(ebooksDir, func(path string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return nil
		}
		ext := strings.ToLower(filepath.Ext(path))
		if ext == ".epub" || ext == ".pdf" {
			info, err := d.Info()
			if err != nil {
				return nil
			}

			title := strings.TrimSuffix(d.Name(), filepath.Ext(d.Name()))
			author := "Unknown Author"

			var coverData []byte
			if ext == ".epub" {
				t, a, c := extractEpubMetadata(path)
				if t != "" {
					title = t
				}
				if a != "" {
					author = a
				}
				coverData = c
			}

			ebookID := id8Ebook(path)
			coverURL := ""

			// Fetch existing to preserve NSFW
			existing, _ := ebooksRepo.GetByID(context.Background(), ebookID)
			isNSFW := false
			collection := ""
			if existing != nil {
				isNSFW = existing.IsNSFW
				collection = existing.Collection
			}

			// If collection is empty, use parent directory name
			if collection == "" {
				parentDir := filepath.Base(filepath.Dir(path))
				if parentDir != "." && parentDir != "ebooks" && parentDir != "" {
					collection = parentDir
				}
			}

			if ext == ".epub" && len(coverData) > 0 {
				dest := filepath.Join(coversDir, ebookID+".jpg")
				if err := os.WriteFile(dest, coverData, 0644); err == nil {
					coverURL = "/api/ebook-covers/" + ebookID
				}
			} else if ext == ".pdf" {
				dest := filepath.Join(coversDir, ebookID+".jpg")
				if _, err := os.Stat(dest); os.IsNotExist(err) {
					if err := extractPdfCover(path, dest); err == nil {
						coverURL = "/api/ebook-covers/" + ebookID
					} else {
						log.Printf("ebook scanner: pdftoppm failed for %s: %v", path, err)
					}
				} else {
					coverURL = "/api/ebook-covers/" + ebookID
				}
			} else if ext == ".epub" {
				log.Printf("ebook scanner: no cover found for %s", path)
			}

			e := domain.Ebook{
				ID:        ebookID,
				Title:     title,
				Author:    author,
				Format:    strings.TrimPrefix(ext, "."),
				SizeBytes: info.Size(),
				FilePath:  path,
				CoverURL:  coverURL,
				IsNSFW:    isNSFW,
				Collection: collection,
				CreatedAt: info.ModTime().Unix(),
			}

			if err := ebooksRepo.Upsert(context.Background(), e); err != nil {
				log.Printf("ebook scanner: error upserting %s: %v", path, err)
			} else {
				log.Printf("ebook scanner: indexed %s", title)
			}
		}
		return nil
	})
	log.Printf("ebook scanner: scan finished")
	return err
}

func extractEpubMetadata(path string) (title, author string, coverData []byte) {
	r, err := zip.OpenReader(path)
	if err != nil {
		return "", "", nil
	}
	defer r.Close()

	var opfPath string
	for _, f := range r.File {
		if f.Name == "META-INF/container.xml" {
			rc, err := f.Open()
			if err != nil {
				continue
			}
			content, _ := io.ReadAll(rc)
			rc.Close()
			re := regexp.MustCompile(`full-path="([^"]+)"`)
			matches := re.FindSubmatch(content)
			if len(matches) > 1 {
				opfPath = string(matches[1])
			}
			break
		}
	}

	if opfPath == "" {
		return "", "", nil
	}

	var opfContent []byte
	for _, f := range r.File {
		if f.Name == opfPath {
			rc, err := f.Open()
			if err != nil {
				continue
			}
			opfContent, _ = io.ReadAll(rc)
			rc.Close()
			break
		}
	}

	if len(opfContent) == 0 {
		return "", "", nil
	}

	reTitle := regexp.MustCompile(`(?i)<dc:title[^>]*>([^<]+)</dc:title>`)
	reAuthor := regexp.MustCompile(`(?i)<dc:creator[^>]*>([^<]+)</dc:creator>`)

	if m := reTitle.FindSubmatch(opfContent); len(m) > 1 {
		title = strings.TrimSpace(string(m[1]))
	}
	if m := reAuthor.FindSubmatch(opfContent); len(m) > 1 {
		author = strings.TrimSpace(string(m[1]))
	}

	// Try to find cover image
	// 1. Look for <meta name="cover" content="item_id" />
	reMetaCover := regexp.MustCompile(`(?i)<meta[^>]+name="cover"[^>]+content="([^"]+)"`)
	var coverItemID string
	if m := reMetaCover.FindSubmatch(opfContent); len(m) > 1 {
		coverItemID = string(m[1])
	}

	var coverImgPath string
	if coverItemID != "" {
		// Find <item id="coverItemID" href="path" />
		reItem := regexp.MustCompile(fmt.Sprintf(`(?i)<item[^>]+id="%s"[^>]+href="([^"]+)"`, regexp.QuoteMeta(coverItemID)))
		if m := reItem.FindSubmatch(opfContent); len(m) > 1 {
			coverImgPath = string(m[1])
		}
	}

	// 2. If not found, look for item with properties="cover-image"
	if coverImgPath == "" {
		reItemCover := regexp.MustCompile(`(?i)<item[^>]+properties="cover-image"[^>]+href="([^"]+)"`)
		if m := reItemCover.FindSubmatch(opfContent); len(m) > 1 {
			coverImgPath = string(m[1])
		}
	}

	if coverImgPath != "" {
		// Resolve path relative to OPF
		fullCoverPath := filepath.Join(filepath.Dir(opfPath), coverImgPath)
		// Zip paths use forward slashes
		fullCoverPath = filepath.ToSlash(fullCoverPath)

		for _, f := range r.File {
			if f.Name == fullCoverPath {
				rc, err := f.Open()
				if err != nil {
					break
				}
				coverData, _ = io.ReadAll(rc)
				rc.Close()
				break
			}
		}
	}

	return title, author, coverData
}

func extractPdfCover(pdfPath, destPath string) error {
	destBase := strings.TrimSuffix(destPath, ".jpg")
	cmd := exec.Command("pdftoppm", "-jpeg", "-f", "1", "-l", "1", "-singlefile", pdfPath, destBase)
	return cmd.Run()
}
