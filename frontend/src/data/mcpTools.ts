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
    name: 'search_music', category: 'ðŸŽµ Music', categoryColor: '#dddddd', uiRoute: '/', prompt: 'tÃ¬m bÃ i hÃ¡t ',
    description: 'TÃ¬m bÃ i hÃ¡t, nghá»‡ sÄ©, album trong thÆ° viá»‡n',
    flow: ['Nháº­n tÃªn bÃ i / nghá»‡ sÄ© tá»« user', 'Gá»i search_music(query=...)', 'Láº¥y id tá»« káº¿t quáº£ tracks[]', 'DÃ¹ng id Ä‘Ã³ cho play_track hoáº·c add_to_playlist'],
  },
  {
    name: 'list_artists', category: 'ðŸŽµ Music', categoryColor: '#dddddd', uiRoute: '/', prompt: 'xem danh sÃ¡ch nghá»‡ sÄ©',
    description: 'Liá»‡t kÃª táº¥t cáº£ nghá»‡ sÄ© trong thÆ° viá»‡n',
    flow: ['Gá»i list_artists()', 'Nháº­n danh sÃ¡ch artists[]', 'DÃ¹ng id nghá»‡ sÄ© cho get_artist hoáº·c list_albums'],
  },
  {
    name: 'get_artist', category: 'ðŸŽµ Music', categoryColor: '#dddddd', uiRoute: '/', prompt: 'xem thÃ´ng tin nghá»‡ sÄ© ',
    description: 'Xem chi tiáº¿t nghá»‡ sÄ©: album, sá»‘ bÃ i, thá»ƒ loáº¡i',
    flow: ['CÃ³ artist id (tá»« list_artists hoáº·c search_music)', 'Gá»i get_artist(id=...)', 'Nháº­n album_count, track_count, genres'],
  },
  {
    name: 'list_albums', category: 'ðŸŽµ Music', categoryColor: '#dddddd', uiRoute: '/', prompt: 'xem album cá»§a nghá»‡ sÄ© ',
    description: 'Liá»‡t kÃª album theo nghá»‡ sÄ©',
    flow: ['Cáº§n artist_id', 'Gá»i list_albums(artist_id=...)', 'Nháº­n albums[] vá»›i id, title, year', 'DÃ¹ng album_id cho list_tracks'],
  },
  {
    name: 'list_tracks', category: 'ðŸŽµ Music', categoryColor: '#dddddd', uiRoute: '/', prompt: 'xem bÃ i hÃ¡t trong album ',
    description: 'Liá»‡t kÃª bÃ i hÃ¡t theo album',
    flow: ['Cáº§n album_id', 'Gá»i list_tracks(album_id=...)', 'Nháº­n tracks[] vá»›i id, title, duration_s', 'DÃ¹ng id cho play_track'],
  },
  {
    name: 'scan_library', category: 'ðŸŽµ Music', categoryColor: '#dddddd', uiRoute: '/', prompt: 'quÃ©t láº¡i thÆ° viá»‡n nháº¡c',
    description: 'QuÃ©t láº¡i thÆ° viá»‡n Ä‘á»ƒ cáº­p nháº­t bÃ i má»›i',
    flow: ['Gá»i scan_library()', 'Chá» tráº£ vá» tracks_scanned', 'KHÃ”NG cáº§n gá»i trÆ°á»›c khi download_youtube â€” download tá»± index'],
  },
  {
    name: 'play_track', category: 'â–¶ï¸ Player', categoryColor: '#bbbbbb', uiRoute: '/', prompt: 'phÃ¡t bÃ i ',
    description: 'PhÃ¡t má»™t bÃ i hÃ¡t tá»« thÆ° viá»‡n',
    flow: ['Láº¥y track id tá»« search_music hoáº·c list_tracks', 'Gá»i play_track(id=...) â€” KHÃ”NG dÃ¹ng playlist_id á»Ÿ Ä‘Ã¢y', 'Tráº£ vá» _frontend_action â†’ player báº¯t Ä‘áº§u phÃ¡t'],
  },
  {
    name: 'toggle_play', category: 'â–¶ï¸ Player', categoryColor: '#bbbbbb', uiRoute: '/', prompt: 'táº¡m dá»«ng / tiáº¿p tá»¥c nháº¡c',
    description: 'PhÃ¡t / Táº¡m dá»«ng nháº¡c Ä‘ang phÃ¡t',
    flow: ['Gá»i toggle_play() â€” khÃ´ng cáº§n tham sá»‘', 'Player tá»± toggle pause/resume'],
  },
  {
    name: 'next_track', category: 'â–¶ï¸ Player', categoryColor: '#bbbbbb', uiRoute: '/', prompt: 'bÃ i tiáº¿p theo',
    description: 'Chuyá»ƒn sang bÃ i tiáº¿p theo',
    flow: ['Gá»i next_track() â€” khÃ´ng cáº§n tham sá»‘', 'Player chuyá»ƒn sang bÃ i káº¿ trong queue'],
  },
  {
    name: 'prev_track', category: 'â–¶ï¸ Player', categoryColor: '#bbbbbb', uiRoute: '/', prompt: 'bÃ i trÆ°á»›c',
    description: 'Quay láº¡i bÃ i trÆ°á»›c',
    flow: ['Gá»i prev_track() â€” khÃ´ng cáº§n tham sá»‘'],
  },
  {
    name: 'set_shuffle_mode', category: 'â–¶ï¸ Player', categoryColor: '#bbbbbb', uiRoute: '/', prompt: 'báº­t shuffle ngáº«u nhiÃªn',
    description: 'Äáº·t cháº¿ Ä‘á»™ phÃ¡t ngáº«u nhiÃªn',
    flow: ['mode cÃ³ 3 giÃ¡ trá»‹: "off" | "shuffle" | "smart"', 'Gá»i set_shuffle_mode(mode="smart") Ä‘á»ƒ báº­t Smart Mix', 'smart = AI tá»± chá»n bÃ i tiáº¿p theo dá»±a trÃªn context'],
  },
  {
    name: 'set_repeat', category: 'â–¶ï¸ Player', categoryColor: '#bbbbbb', uiRoute: '/', prompt: 'báº­t repeat',
    description: 'Äáº·t cháº¿ Ä‘á»™ láº·p',
    flow: ['mode: "off" | "one" | "all"', 'Gá»i set_repeat(mode="all") Ä‘á»ƒ láº·p toÃ n bá»™ queue'],
  },
  {
    name: 'list_playlists', category: 'ðŸ“‹ Playlist', categoryColor: '#999999', uiRoute: '/playlists', prompt: 'xem danh sÃ¡ch playlist',
    description: 'Liá»‡t kÃª táº¥t cáº£ playlist',
    flow: ['Gá»i list_playlists()', 'Nháº­n playlists[] vá»›i id, name, track_count', 'DÃ¹ng id cho play_playlist, add_to_playlist'],
  },
  {
    name: 'create_playlist', category: 'ðŸ“‹ Playlist', categoryColor: '#999999', uiRoute: '/playlists', prompt: 'táº¡o playlist tÃªn ',
    description: 'Táº¡o playlist má»›i',
    flow: ['Gá»i create_playlist(name=...)', 'Nháº­n playlist_id â€” ÄÃ‚Y LÃ€ PLAYLIST ID, khÃ´ng pháº£i track id', 'DÃ¹ng playlist_id nÃ y cho add_to_playlist vÃ  play_playlist', 'KHÃ”NG dÃ¹ng playlist_id cho play_track'],
  },
  {
    name: 'add_to_playlist', category: 'ðŸ“‹ Playlist', categoryColor: '#999999', uiRoute: '/playlists', prompt: 'thÃªm bÃ i vÃ o playlist ',
    description: 'ThÃªm bÃ i hÃ¡t vÃ o playlist',
    flow: ['Cáº§n playlist_id (tá»« create_playlist hoáº·c list_playlists)', 'Cáº§n track_id (tá»« search_music hoáº·c list_tracks â€” KHÃ”NG dÃ¹ng playlist_id)', 'Gá»i add_to_playlist(playlist_id=..., track_id=...)'],
  },
  {
    name: 'play_playlist', category: 'ðŸ“‹ Playlist', categoryColor: '#999999', uiRoute: '/playlists', prompt: 'phÃ¡t playlist ',
    description: 'PhÃ¡t toÃ n bá»™ playlist',
    flow: ['CÃ³ playlist_id', 'Gá»i play_playlist(playlist_id=...)', 'Playlist pháº£i cÃ³ Ã­t nháº¥t 1 bÃ i â€” náº¿u empty sáº½ bÃ¡o lá»—i'],
  },
  {
    name: 'remove_from_playlist', category: 'ðŸ“‹ Playlist', categoryColor: '#999999', uiRoute: '/playlists', prompt: 'xÃ³a bÃ i khá»i playlist ',
    description: 'XÃ³a bÃ i hÃ¡t khá»i playlist',
    flow: ['Cáº§n playlist_id vÃ  track_id', 'Gá»i remove_from_playlist(playlist_id=..., track_id=...)'],
  },
  {
    name: 'delete_playlist', category: 'ðŸ“‹ Playlist', categoryColor: '#999999', uiRoute: '/playlists', prompt: 'xÃ³a playlist ',
    description: 'XÃ³a toÃ n bá»™ playlist',
    flow: ['Cáº§n playlist_id', 'Gá»i delete_playlist(playlist_id=...) â€” xÃ³a cáº£ tracks trong playlist'],
  },
  {
    name: 'search_youtube', category: 'ðŸ“º YouTube', categoryColor: '#777777', uiRoute: '/search', prompt: 'tÃ¬m trÃªn YouTube ',
    description: 'TÃ¬m kiáº¿m video / nháº¡c trÃªn YouTube',
    flow: ['Gá»i search_youtube(query=...)', 'Nháº­n results[] vá»›i id, title, artist, duration', 'DÃ¹ng id cho download_youtube hoáº·c play_youtube_stream'],
  },
  {
    name: 'download_youtube', category: 'ðŸ“º YouTube', categoryColor: '#777777', uiRoute: '/ai', prompt: 'táº£i nháº¡c tá»« YouTube ',
    description: 'Táº£i audio tá»« YouTube vá» thÆ° viá»‡n â€” Ä‘á»“ng bá»™, index ngay',
    flow: ['CÃ³ YouTube video id (tá»« search_youtube)', 'Gá»i download_youtube(id=..., title=..., artist=...)', 'Nháº­n track_id â€” dÃ¹ng NGAY cho add_to_playlist KHÃ”NG cáº§n search_music láº¡i', 'KHÃ”NG cáº§n gá»i scan_library sau khi download'],
  },
  {
    name: 'play_youtube_stream', category: 'ðŸ“º YouTube', categoryColor: '#777777', uiRoute: '/ai', prompt: 'phÃ¡t YouTube trá»±c tiáº¿p ',
    description: 'Stream vÃ  phÃ¡t nháº¡c tá»« YouTube ngay (khÃ´ng lÆ°u)',
    flow: ['CÃ³ YouTube video id', 'Gá»i play_youtube_stream(id=..., title=..., artist=...)', 'PhÃ¡t trá»±c tiáº¿p â€” bÃ i khÃ´ng Ä‘Æ°á»£c lÆ°u vÃ o thÆ° viá»‡n'],
  },
  {
    name: 'get_trending', category: 'ðŸ“ˆ Trending', categoryColor: '#aaaaaa', uiRoute: '/trending', prompt: 'xem trending GitHub hÃ´m nay',
    description: 'Xem repo GitHub trending theo ngÃ y',
    flow: ['Gá»i get_trending() hoáº·c get_trending(date="YYYY-MM-DD")', 'Nháº­n repos[] vá»›i name, stars, impact_score, problem_solved'],
  },
  {
    name: 'get_stats', category: 'ðŸ“Š Analytics', categoryColor: '#888888', uiRoute: '/ai/stats', prompt: 'xem thá»‘ng kÃª tá»•ng quan AI',
    description: 'Thá»‘ng kÃª token, model, lá»—i',
    flow: ['Gá»i get_stats()', 'Nháº­n summary: total, failed, tokens_in, tokens_out, avg_ms'],
  },
  {
    name: 'get_ai_analytics', category: 'ðŸ“Š Analytics', categoryColor: '#888888', uiRoute: '/ai/stats', prompt: 'phÃ¢n tÃ­ch chi tiáº¿t AI',
    description: 'PhÃ¢n tÃ­ch chi tiáº¿t hoáº¡t Ä‘á»™ng AI',
    flow: ['Gá»i get_ai_analytics()', 'Nháº­n daily stats, model distribution, provider stats'],
  },
  {
    name: 'get_ai_logs', category: 'ðŸ“Š Analytics', categoryColor: '#888888', uiRoute: '/ai/stats', prompt: 'xem AI logs gáº§n Ä‘Ã¢y',
    description: 'Xem lá»‹ch sá»­ chat vÃ  lá»—i',
    flow: ['Gá»i get_ai_logs() hoáº·c get_ai_logs(failed=true) Ä‘á»ƒ lá»c lá»—i', 'Nháº­n logs[] vá»›i user_msg, ai_msg, tokens, fail_reason'],
  },
  {
    name: 'get_ai_extremes', category: 'ðŸ“Š Analytics', categoryColor: '#888888', uiRoute: '/ai/stats', prompt: 'xem request tá»‘n token nháº¥t',
    description: 'TÃ¬m request tá»‘n nhiá»u / Ã­t token nháº¥t',
    flow: ['Gá»i get_ai_extremes()', 'Nháº­n most_expensive vÃ  cheapest request'],
  },
  {
    name: 'remember', category: 'ðŸ§  Memory', categoryColor: '#cccccc', uiRoute: '/ai', prompt: 'ghi nhá»› ráº±ng ',
    description: 'LÆ°u thÃ´ng tin vÃ o bá»™ nhá»› dÃ i háº¡n',
    flow: ['Khi user chia sáº» sá»Ÿ thÃ­ch / thÃ³i quen / thÃ´ng tin cÃ¡ nhÃ¢n', 'Gá»i remember(key=..., value=...) ngay trong turn Ä‘Ã³', 'key nÃªn ngáº¯n gá»n, dá»… recall sau nÃ y'],
  },
  {
    name: 'recall', category: 'ðŸ§  Memory', categoryColor: '#cccccc', uiRoute: '/ai', prompt: 'tÃ¬m trong bá»™ nhá»› ',
    description: 'TÃ¬m kiáº¿m thÃ´ng tin Ä‘Ã£ ghi nhá»›',
    flow: ['Gá»i recall(query=...) TRÆ¯á»šC khi tráº£ lá»i náº¿u cáº§n context user', 'Nháº­n facts[] phÃ¹ há»£p vá»›i query', 'DÃ¹ng káº¿t quáº£ Ä‘á»ƒ cÃ¡ nhÃ¢n hÃ³a cÃ¢u tráº£ lá»i'],
  },
  {
    name: 'forget', category: 'ðŸ§  Memory', categoryColor: '#cccccc', uiRoute: '/ai', prompt: 'xÃ³a khá»i bá»™ nhá»› ',
    description: 'XÃ³a thÃ´ng tin khá»i bá»™ nhá»›',
    flow: ['Gá»i forget(key=...) vá»›i key chÃ­nh xÃ¡c', 'NÃªn recall trÆ°á»›c Ä‘á»ƒ biáº¿t Ä‘Ãºng key cáº§n xÃ³a'],
  },
  {
    name: 'web_search', category: 'ðŸŒ Web', categoryColor: '#64748b', uiRoute: '/ai', prompt: 'tÃ¬m trÃªn web ',
    description: 'TÃ¬m kiáº¿m thÃ´ng tin trÃªn internet',
    flow: ['Gá»i web_search(query=...)', 'Nháº­n results[] vá»›i title, url, snippet', 'Tá»•ng há»£p káº¿t quáº£ tráº£ lá»i user'],
  },
  {
    name: 'browse_url', category: 'ðŸŒ Web', categoryColor: '#64748b', uiRoute: '/ai', prompt: 'Ä‘á»c trang web ',
    description: 'Truy cáº­p vÃ  Ä‘á»c ná»™i dung trang web',
    flow: ['Gá»i browse_url(url=...)', 'Nháº­n text content cá»§a trang', 'TÃ³m táº¯t hoáº·c trÃ­ch xuáº¥t thÃ´ng tin cáº§n thiáº¿t'],
  },
  {
    name: 'schedule_agent_task', category: 'âš™ï¸ System', categoryColor: '#94a3b8', uiRoute: '/ai', prompt: 'lÃªn lá»‹ch task AI ',
    description: 'LÃªn lá»‹ch tÃ¡c vá»¥ AI cháº¡y theo cron',
    flow: ['Gá»i schedule_agent_task(cron=..., prompt=...)', 'cron format: "0 8 * * *" = 8am má»—i ngÃ y', 'Nháº­n task_id Ä‘á»ƒ quáº£n lÃ½ sau'],
  },
  {
    name: 'get_scheduled_tasks', category: 'âš™ï¸ System', categoryColor: '#94a3b8', uiRoute: '/ai', prompt: 'xem task Ä‘Ã£ lÃªn lá»‹ch',
    description: 'Liá»‡t kÃª cÃ¡c task AI Ä‘Ã£ lÃªn lá»‹ch',
    flow: ['Gá»i get_scheduled_tasks()', 'Nháº­n tasks[] vá»›i id, cron, prompt, last_run_at'],
  },
  {
    name: 'delete_scheduled_task', category: 'âš™ï¸ System', categoryColor: '#94a3b8', uiRoute: '/ai', prompt: 'xÃ³a task lÃªn lá»‹ch ',
    description: 'XÃ³a task AI khá»i lá»‹ch',
    flow: ['Cáº§n task_id (tá»« get_scheduled_tasks)', 'Gá»i delete_scheduled_task(id=...)'],
  },
  {
    name: 'create_custom_skill', category: 'âš™ï¸ System', categoryColor: '#94a3b8', uiRoute: '/ai', prompt: 'táº¡o skill má»›i tÃªn ',
    description: 'Táº¡o skill / tool tÃ¹y chá»‰nh cho AI',
    flow: ['Gá»i create_custom_skill(name=..., description=..., steps=[...])', 'Skill Ä‘Æ°á»£c lÆ°u vÃ  dÃ¹ng Ä‘Æ°á»£c ngay trong session tiáº¿p theo'],
  },
  {
    name: 'list_ambient_sounds', category: 'ðŸ”Š Ambient', categoryColor: '#999999', uiRoute: '/ai', prompt: 'xem danh sÃ¡ch Ã¢m thanh ná»n',
    description: 'Liá»‡t kÃª cÃ¡c Ã¢m thanh ná»n kháº£ dá»¥ng (rain, ocean, fire...)',
    flow: ['Gá»i list_ambient_sounds()', 'Nháº­n sounds[] vá»›i name vÃ  label', 'DÃ¹ng name cho play_ambient_sound'],
  },
  {
    name: 'play_ambient_sound', category: 'ðŸ”Š Ambient', categoryColor: '#999999', uiRoute: '/ai', prompt: 'báº­t Ã¢m thanh ná»n ',
    description: 'PhÃ¡t Ã¢m thanh ná»n (mÆ°a, sÃ³ng biá»ƒn, lá»­a...)',
    flow: ['Gá»i list_ambient_sounds() Ä‘á»ƒ láº¥y danh sÃ¡ch', 'Gá»i play_ambient_sound(name="rain", volume=0.3)', 'volume tuá»³ chá»n, máº·c Ä‘á»‹nh 0.3'],
  },
  {
    name: 'stop_ambient_sound', category: 'ðŸ”Š Ambient', categoryColor: '#999999', uiRoute: '/ai', prompt: 'táº¯t Ã¢m thanh ná»n',
    description: 'Dá»«ng Ã¢m thanh ná»n Ä‘ang phÃ¡t',
    flow: ['Gá»i stop_ambient_sound() â€” khÃ´ng cáº§n tham sá»‘'],
  },
]

