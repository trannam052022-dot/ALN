# CHANGES.md — Khu "Cẩm nang làm nhà"

> Theo dõi tiến độ triển khai `applamnha.vn/cam-nang/` theo brief `CAM_NANG_ALN.md`.

---

## ĐÃ DEPLOY (2026-07-04)

Founder duyệt lần cuối → merge nhánh `claude/cam-nang-aln-pass-1-kyj5ik` vào `main` (commit `c58e6ec`), push lên GitHub. Không có xung đột (main chỉ đổi các trang app nội bộ không liên quan — `client_CN/DN`, `designer_dashboard`, `founder_panel`, `kts_dashboard`, `functions/index.js`). Đã build lại + kiểm tra idempotent trên `main` trước khi push. GitHub Pages tự build lại theo cấu hình hiện tại (~1-2 phút).

Việc thủ công còn lại của Founder (mục 9 brief gốc): đăng ký Google Search Console + gửi sitemap, chia sẻ 5 bài lên Facebook/LinkedIn.
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

---

## Pass 3 — Build script Markdown → HTML + sitemap.xml + robots.txt (2026-07-03)

**Trạng thái:** Xong, chưa deploy. Giao diện Pass 2 đã được Founder duyệt.

### File đã tạo

- `scripts/lib/frontmatter.js` — parser YAML tối giản (chỉ tập con cần dùng: chuỗi/quote, số, bool, mảng inline `[a,b]`, mảng khối `- item`, không hỗ trợ map lồng nhau). Không dùng thư viện ngoài (không `js-yaml`).
- `scripts/lib/markdown.js` — Markdown → HTML tối giản: H2/H3, đoạn văn, `**đậm**`, `[link](url)`, danh sách `- item`, bảng GFM (`| ... |`), khối HTML thô (dòng bắt đầu bằng `<`, truyền thẳng không xử lý), và marker `[[CTA_MID]]` để chèn khối CTA giữa bài tại đúng vị trí tác giả đặt (không tính % cứng theo độ dài bài).
- `scripts/lib/templates.js` — lắp trang từ dữ liệu frontmatter + HTML nội dung đã render: `renderIndexPage()` (trang danh mục) và `renderArticlePage()` (trang bài viết) — markup/class giữ nguyên 100% so với bản Pass 2 tay viết đã duyệt. Có `renderRelated()` tự động lấy tối đa 3 bài cùng chuyên mục (thật, nếu có), thiếu thì lấp bằng `relatedUpcoming` (placeholder "Sắp ra mắt") khai báo trong frontmatter — không cần logic phức tạp hơn vì hiện chỉ có 1 bài thật.
- `scripts/build-cam-nang.js` — script chính, chạy `node scripts/build-cam-nang.js`:
  1. Đọc mọi `content/cam-nang/*.md`
  2. Sinh `cam-nang/{slug}/index.html` cho từng bài
  3. Sinh `cam-nang/index.html` (danh mục, bài mới nhất trước theo `updated`/`date`)
  4. Sinh `sitemap.xml` (gốc repo)
  5. Sinh `robots.txt` (gốc repo)
  6. Mỗi bước chỉ ghi đè file khi nội dung thực sự đổi (`writeFileIfChanged`) — nền tảng cho tính **idempotent**.
- `content/cam-nang/chi-phi-thiet-ke-nha-pho.md` — bài mẫu Pass 2 chuyển thành nguồn Markdown + frontmatter đầy đủ (title, slug, category, description, date, updated, readTime, author, keywords, summary, ctaMid, relatedUpcoming, imageCaption). Trường `image`/`imageAlt` để trống — vẫn hiện ô placeholder "chờ Founder cung cấp ảnh thật" cho tới khi có ảnh + đường dẫn thật.

### Sitemap — phạm vi "toàn site" đã diễn giải thành danh sách tường minh

`STATIC_PUBLIC_PAGES` trong `build-cam-nang.js` là **mảng liệt kê tay**, không quét toàn bộ `*.html` trong repo. Lý do: repo có nhiều trang nội bộ/admin yêu cầu đăng nhập hoặc là công cụ vận hành, đưa vào sitemap sẽ khiến Google index nhầm trang không dành cho public:

- **Loại trừ có chủ đích:** `client_CN.html`, `client_DN.html`, `kts_dashboard.html`, `designer_dashboard.html`, `founder_panel.html`, `ks_dashboard.html`, `profile.html` (có `onAuthStateChanged` gate), `aln_community.html` (có `authVeil`/gate), `seed.html`, `kho-du-an.html`, `board-editor.html`, `aln_patch.html`, toàn bộ `PUBLIC/`, `features/` (nội bộ/demo/admin).
- **Đưa vào:** `home.html`, `register.html`, `login.html`, `kts-apply.html`, `dn-studio.html`, `designer-apply.html`, `ks-apply.html`, `recruit.html`, `tuyen-kts.html`, `aln-giu-cho/phong-cho.html`, `aln-giu-cho/giu-cho.html`, `privacy.html` — đều là trang public không yêu cầu đăng nhập, đúng tinh thần "trang public" mà brief yêu cầu.
- **Cân nhắc riêng, đã loại:** `aln-giu-cho/tuyen-kts.html` — nội dung/thiết kế khác bản `tuyen-kts.html` gốc (không phải trùng lặp thuần), nhưng chưa rõ có đang được dẫn link/sử dụng chính thức hay là bản nháp — loại ra để tránh nội dung trùng lặp (duplicate content) ảnh hưởng SEO. Founder xác nhận nếu muốn đưa vào.
- Danh sách này là 1 mảng JS đơn giản trong `build-cam-nang.js` — Founder/Claude Code sửa trực tiếp khi có trang public mới, không cần đổi kiến trúc.

`robots.txt` sinh ra: `Allow: /` (cho phép crawl toàn site, gồm `/cam-nang/`) + dòng `Sitemap:` trỏ về `sitemap.xml` — tối giản đúng yêu cầu brief, chưa chặn riêng các trang nội bộ (những trang đó vẫn yêu cầu đăng nhập nên không lộ dữ liệu dù có bị crawl tới).

### Kiểm tra idempotent

Chạy `node scripts/build-cam-nang.js` 2 lần liên tiếp:

```
Lần 1: Bài viết đổi: 1 | Trang danh mục đổi: có | sitemap.xml đổi: có | robots.txt đổi: có
Lần 2: Bài viết đổi: 0 | Trang danh mục đổi: không | sitemap.xml đổi: không | robots.txt đổi: không
```

→ Đạt yêu cầu: chạy lại nhiều lần không tạo diff thừa, an toàn để commit lặp lại mỗi khi thêm bài.

### Đối chiếu output với bản Pass 2 tay viết

Sau khi build, chạy lại Chromium headless chụp `cam-nang/` và `cam-nang/chi-phi-thiet-ke-nha-pho/` — bố cục, màu, khối CTA, bảng giá, breadcrumb... giống hệt bản Pass 2 đã duyệt. HTML sinh ra **không byte-identical** với bản tay viết trước đó (khác thứ tự thuộc tính/khoảng trắng ở vài chỗ do qua template) nhưng **tương đương về nội dung/markup/class** — đã phát hiện và bổ sung lại 1 chỗ thiếu so với bản gốc: dòng chú thích ảnh (`<p class="cn-caption">`) bị bỏ sót ở lần build đầu vì thiếu trường `imageCaption` trong frontmatter, đã thêm và build lại khớp 100%.

### Việc còn thiếu / lưu ý cho pass sau

- Chưa test build với bài thứ 2 trở lên (chưa có nội dung thật) — logic `renderRelated()` lấy bài cùng chuyên mục thật sẽ tự kích hoạt khi Pass 5 thêm bài, nhưng chưa kiểm chứng thực tế.
- Markdown parser hiện không hỗ trợ ảnh chèn giữa bài (`![alt](src)`) hay blockquote — bài mẫu hiện tại không cần, sẽ bổ sung khi có bài thật cần dùng.
- `functions/package.json` dùng `node: "22"` nhưng `firebase.json` khai `"runtime": "nodejs22"` — không liên quan Cẩm nang, không đụng tới.

### Việc tiếp theo

→ Pass 4: thêm section "Cẩm nang" + mục nav trên `home.html` (thay đổi DUY NHẤT trên trang đang chạy) — bao gồm nối query `?mymy=1` để tự mở khung chat MyMy từ nút CTA trong bài Cẩm nang.

---

## Pass 4 — Section "Cẩm nang" + nav + nối MyMy trên home.html (2026-07-03)

**Trạng thái:** Xong, chưa deploy. Đây là thay đổi DUY NHẤT trên trang đang chạy (`home.html`), đúng nguyên tắc brief mục 5. Không đụng file nào khác đang chạy.

Đã chốt cùng Founder trước khi làm: trang tuyển KTS chính thức là `tuyen-kts.html` (đã có trong `sitemap.xml` từ Pass 3, không đổi). Bản `aln-giu-cho/tuyen-kts.html` giữ nguyên **không** đưa vào sitemap — không cần sửa gì ở Pass 3, đã đúng từ đầu.

### Thay đổi trong `home.html`

1. **CSS mới** (chèn ngay trước rule `footer{...}`, dòng ~238) — toàn bộ dùng lại biến có sẵn (`--bg2/--bg3/--bg4/--border/--r/--shadow-sm/--shadow-md/--gold/--gold-bg/--syne/--ease`), không đặt màu/font mới: `.cn-home-track`, `.cn-home-card`, `.cn-home-img`, `.cn-home-body`, `.cn-home-tag`. Card dùng `flex:0 1 340px` + `justify-content:center` để tự canh giữa dù chỉ có 1-2 thẻ (chưa đủ 3 bài thật) — không cần logic điều kiện riêng cho số lượng thẻ.
2. **Mục nav "Cẩm nang"** — thêm vào `.nav-links` (desktop) và `#mobile-nav` (mobile), đặt ngay sau "Bảng giá" (`#pricing`) / trước "Ước tính". Brief gốc ghi "giữa Báo giá và Liên hệ" nhưng nav hiện tại không có mục nào tên đúng vậy (đã ghi nhận lệch tên ở Pass 1) — chọn vị trí liền sau "Bảng giá" vì đó là mục gần nghĩa nhất.
3. **Section `<section class="sec" id="camnang">`** — chèn ngay trước `<!-- FOOTER -->`, dùng đúng pattern `.sec`/`.sec-head`/`.eyebrow` sẵn có (giống các section khác như "Ba bước bắt đầu"). Bên trong danh sách thẻ đặt giữa 2 marker `<!-- CAM_NANG_CARDS_START -->` / `<!-- CAM_NANG_CARDS_END -->` để build script tự cập nhật (xem mục dưới). Nút "Xem tất cả bài viết →" dùng class `.btn.btn-outline` có sẵn, trỏ `cam-nang/`.
4. **Mobile "trượt ngang 1 thẻ/màn hình"** — `@media(max-width:768px)`: `.cn-home-track` chuyển `overflow-x:auto` + `scroll-snap-type:x mandatory`, `.cn-home-card{flex:0 0 100%}`. Hiện chỉ có 1 bài nên thẻ chiếm trọn màn hình, không có gì để trượt — hành vi trượt sẽ thấy rõ khi Pass 5 có ≥2 bài.
5. **Nối `?mymy=1`** — thêm hàm `mymyAutoOpenFromQuery()` gọi `mymyOpen()` (hàm có sẵn) khi `URLSearchParams(location.search).get('mymy') === '1'`, đăng ký qua `window.addEventListener('DOMContentLoaded', ...)`. Sau khi mở, dùng `history.replaceState` xoá `?mymy=1` khỏi URL (tránh mở lại khi bấm back/reload). Đặt trong `<script>` thường (không phải `type="module"`) — đã kiểm tra không dùng optional chaining/object shorthand, đúng quy ước CLAUDE.md mục 3.

### Build script — tự động hoá khối 3 bài mới nhất (đúng yêu cầu brief "Tự động lấy 3 bài mới nhất")

Thêm `buildHomeSection()` vào `scripts/build-cam-nang.js`: đọc `home.html`, tìm 2 marker `CAM_NANG_CARDS_START/END`, thay nội dung giữa bằng danh sách tối đa 3 bài mới nhất (từ `readArticles()`, đã sort theo `updated`/`date`) — chỉ ghi đè phần đó, không đụng gì khác trong file. Nếu marker chưa tồn tại (trường hợp trước Pass 4), bước này tự bỏ qua thay vì lỗi — script vẫn chạy được ở các repo chưa có section này.

Đã kiểm chứng: sau khi tự tay viết section + card đầu tiên trong `home.html`, chạy `node scripts/build-cam-nang.js` lần đầu báo **"home.html (khối 3 bài mới nhất) đổi: không"** — tức bản tay viết khớp 100% với bản script tự sinh, không cần script ghi đè gì thêm. Từ Pass 5 trở đi, mỗi lần thêm bài mới chỉ cần chạy lại script, khối này tự cập nhật.

### Kiểm tra hiển thị

Dùng Chromium headless (đã cài sẵn, chạy qua `NODE_PATH=/opt/node22/lib/node_modules`):
- Desktop 1440px: nav có "Cẩm nang" giữa "Bảng giá"/"Ước tính"; section hiện đúng 1 thẻ (card) canh giữa, tag gold "CHI PHÍ & BÁO GIÁ", nút "Xem tất cả bài viết →".
- Mobile 390px: section co đúng, thẻ chiếm 100% chiều rộng; menu hamburger mở ra có "Cẩm nang" đúng vị trí.
- `home.html?mymy=1`: khung chat MyMy tự mở kèm lời chào + nút chọn xưng hô, URL tự dọn về `home.html` (không còn query).
- Chạy `node scripts/build-cam-nang.js` 2 lần liên tiếp sau khi sửa tay xong: cả 2 lần đều báo "không đổi" ở mọi mục — vẫn giữ tính idempotent.
- `</head></body></html>` đủ, không đụng file nào khác ngoài `home.html`.

**Lưu ý môi trường (không phải lỗi trang):** lúc chụp ảnh, `networkidle` bị treo vì Google Fonts/Phosphor CDN/Firebase CDN bị chặn trong sandbox — đã đổi sang chờ `load` + khung hình `requestAnimationFrame` để chụp ổn định. Không liên quan đến code trang, ngoài production các CDN này tải bình thường.

### Việc tiếp theo

→ Pass 5: đăng 5 bài Đợt 1 (nội dung do Founder cung cấp) — mỗi bài thêm 1 file `content/cam-nang/{slug}.md`, chạy `node scripts/build-cam-nang.js`, khối 3 bài mới nhất trên `home.html` và trang danh mục tự cập nhật theo cơ chế đã dựng ở Pass 3-4. Cần Founder cung cấp ảnh đại diện 16:9 cho từng bài (chưa có thì vẫn hiện placeholder, không chặn).

---

## Pass 5 — Đăng 5 bài Đợt 1 (2026-07-04)

**Trạng thái:** Xong, chưa deploy. Chờ Founder duyệt lần cuối.

### File nhận từ Founder

5 bài `.md` + 5 ảnh `.jpg` (gửi qua đính kèm chat dạng zip, không phải đặt vào thư mục gốc máy Founder — máy Founder và môi trường Claude Code chạy tách biệt, phải đính kèm qua khung chat hoặc push git). Đã dọn vào:
- `content/cam-nang/chi-phi-thiet-ke-biet-thu.md`, `chi-phi-thiet-ke-nha-pho.md` (ghi đè bản mẫu Pass 3), `gia-thiet-ke-noi-that.md`, `phi-thiet-ke-chiem-bao-nhieu-phan-tram.md`, `xay-nha-2026-het-bao-nhieu-tien.md`
- `images/cam-nang/chi-phi-thiet-ke-biet-thu.jpg`, `chi-phi-thiet-ke-nha-pho.jpg`, `gia-thiet-ke-noi-that.jpg`, `phi-thiet-ke-phan-tram.jpg`, `xay-nha-het-bao-nhieu-tien.jpg`

Đối chiếu tên ảnh với trường `image:` trong từng frontmatter: **khớp 100%, không phải sửa file nào** — kể cả bài `xay-nha-2026-het-bao-nhieu-tien.md` mà Founder lưu ý riêng (frontmatter đã tự đúng `xay-nha-het-bao-nhieu-tien.jpg` dù tên file `.md` dài hơn tên ảnh).

**Sửa 1 chỗ:** `description` của bài "Phí thiết kế chiếm bao nhiêu %..." dài 157 ký tự (vượt giới hạn 155 trong brief) — rút gọn còn 154 ký tự (bỏ chữ "cả" thừa), giữ nguyên nghĩa.

### Nội dung Founder viết khác cấu trúc giả định ở Pass 3 — đã nâng cấp build script để xử lý đúng

Bài Founder viết không dùng frontmatter `summary:`/marker `[[CTA_MID]]` như bài mẫu Pass 3, mà viết tự nhiên trong nội dung Markdown:
- Mở đầu bằng `# Tiêu đề` (trùng title) rồi blockquote `> **Nội dung chính**` + `> - gạch đầu dòng` — script giờ **tự bỏ H1 trùng lặp** (template đã tự in H1 riêng) và **tự trích blockquote này thành hộp tóm tắt** (không cần frontmatter `summary` nữa, nhưng vẫn giữ tương thích ngược nếu bài nào có).
- CTA giữa bài viết tự nhiên thành 1 câu có link `**[Chat miễn phí với MyMy →](/home.html?mymy=1)**`, không dùng marker `[[CTA_MID]]` — script giờ **tự nhận diện blockquote có chữ "mymy"** và bọc thành khối `.cn-cta-mid` nền navy, giữ nguyên câu chữ gốc của Founder (không ép về câu mẫu cứng), chỉ tô đậm + gạch chân vàng cho phần link để nổi bật trên nền tối.
- Cuối bài có `<!-- CTA_BLOCK: [Nhận báo giá ngay] [Chat với MyMy] -->` — đây chỉ là ghi chú của người viết, CTA cuối bài đã tự render cố định (đúng 2 nút này) từ Pass 2 nên script **lặng lẽ bỏ dòng comment này**, không in ra HTML.
- Nhiều đoạn có **H3/nhãn in đậm dính liền đoạn văn hoặc danh sách theo sau, không cách dòng trống** (ví dụ `### Hồ sơ kết cấu\nBản vẽ...` hoặc `**Nhà phố 5×20m:**\n- Diện tích...`) — parser Pass 3 xử lý theo khối cách nhau bằng dòng trống nên các trường hợp này bị lọt sai định dạng (in ra chữ `###`/`**` thô ngoài giao diện) khi build thử lần đầu. Đã viết lại `renderBlock()` trong `scripts/lib/markdown.js` theo hướng đệ quy: tách dòng tiêu đề/nhãn đầu tiên ra xử lý riêng, phần còn lại tiếp tục được nhận diện đúng loại (đoạn văn/danh sách) — đã build lại và rà soát bằng `grep` toàn bộ 5 bài, không còn cú pháp Markdown nào lọt ra HTML.
- Thêm hỗ trợ `*nghiêng*` (in nghiêng) và `---`/`***` (gạch ngang `<hr>`) — 2 cú pháp Founder dùng mà Pass 3 chưa hỗ trợ.
- Câu hỏi FAQ dạng `**Câu hỏi?**\nCâu trả lời` (không cách dòng trống) — tách thành 2 đoạn `<p>` riêng thay vì gộp chung một dòng.

### Sửa lỗi đường dẫn ảnh (phát hiện khi lắp ảnh thật đầu tiên)

Frontmatter `image:` dùng đường dẫn tuyệt đối từ gốc site (`/images/cam-nang/xxx.jpg`), nhưng `templates.js` (Pass 3) lại nối thêm `paths.root` (`../../`) phía trước — chỉ không lộ ra ở Pass 3 vì bài mẫu khi đó chưa có ảnh thật (luôn hiện placeholder). Với ảnh thật lần này, lỗi sẽ tạo đường dẫn hỏng (`../.././images/...`) và ảnh Open Graph bị lặp dấu `/`. Đã sửa 2 chỗ trong `renderArticlePage()`: ảnh đại diện dùng thẳng `article.image` (không cộng `paths.root`), OG/JSON-LD dùng `siteBase + article.image` (bỏ dấu `/` thừa).

### Kết quả build

```
node scripts/build-cam-nang.js
Cẩm nang build xong — 5 bài.
  Bài viết đổi: 5
  Trang danh mục đổi: có
  home.html (khối 3 bài mới nhất) đổi: có
  sitemap.xml đổi: có
  robots.txt đổi: không

(chạy lại lần 2 — idempotent)
  Bài viết đổi: 0 | Trang danh mục đổi: không | home.html đổi: không | sitemap.xml đổi: không | robots.txt đổi: không
```

- `cam-nang/index.html`: hiện đủ 5 thẻ bài, ảnh thật, tag "Chi phí & Báo giá".
- `home.html` (khối `CAM_NANG_CARDS_START/END`): tự cập nhật 3 bài (không cần sửa tay).
- `sitemap.xml`: có đủ 5 URL bài viết + `<lastmod>2026-07-06</lastmod>` lấy từ frontmatter `updated`.
- **"3 bài liên quan"**: hết placeholder "Sắp ra mắt" — mỗi bài giờ hiện 3 bài thật cùng chuyên mục "Chi phí & Báo giá" (5 bài, mỗi bài có đúng 4 bài khác cùng mục nên luôn đủ 3, không cần rơi về `relatedUpcoming`), link nội bộ trỏ đúng thư mục bài (`../{slug}/`).
- **Marker `<!-- CTA_BLOCK -->`**: xác nhận không xuất hiện trong HTML sinh ra; CTA cuối bài hiện đúng 2 nút "Nhận báo giá ngay" (gold) + "Chat với MyMy" (outline trên nền navy).

### Kiểm tra hiển thị

Chromium headless, cả 5 bài + trang danh mục + khối trên `home.html`, desktop (1440px) và mobile (390px):
- Trang danh mục: lưới 5 thẻ ảnh thật, đúng bo góc/tag gold, responsive 3→1 cột.
- Bài viết: bảng giá scroll gọn trong khung riêng ở mobile, không vỡ layout; khối CTA giữa bài (navy, chữ trắng, link gạch chân vàng) hiển thị đúng; FAQ tách rõ câu hỏi/câu trả lời; "Bài liên quan" đủ 3 thẻ thật, không còn "Sắp ra mắt".
- `home.html`: khối Cẩm nang hiện 3 thẻ ảnh thật ở desktop; mobile đúng "1 thẻ/màn hình" (thẻ đầu chiếm trọn viewport, 2 thẻ còn lại trượt ngang qua scroll-snap).
- `grep` toàn bộ `cam-nang/*/index.html`: không còn `##`, `**`, `- ` thô lọt ra ngoài thẻ HTML; đủ `</head></body></html>` ở mọi file.

### Việc còn thiếu (không chặn, Founder xử lý sau)

- Google Search Console + gửi sitemap — việc thủ công của Founder sau khi deploy (đã ghi ở mục 9 brief gốc).
- Chia sẻ bài lên Facebook/LinkedIn sau khi đăng — việc thủ công của Founder.

### Việc tiếp theo

→ Chờ Founder duyệt lần cuối. Sau khi duyệt: Founder xác nhận lệnh deploy (`git push` đã có sẵn trên nhánh, GitHub Pages tự build lại theo cấu hình hiện tại — không cần thao tác gì thêm ngoài merge/deploy nhánh).
