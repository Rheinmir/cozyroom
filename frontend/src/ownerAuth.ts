// The owner password is never in this bundle. The server decides (GET /api/owner/check).
// The typed password is kept in sessionStorage only (gone when the tab closes) and sent as a header.
import { API } from './endpoints'

export const OWNER_PW_KEY = 'cozyroom_owner_password'

// Old builds kept the typed password in localStorage for good: drop it.
try { localStorage.removeItem('ebook-nsfw-pass') } catch { /* private mode */ }

export const getOwnerPw = (): string => sessionStorage.getItem(OWNER_PW_KEY) || ''
export const setOwnerPw = (pw: string) => sessionStorage.setItem(OWNER_PW_KEY, pw)
export const clearOwnerPw = () => sessionStorage.removeItem(OWNER_PW_KEY)

// 204 = right password. Any other answer (401, 429, network error) = not accepted.
export async function checkOwner(pw: string): Promise<boolean> {
  if (!pw) return false
  try {
    const r = await fetch(`${API}/owner/check`, { headers: { 'X-Owner-Password': pw } })
    return r.status === 204
  } catch {
    return false
  }
}
