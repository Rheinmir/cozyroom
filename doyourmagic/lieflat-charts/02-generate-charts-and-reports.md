# 02 · Sinh biểu đồ / báo cáo bằng lieflat-charts

**Why you'd use this:** biến một mớ dữ liệu thô thành 1 file HTML đẹp, mở-là-thấy, không cần build.
**What it produces:** một file `.html` đơn (một biểu đồ hoặc một báo cáo nguyên trang), double-click mở bằng trình duyệt.

> Track: **Consumer** · Loại: **Chat-only**. Đây là câu nói với agent, **không phải lệnh terminal** — đừng dán vào shell.

## Nói chuyện với agent

Bạn là người không-lập-trình cũng dùng được: nói bằng ngôn ngữ đời thường (mục đích + nơi đăng), agent tự dịch sang loại biểu đồ đúng.

```text
$lieflat-charts  Đây là dữ liệu chuyển đổi 4 quý của tôi: Q1 12%, Q2 15%,
Q3 14%, Q4 19%. Vẽ giúp một biểu đồ để đăng lên bài blog.
```

Mặc định agent ra **biểu đồ** (chart mode). Chỉ khi bạn nói rõ "báo cáo / annual report / white paper / poster / brief / dashboard report" thì nó mới vào **report mode** (dùng template R01–R12).

## Hai chế độ

| Chế độ | Kích hoạt bằng | Kết quả |
|---|---|---|
| **Chart** (mặc định) | "vẽ giúp / visualize / làm một biểu đồ / mấy cái chart" | 1 file HTML một biểu đồ, chọn từ Lupi → Basics → (mới tới Glance) |
| **Report** | nói rõ "báo cáo / năm / tháng / white paper / poster / brief / dashboard report" | 1 file HTML nguyên trang theo R01–R12, song ngữ zh/en |

## 12 template báo cáo (report mode)

R01 Survey One-Pager · R02 Annual Milestones · R03 Year in Data · R04 Monthly Ops · R05 Impact Story · R06 Eight-Year Almanac · R07 Survey Collage Poster · R08 Population One-Pager · R09 Data Story Dashboard · R10 Travel Notebook · R11 Research Brief Card · R12 Weekly Glance.

## Màu sắc — không cần yêu cầu

Mặc định **Mono** (đen-trắng-xám). Agent tự chọn 1 trong 3 preset màu khi ngữ nghĩa dữ liệu hợp: 青瓷蓝 *porcelain*, 椰林绿 *palm*, 编辑部红 *wire*. Một file HTML chỉ dùng **một** hệ màu, không trộn. Đưa mã màu thương hiệu → agent lập một bộ *custom*.

## Xem kết quả

Double-click file `.html` để mở, hoặc:

```bash
# ví dụ, xem gallery template ngay trong repo đã cài
xdg-open ~/.claude/skills/lieflat-charts/templates/lupi-gallery.html   # Linux
open      ~/.claude/skills/lieflat-charts/templates/reports/index.html # macOS
```

## ⚠️ Online vs offline (quyết định file có hiện đủ không)

| Loại | Phụ thuộc | Mở offline? |
|---|---|---|
| **Lupi, Basics** (trừ F13) | SVG thuần | ✅ Có |
| F13 Treemap | ECharts | Cần mạng |
| **Glance, Circular, Force, báo cáo R11 / R12** | CDN Chart.js / ECharts (`cdn.jsdelivr.net`) + font Inter (`fonts.googleapis.com`) | ❌ Cần mạng |

Muốn file dùng được offline hoàn toàn → yêu cầu agent chọn biểu đồ Lupi/Basics SVG, hoặc inline sẵn thư viện + font.
