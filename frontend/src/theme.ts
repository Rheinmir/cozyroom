// App theme: 'dark' is the :root default, the others are :root[data-theme="..."] in index.css.
// The saved choice is applied before first paint by the inline script in index.html (keep both lists in sync).
export type Theme = 'dark' | 'light' | 'warm'
export const THEMES: Theme[] = ['dark', 'light', 'warm']
const KEY = 'cozyroom-theme'

export function getTheme(): Theme {
  try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'warm' ? v : 'dark' } catch { return 'dark' }
}

export function setTheme(t: Theme) {
  try { localStorage.setItem(KEY, t) } catch { /* private mode: the theme just will not persist */ }
  if (t === 'dark') document.documentElement.removeAttribute('data-theme')
  else document.documentElement.setAttribute('data-theme', t)
}
