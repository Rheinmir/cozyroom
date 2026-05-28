package api

import (
	"encoding/json"
	"sync"
	"time"
)

// latestCache is a single-value cache with:
//   - single-flight: concurrent requests share one in-flight fetch
//   - proactive refresh: timer fires at TTL so clients always hit warm cache
//   - stale-on-error: last good value served if refresh fails; retries at TTL/4
//   - retry claim: any fresher result (client-triggered or background) updates
//     the cache and unblocks all waiting clients
type latestCache struct {
	mu       sync.Mutex
	value    []byte    // last good JSON payload (includes fetchedAt)
	at       time.Time // when value was last written
	ttl      time.Duration
	inFlight *lcInflight
	timer    *time.Timer
}

type lcInflight struct {
	done  chan struct{}
	value []byte
	err   error
}

func newLatestCache(ttl time.Duration) *latestCache {
	return &latestCache{ttl: ttl}
}

// Get returns cached or freshly-fetched data.
// Concurrent callers with a stale/cold cache all wait for the same fetch.
func (c *latestCache) Get(fetch func() ([]byte, error)) ([]byte, error) {
	c.mu.Lock()

	if len(c.value) > 0 && time.Since(c.at) < c.ttl {
		v := c.value
		c.mu.Unlock()
		return v, nil
	}

	// Join an in-flight fetch — don't duplicate work
	if c.inFlight != nil {
		inf := c.inFlight
		stale := c.value
		c.mu.Unlock()
		<-inf.done
		if inf.err == nil {
			return inf.value, nil
		}
		if len(stale) > 0 {
			return stale, nil // stale-on-error
		}
		return nil, inf.err
	}

	// Start a new fetch
	inf := &lcInflight{done: make(chan struct{})}
	c.inFlight = inf
	c.mu.Unlock()

	raw, err := fetch()

	c.mu.Lock()
	c.inFlight = nil
	if err == nil {
		raw = lcStampTime(raw, time.Now())
		c.value = raw
		c.at = time.Now()
		c.rearm(fetch, c.ttl)
	} else if len(c.value) > 0 {
		raw, err = c.value, nil
		c.rearm(fetch, c.ttl/4) // retry sooner
	} else {
		c.rearm(fetch, c.ttl/4) // cold + error: retry soon
	}
	c.mu.Unlock()

	inf.value, inf.err = raw, err
	close(inf.done) // unblock all waiters

	return raw, err
}

// bgRefresh is invoked by the timer to keep the cache warm proactively.
// Any waiter that arrives during a background refresh joins it via inFlight.
func (c *latestCache) bgRefresh(fetch func() ([]byte, error)) {
	c.mu.Lock()
	if c.inFlight != nil {
		c.mu.Unlock()
		return // already in-flight; it will rearm when done
	}
	inf := &lcInflight{done: make(chan struct{})}
	c.inFlight = inf
	c.mu.Unlock()

	raw, err := fetch()

	c.mu.Lock()
	c.inFlight = nil
	if err == nil {
		raw = lcStampTime(raw, time.Now())
		c.value = raw
		c.at = time.Now()
		c.rearm(fetch, c.ttl)
	} else {
		c.rearm(fetch, c.ttl/4)
	}
	c.mu.Unlock()

	inf.value, inf.err = raw, err
	close(inf.done)
}

// rearm schedules the next refresh. Must be called with c.mu held.
func (c *latestCache) rearm(fetch func() ([]byte, error), delay time.Duration) {
	if c.timer != nil {
		c.timer.Stop()
	}
	c.timer = time.AfterFunc(delay, func() { c.bgRefresh(fetch) })
}

// lcStampTime injects "fetchedAt" into a JSON object payload.
func lcStampTime(data []byte, t time.Time) []byte {
	var m map[string]json.RawMessage
	if err := json.Unmarshal(data, &m); err != nil {
		return data
	}
	ts, _ := json.Marshal(t.UTC().Format(time.RFC3339))
	m["fetchedAt"] = json.RawMessage(ts)
	out, err := json.Marshal(m)
	if err != nil {
		return data
	}
	return out
}
