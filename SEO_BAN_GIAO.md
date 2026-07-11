# SEO_BAN_GIAO.md — Kế hoạch SEO ALN (giao cho Claude Code thực thi)

> **Cách dùng:** Đặt file này vào thư mục gốc repo `C:\Users\HP\Documents\ALN\` (cạnh CLAUDE.md, MARKETING.md).
> Mở Claude Code: `cd Documents\ALN` → `git pull` → `claude` → gõ: **"Đọc SEO_BAN_GIAO.md và làm theo thứ tự Phase 0 → 1 → 2 → 3. Làm từng phase, commit sau mỗi phase, báo cáo rồi mới sang phase kế."**
> Trả lời bằng tiếng Việt. Người dùng KHÔNG phải dev.

---

## 0. BỐI CẢNH (đọc trước khi làm)

- Dự án: sàn ALN kết nối Chủ nhà (CN) – Kiến trúc sư (KTS) – Doanh nghiệp (DN). Chi tiết trong `CLAUDE.md`.
- Frontend **tĩnh HTML/JS thuần** trên GitHub Pages: `https://trannam052022-dot.github.io/ALN/` — đây là LỢI THẾ SEO (không cần pre-render phức tạp, chỉ cần sinh file HTML tĩnh).
- Backend Firebase `aln-platform` (Blaze, asia-southeast1, SDK 10.12.0).
- Máy người dùng yếu (8.5GB RAM): **KHÔNG đọc cả file lớn — dùng grep/sed**. Làm việc nhỏ, commit thường xuyên.
- Schema lead + speed-to-lead loop đã có trong `MARKETING.md` — trang mới PHẢI ghi lead vào đúng collection `leads/{id}` theo schema đó, không tự chế schema mới.

### Quyền tự động (giống CLAUDE.md)
- ĐƯỢC tự làm: viết/sửa HTML/JS/CSS, tạo file mới, `git add/commit/push`.
- PHẢI HỎI trước: sửa `firestore.rules`, `firebase.json`, deploy rules, xóa dữ liệu.

### Mục tiêu tổng
1. **Trụ 1** — Trang mẫu nhà tự sinh (programmatic SEO): mỗi mẫu trong Kho mẫu = 1 trang HTML tĩnh chuẩn SEO.
2. **Trụ 2** — Tool "Dự toán xây nhà 60 giây": trang tương tác hút từ khóa volume cao + bắt lead.
3. **Trụ 3** — SEO địa phương: trang tỉnh + schema LocalBusiness (phần code) + checklist việc tay cho chủ dự án.
4. **Phase 0** — Nền kỹ thuật SEO bắt buộc làm TRƯỚC tất cả.

---

## PHASE 0 — NỀN KỸ THUẬT SEO (làm trước, ~1 buổi)

### 0.1. Tạo `robots.txt` ở gốc repo
```
User-agent: *
Allow: /
Disallow: /founder_panel.html
Disallow: /kts_dashboard.html
Disallow: /designer_dashboard.html
Disallow: /client_CN.html
Disallow: /client_DN.html
Disallow: /seed.html
Disallow: /login.html
Sitemap: https://trannam052022-dot.github.io/ALN/sitemap.xml
```
(Khi có domain applamnha.vn thì thay URL sitemap — ghi chú TODO trong file.)

### 0.2. Tạo `sitemap.xml` ở gốc repo
- Liệt kê các trang public: `index.html`, `recruit.html`, trang 4 bước (nếu có), và SAU NÀY toàn bộ trang trong `/mau/` và `/du-toan/`.
- Viết script `tools/gen-sitemap.js` (Node, không cần thư viện ngoài): quét thư mục `mau/` + `du-toan/` + danh sách trang tĩnh cố định → sinh `sitemap.xml`. Chạy lại mỗi khi thêm trang mới.

### 0.3. Chuẩn hóa meta cho các trang public hiện có
Với `index.html` và `recruit.html`, kiểm tra và bổ sung (dùng grep xem trước, sửa tối thiểu):
- `<title>` ≤ 60 ký tự chứa từ khóa chính. Ví dụ index: `App Làm Nhà — Thiết kế nhà trọn gói, thanh toán Escrow 4 chặng an toàn`
- `<meta name="description">` ≤ 155 ký tự.
- Open Graph: `og:title`, `og:description`, `og:image` (dùng `icon512.png` tạm), `og:url`.
- `<link rel="canonical">`.
- `<html lang="vi">`.

### 0.4. Schema JSON-LD cho index.html
Chèn `<script type="application/ld+json">` loại `Organization` + `WebSite`:
- name: "App Làm Nhà (ALN)", url, logo (icon512.png), areaServed: "VN".

### 0.5. Google Search Console + Analytics
- Tạo file hướng dẫn `docs/SEO_VIEC_TAY.md` (checklist cho chủ dự án — xem Phase 3.3), mục đầu tiên: đăng ký Google Search Console bằng tài khoản trannam052022@gmail.com, verify bằng thẻ meta (Claude Code chèn thẻ meta verify khi chủ dự án đưa mã), submit sitemap.

**Nghiệm thu Phase 0:** robots.txt + sitemap.xml truy cập được trên GitHub Pages; view-source index.html thấy đủ title/description/OG/canonical/JSON-LD; commit + push xong.

---

## PHASE 1 — TRỤ 1: TRANG MẪU NHÀ TỰ SINH (programmatic SEO)

### 1.1. Dữ liệu mẫu nhà
Tạo `data/mau-nha.json` — nguồn chân lý cho generator. Schema mỗi mẫu:
```json
{
  "id": "MAU-0001",
  "slug": "mau-nha-pho-4x15-2-tang-3-phong-ngu",
  "ten": "Mẫu nhà phố 4×15m 2 tầng 3 phòng ngủ hiện đại",
  "loai": "nha-pho",            // nha-pho | nha-cap-4 | biet-thu | nha-2-tang | nha-3-tang
  "ngang": 4, "dai": 15, "tang": 2, "phongNgu": 3, "phongTam": 2,
  "dienTichDat": 60, "dienTichSan": 120,
  "phongCach": "hien-dai",       // hien-dai | tan-co-dien | mai-thai | toi-gian
  "duToanTu": 950000000, "duToanDen": 1250000000,
  "anh": ["url-phoi-canh-1.jpg", "url-mat-bang.jpg"],
  "moTa": "2-3 đoạn mô tả chuẩn SEO, 250-400 từ, tự nhiên, không nhồi từ khóa",
  "ktsTacGia": "KTS. Nguyễn Văn A",
  "giaBanMau": 3000000,
  "tags": ["nhà phố", "4x15", "2 tầng", "3 phòng ngủ"]
}
```
- Seed sẵn **5 mẫu demo** với dữ liệu hợp lý (ảnh dùng placeholder từ `icon512.png` hoặc để trống kèm khung "Phối cảnh đang cập nhật") để test pipeline. Mẫu thật sẽ được thêm dần khi KTS nộp.

### 1.2. Template + Generator
- Tạo `tools/gen-mau.js` (Node thuần): đọc `data/mau-nha.json` → sinh mỗi mẫu 1 file `mau/{slug}.html` từ template `tools/template-mau.html`.
- Template trang mẫu gồm (thứ tự trên trang):
  1. Breadcrumb: Trang chủ › Kho mẫu › {loại} › {tên}
  2. H1 = tên mẫu. Gallery ảnh (lazy-load, `alt` mô tả đầy đủ).
  3. Bảng thông số: ngang×dài, tầng, phòng ngủ/tắm, diện tích, phong cách, **khoảng dự toán**.
  4. Khối mô tả SEO (từ `moTa`).
  5. **2 CTA:** "Mua mẫu này — nhận hồ sơ trong 48h" và "Tư vấn miễn phí với KTS" → cả 2 mở form ghi vào Firestore `leads/{id}` đúng schema MARKETING.md, thêm trường `source: "mau"`, `mauId`. Import từ `firebase-config.js` như các trang khác (script type="module", tuân thủ quy ước 2 scope trong CLAUDE.md).
  6. Khối "Mẫu tương tự" — 4 link nội bộ cùng `loai` hoặc cùng khoảng dự toán (generator tự chọn) → internal linking.
  7. Khối trust: "Quy trình 4 bước đảm bảo — tiền giữ trung gian, KTS xác thực CCHN" + link trang 4 bước.
- SEO từng trang: title = `{tên} — Dự toán {X} tỷ | App Làm Nhà`; description riêng; canonical; OG image = ảnh phối cảnh; JSON-LD `Product` (name, image, offers.price = giaBanMau, priceCurrency VND) + `FAQPage` (3 câu hỏi tự sinh: "Mẫu này xây hết bao nhiêu?", "Có sửa theo đất của tôi được không?", "Bao lâu nhận hồ sơ?").

### 1.3. Trang danh mục
- Sinh `mau/index.html`: lưới toàn bộ mẫu, bộ lọc client-side theo loại/tầng/ngân sách (JS thuần, không thư viện).
- Sinh trang danh mục con theo `loai`: `mau/nha-pho.html`, `mau/nha-cap-4.html`, `mau/biet-thu.html`... (mỗi trang có đoạn mở đầu 150-200 từ riêng, KHÔNG copy nhau).
- Thêm link "Kho mẫu" vào menu `index.html`.

### 1.4. Sau khi sinh
- Chạy `tools/gen-sitemap.js` cập nhật sitemap.
- Ghi vào `docs/SEO_VIEC_TAY.md`: quy trình thêm mẫu mới = thêm object vào JSON → chạy 2 lệnh gen → commit push (viết lệnh sẵn để copy-paste).

**Nghiệm thu Phase 1:** 5 trang mẫu + trang danh mục live trên GitHub Pages, form CTA ghi được vào `leads/` (test bằng tài khoản thật), view-source thấy JSON-LD Product hợp lệ (kiểm bằng cách dán vào validator.schema.org — ghi hướng dẫn cho chủ dự án).

---

## PHASE 2 — TRỤ 2: TOOL "DỰ TOÁN XÂY NHÀ 60 GIÂY"

### 2.1. Trang chính `du-toan/index.html`
- H1: "Dự toán chi phí xây nhà 60 giây — miễn phí, có ngay khoảng giá"
- Form 5 câu (chọn nút, không gõ): Loại công trình (nhà phố/cấp 4/biệt thự) → Số tầng → Diện tích sàn ước tính (slider) → Mức hoàn thiện (cơ bản/khá/cao cấp) → Khu vực (dropdown tỉnh).
- **Tính toán client-side, KHÔNG cần backend.** Tạo `data/don-gia.json`:
```json
{
  "donGiaThoM2": { "co-ban": 3500000, "kha": 4500000, "cao-cap": 6000000 },
  "heSoLoai": { "nha-pho": 1.0, "nha-cap-4": 0.85, "biet-thu": 1.3 },
  "heSoVung": { "hcm": 1.1, "ba-ria-vung-tau": 1.0, "dong-nai": 0.95, "binh-duong": 0.95, "khac": 1.0 },
  "_ghiChu": "SỐ LIỆU GIẢ ĐỊNH — chủ dự án PHẢI hiệu chỉnh theo đơn giá thật trước khi chạy quảng cáo"
}
```
- Kết quả hiển thị: khoảng giá min–max (±10%), bảng bóc tách sơ bộ (thô 60% / hoàn thiện 30% / dự phòng 10%), kèm 3 mẫu nhà phù hợp từ `data/mau-nha.json` (link chéo về Trụ 1).
- **Cổng lead:** kết quả tóm tắt hiện ngay (giữ lời hứa 60 giây), nhưng nút "Nhận bảng dự toán chi tiết PDF + tư vấn miễn phí" mở form → ghi `leads/{id}` schema MARKETING.md, `source: "du-toan"`, kèm `area`, `budget` suy ra từ kết quả (map vào enum có sẵn).
- Disclaimer bắt buộc dưới kết quả: "Con số ước tính tham khảo theo đơn giá thị trường, dự toán chính xác cần KTS khảo sát thực tế."

### 2.2. Biến thể địa phương (programmatic)
- `tools/gen-dutoan.js`: sinh `du-toan/xay-nha-tai-{tinh}.html` cho: vung-tau, ba-ria, tp-hcm, bien-hoa, dong-nai, binh-duong (danh sách trong `data/tinh.json`, mở rộng dần theo Ambassador).
- Mỗi trang tỉnh: H1 "Dự toán chi phí xây nhà tại {Tỉnh} [năm hiện tại]", đoạn mở đầu 150-200 từ RIÊNG cho từng tỉnh (đặc điểm nền đất, đơn giá nhân công tương đối — viết chung chung an toàn, không bịa số liệu cụ thể), nhúng cùng tool với `heSoVung` đặt sẵn theo tỉnh, JSON-LD `WebApplication` + `FAQPage`.

### 2.3. SEO trang tool
- Title trang chính: `Dự toán chi phí xây nhà 60 giây — Bảng giá [năm] | App Làm Nhà`
- Cập nhật sitemap. Link tool nổi bật trên `index.html` (hero hoặc menu).

**Nghiệm thu Phase 2:** tool tính đúng theo don-gia.json; đổi JSON là kết quả đổi theo (không hardcode số trong JS); form ghi lead OK; các trang tỉnh live; số liệu giả định có cờ cảnh báo rõ để chủ dự án hiệu chỉnh.

---

## PHASE 3 — TRỤ 3: SEO ĐỊA PHƯƠNG

### 3.1. Trang dịch vụ theo tỉnh
- `tools/gen-tinh.js` sinh `thiet-ke-nha/{tinh}.html` (cùng danh sách `data/tinh.json`): H1 "Thiết kế nhà tại {Tỉnh} — KTS xác thực, thanh toán Escrow an toàn", nội dung khối: giới thiệu ALN tại khu vực, 4 bước đảm bảo, mẫu nhà gợi ý (link Trụ 1), tool dự toán tỉnh đó (link Trụ 2), form lead `source: "local-{tinh}"`.
- JSON-LD `LocalBusiness` mỗi trang: name "App Làm Nhà — {Tỉnh}", areaServed, telephone (đặt placeholder `{{SDT_ALN}}` — chủ dự án điền), url.
- 3 trang tỉnh link chéo nhau + đều link về trang chủ và Kho mẫu (mạng lưới internal link).

### 3.2. Cập nhật index.html
- Footer thêm khối "Khu vực phục vụ" link tới các trang tỉnh (giúp Google crawl).

### 3.3. Checklist việc TAY cho chủ dự án — ghi vào `docs/SEO_VIEC_TAY.md`
Claude Code KHÔNG làm được các việc này, chỉ soạn hướng dẫn từng bước bằng tiếng Việt đơn giản:
1. Đăng ký **Google Business Profile** "App Làm Nhà" tại Vũng Tàu (danh mục: Kiến trúc sư / Dịch vụ thiết kế nhà) — hướng dẫn từng màn hình.
2. Verify Google Search Console + submit sitemap (mục 0.5).
3. Quy trình **xin review Google** sau nghiệm thu chặng C4: mẫu tin nhắn Zalo gửi chủ nhà kèm link review.
4. Hiệu chỉnh `data/don-gia.json` theo bảng giá thật TRƯỚC khi chạy quảng cáo vào trang tool.
5. (Khi có domain applamnha.vn) trỏ custom domain cho GitHub Pages + thay toàn bộ URL trong robots/sitemap/canonical — Claude Code sẽ làm phần code khi được báo.

**Nghiệm thu Phase 3:** các trang tỉnh live, LocalBusiness schema hợp lệ, `docs/SEO_VIEC_TAY.md` hoàn chỉnh dễ hiểu cho người không phải dev.

---

## QUY TẮC CHUNG CHO MỌI PHASE

1. **Nội dung tiếng Việt tự nhiên, KHÔNG nhồi từ khóa.** Mỗi trang sinh ra phải có đoạn văn riêng — tuyệt đối không để 2 trang trùng mô tả (duplicate content bị Google phạt).
2. **Không bịa số liệu thị trường cụ thể** (giá VLXD, thống kê ngành). Số nào giả định phải gắn cờ `_ghiChu` cho chủ dự án hiệu chỉnh.
3. **Mọi form lead dùng đúng schema `leads/{id}` trong MARKETING.md** + thêm `source`/`mauId` — để loop speed-to-lead và chấm điểm dùng chung. Không tạo collection mới.
4. Tuân thủ quy ước code trong CLAUDE.md: 2 scope script tách biệt, không optional chaining trong script thường, `node --check` sau mỗi file, kiểm tra đủ `</head></body></html>`.
5. Ảnh: luôn có `alt`, `loading="lazy"`, nén trước khi commit (không đẩy ảnh >500KB vào repo).
6. Commit sau mỗi phase với message rõ: `SEO Phase 0: nền kỹ thuật`, `SEO Phase 1: trang mẫu nhà`...
7. Ngôn từ trên trang: dùng "Quy trình 4 bước đảm bảo" (với khách hàng), KHÔNG dùng thuật ngữ nội bộ "Quỹ bảo đảm". Với KTS dùng "Tiền đã có sẵn tại ALN chờ bạn". Không dùng từ ngữ gợi quan hệ lao động với KTS (tuyển dụng nhân viên, lương, cấp trên...) — chỉ "đối tác", "nhận dự án", "thù lao theo dự án".

## THỨ TỰ & BÁO CÁO
- Bắt buộc: Phase 0 → 1 → 2 → 3. Không nhảy cóc.
- Sau mỗi phase: báo cáo ngắn (file đã tạo/sửa, link trang để test, việc cần chủ dự án làm tay) rồi CHỜ xác nhận mới sang phase kế.
- Nếu gặp quyết định lớn ngoài phạm vi file này (đổi cấu trúc repo, cần dịch vụ trả phí, sửa rules) → HỎI, không tự quyết.
