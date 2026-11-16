// "The room's voice": short, TRUE, situational lines that address the listener
// directly — built only from data the app actually has (play counts, watch /
// read progress, the clock). Never generic filler: if there's nothing real to
// say, return null and the UI simply shows nothing.
import type { DailyPlayCount, TopPlayedTrack } from './api'
import type { Track } from './types'

export function relTime(ms: number): string {
  const s = Math.max(0, (Date.now() - ms) / 1000)
  if (s < 90) return 'vừa xong'
  if (s < 3600) return `${Math.round(s / 60)} phút trước`
  if (s < 6 * 3600) return `${Math.round(s / 3600)} giờ trước`
  const d0 = new Date(); d0.setHours(0, 0, 0, 0)
  if (ms >= d0.getTime()) return new Date(ms).getHours() < 12 ? 'sáng nay' : 'hôm nay'
  if (ms >= d0.getTime() - 86400_000) return 'hôm qua'
  const days = Math.round((d0.getTime() - ms) / 86400_000) + 1
  return days < 7 ? `${days} ngày trước` : days < 30 ? `${Math.round(days / 7)} tuần trước` : 'khá lâu rồi'
}

const todayKey = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** One line about the listener's day of listening, or null. */
export function listeningLine(daily: DailyPlayCount[], top: TopPlayedTrack[]): string | null {
  const h = new Date().getHours()
  const today = daily.find(d => d.date === todayKey())?.plays ?? 0
  const past = daily.filter(d => d.date !== todayKey())
  const yesterday = past[past.length - 1]
  const week = past.slice(-6)
  const fav = top[0]

  if (h < 5 && today > 0) return `Khuya rồi. Hôm nay bạn đã nghe ${today} bài — có lẽ nên chọn gì đó thật nhẹ.`
  if (today === 0) {
    return fav
      ? `Hôm nay căn phòng còn yên ắng. Mở đầu bằng “${fav.title}” như mọi khi nhé?`
      : 'Hôm nay căn phòng còn yên ắng.'
  }
  if (yesterday && week.length >= 3 && yesterday.plays >= Math.max(...week.map(d => d.plays)) && yesterday.plays > today) {
    return `Hôm nay bạn đã nghe ${today} bài. Hôm qua là ngày nghe nhiều nhất tuần — ${yesterday.plays} bài.`
  }
  if (fav && fav.plays >= 10) {
    return `Hôm nay bạn đã nghe ${today} bài. Dạo này “${fav.title}” cứ lặp lại mãi — ${fav.plays} lần rồi đấy.`
  }
  return `Hôm nay bạn đã nghe ${today} bài.`
}

/** Idle-player invitation: what the pill offers to play, and how it says it. */
export function idleInvite(top: TopPlayedTrack[]): { text: string; track: Track | null } {
  const h = new Date().getHours()
  const fav = top[0]
  if (!fav) return { text: h < 5 || h >= 22 ? 'Căn phòng đang yên lặng…' : 'Chọn một bài để căn phòng ấm lên', track: null }
  const albumId = fav.cover_url?.split('/').pop()?.split('?')[0] ?? ''
  const track: Track = { id: fav.id, title: fav.title, artist_name: fav.artist_name, album_id: albumId, album_title: fav.album_title, track_num: 0, duration_s: 0 }
  const verb = h < 5 ? 'Khuya rồi — nghe lại' : h < 11 ? 'Sáng nay bắt đầu với' : h >= 22 ? 'Tối rồi — nghe lại' : 'Nghe lại'
  return { text: `${verb} “${fav.title}”?`, track }
}
