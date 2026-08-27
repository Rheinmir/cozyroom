package api

import (
	"context"
	"encoding/json"
	"net"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"sync"
	"time"
)

// debugInstance reports which pod/node is serving this request, plus the
// network evidence attached to THIS actual request (Cloudflare headers,
// proxy-forwarded client IP) — never a static/illustrative value.
func debugInstance(w http.ResponseWriter, r *http.Request) {
	if !verifyOwnerPassword(r) {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	env := func(k string) string {
		if v := os.Getenv(k); v != "" {
			return v
		}
		return "unknown"
	}
	header := func(k string) string {
		if v := r.Header.Get(k); v != "" {
			return v
		}
		return "unknown"
	}
	resp := map[string]string{
		"pod_name":          env("POD_NAME"),
		"node_name":         env("NODE_NAME"),
		"pod_ip":            env("POD_IP"),
		"cf_ray":            header("CF-Ray"),
		"cf_connecting_ip":  header("CF-Connecting-IP"),
		"cf_ip_country":     header("CF-IPCountry"),
		"x_real_ip":         header("X-Real-IP"),
		"remote_addr":       r.RemoteAddr,
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

type serviceCheck struct {
	Name      string `json:"name"`
	Addr      string `json:"addr"`
	Reachable bool   `json:"reachable"`
	LatencyMS int64  `json:"latency_ms"`
	Error     string `json:"error,omitempty"`
}

// Hardcoded known service DNS names — Phương án A (no k8s API dependency).
// db-adapter is the path the backend actually uses (see DATABASE_URL);
// postgres is checked separately so a failure can tell apart "primary
// unreachable" from "just the HAProxy layer unreachable".
var debugServiceTargets = []struct{ Name, Addr string }{
	{"postgres", "postgres:5432"},
	{"db-adapter", "db-adapter:5432"},
	{"cloak-proxy", "cloak-proxy:8765"},
	{"frontend", "frontend:80"},
}

func debugServices(w http.ResponseWriter, r *http.Request) {
	if !verifyOwnerPassword(r) {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	// Dial every target concurrently — sequentially, an unreachable service
	// costs its full 1.5s timeout each, and with 4 targets that added up to
	// several seconds of dead time on every /debug page load.
	results := make([]serviceCheck, len(debugServiceTargets))
	var wg sync.WaitGroup
	for i, t := range debugServiceTargets {
		wg.Add(1)
		go func(i int, t struct{ Name, Addr string }) {
			defer wg.Done()
			start := time.Now()
			conn, err := net.DialTimeout("tcp", t.Addr, 1500*time.Millisecond)
			sc := serviceCheck{Name: t.Name, Addr: t.Addr, LatencyMS: time.Since(start).Milliseconds()}
			if err != nil {
				sc.Error = err.Error()
			} else {
				sc.Reachable = true
				conn.Close()
			}
			results[i] = sc
		}(i, t)
	}
	wg.Wait()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}

// debugTraceroute runs traceroute FROM this pod outward — this is the
// server's-eye view of the network, never the client's. The UI must label
// it that way; this handler only supplies the raw evidence.
func debugTraceroute(w http.ResponseWriter, r *http.Request) {
	if !verifyOwnerPassword(r) {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	target := r.URL.Query().Get("target")
	if target == "" {
		target = r.Header.Get("CF-Connecting-IP")
	}
	w.Header().Set("Content-Type", "application/json")
	if target == "" {
		json.NewEncoder(w).Encode(map[string]string{
			"error": "no target: pass ?target=<ip> or the request needs a CF-Connecting-IP header",
		})
		return
	}
	binPath, err := exec.LookPath("traceroute")
	if err != nil {
		json.NewEncoder(w).Encode(map[string]string{
			"error": "traceroute binary not available in this container",
		})
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	out, runErr := exec.CommandContext(ctx, binPath, "-w", "1", "-q", "1", target).Output()
	hops := strings.Split(strings.TrimRight(string(out), "\n"), "\n")
	resp := map[string]any{"target": target, "hops": hops}
	if runErr != nil {
		resp["error"] = "traceroute exited with error: " + runErr.Error()
	}
	json.NewEncoder(w).Encode(resp)
}
