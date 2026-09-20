---
type: source
title: Chan doan phat chong 2 bai va MediaSession sai track (iOS)
status: diagnosed
tags: [player, audio, ios, race-condition, mediasession, diagnosis]
timestamp: 2026-09-02
---

# 020926-playback-double-audio-mediasession-diagnosis
**Type:** source
**Status:** diagnosed — chưa fix, chờ `/propose`
**Tags:** player, audio, ios, race-condition, mediasession
**Date:** 2026-09-02

## Triệu chứng (user báo)

1. Client đôi khi phát 2 bài hát cùng một lúc (nghe chồng tiếng nhau).
2. Media controller trên lock-screen iOS không bắt đúng track đang phát — hệ quả là đôi khi bấm pause xong thì bấm play lại không phát lại được nữa (phải force-quit/reload mới hết).

Cả 2 triệu chứng đều "đôi khi" (không phải luôn luôn) — đặc trưng của race condition, không phải lỗi logic tất định.

## Nguyên nhân gốc — 1 lỗ hổng chung, 2 hệ quả khác nhau

`startTrack()` trong `frontend/src/PlayerContext.tsx` (~dòng 340-406) có nhánh xử lý track không phải YouTube:

```js
const active  = activeSlot.current === 'A' ? audioA.current : audioB.current
const standby = activeSlot.current === 'A' ? audioB.current : audioA.current

getOfflineObjectURL(t.id).then(offlineUrl => {
  if (offlineUrl) { active.pause(); active.src = offlineUrl; active.play().catch(console.error); return }
  if (preloadedTrackId.current === t.id) {
    // seamless swap...
    active.pause(); active.removeAttribute('src'); active.load()
    activeSlot.current = activeSlot.current === 'A' ? 'B' : 'A'
    standby.play().catch(console.error)
  } else {
    active.src = streamUrl(t.id, resolveQuality(t.id, q), getClientId(), attemptIdRef.current)
    active.play().catch(console.error)
  }
})

preloadedTrackId.current = null   // <-- chạy NGAY SAU, đồng bộ, không chờ promise trên
retriesRef.current = {}
trackRef.current = t
setTrack(t)
...
```

`getOfflineObjectURL(t.id)` là async (tra cứu IndexedDB). Callback `.then(...)` **không hề kiểm tra xem lệnh `startTrack` này có còn là lệnh mới nhất hay không** trước khi gọi `active.play()` — không giống hệt logic retry trong `onError` (dòng ~530) đã có đúng guard này: `if (el !== getActive() || trackRef.current?.id !== tId) { return }`.

### Hệ quả A — Phát chồng 2 bài (double-audio)

Khi user chuyển bài nhanh (bấm next liên tục, hoặc auto-advance trong lúc user cũng vừa thao tác) **và** lệnh chuyển bài sau đó băng qua ranh giới local↔YouTube (2 họ audio element hoàn toàn tách biệt: `audioA`/`audioB` cho local, `audioYT` riêng cho YouTube):

1. `startTrack(trackLocal)` được gọi → chụp `active = audioA`, bắn `getOfflineObjectURL().then(cb1)` (đang chờ).
2. Trước khi `cb1` chạy, user chuyển sang 1 track YouTube → `startTrack(trackYT)` chạy nhánh YouTube: đồng bộ `audioA.pause(); audioB.pause(); audioYT.src=...; audioYT.play()` — YouTube bắt đầu phát.
3. `cb1` (bị bỏ quên) cuối cùng cũng chạy: **không biết** đã có track mới hơn tiếp quản, vô tư gọi `active.src = streamUrl(trackLocal...); active.play()` trên `audioA` — **audioA bắt đầu phát trackLocal trong khi audioYT vẫn đang phát trackYT** → nghe chồng 2 bài.

### Hệ quả B — MediaSession điều khiển sai track / pause xong không start lại được

MediaSession action handler (`useEffect` dòng ~767-794) chụp `const active = getActive()` một lần mỗi khi `track` đổi, rồi đóng gói handler `play`/`pause` quanh chính biến `active` đó — **không có `.catch()` cho `active.play()`** (khác mọi chỗ khác trong file, tất cả đều có `.play().catch(console.error)`, riêng dòng 783 thì không):

```js
navigator.mediaSession.setActionHandler('play', () => { active.play();  setPlaying(true)  })
```

Nếu callback mồ côi ở Hệ quả A đã từng chạy — nó có thể `active.removeAttribute('src'); active.load()` (nhánh seamless-swap) hoặc ghi đè `src` lên đúng phần tử mà MediaSession đang giữ tham chiếu, khiến phần tử đó rơi vào trạng thái không còn nguồn phát hợp lệ. Lúc đó user bấm pause (tắt được, vì `.pause()` luôn thành công) rồi bấm play lại: `active.play()` reject (không có nguồn hợp lệ hoặc bị request chồng) — **promise reject bị nuốt hoàn toàn vì không có `.catch()`**, nhưng `setPlaying(true)` vẫn chạy vô điều kiện ngay sau đó. Kết quả: state `isPlaying` báo `true` nhưng thực tế không có tiếng gì — đúng mô tả "pause xong không start lại được", đặc biệt dễ gặp trên iOS vì Safari mobile nghiêm ngặt hơn với `play()` bị gián đoạn/nguồn không hợp lệ so với desktop.

## Phát hiện phụ (liên quan, không phải nguyên nhân chính 2 triệu chứng trên)

`preloadedTrackId.current = null` chạy đồng bộ ngay sau khi đăng ký `.then(cb)` — nhưng promise `.then()` luôn chạy ở microtask kế tiếp, **sau** dòng này. Nghĩa là bên trong `cb`, điều kiện `preloadedTrackId.current === t.id` **luôn luôn `false`** (bị chính lệnh `startTrack` đang gọi nó xoá mất giá trị trước khi kịp đọc) — nhánh "seamless swap dùng standby đã preload" **chưa từng chạy được** với track online (chỉ có thể chạy với track offline vì nhánh đó tách riêng và return sớm). Hệ quả: `activeSlot.current` không bao giờ đổi khỏi `'A'` trong suốt phiên — toàn bộ cơ chế gapless preload từ [[GaplessPlayback]] hiện không phát huy tác dụng cho track online, mọi lần chuyển bài đều load lại từ đầu thay vì swap mượt sang standby đã buffer sẵn. Đây là bug thật, độc lập, nhưng không tự nó gây phát chồng — chỉ làm mất lợi ích gapless.

## Vì sao "đôi khi" chứ không phải luôn luôn

Cả 2 hệ quả đều cần: (a) `startTrack` được gọi lần 2 **trước khi** async callback của lần gọi trước đó kịp resolve — cửa sổ race này thường chỉ vài chục ms (thời gian tra IndexedDB), nên chỉ lộ ra khi user thao tác nhanh (bấm next liên tục, chuyển giữa track local/YouTube gần nhau), hoặc khi thiết bị chậm/mạng chập chờn kéo dài cửa sổ race đó ra. Đúng đặc điểm "đôi khi" user mô tả.

## Related
- [[GaplessPlayback]] — nguồn gốc kiến trúc dual-audio slot-swap
- [[280726-playback-chunk-repeat-ios-background-diagnosis]] — chẩn đoán các bug audio/iOS trước đó (nguyên nhân khác, đã fix, không trùng với race này)
- [[AudioReliability]] — retry logic có sẵn pattern guard đúng (`el !== getActive() || trackRef.current?.id !== tId`) mà `startTrack`'s offline-check đang thiếu

## Origin
- **Source:** Đọc trực tiếp `frontend/src/PlayerContext.tsx` (toàn bộ file, ~850 dòng) đối chiếu với báo cáo lỗi của user 2026-09-02, qua `/orca-workflow` → `/query` (không tìm thấy race condition này trong lịch sử wiki — 2 triệu chứng mới, khác 5 lần fix tháng 7)
- **Commit:** _(không áp dụng — đây là chẩn đoán, chưa có code fix)_
