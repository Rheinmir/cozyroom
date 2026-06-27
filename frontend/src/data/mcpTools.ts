export interface McpTool {
  name: string
  description: string
  category: string
  categoryColor: string
  uiRoute: string
  prompt: string
  flow: string[]  // step-by-step usage guide
}

export const MCP_TOOLS: McpTool[] = [
  {
    name: 'search_music', category: '🎵 Music', categoryColor: '#1db954', uiRoute: '/', prompt: 'tìm bài hát ',
    description: 'Tìm bài hát, nghệ sĩ, album trong thư viện',
    flow: ['Nhận tên bài / nghệ sĩ từ user', 'Gọi search_music(query=...)', 'Lấy id từ kết quả tracks[]', 'Dùng id đó cho play_track hoặc add_to_playlist'],
  },
  {
    name: 'list_artists', category: '🎵 Music', categoryColor: '#1db954', uiRoute: '/', prompt: 'xem danh sách nghệ sĩ',
    description: 'Liệt kê tất cả nghệ sĩ trong thư viện',
    flow: ['Gọi list_artists()', 'Nhận danh sách artists[]', 'Dùng id nghệ sĩ cho get_artist hoặc list_albums'],
  },
  {
    name: 'get_artist', category: '🎵 Music', categoryColor: '#1db954', uiRoute: '/', prompt: 'xem thông tin nghệ sĩ ',
    description: 'Xem chi tiết nghệ sĩ: album, số bài, thể loại',
    flow: ['Có artist id (từ list_artists hoặc search_music)', 'Gọi get_artist(id=...)', 'Nhận album_count, track_count, genres'],
  },
  {
    name: 'list_albums', category: '🎵 Music', categoryColor: '#1db954', uiRoute: '/', prompt: 'xem album của nghệ sĩ ',
    description: 'Liệt kê album theo nghệ sĩ',
    flow: ['Cần artist_id', 'Gọi list_albums(artist_id=...)', 'Nhận albums[] với id, title, year', 'Dùng album_id cho list_tracks'],
  },
  {
    name: 'list_tracks', category: '🎵 Music', categoryColor: '#1db954', uiRoute: '/', prompt: 'xem bài hát trong album ',
    description: 'Liệt kê bài hát theo album',
    flow: ['Cần album_id', 'Gọi list_tracks(album_id=...)', 'Nhận tracks[] với id, title, duration_s', 'Dùng id cho play_track'],
  },
  {
    name: 'scan_library', category: '🎵 Music', categoryColor: '#1db954', uiRoute: '/', prompt: 'quét lại thư viện nhạc',
    description: 'Quét lại thư viện để cập nhật bài mới',
    flow: ['Gọi scan_library()', 'Chờ trả về tracks_scanned', 'KHÔNG cần gọi trước khi download_youtube — download tự index'],
  },
  {
    name: 'play_track', category: '▶️ Player', categoryColor: '#f59e0b', uiRoute: '/', prompt: 'phát bài ',
    description: 'Phát một bài hát từ thư viện',
    flow: ['Lấy track id từ search_music hoặc list_tracks', 'Gọi play_track(id=...) — KHÔNG dùng playlist_id ở đây', 'Trả về _frontend_action → player bắt đầu phát'],
  },
  {
    name: 'toggle_play', category: '▶️ Player', categoryColor: '#f59e0b', uiRoute: '/', prompt: 'tạm dừng / tiếp tục nhạc',
    description: 'Phát / Tạm dừng nhạc đang phát',
    flow: ['Gọi toggle_play() — không cần tham số', 'Player tự toggle pause/resume'],
  },
  {
    name: 'next_track', category: '▶️ Player', categoryColor: '#f59e0b', uiRoute: '/', prompt: 'bài tiếp theo',
    description: 'Chuyển sang bài tiếp theo',
    flow: ['Gọi next_track() — không cần tham số', 'Player chuyển sang bài kế trong queue'],
  },
  {
    name: 'prev_track', category: '▶️ Player', categoryColor: '#f59e0b', uiRoute: '/', prompt: 'bài trước',
    description: 'Quay lại bài trước',
    flow: ['Gọi prev_track() — không cần tham số'],
  },
  {
    name: 'set_shuffle_mode', category: '▶️ Player', categoryColor: '#f59e0b', uiRoute: '/', prompt: 'bật shuffle ngẫu nhiên',
    description: 'Đặt chế độ phát ngẫu nhiên',
    flow: ['mode có 3 giá trị: "off" | "shuffle" | "smart"', 'Gọi set_shuffle_mode(mode="smart") để bật Smart Mix', 'smart = AI tự chọn bài tiếp theo dựa trên context'],
  },
  {
    name: 'set_repeat', category: '▶️ Player', categoryColor: '#f59e0b', uiRoute: '/', prompt: 'bật repeat',
    description: 'Đặt chế độ lặp',
    flow: ['mode: "off" | "one" | "all"', 'Gọi set_repeat(mode="all") để lặp toàn bộ queue'],
  },
  {
    name: 'list_playlists', category: '📋 Playlist', categoryColor: '#8b5cf6', uiRoute: '/playlists', prompt: 'xem danh sách playlist',
    description: 'Liệt kê tất cả playlist',
    flow: ['Gọi list_playlists()', 'Nhận playlists[] với id, name, track_count', 'Dùng id cho play_playlist, add_to_playlist'],
  },
  {
    name: 'create_playlist', category: '📋 Playlist', categoryColor: '#8b5cf6', uiRoute: '/playlists', prompt: 'tạo playlist tên ',
    description: 'Tạo playlist mới',
    flow: ['Gọi create_playlist(name=...)', 'Nhận playlist_id — ĐÂY LÀ PLAYLIST ID, không phải track id', 'Dùng playlist_id này cho add_to_playlist và play_playlist', 'KHÔNG dùng playlist_id cho play_track'],
  },
  {
    name: 'add_to_playlist', category: '📋 Playlist', categoryColor: '#8b5cf6', uiRoute: '/playlists', prompt: 'thêm bài vào playlist ',
    description: 'Thêm bài hát vào playlist',
    flow: ['Cần playlist_id (từ create_playlist hoặc list_playlists)', 'Cần track_id (từ search_music hoặc list_tracks — KHÔNG dùng playlist_id)', 'Gọi add_to_playlist(playlist_id=..., track_id=...)'],
  },
  {
    name: 'play_playlist', category: '📋 Playlist', categoryColor: '#8b5cf6', uiRoute: '/playlists', prompt: 'phát playlist ',
    description: 'Phát toàn bộ playlist',
    flow: ['Có playlist_id', 'Gọi play_playlist(playlist_id=...)', 'Playlist phải có ít nhất 1 bài — nếu empty sẽ báo lỗi'],
  },
  {
    name: 'remove_from_playlist', category: '📋 Playlist', categoryColor: '#8b5cf6', uiRoute: '/playlists', prompt: 'xóa bài khỏi playlist ',
    description: 'Xóa bài hát khỏi playlist',
    flow: ['Cần playlist_id và track_id', 'Gọi remove_from_playlist(playlist_id=..., track_id=...)'],
  },
  {
    name: 'delete_playlist', category: '📋 Playlist', categoryColor: '#8b5cf6', uiRoute: '/playlists', prompt: 'xóa playlist ',
    description: 'Xóa toàn bộ playlist',
    flow: ['Cần playlist_id', 'Gọi delete_playlist(playlist_id=...) — xóa cả tracks trong playlist'],
  },
  {
    name: 'search_youtube', category: '📺 YouTube', categoryColor: '#ef4444', uiRoute: '/search', prompt: 'tìm trên YouTube ',
    description: 'Tìm kiếm video / nhạc trên YouTube',
    flow: ['Gọi search_youtube(query=...)', 'Nhận results[] với id, title, artist, duration', 'Dùng id cho download_youtube hoặc play_youtube_stream'],
  },
  {
    name: 'download_youtube', category: '📺 YouTube', categoryColor: '#ef4444', uiRoute: '/ai', prompt: 'tải nhạc từ YouTube ',
    description: 'Tải audio từ YouTube về thư viện — đồng bộ, index ngay',
    flow: ['Có YouTube video id (từ search_youtube)', 'Gọi download_youtube(id=..., title=..., artist=...)', 'Nhận track_id — dùng NGAY cho add_to_playlist KHÔNG cần search_music lại', 'KHÔNG cần gọi scan_library sau khi download'],
  },
  {
    name: 'play_youtube_stream', category: '📺 YouTube', categoryColor: '#ef4444', uiRoute: '/ai', prompt: 'phát YouTube trực tiếp ',
    description: 'Stream và phát nhạc từ YouTube ngay (không lưu)',
    flow: ['Có YouTube video id', 'Gọi play_youtube_stream(id=..., title=..., artist=...)', 'Phát trực tiếp — bài không được lưu vào thư viện'],
  },
  {
    name: 'get_trending', category: '📈 Trending', categoryColor: '#06b6d4', uiRoute: '/trending', prompt: 'xem trending GitHub hôm nay',
    description: 'Xem repo GitHub trending theo ngày',
    flow: ['Gọi get_trending() hoặc get_trending(date="YYYY-MM-DD")', 'Nhận repos[] với name, stars, impact_score, problem_solved'],
  },
  {
    name: 'get_stats', category: '📊 Analytics', categoryColor: '#ec4899', uiRoute: '/ai/stats', prompt: 'xem thống kê tổng quan AI',
    description: 'Thống kê token, model, lỗi',
    flow: ['Gọi get_stats()', 'Nhận summary: total, failed, tokens_in, tokens_out, avg_ms'],
  },
  {
    name: 'get_ai_analytics', category: '📊 Analytics', categoryColor: '#ec4899', uiRoute: '/ai/stats', prompt: 'phân tích chi tiết AI',
    description: 'Phân tích chi tiết hoạt động AI',
    flow: ['Gọi get_ai_analytics()', 'Nhận daily stats, model distribution, provider stats'],
  },
  {
    name: 'get_ai_logs', category: '📊 Analytics', categoryColor: '#ec4899', uiRoute: '/ai/stats', prompt: 'xem AI logs gần đây',
    description: 'Xem lịch sử chat và lỗi',
    flow: ['Gọi get_ai_logs() hoặc get_ai_logs(failed=true) để lọc lỗi', 'Nhận logs[] với user_msg, ai_msg, tokens, fail_reason'],
  },
  {
    name: 'get_ai_extremes', category: '📊 Analytics', categoryColor: '#ec4899', uiRoute: '/ai/stats', prompt: 'xem request tốn token nhất',
    description: 'Tìm request tốn nhiều / ít token nhất',
    flow: ['Gọi get_ai_extremes()', 'Nhận most_expensive và cheapest request'],
  },
  {
    name: 'remember', category: '🧠 Memory', categoryColor: '#10b981', uiRoute: '/ai', prompt: 'ghi nhớ rằng ',
    description: 'Lưu thông tin vào bộ nhớ dài hạn',
    flow: ['Khi user chia sẻ sở thích / thói quen / thông tin cá nhân', 'Gọi remember(key=..., value=...) ngay trong turn đó', 'key nên ngắn gọn, dễ recall sau này'],
  },
  {
    name: 'recall', category: '🧠 Memory', categoryColor: '#10b981', uiRoute: '/ai', prompt: 'tìm trong bộ nhớ ',
    description: 'Tìm kiếm thông tin đã ghi nhớ',
    flow: ['Gọi recall(query=...) TRƯỚC khi trả lời nếu cần context user', 'Nhận facts[] phù hợp với query', 'Dùng kết quả để cá nhân hóa câu trả lời'],
  },
  {
    name: 'forget', category: '🧠 Memory', categoryColor: '#10b981', uiRoute: '/ai', prompt: 'xóa khỏi bộ nhớ ',
    description: 'Xóa thông tin khỏi bộ nhớ',
    flow: ['Gọi forget(key=...) với key chính xác', 'Nên recall trước để biết đúng key cần xóa'],
  },
  {
    name: 'web_search', category: '🌐 Web', categoryColor: '#64748b', uiRoute: '/ai', prompt: 'tìm trên web ',
    description: 'Tìm kiếm thông tin trên internet',
    flow: ['Gọi web_search(query=...)', 'Nhận results[] với title, url, snippet', 'Tổng hợp kết quả trả lời user'],
  },
  {
    name: 'browse_url', category: '🌐 Web', categoryColor: '#64748b', uiRoute: '/ai', prompt: 'đọc trang web ',
    description: 'Truy cập và đọc nội dung trang web',
    flow: ['Gọi browse_url(url=...)', 'Nhận text content của trang', 'Tóm tắt hoặc trích xuất thông tin cần thiết'],
  },
  {
    name: 'schedule_agent_task', category: '⚙️ System', categoryColor: '#94a3b8', uiRoute: '/ai', prompt: 'lên lịch task AI ',
    description: 'Lên lịch tác vụ AI chạy theo cron',
    flow: ['Gọi schedule_agent_task(cron=..., prompt=...)', 'cron format: "0 8 * * *" = 8am mỗi ngày', 'Nhận task_id để quản lý sau'],
  },
  {
    name: 'get_scheduled_tasks', category: '⚙️ System', categoryColor: '#94a3b8', uiRoute: '/ai', prompt: 'xem task đã lên lịch',
    description: 'Liệt kê các task AI đã lên lịch',
    flow: ['Gọi get_scheduled_tasks()', 'Nhận tasks[] với id, cron, prompt, last_run_at'],
  },
  {
    name: 'delete_scheduled_task', category: '⚙️ System', categoryColor: '#94a3b8', uiRoute: '/ai', prompt: 'xóa task lên lịch ',
    description: 'Xóa task AI khỏi lịch',
    flow: ['Cần task_id (từ get_scheduled_tasks)', 'Gọi delete_scheduled_task(id=...)'],
  },
  {
    name: 'create_custom_skill', category: '⚙️ System', categoryColor: '#94a3b8', uiRoute: '/ai', prompt: 'tạo skill mới tên ',
    description: 'Tạo skill / tool tùy chỉnh cho AI',
    flow: ['Gọi create_custom_skill(name=..., description=..., steps=[...])', 'Skill được lưu và dùng được ngay trong session tiếp theo'],
  },
  {
    name: 'list_ambient_sounds', category: '🔊 Ambient', categoryColor: '#6366f1', uiRoute: '/ai', prompt: 'xem danh sách âm thanh nền',
    description: 'Liệt kê các âm thanh nền khả dụng (rain, ocean, fire...)',
    flow: ['Gọi list_ambient_sounds()', 'Nhận sounds[] với name và label', 'Dùng name cho play_ambient_sound'],
  },
  {
    name: 'play_ambient_sound', category: '🔊 Ambient', categoryColor: '#6366f1', uiRoute: '/ai', prompt: 'bật âm thanh nền ',
    description: 'Phát âm thanh nền (mưa, sóng biển, lửa...)',
    flow: ['Gọi list_ambient_sounds() để lấy danh sách', 'Gọi play_ambient_sound(name="rain", volume=0.3)', 'volume tuỳ chọn, mặc định 0.3'],
  },
  {
    name: 'stop_ambient_sound', category: '🔊 Ambient', categoryColor: '#6366f1', uiRoute: '/ai', prompt: 'tắt âm thanh nền',
    description: 'Dừng âm thanh nền đang phát',
    flow: ['Gọi stop_ambient_sound() — không cần tham số'],
  },
]
