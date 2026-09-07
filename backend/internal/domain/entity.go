// Package domain defines the core business entities and repository contracts.
// No package in this layer depends on infrastructure (sql, http, etc.).
package domain

// Artist represents a music artist.
type Artist struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	ImageURL string `json:"image_url,omitempty"`
}

// Album represents a music album belonging to an artist.
type Album struct {
	ID             string `json:"id"`
	ArtistID       string `json:"artist_id"`
	ArtistName     string `json:"artist_name"`
	Title          string `json:"title"`
	Year           int    `json:"year"`
	CoverURL       string `json:"cover_url"`
	ArtistImageURL string `json:"artist_image_url,omitempty"`
}

// Track represents a single audio track inside an album.
type Track struct {
	ID         string `json:"id"`
	AlbumID    string `json:"album_id"`
	Title      string `json:"title"`
	TrackNum   int    `json:"track_num"`
	DurationS  int    `json:"duration_s"`
	FilePath   string `json:"-"`
	Genre      string `json:"-"`
	ArtistName string `json:"artist_name"`
	AlbumTitle string `json:"album_title"`
	ArtistID   string `json:"artist_id"`
}

// TrackMeta is the metadata slice required by lyrics / lastfm lookups.
type TrackMeta struct {
	FilePath  string
	Title     string
	Artist    string
	Album     string
	DurationS int
}

// ArtistDetail contains aggregated info for a single artist page.
type ArtistDetail struct {
	ID         string   `json:"id"`
	Name       string   `json:"name"`
	AlbumCount int      `json:"album_count"`
	TrackCount int      `json:"track_count"`
	Genres     []string `json:"genres"`
}

// Stats holds library-wide counts.
type Stats struct {
	Artists int `json:"artists"`
	Albums  int `json:"albums"`
	Tracks  int `json:"tracks"`
}

// SearchResult groups search hits across all entity types.
type SearchResult struct {
	Artists []Artist       `json:"artists"`
	Albums  []SearchAlbum  `json:"albums"`
	Tracks  []SearchTrack  `json:"tracks"`
}

// SearchAlbum is the album shape returned by the search endpoint.
type SearchAlbum struct {
	ID         string `json:"id"`
	ArtistID   string `json:"artist_id"`
	ArtistName string `json:"artist_name"`
	Title      string `json:"title"`
	Year       int    `json:"year"`
	CoverURL   string `json:"cover_url"`
}

// SearchTrack is the track shape returned by the search endpoint.
type SearchTrack struct {
	ID         string `json:"id"`
	AlbumID    string `json:"album_id"`
	AlbumTitle string `json:"album_title"`
	Title      string `json:"title"`
	TrackNum   int    `json:"track_num"`
	ArtistName string `json:"artist_name"`
	DurationS  int    `json:"duration_s"`
	ArtistID   string `json:"artist_id"`
}

// Genre is a distinct track genre with a representative cover for browse grids.
type Genre struct {
	Name       string `json:"name"`
	TrackCount int    `json:"track_count"`
	CoverURL   string `json:"cover_url"`
}

// GenreDetail groups the albums and tracks tagged with one genre.
type GenreDetail struct {
	Albums []SearchAlbum `json:"albums"`
	Tracks []SearchTrack `json:"tracks"`
}

// Video represents a movie or video file.
type Video struct {
	ID             string `json:"id"`
	Title          string `json:"title"`
	DurationS      int    `json:"duration_s"`
	SizeBytes      int64  `json:"size_bytes"`
	FilePath       string `json:"-"`
	CreatedAt      int64  `json:"created_at"`
	TrickplayReady bool   `json:"trickplay_ready"`
	PosterURL      string `json:"poster_url,omitempty"`
	GroupName      string `json:"group_name,omitempty"`
}

// PlaybackProgress records the resume position for a track or video.
type PlaybackProgress struct {
	ItemType  string  `json:"item_type"`
	ItemID    string  `json:"item_id"`
	PositionS float64 `json:"position_s"`
	UpdatedAt int64   `json:"updated_at"`
}

// Ebook represents a digital book (EPUB or PDF).
type Ebook struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Author    string `json:"author"`
	Format    string `json:"format"` // "epub" or "pdf"
	SizeBytes int64  `json:"size_bytes"`
	FilePath  string `json:"-"`
	CoverURL  string `json:"cover_url,omitempty"`
	IsNSFW    bool   `json:"is_nsfw"`
	Collection string `json:"collection"`
	Progress  string `json:"progress"` // CFI for epub, page for pdf
	CreatedAt int64  `json:"created_at"`
}
