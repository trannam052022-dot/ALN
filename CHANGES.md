# CHANGES.md — Khu "Cẩm nang làm nhà"

> Theo dõi tiến độ triển khai `applamnha.vn/cam-nang/` theo brief `CAM_NANG_ALN.md`.
> Quy trình: mỗi Pass ghi lại đây sau khi hoàn tất, commit riêng.

---

## Pass 1 — Khảo sát codebase + xác nhận kiến trúc (2026-07-03)

**Trạng thái:** Báo cáo, chưa code.

### Hiện trạng codebase liên quan

- **Không có build tool cho frontend.** Toàn bộ site là HTML/CSS/JS thuần, không có `package.json` ở root, không có bundler/SSG. `functions/package.json` chỉ phục vụ Cloud Functions (Node 22), không liên quan frontend.
- **Deploy:** GitHub Pages phục vụ tĩnh trực tiếp từ repo (branch `main`), tên miền tuỳ chỉnh qua file `CNAME` = `applamnha.vn`. Không có Jekyll bypass (`.nojekyll`) nhưng cũng không có nội dung dùng cú pháp Liquid nên chưa từng gây vấn đề — sẽ thêm `.nojekyll` khi tạo cấu trúc thư mục mới để tránh Jekyll xử lý ngầm thư mục `cam-nang/`.
- **`index.html`** hiện chỉ redirect sang `home.html` — đây là trang chủ thật (SEO, marketing, dark/light gold luxury theme).
- **Không có `sitemap.xml` / `robots.txt`** trong repo hiện tại.
- **3 bảng màu "gold" khác nhau đang tồn tại** trong site (phát hiện khi khảo sát, không có trong brief):
  - `home.html` (trang chủ đang chạy): gold `#98690a`, font DM Sans/Syne/Cormorant Garamond.
  - `tuyen-kts.html`: navy `#041020`, gold `#f6ca62`, font Oswald.
  - `aln-tokens.css` (dùng chung app nội bộ CN/DN/KTS): `--c-gold: #c9a84c`.
  - Brief `CAM_NANG_ALN.md` đề xuất thêm bảng màu thứ 4: navy `#0f2c52` / gold `#d4a017` / Oswald + Be Vietnam Pro.
- **`home.html`** có nav (`<nav id="nav">`, dòng ~489) với các mục: Mạng lưới KTS, Phòng Hội Kiến, Vì sao chọn ALN, Quy trình, Bảng giá, Ước tính, Thước Lỗ Ban, Phối cảnh, Kho mẫu, FAQ. Không có mục "Liên hệ" hay "Báo giá" (brief nhắc "giữa Báo giá và Liên hệ" — tên mục không khớp, sẽ chèn mục "Cẩm nang" cạnh "Bảng giá"/"FAQ" ở Pass 4). Footer ở dòng ~1034.
- **CI hiện có:** `code-check.yml` (kiểm tra emoji/thẻ HTML/kích thước file trên các trang app nội bộ, không đụng trang B2C) và `daily-report.yml` — không có workflow build/deploy nào cần tương thích.

### Quyết định kiến trúc đã xác nhận với Founder

1. **Bảng màu Cẩm nang:** đồng bộ theo `home.html` — gold `#98690a`, font DM Sans/Syne/Cormorant Garamond (KHÔNG dùng navy `#0f2c52`/gold `#d4a017`/Oswald như bản brief gốc đề xuất, để liền mạch với trang chủ đang chạy).
2. **Build Markdown → HTML:** viết script Node thuần (không thêm dependency npm ngoài), Claude Code tự chạy script mỗi khi thêm bài mới rồi commit thẳng HTML tĩnh sinh ra vào repo. Founder không cần chạy lệnh gì — giữ đúng mô hình "thuần tĩnh" hiện tại của site. Bài viết nguồn lưu ở `content/cam-nang/{slug}.md`, script build ra `cam-nang/{slug}/index.html` + cập nhật `cam-nang/index.html` (trang danh mục).
3. **Phạm vi `sitemap.xml`:** toàn site (không chỉ `/cam-nang/`) — liệt kê mọi trang public hiện có (`home.html`, `cam-nang/**`, các trang landing khác) để tối ưu SEO tổng thể luôn trong 1 lần làm.

### Nguyên tắc giữ nguyên (không đổi)

- Không sửa bất kỳ trang/chức năng app nội bộ nào (`client_CN`, `client_DN`, `kts_dashboard`, `founder_panel`, ...).
- Thay đổi DUY NHẤT trên trang đang chạy: thêm section "Cẩm nang" + mục nav trên `home.html` (Pass 4).
- Chưa deploy — chờ lệnh Founder sau khi duyệt giao diện Pass 2.

### Việc tiếp theo

→ Pass 2: build template bài viết + trang danh mục `/cam-nang/` với dữ liệu mẫu 1 bài giả (theo bảng màu home.html đã chốt), để Founder duyệt giao diện trước khi viết build script thật (Pass 3).

---

## Pass 2 — Template bài viết + trang danh mục (2026-07-03)

**Trạng thái:** Xong, chưa deploy. Đã kiểm tra desktop + mobile bằng Chromium headless (screenshot đính kèm).

### ĐÍNH CHÍNH so với Pass 1

Founder yêu cầu **KHÔNG tự đặt màu/font mới** — Cẩm nang phải dùng đúng mã màu/font đang chạy thật trên `home.html`, không phải giá trị NAVY `#0f2c52` / GOLD `#d4a017` / Oswald ghi trong bản brief gốc, và cũng không phải cách diễn giải lỏng lẻo "đồng bộ tinh thần" ở Pass 1. Toàn bộ giá trị dưới đây **copy nguyên văn** từ `<style>` trong `home.html` (dòng 46-99, 117-244) — không suy diễn, không làm tròn.

### Bảng màu — trích xuất từ `home.html` `:root`

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--bg` | `#f7f9fb` | nền trang |
| `--bg2` | `#ffffff` | nền thẻ/card |
| `--bg3` | `#eef2f6` | nền phụ, nền hộp tóm tắt |
| `--bg4` | `#e2e8f0` | nền phụ đậm hơn |
| `--border` | `#e1e7ee` | viền nhạt |
| `--border2` | `#c9d3de` | viền đậm hơn |
| `--text` | `#1a2634` | chữ chính (chính là tông "navy" đậm — home.html không có biến tên `navy` riêng, đây là màu tối nhất dùng cho chữ/heading) |
| `--text2` | `#3d4b5c` | chữ phụ |
| `--sub` / `--muted` | `#5b6b7f` | chữ mờ, meta |
| `--gold` | `#98690a` | gold chính (nút, tag, accent) |
| `--gold2` | `#b8860b` | gold sáng hơn (gradient nút, chữ nhấn H1/H2) |
| `--gold-bg` | `rgba(152,105,10,.09)` | nền pill tag |
| `--gold-glow` | `rgba(152,105,10,.16)` | glow/shadow gold |
| `--green` | `#15803d` | trạng thái tốt |
| `--red` | `#dc2626` | trạng thái lỗi |
| `--amber` | `#b45309` | cảnh báo |
| `--blue` | `#1d4ed8` | thông tin |
| nút gold — chữ | `#1a1400` | màu chữ trên nền `.btn-gold` |
| nền tối (hero-slider) | `#0e1424` | **dùng làm "navy" cho khối CTA đậm** — đây là màu tối duy nhất home.html thực sự dùng làm nền (dòng 117/119, `.hero-slider`/`.hs-slide`) |
| chữ trên nền tối | `#f5efe0` | copy từ `.hs-cap` (dòng 121) — chữ kem sáng trên nền `#0e1424` |

→ Bảng màu "navy #0f2c52 / gold #d4a017" trong brief gốc **KHÔNG được dùng**. "Navy" thực tế của Cẩm nang = `#0e1424` (đã có sẵn trong home.html), không phải giá trị bịa mới.

### Font — trích xuất từ `home.html`

| Alias | Font thật | Dùng cho |
|---|---|---|
| `--sans` | `'DM Sans', sans-serif` | toàn bộ nội dung/body — **thay cho "Be Vietnam Pro" trong brief gốc** |
| `--syne` | `'Syne', sans-serif` | nhãn/nút/H2-H3/uppercase label — **thay cho "Oswald" trong brief gốc** |
| `--serif` | `'Cormorant Garamond', serif` | H1 và các heading lớn (nghiêng, đậm cho từ nhấn) |
| `--mono` | `'JetBrains Mono', monospace` | không dùng trong Cẩm nang (không có số liệu dạng mã) |

Google Fonts import dùng đúng URL home.html đang gọi (bớt `JetBrains Mono` vì không cần):
`https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,600;1,300;1,600&family=DM+Sans:wght@300;400;500;600;700&family=Syne:wght@700;800&display=swap`

Icon: Phosphor Duotone (đúng CDN home.html dùng: `@phosphor-icons/web@2.1.1`).

### Style nút / component — copy nguyên

- `.btn` / `.btn-gold` / `.btn-outline`: copy y nguyên từ home.html dòng 75-81 (bo góc 11px, gradient gold `135deg, --gold2 → --gold`, chữ `#1a1400`, hover `translateY(-2px)` + shadow đậm hơn).
- `.wrap{max-width:1180px}`: copy nguyên container chính.
- Card style (`.cn-card`) copy pattern `.why-card` (dòng 164-165): nền `--bg2`, viền `--border`, bo góc `var(--r)` = 14px, `box-shadow:var(--shadow-sm)`, hover nổi lên + đổi viền gold.
- Tag chuyên mục (`.tag-gold`) copy pattern `.mh-cat` (dòng 398): nền `--gold-bg`, chữ `--gold`, pill bo tròn 99px, font Syne uppercase.
- `html{font-size:14px}` + breakpoint `1440px→15px`, `1920px→17px`: copy nguyên responsive scale của home.html (khác với pattern 13/14/16 mặc định trong `aln-tokens.css` — vì đây là trang B2C công khai, dùng đúng scale home.html đang chạy, không dùng scale nội bộ app).
- Khối 720px cho nội dung bài: home.html **đã có sẵn** pattern này ở `.lib-mod{max-width:720px}` (dòng 380) — không phải giá trị mới, khớp yêu cầu brief.

### File đã tạo (Pass 2 — chưa deploy)

- `cam-nang/cam-nang.css` — stylesheet dùng chung, chứa toàn bộ giá trị trích xuất ở trên + component style riêng cho Cẩm nang (card lưới, tab lọc, breadcrumb, hộp tóm tắt, CTA giữa/cuối bài, bài liên quan).
- `cam-nang/index.html` — trang danh mục: hero + 4 tab lọc chuyên mục (JS thuần, không phụ thuộc build) + lưới thẻ (3 cột desktop / 1 cột mobile) + 1 thẻ bài mẫu thật + ghi chú các bài đang biên soạn.
- `cam-nang/chi-phi-thiet-ke-nha-pho/index.html` — bài mẫu **"Chi phí thiết kế nhà phố 2026: Bảng giá chi tiết theo m²"** (dùng đúng đơn giá niêm yết ALN 120.000đ/m²), đủ khối: breadcrumb → H1 → meta (ngày/thời gian đọc/tác giả) → ảnh đại diện 16:9 (placeholder, chờ Founder cung cấp ảnh thật) → hộp tóm tắt viền trái gold → nội dung H2/H3 + bảng giá → CTA giữa bài (nền `#0e1424`, chữ trắng) → CTA cuối bài (khối lớn nền `#0e1424`, nút gold "Nhận báo giá ngay" + nút outline "Chat với MyMy") → 3 bài liên quan (đánh dấu "Sắp ra mắt" vì chưa có bài thật khác). Có `<title>` (47 ký tự), `<meta description>` (136 ký tự), Open Graph đầy đủ, JSON-LD `Article`, breadcrumb, heading đúng cấp (1 H1 duy nhất).
- `.nojekyll` (root) — GitHub Pages bỏ qua xử lý Jekyll cho thư mục con mới `cam-nang/`, phòng ngừa an toàn, không ảnh hưởng trang hiện có.

### Ghi chú / việc còn thiếu (không chặn Pass 2, xử lý ở pass sau)

- Nút "Chat với MyMy" trên trang Cẩm nang trỏ về `home.html?mymy=1#pricing` — hiện `home.html` **chưa đọc** query `mymy=1` để tự mở khung chat. Sẽ nối ở Pass 4 khi đụng đến `home.html` (tuân thủ "chỉ 1 thay đổi trên trang đang chạy" theo brief mục 5).
- "Internal link ≥ 2 bài khác trong Cẩm nang" (yêu cầu SEO mục 4) chưa đạt đủ vì mới có 1 bài thật — bài mẫu đang link nội bộ về `home.html#pricing` và `cam-nang/index.html` tạm thời; sẽ bổ sung link chéo giữa các bài thật khi đăng Đợt 1 (Pass 5).
- Ảnh đại diện 16:9 đang là ô placeholder xám ghi chú — chờ Founder cung cấp ảnh thật theo checklist mục 9.
- Sitemap.xml/robots.txt (phạm vi toàn site, đã chốt ở Pass 1) — làm ở Pass 3 cùng lúc với build script, để liệt kê đủ cả trang tĩnh sẵn có lẫn bài Cẩm nang.

### Kiểm tra đã làm

- Chạy `python3 -m http.server`, mở qua Chromium headless (Playwright có sẵn trong môi trường), chụp cả 2 trang ở desktop (1440×900) và mobile (390×844, iPhone 12 width) — bố cục đúng, lưới thẻ co từ 3 cột → 1 cột, tab lọc tự xuống dòng, bảng giá scroll ngang trong khung riêng, không đè chữ.
- Kiểm tra thẻ đóng đủ `</head></body></html>` ở cả 2 file HTML mới.
- Không đụng bất kỳ file nào đang chạy (`home.html`, `aln-tokens.css`, ... không sửa).

### Việc tiếp theo

→ Founder duyệt giao diện (đối chiếu bảng màu/font ở trên). Sau khi duyệt: Pass 3 — viết build script Markdown → HTML (Node thuần, Claude Code tự chạy) dùng lại đúng template Pass 2 + sinh `sitemap.xml`/`robots.txt` toàn site.
