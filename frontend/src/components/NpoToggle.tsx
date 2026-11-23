import { useRef } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'

type Opt<T extends string> = { value: T; label: string; icon: ReactNode }

// Two-way switch between the two versions of the Now Playing screen (Vinyl | Lyrics).
// Radio-group semantics: one checked option, roving tabindex, Left/Right/Up/Down/Home/End move and select.
export default function NpoToggle<T extends string>({ value, options, onChange, label }: {
  value: T
  options: [Opt<T>, Opt<T>]
  onChange: (v: T) => void
  label: string
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = options.findIndex(o => o.value === value)
    let n = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % options.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i - 1 + options.length) % options.length
    else if (e.key === 'Home') n = 0
    else if (e.key === 'End') n = options.length - 1
    if (n < 0) return
    e.preventDefault()
    onChange(options[n].value)
    refs.current[n]?.focus()
  }

  return (
    <div className="npo-toggle" role="radiogroup" aria-label={label} onKeyDown={onKey}>
      {options.map((o, i) => (
        <button
          key={o.value}
          ref={el => { refs.current[i] = el }}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          tabIndex={o.value === value ? 0 : -1}
          onClick={() => onChange(o.value)}
        >
          {o.icon}
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  )
}
