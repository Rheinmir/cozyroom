# Proposal: Maintain YouTube Downloads as Separate Albums per Uploader and Fix Scanner Metadata Overwrite

## 1. Restated Request
Maintain each downloaded YouTube track as its own separate/individual album (using the track title as the album title) under its respective uploader's artist name, and fix the library scanner to prevent it from overwriting downloaded YouTube tracks' metadata with `"Unknown Artist"/"Unknown Album"`.

## 2. Affected Components & Files
- **Backend Handler**: `backend/internal/api/youtube.go` (specifically the `download` handler)
- **Library Scanner**: `backend/internal/library/scanner.go` (specifically the `indexFile` function)
- **Database Migrator**: `backend/internal/db/db.go` (specifically adding a `migrateYouTubeTracks` startup migration)

## 3. Potential Side Effects & Breakage
- **No side effects on existing local files**: Standard local files scanned from disk have ID3 tags and will not be affected.
- **No side effects on direct streaming**: Streaming from YouTube directly inside the app uses `yt:<id>` paths and remains completely unaffected.

## 4. Proposed Implementation Plan
1. **Downloader Update**:
   - In `backend/internal/api/youtube.go`, call `IndexFileWithMetadata` with the track's `body.Title` as the album title, ensuring each download gets its own separate single-track album card.
2. **Scanner Protection**:
   - In `backend/internal/library/scanner.go`, define `reYouTubeID` regex.
   - At the beginning of `indexFile`, check if the filename base represents an 11-character YouTube video ID. If it does and the track already exists in the database, return `nil` immediately to skip scanning and preserve correct metadata.
3. **Database Migration on Startup**:
   - In `backend/internal/db/db.go`, implement a `migrateYouTubeTracks` function that:
     - Finds all tracks whose filename base is an 11-character YouTube ID.
     - For each track, gets its current `artist_id` and track `title`.
     - Creates a separate album for each track with `title = track_title` under its `artist_id` if not exists.
     - Updates the track's `album_id` to its individual album ID.
     - Automatically fetches and saves the YouTube video thumbnail as the cover art for each album to avoid broken covers.
     - Cleans up empty albums and artists.
   - Call `migrateYouTubeTracks` at the end of the database `migrate` function.

## 5. Success Criteria
- Existing downloaded YouTube tracks are listed separately/individually as their own single-track album cards under their respective uploaders.
- In the local artist page for `"Nhạc Việt Nam nhưng ở 1 diễn biến khác"`, both downloaded YouTube tracks (`ĐÂY THÔN VĨ DẠ ( Club Mix )` and `YÊU 1 NGƯỜI CÓ LẼ ( Rock Version )`) are displayed correctly as separate album cards, and play normally.
- Newly downloaded YouTube tracks immediately show up in their own separate album under their respective uploader.
- Subsequent library scans (`/api/scan`) do not overwrite or reset these tracks' metadata.

