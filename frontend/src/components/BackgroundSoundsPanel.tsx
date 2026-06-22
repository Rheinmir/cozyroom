import { useEffect, useRef } from 'react'
import { useBgSounds } from '../BgSoundsContext'

export default function BackgroundSoundsPanel() {
  const { sounds, active, volume, panelOpen, setPanelOpen, setActive, setVolume } = useBgSounds()
  const panelRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!panelOpen) return
    function onDown(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPanelOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [panelOpen, setPanelOpen])

  if (!panelOpen) return null

  return (
    <div className="bgsounds-panel" ref={panelRef}>
      <div className="bgsounds-header">
        <span className="bgsounds-icon">
          <svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor">
            <path d="M9 3.5a.5.5 0 0 0-.8-.4L4.5 6H2a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.5l3.7 2.9a.5.5 0 0 0 .8-.4V3.5zm3.7 1.8a.75.75 0 0 1 1.06.05A7 7 0 0 1 15.5 10a7 7 0 0 1-1.74 4.65.75.75 0 0 1-1.12-1A5.5 5.5 0 0 0 14 10a5.5 5.5 0 0 0-1.36-3.65.75.75 0 0 1 .06-1.05zm2.4-2.3a.75.75 0 0 1 1.06.04A10.5 10.5 0 0 1 18.5 10a10.5 10.5 0 0 1-2.34 6.56.75.75 0 0 1-1.16-.96A9 9 0 0 0 17 10a9 9 0 0 0-2-5.6.75.75 0 0 1 .1-1.1z"/>
          </svg>
        </span>
        <span className="bgsounds-title">Background Sounds</span>
        {active && <span className="bgsounds-active-name">{sounds.find(s => s.name === active)?.label ?? active}</span>}
        <button className="bgsounds-close" onClick={() => setPanelOpen(false)}>✕</button>
      </div>

      <ul className="bgsounds-list">
        {sounds.map(s => (
          <li
            key={s.name}
            className={'bgsounds-item' + (active === s.name ? ' bgsounds-item--active' : '')}
            onClick={() => setActive(active === s.name ? null : s.name)}
          >
            <span className="bgsounds-check">{active === s.name ? '✓' : ''}</span>
            <span className="bgsounds-label">{s.label}</span>
          </li>
        ))}
      </ul>

      <div className="bgsounds-volume">
        <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" opacity=".5">
          <path d="M9 2.5a.5.5 0 0 0-.8-.4L4.8 5H3a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h1.8l3.4 2.9a.5.5 0 0 0 .8-.4V2.5z"/>
        </svg>
        <input
          type="range"
          className="bgsounds-slider"
          min={0} max={1} step={0.01}
          value={volume}
          onChange={e => setVolume(parseFloat(e.target.value))}
        />
        <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" opacity=".7">
          <path d="M9 2.5a.5.5 0 0 0-.8-.4L4.8 5H3a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h1.8l3.4 2.9a.5.5 0 0 0 .8-.4V2.5zm2.8 1.3a.6.6 0 0 1 .85.04A5.5 5.5 0 0 1 14 8a5.5 5.5 0 0 1-1.35 3.66.6.6 0 1 1-.9-.8A4.3 4.3 0 0 0 12.8 8a4.3 4.3 0 0 0-1.05-2.86.6.6 0 0 1 .05-.85zm2.3-1.95a.6.6 0 0 1 .85.04A8.5 8.5 0 0 1 17 8a8.5 8.5 0 0 1-2.05 5.6.6.6 0 0 1-.92-.77A7.3 7.3 0 0 0 15.8 8a7.3 7.3 0 0 0-1.77-4.83.6.6 0 0 1 .07-.82z"/>
        </svg>
      </div>
    </div>
  )
}
