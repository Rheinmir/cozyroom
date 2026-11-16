// The artist-image source hands back a generic grey "person silhouette" when it
// has no real photo. On the dark canvas those read as glaring white discs, so
// detect them and let callers fall back to the gradient + initial avatar.
// Signature: the silhouette's flat background rgb(235,232,239) covers ~75% of
// the frame; real photos (even white-background ones) never sit on that exact
// lavender-grey for most of their pixels.
const BG = [235, 232, 239]

export function isPlaceholderAvatar(img: HTMLImageElement): boolean {
  try {
    const c = document.createElement('canvas')
    c.width = c.height = 24
    const ctx = c.getContext('2d', { willReadFrequently: true })
    if (!ctx) return false
    ctx.drawImage(img, 0, 0, 24, 24)
    const d = ctx.getImageData(0, 0, 24, 24).data
    let hit = 0
    for (let i = 0; i < d.length; i += 4) {
      if (Math.abs(d[i] - BG[0]) <= 4 && Math.abs(d[i + 1] - BG[1]) <= 4 && Math.abs(d[i + 2] - BG[2]) <= 4) hit++
    }
    return hit / (d.length / 4) >= 0.6
  } catch {
    return false // tainted canvas (cross-origin) — keep the image
  }
}
