# 230626-background-sounds

**Status:** done
**Sequence diagram:** [html/230626-background-sounds-seq.html](../../../html/230626-background-sounds-seq.html)

## Context

Feature: phát background sound như macOS Accessibility → Hearing → Background Sounds.
8 loại âm thanh: Balanced Noise, Bright Noise, Dark Noise, Ocean, Rain, Stream, Night, Fire.
Truy cập nhanh qua RadialNav (floating bubble) + icon button ở PlayerBar.

**Về file macOS gốc:**
macOS lưu background sounds tại `/System/Library/Accessibility/Sounds/` (Monterey+) dạng `.m4a`.
User copy vào `backend/sounds/ambient/` để dùng. Noise types (Balanced/Bright/Dark) generate
bằng Web Audio API — không cần file.

## Plan

- [ ] Task 1: Backend Go — `GET /api/ambient-sounds` list + `GET /api/ambient-sounds/:name` stream file
- [ ] Task 2: `useBackgroundSounds` hook — noise gen (WebAudio) + ambient file playback, loop, volume, persist
- [ ] Task 3: `BackgroundSoundsPanel` component — macOS-style dark-glass dropdown (list + checkmark + volume slider)
- [ ] Task 4: PlayerBar icon + RadialNav petal integration

## Agent Task Assignment

| Task | Agent | Model | Status |
|------|-------|-------|--------|
| T1: Go backend ambient-sounds endpoint | Claude main | claude-sonnet-4-6 | done |
| T2: useBackgroundSounds hook (noise + file) | Claude main | claude-sonnet-4-6 | done |
| T3: BackgroundSoundsPanel component | Claude main | claude-sonnet-4-6 | done |
| T4: PlayerBar icon + RadialNav petal | Claude main | claude-sonnet-4-6 | done |

## Files sẽ tạo/sửa

| File | Action | Lý do |
|------|--------|-------|
| `backend/handler_ambient.go` | create | API endpoint list + stream |
| `backend/router.go` | modify | đăng ký route /api/ambient-sounds |
| `frontend/src/hooks/useBackgroundSounds.ts` | create | hook quản lý noise + file playback |
| `frontend/src/components/BackgroundSoundsPanel.tsx` | create | UI macOS-style dropdown |
| `frontend/src/components/PlayerBar.tsx` | modify | thêm icon button trigger |
| `frontend/src/components/RadialNav.tsx` | modify | thêm petal "Sounds" inner ring |
| `backend/sounds/ambient/.gitkeep` | create | placeholder cho user drop macOS files |

## Sounds

| Name | Type | Source |
|------|------|--------|
| Balanced Noise | Pink noise | Web Audio API |
| Bright Noise | White noise | Web Audio API |
| Dark Noise | Brown noise | Web Audio API |
| Ocean | File loop | `backend/sounds/ambient/ocean.m4a` |
| Rain | File loop | `backend/sounds/ambient/rain.m4a` |
| Stream | File loop | `backend/sounds/ambient/stream.m4a` |
| Night | File loop | `backend/sounds/ambient/night.m4a` |
| Fire | File loop | `backend/sounds/ambient/fire.m4a` |

## Risks

- macOS audio files là system files, user tự copy vào backend/sounds/ambient/ — không bundle vào repo
- Nếu file không tồn tại, API trả 404 → frontend ẩn option đó (không crash)
- Web Audio API noise generation chạy trên main thread nhẹ (~1% CPU), dùng ScriptProcessorNode hoặc AudioWorklet
- RadialNav đã có nhiều petal — cần test không bị overlap

## Origin

- **Draft:** `wiki/draft/orca/230626-background-sounds.md`
- **Commit:** _(filled by verify-before-commit)_
- **Date promoted:** _(filled by verify-before-commit)_
