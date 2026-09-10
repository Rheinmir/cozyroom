// IndexedDB-backed store for tracks downloaded to listen offline.
// Deliberately kept separate from the Service Worker cache (sw2.js) — touching
// Service Worker cache logic previously caused a real blank-page incident
// (Cloudflare overrode the no-cache header, leaving a stale precache stuck).
// This store never touches sw2.js or the Cache Storage API.

const DB_NAME = 'cozyroom-offline'
const DB_VERSION = 1
const STORE_NAME = 'offline_tracks'

export type OfflineQuality = 'lossless' | '320'

export type OfflineTrack = {
  trackId: string
  blob: Blob
  quality: OfflineQuality
  downloadedAt: number
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME, { keyPath: 'trackId' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function saveOfflineTrack(
  trackId: string, blob: Blob, quality: OfflineQuality,
): Promise<{ ok: true } | { ok: false; reason: 'quota' | 'unknown' }> {
  try {
    const db = await openDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put({ trackId, blob, quality, downloadedAt: Date.now() } satisfies OfflineTrack)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    return { ok: true }
  } catch (e) {
    const reason = e instanceof DOMException && e.name === 'QuotaExceededError' ? 'quota' : 'unknown'
    return { ok: false, reason }
  }
}

export async function getOfflineTrack(trackId: string): Promise<OfflineTrack | null> {
  try {
    const db = await openDB()
    return await new Promise<OfflineTrack | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(trackId)
      req.onsuccess = () => resolve(req.result ?? null)
      req.onerror = () => reject(req.error)
    })
  } catch {
    return null
  }
}

export async function deleteOfflineTrack(trackId: string): Promise<void> {
  const cachedUrl = objectUrlCache.get(trackId)
  if (cachedUrl) {
    URL.revokeObjectURL(cachedUrl)
    objectUrlCache.delete(trackId)
  }
  try {
    const db = await openDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).delete(trackId)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {}
}

export async function listOfflineTrackIds(): Promise<string[]> {
  try {
    const db = await openDB()
    return await new Promise<string[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).getAllKeys()
      req.onsuccess = () => resolve(req.result as string[])
      req.onerror = () => reject(req.error)
    })
  } catch {
    return []
  }
}

// Cache created object URLs per track so replaying the same offline track
// doesn't leak a fresh blob URL on every play — bounded by how many distinct
// tracks the user has downloaded, not by how many times they hit play.
const objectUrlCache = new Map<string, string>()

/** Returns a playable blob: URL for an offline track, or null if it isn't downloaded. */
export async function getOfflineObjectURL(trackId: string): Promise<string | null> {
  const cached = objectUrlCache.get(trackId)
  if (cached) return cached
  const rec = await getOfflineTrack(trackId)
  if (!rec) return null
  const url = URL.createObjectURL(rec.blob)
  objectUrlCache.set(trackId, url)
  return url
}
