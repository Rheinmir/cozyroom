package api

import (
	"crypto/sha256"
	"crypto/subtle"
	"log"
	"net"
	"net/http"
	"os"
	"sync"
	"time"
)

// The owner password lives only in the environment (k8s Secret cozyroom-owner, key "password").
// It is never a constant in code, never in a frontend bundle, never in docs.
// Unset or empty = fail closed: every owner check answers false, so every owner write is refused.
// Header only (X-Owner-Password): a password in a URL would land in access logs, history and Referer.
const ownerPasswordEnv = "COZYROOM_OWNER_PASSWORD"

// Brute force: a password that was SENT and is wrong waits ownerFailDelay, and counts against the client.
// ownerFailMax wrong tries per client per ownerFailWindow, then 429 (even the right password waits out the window).
// ownerFailGlobalMax: once this many wrong tries happened in the window, clients that already failed are refused too.
// A request without any password (a kanban user with a session) is never delayed or counted.
var (
	ownerFailDelay     = 500 * time.Millisecond
	ownerFailMax       = 10
	ownerFailGlobalMax = 60
	ownerFailMaxKeys   = 1000
	ownerFailWindow    = time.Minute
	ownerUnsetWarn     sync.Once
	ownerFails         = struct {
		sync.Mutex
		by  map[string][]time.Time
		all []time.Time
	}{by: map[string][]time.Time{}}
)

// ownerPasswordOK compares in constant time (sha256 of both sides hides the length).
func ownerPasswordOK(pw string) bool {
	want := os.Getenv(ownerPasswordEnv)
	if want == "" {
		ownerUnsetWarn.Do(func() { log.Printf("%s is not set: owner endpoints refuse every request", ownerPasswordEnv) })
		return false
	}
	a, b := sha256.Sum256([]byte(pw)), sha256.Sum256([]byte(want))
	return subtle.ConstantTimeCompare(a[:], b[:]) == 1
}

// ownerClientKey: Cloudflare's client IP, else nginx's X-Real-IP, else the socket peer.
func ownerClientKey(r *http.Request) string {
	if v := r.Header.Get("CF-Connecting-IP"); v != "" {
		return v
	}
	if v := r.Header.Get("X-Real-IP"); v != "" {
		return v
	}
	if h, _, err := net.SplitHostPort(r.RemoteAddr); err == nil {
		return h
	}
	return r.RemoteAddr
}

func recent(ts []time.Time, now time.Time) []time.Time {
	i := 0
	for i < len(ts) && now.Sub(ts[i]) >= ownerFailWindow {
		i++
	}
	return ts[i:]
}

// ownerBlocked reports whether this client (or everyone together) used up its wrong tries in the window.
func ownerBlocked(key string, now time.Time) bool {
	ownerFails.Lock()
	defer ownerFails.Unlock()
	ownerFails.all = recent(ownerFails.all, now)
	ts := recent(ownerFails.by[key], now)
	if len(ts) == 0 {
		delete(ownerFails.by, key)
	} else {
		ownerFails.by[key] = ts
	}
	if len(ownerFails.by) > ownerFailMaxKeys { // keys of clients that never came back would stay forever
		for k, v := range ownerFails.by {
			if v = recent(v, now); len(v) == 0 {
				delete(ownerFails.by, k)
			} else {
				ownerFails.by[k] = v
			}
		}
	}
	if len(ts) >= ownerFailMax {
		return true
	}
	// The global cap only stops clients that already failed in the window, so the real owner (0 failures)
	// is never locked out by strangers. ponytail: a spoofed client header gets one free try per fake key;
	// fine behind Cloudflare (it sets CF-Connecting-IP). Add a total cap on all tries if the app is ever exposed directly.
	return len(ts) > 0 && len(ownerFails.all) >= ownerFailGlobalMax
}

func ownerNoteFail(key string, now time.Time) {
	ownerFails.Lock()
	defer ownerFails.Unlock()
	ownerFails.by[key] = append(ownerFails.by[key], now)
	ownerFails.all = append(ownerFails.all, now)
}

// ownerAuth: password from the header only.
func ownerAuth(r *http.Request) (ok, tooMany bool) {
	return ownerAuthPW(r, r.Header.Get("X-Owner-Password"))
}

// ownerAuthPW: ok = right password; tooMany = refused without a check because the client is over its limit.
// Every owner check goes through here (also the ebook body password), so the delay and the limit cover all of them.
func ownerAuthPW(r *http.Request, pw string) (ok, tooMany bool) {
	if pw == "" {
		return ownerPasswordOK(""), false
	}
	key, now := ownerClientKey(r), time.Now()
	if ownerBlocked(key, now) {
		return false, true
	}
	if ownerPasswordOK(pw) {
		return true, false
	}
	ownerNoteFail(key, now)
	time.Sleep(ownerFailDelay)
	return false, false
}

func verifyOwnerPassword(r *http.Request) bool {
	ok, _ := ownerAuth(r)
	return ok
}

// GET /api/owner/check: the frontend asks the server instead of comparing in the browser.
func ownerCheck(w http.ResponseWriter, r *http.Request) {
	ok, tooMany := ownerAuth(r)
	switch {
	case ok:
		w.WriteHeader(http.StatusNoContent)
	case tooMany:
		w.Header().Set("Retry-After", "60")
		http.Error(w, "too many attempts", http.StatusTooManyRequests)
	default:
		http.Error(w, "unauthorized", http.StatusUnauthorized)
	}
}
