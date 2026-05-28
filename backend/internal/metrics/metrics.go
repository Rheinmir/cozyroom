package metrics

import "github.com/prometheus/client_golang/prometheus/promauto"
import "github.com/prometheus/client_golang/prometheus"

var (
	StreamsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "music_streams_total",
		Help: "Total number of audio streams served",
	}, []string{"quality"})

	StreamErrorsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "music_stream_errors_total",
		Help: "Total number of audio stream errors",
	}, []string{"quality", "error"})

	SearchesTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "music_searches_total",
		Help: "Search queries executed",
	})

	SmartQueueTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "music_smart_queue_total",
		Help: "Smart queue requests",
	})

	LyricsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "music_lyrics_total",
		Help: "Lyrics fetch requests",
	}, []string{"cached"})

	ScrobblesTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "music_scrobbles_total",
		Help: "Last.fm scrobbles sent",
	})

	NowPlayingTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "music_now_playing_total",
		Help: "Last.fm now-playing updates sent",
	})

	HTTPRequestsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "music_http_requests_total",
		Help: "HTTP requests by method, path and status",
	}, []string{"method", "path", "status"})

	HTTPDurationSeconds = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "music_http_request_duration_seconds",
		Help:    "HTTP request latency",
		Buckets: prometheus.DefBuckets,
	}, []string{"method", "path"})
)
