---
type: concept
title: Reuse existing AI provider
tags: [ai, feedback, backend]
timestamp: 2026-08-03
---

# Reuse existing AI provider
**Type:** concept
**Tags:** ai, feedback, backend

Khi thêm 1 tính năng AI-sinh-text mới (blurb nhận xét thói quen nghe nhạc trên `/stats/music`), lần đầu đã viết thẳng 1 lệnh gọi HTTP trực tiếp tới Anthropic API (`callClaudeText()`), giả định Claude là lựa chọn đúng/duy nhất. User sửa lại: "dùng api có sẵn của chúng ta đi mắc gì phải dùng anthropic".

**Vì sao:** cozyroom đã có sẵn 1 lớp trừu tượng multi-provider (`backend/internal/api/ai_providers.go` — `anthropicProvider`/`geminiProvider`/`deepseekProvider`/`openRouterProvider`, tất cả implement chung interface `aiProvider`) và phương thức `selectProvider(model string)` trên `*AIHandlers` tự chọn provider nào có key cấu hình sẵn (ưu tiên: DeepSeek > Anthropic > Gemini > OpenRouter). Production chỉ có `DEEPSEEK_API_KEY`/`OPENROUTER_API_KEY` — không có `ANTHROPIC_API_KEY` — nên 1 lệnh gọi Anthropic cứng sẽ luôn trả rỗng trên production thật.

**Cách áp dụng:** với bất kỳ tính năng sinh text AI một-lần mới nào trong codebase này, gọi `h.selectProvider("")` rồi dùng qua interface `aiProvider` có sẵn (`provider.SetSystemPrompt(...)`, `provider.initMessages(nil, prompt)`, `provider.call(msgs, nil)` — truyền `nil` cho tools hoạt động tốt trên cả 4 provider, mỗi cái tự tạo tool list rỗng an toàn). Chỉ dùng thẳng API riêng của 1 provider cụ thể khi user chỉ đích danh provider đó.

## Notes
- Liên quan tới [[Cozyroom is single-tenant]] — cùng phiên research khi build tính năng thống kê

## Origin
- **Source:** feedback trực tiếp từ user khi build music-listening-insight blurb
- **Commit:** _(xem `backend/internal/api/music_insight.go`)_
- **Date:** 2026-08-03
