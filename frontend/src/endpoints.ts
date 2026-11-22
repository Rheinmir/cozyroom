// Canonical public paths for everything that is not a UI page.
//   API   : every JSON/REST call          /api/v1/...   (old /api/... still works)
//   MEDIA : bytes the player/img/video tags pull   /media/audio|video|hls|covers|...
// nginx and the Go server rewrite these to the old paths (nginx.conf, backend/internal/api/aliases.go).
export const API = '/api/v1'
export const MEDIA = '/media'
