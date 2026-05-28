package enricher

import "context"

// ArtistImageProvider fetches a remote image URL for an artist.
type ArtistImageProvider interface {
	ArtistImageURL(ctx context.Context, artistName string) (string, error)
}

// VideoPosterProvider fetches a remote poster image URL for a video title.
type VideoPosterProvider interface {
	VideoPosterURL(ctx context.Context, title string) (string, error)
}
