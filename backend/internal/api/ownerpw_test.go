package api

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"testing"
	"time"
)

// Fake value for tests only. The real owner password is never written in this repo.
const testOwnerPw = "test-owner-pw-0123"

func ownerEnv(t *testing.T, pw string) {
	t.Helper()
	t.Setenv(ownerPasswordEnv, pw)
	oldDelay, oldMax, oldGMax := ownerFailDelay, ownerFailMax, ownerFailGlobalMax
	ownerFailDelay = 0
	ownerFails.Lock()
	ownerFails.by, ownerFails.all = map[string][]time.Time{}, nil
	ownerFails.Unlock()
	t.Cleanup(func() { ownerFailDelay, ownerFailMax, ownerFailGlobalMax = oldDelay, oldMax, oldGMax })
}

func callCheck(hdr, query, ip string) *httptest.ResponseRecorder {
	req := httptest.NewRequest("GET", "/api/owner/check"+query, nil)
	if hdr != "" {
		req.Header.Set("X-Owner-Password", hdr)
	}
	if ip != "" {
		req.Header.Set("CF-Connecting-IP", ip)
	}
	w := httptest.NewRecorder()
	ownerCheck(w, req)
	return w
}

func TestOwnerUnsetFailsClosed(t *testing.T) {
	ownerEnv(t, "")
	for _, pw := range []string{"", "x", testOwnerPw} {
		if c := callCheck(pw, "", "").Code; c != http.StatusUnauthorized {
			t.Fatalf("env unset, header %q: want 401, got %d", pw, c)
		}
	}
	// an owner write (ebook NSFW toggle takes the password in the body) is refused too
	h := &handlers{}
	for _, body := range []string{`{"is_nsfw":true,"password":""}`, `{"is_nsfw":true,"password":"` + testOwnerPw + `"}`} {
		w := httptest.NewRecorder()
		h.setEbookNSFW(w, httptest.NewRequest("POST", "/api/ebooks/x/nsfw", strings.NewReader(body)))
		if w.Code != http.StatusUnauthorized {
			t.Fatalf("env unset, body %s: want 401, got %d", body, w.Code)
		}
	}
}

func TestOwnerRightAndWrong(t *testing.T) {
	ownerEnv(t, testOwnerPw)
	if c := callCheck(testOwnerPw, "", "").Code; c != http.StatusNoContent {
		t.Fatalf("right password: want 204, got %d", c)
	}
	for _, bad := range []string{"", "x", testOwnerPw + "x", testOwnerPw[:len(testOwnerPw)-1], strings.ToUpper(testOwnerPw)} {
		if c := callCheck(bad, "", "").Code; c != http.StatusUnauthorized {
			t.Fatalf("wrong password %q: want 401, got %d", bad, c)
		}
	}
}

func TestOwnerQueryPasswordRefused(t *testing.T) {
	ownerEnv(t, testOwnerPw)
	if c := callCheck("", "?password="+testOwnerPw, "").Code; c != http.StatusUnauthorized {
		t.Fatalf("right password in the URL must be refused, got %d", c)
	}
}

func TestOwnerRateLimit(t *testing.T) {
	ownerEnv(t, testOwnerPw)
	ownerFailMax, ownerFailGlobalMax = 3, 5
	for i := 0; i < 3; i++ {
		if c := callCheck("bad", "", "1.1.1.1").Code; c != http.StatusUnauthorized {
			t.Fatalf("try %d: want 401, got %d", i, c)
		}
	}
	w := callCheck(testOwnerPw, "", "1.1.1.1") // over the limit: even the right password waits
	if w.Code != http.StatusTooManyRequests || w.Header().Get("Retry-After") == "" {
		t.Fatalf("over the limit: want 429 + Retry-After, got %d", w.Code)
	}
	if c := callCheck(testOwnerPw, "", "2.2.2.2").Code; c != http.StatusNoContent {
		t.Fatalf("another client must not be locked, got %d", c)
	}
	// a request with no password (a kanban user with a session) is never counted or answered 429
	req := httptest.NewRequest("GET", "/x", nil)
	req.Header.Set("CF-Connecting-IP", "1.1.1.1")
	if ok, many := ownerAuth(req); ok || many {
		t.Fatalf("no password: want (false,false), got (%v,%v)", ok, many)
	}
	// global cap: a spoofed client header cannot buy unlimited tries
	ownerEnv(t, testOwnerPw)
	ownerFailMax, ownerFailGlobalMax = 100, 4
	for i := 0; i < 4; i++ {
		callCheck("bad", "", "9.9.9."+string(rune('0'+i)))
	}
	if c := callCheck(testOwnerPw, "", "9.9.9.0").Code; c != http.StatusTooManyRequests { // already failed once: refused
		t.Fatalf("global cap, client with a failure: want 429, got %d", c)
	}
	if c := callCheck(testOwnerPw, "", "8.8.8.8").Code; c != http.StatusNoContent { // 0 failures: the owner is not locked out
		t.Fatalf("global cap, clean client: want 204, got %d", c)
	}
}

func TestOwnerEbookBodyPasswordIsLimitedToo(t *testing.T) {
	ownerEnv(t, testOwnerPw)
	ownerFailMax = 2
	h := &handlers{}
	post := func() int {
		w := httptest.NewRecorder()
		h.setEbookNSFW(w, httptest.NewRequest("POST", "/api/ebooks/x/nsfw", strings.NewReader(`{"is_nsfw":true,"password":"bad"}`)))
		return w.Code
	}
	if a, b, c := post(), post(), post(); a != 401 || b != 401 || c != 429 {
		t.Fatalf("want 401,401,429 got %d,%d,%d", a, b, c)
	}
}

func TestOwnerFailDelay(t *testing.T) {
	ownerEnv(t, testOwnerPw)
	ownerFailDelay = 60 * time.Millisecond
	t0 := time.Now()
	callCheck("bad", "", "3.3.3.3")
	if d := time.Since(t0); d < 60*time.Millisecond {
		t.Fatalf("a wrong password must wait, took %v", d)
	}
	req := httptest.NewRequest("GET", "/x", nil)
	t0 = time.Now()
	ownerAuth(req)
	if d := time.Since(t0); d >= 60*time.Millisecond {
		t.Fatalf("a request without a password must not wait, took %v", d)
	}
}

func TestOwnerPasswordNeverLogged(t *testing.T) {
	ownerEnv(t, testOwnerPw)
	var buf bytes.Buffer
	log.SetOutput(&buf)
	t.Cleanup(func() { log.SetOutput(os.Stderr) })
	srv := metricsMiddleware(http.HandlerFunc(ownerCheck))
	for _, pw := range []string{"wrong-" + testOwnerPw, testOwnerPw} {
		req := httptest.NewRequest("GET", "/api/owner/check", nil)
		req.Header.Set("X-Owner-Password", pw)
		srv.ServeHTTP(httptest.NewRecorder(), req)
	}
	rows, _ := json.Marshal(globalRing.snapshot())
	if bytes.Contains(rows, []byte(testOwnerPw)) || strings.Contains(buf.String(), testOwnerPw) {
		t.Fatal("the owner password reached the request log or the log output")
	}
}

// No secret is written here: only patterns that a hardcoded password would match.
func TestNoOwnerPasswordInSource(t *testing.T) {
	root := filepath.Join("..", "..", "..")
	goBad := regexp.MustCompile(`(?m)^\s*(const|var)\s+OwnerPassword\b`)
	feBad := map[string]*regexp.Regexp{
		"constant":      regexp.MustCompile(`OWNER_PASSWORD\s*=\s*['"` + "`" + `]`),
		"weak fallback": regexp.MustCompile(`admin123`),
		"compare":       regexp.MustCompile(`(?i)\b(pw|password|passwd|input|trimmed)\s*[!=]==\s*['"` + "`" + `][^'"` + "`" + `]|\.trim\(\)\s*[!=]==\s*['"` + "`" + `][^'"` + "`" + `]`),
		"in URL":        regexp.MustCompile(`[?&]password=`),
		"old storage":   regexp.MustCompile(`localStorage\.(get|set)Item\(\s*'ebook-nsfw-pass'`),
	}
	walk := func(dir string, exts []string, fn func(path, text string)) {
		filepath.Walk(filepath.Join(root, dir), func(p string, info os.FileInfo, err error) error {
			if err != nil || info.IsDir() {
				if info != nil && info.IsDir() && (info.Name() == "node_modules" || info.Name() == "dist") {
					return filepath.SkipDir
				}
				return nil
			}
			for _, e := range exts {
				if strings.HasSuffix(p, e) {
					b, _ := os.ReadFile(p)
					fn(p, string(b))
				}
			}
			return nil
		})
	}
	n := 0
	walk("backend", []string{".go"}, func(p, s string) {
		n++
		if strings.HasSuffix(p, "_test.go") {
			return
		}
		if goBad.MatchString(s) {
			t.Errorf("%s: owner password constant is back", p)
		}
	})
	walk("frontend/src", []string{".ts", ".tsx"}, func(p, s string) {
		n++
		for name, re := range feBad {
			if re.MatchString(s) {
				t.Errorf("%s: hardcoded owner password pattern (%s)", p, name)
			}
		}
	})
	if n < 20 {
		t.Fatalf("scan saw only %d files: wrong root?", n)
	}
	b, err := os.ReadFile(filepath.Join(root, "k8s", "backend.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	y := string(b)
	i := strings.Index(y, ownerPasswordEnv)
	if i < 0 || !strings.Contains(y[i:min(len(y), i+300)], "secretKeyRef") || !strings.Contains(y[i:min(len(y), i+300)], "optional: true") {
		t.Error("k8s/backend.yaml must read " + ownerPasswordEnv + " from a secretKeyRef with optional: true")
	}
}

func TestOwnerFailMapIsPruned(t *testing.T) {
	ownerEnv(t, testOwnerPw)
	stale := time.Now().Add(-2 * ownerFailWindow)
	ownerFails.Lock()
	for i := 0; i < ownerFailMaxKeys+200; i++ {
		ownerFails.by["old-"+strconv.Itoa(i)] = []time.Time{stale}
	}
	ownerFails.Unlock()
	callCheck("bad", "", "7.7.7.7")
	callCheck("bad", "", "7.7.7.7")
	ownerFails.Lock()
	n := len(ownerFails.by)
	ownerFails.Unlock()
	if n > 2 {
		t.Fatalf("stale keys must be pruned, map still holds %d", n)
	}
}

// Positive twin of TestAliasKeepsAuth (which only asserts the 401 cases): with the right password
// the handler is reached through /api and through /api/v1. "not json" makes the handler answer 400
// AFTER the password check, so 400 means "let in", 401 means "refused".
func TestOwnerPasswordReachesHandlerThroughAliases(t *testing.T) {
	ownerEnv(t, testOwnerPw)
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/playlists", (&PlaylistHandlers{}).createPlaylist)
	h := aliasPaths(metricsMiddleware(panicRecovery(mux)))
	for i, base := range []string{"/api", "/api/v1"} {
		for _, c := range []struct {
			pw   string
			want int
		}{{testOwnerPw, http.StatusBadRequest}, {"wrong-" + testOwnerPw, http.StatusUnauthorized}, {"", http.StatusUnauthorized}} {
			req := httptest.NewRequest("POST", base+"/playlists", strings.NewReader("not json"))
			req.RemoteAddr = "192.0.2." + strconv.Itoa(i*10+len(c.pw)%9+1) + ":4000" // own client per case: the rate limiter must not interfere
			if c.pw != "" {
				req.Header.Set("X-Owner-Password", c.pw)
			}
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, req)
			if rec.Code != c.want {
				t.Errorf("POST %s/playlists with password %q: %d, want %d", base, c.pw, rec.Code, c.want)
			}
		}
	}
}
