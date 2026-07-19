# CLAUDE.md — Dự án ALN (App Làm Nhà)

> File này giúp Claude Code tự nạp context mỗi phiên. Đặt ở thư mục gốc repo: `C:\Users\HP\Documents\ALN\CLAUDE.md`

## NGUYÊN TẮC ĐỊNH VỊ ALN (bắt buộc, không suy diễn)

- **ALN là Tổng thầu THIẾT KẾ** (không phải thi công) — ký HĐ trực tiếp với khách hàng, tiền khách trả là doanh thu ALN, ALN chịu trách nhiệm toàn bộ hợp đồng, KTS là CTV/nhà thầu phụ theo Quy trình 4 bước C1–C4.
- **CẤM:** "xây nhà trọn gói", "ALN là nhà thầu/tổng thầu thi công" — mảng thi công chưa được phép triển khai (chưa có chứng chỉ năng lực). Nếu nhắc thi công, luôn ghi **"đơn vị thi công đối tác"** (chủ thể khác ALN).
- **CẤM:** "giữ tiền trung gian", "bên trung gian", "giữ hộ tiền" khi mô tả ALN với khách hàng — tự mâu thuẫn với việc ký HĐ trực tiếp, gây cảm giác kém uy tín.
- **Câu chuẩn thay thế:** *"ALN là Tổng thầu Thiết kế — ký hợp đồng trực tiếp với khách hàng, trực tiếp chịu trách nhiệm toàn bộ dự án. Thanh toán theo Quy trình 4 bước đảm bảo (C1–C4)."* Bản rút gọn: *"Tổng thầu Thiết kế — hợp đồng trực tiếp, thanh toán theo Quy trình 4 bước đảm bảo."*
- **Ngữ cảnh thuật ngữ** (không lẫn nhau): khách hàng → **"Quy trình 4 bước đảm bảo"**; KTS → **"Làm bước nào thanh toán bước đó"** (cập nhật 15/07/2026, thay cho "Tiền đã có sẵn tại ALN chờ bạn"); nội bộ → **"Quỹ bảo đảm 4 bước"**.
- Trước khi publish nội dung mới (Cẩm nang, trang mẫu, trang tỉnh...), đối chiếu với lint content (đã thêm ở Phase 3) để chặn tái phạm.

## Tài liệu chiến lược → repo private

Từ 13/07/2026, các tài liệu chiến lược/vận hành nội bộ (MARKETING.md, MONETIZATION_KTS.md, SEO_BAN_GIAO.md, docs/SEO_VIEC_TAY.md, BAN_GIAO_*, CHECKLIST_*, CHANGES.md...) đã **chuyển sang repo private `ALN-private`** — không còn trong repo public này (đối thủ đọc được repo public). Tài liệu chiến lược MỚI phải đưa vào repo private, KHÔNG commit vào đây. Code tham chiếu tên các file đó (vd `docs/SEO_VIEC_TAY.md` trong seoAnalytics.js) là trỏ tới repo private.

## Tổng quan

Nền tảng theo dõi công trình xây dựng. **Frontend tĩnh** (HTML/JS thuần) host trên **GitHub Pages**, **backend Firebase** (Auth + Firestore + Storage + FCM + Cloud Functions).

- GitHub repo: `https://github.com/trannam052022-dot/ALN` (public)
- GitHub Pages: `https://trannam052022-dot.github.io/ALN/`
- Firebase project: `aln-platform` (gói Blaze), region `asia-southeast1`, SDK **10.12.0** (giữ đồng bộ version ở mọi nơi import)

## Cấu trúc file

| File | Vai trò |
|------|--------|
| `login.html` | Đăng nhập — dark luxury, role tabs, 3 nút đăng ký KTS/DN/Designer |
| `client_CN.html` | Trang Chủ nhà (CN) |
| `client_DN.html` | Trang Doanh nghiệp (DN) |
| `kts_dashboard.html` | Trang Kiến trúc sư (KTS) |
| `designer_dashboard.html` | Trang Designer Nội thất — violet accent, collection `designProjects/` |
| `founder_panel.html` | Trang quản trị founder — dark luxury, nav nhóm: DỰ ÁN / THÀNH VIÊN / VẬN HÀNH / LIVE, tab Duyệt đăng ký KTS/DN/Designer/KS |
| `kts-apply.html` | Form đăng ký KTS (dark luxury) → ghi `ktsApplications/{uid}` |
| `dn-studio.html` | Form đăng ký DN (dark luxury) → ghi `dnApplications/{uid}` |
| `designer-apply.html` | Form đăng ký Designer NT (dark luxury, violet) → ghi `designerApplications/{uid}` |
| `ks-apply.html` | Form đăng ký KS Vùng (dark luxury, gold) → ghi `ksApplications/{uid}`, role `ks`, username prefix `ks.` |
| `ks_dashboard.html` | Trang KS Vùng — xét duyệt sơ bộ hồ sơ KTS theo tỉnh, gửi nhận xét lên `ktsApplications/{uid}.ksNote` |
| `seed.html` | Nạp dữ liệu mẫu lên Firestore |
| `firebase-config.js` | Khởi tạo Firebase + export hàm dùng chung |
| `firebase-messaging-sw.js` | Service worker cho web push |
| `functions/index.js` | Cloud Functions (Node 20, asia-southeast1) |
| `index.html`, `manifest.json`, `icon-*.png` | PWA |
| `ncc-apply.html` | Form đăng ký Gian hàng NCC (nhà cung cấp vật liệu/thiết bị) → ghi `nccApplications/{uid}`, role `ncc`, username prefix `ncc.` |
| `ncc-showcase.html` | Trang công khai "Mạng lưới Thiết bị - Vật tư ALN" — danh sách gian hàng NCC (3 tầng, tìm kiếm, filter tỉnh/danh mục), đổi tên từ "Gian hàng Vật liệu"/"Vietbuild ALN" → "Mạng lưới Vật liệu ALN" → "Mạng lưới Thiết bị - Vật tư ALN" ngày 19/07/2026 |
| `ncc_profile.html` | Trang công khai chi tiết 1 gian hàng NCC (`?uid=`), có chế độ xem thử `?demo=1` |
| `ncc-dashboard.html` | Trang NCC tự quản lý gian hàng sau khi được duyệt |

## firebase-config.js — exports

CÓ export: `app, auth, db, usernameToEmail, signIn/createUser, onAuthStateChanged, signOut, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, addDoc, getDocs, query, where, orderBy, limit, limitToLast, onSnapshot, serverTimestamp, storage, storageRef, uploadBytes, getDownloadURL`.

**KHÔNG export** `writeBatch` / `Timestamp` → nếu cần (như trong `seed.html`) phải import trực tiếp từ cùng version SDK 10.12.0.

Quy ước: `username + "@aln.vn"` = email đăng nhập (email ảo).

## Vai trò hệ thống

| Vai | Trang | Collection dự án | Accent color |
|-----|-------|-----------------|-------------|
| `founder` | `founder_panel.html` | — (quản lý tất cả) | gold |
| `kts` | `kts_dashboard.html` | `projects/` (ALN-XXXX) | amber |
| `designer` | `designer_dashboard.html` | `designProjects/` (DES-XXXX) | violet `#7c3aed` |
| `dn` | `client_DN.html` | — (xem projects + designProjects) | blue |
| `cn` | `client_CN.html` | — (xem projects của mình) | green |
| `ks` | `ks_dashboard.html` | — (xét duyệt KTS theo tỉnh) | gold |
| `ncc` | `ncc-dashboard.html` | — (tự quản lý gian hàng, doc `nccApplications/{uid}`) | gold |

**KS Vùng (Kỹ sư Vùng):** username prefix `ks.`, đăng ký qua `ks-apply.html` → `ksApplications/{uid}`, chờ founder duyệt. Sau khi active, login vào `ks_dashboard.html`, xem KTS pending trong tỉnh và gửi nhận xét (`ksNote`) lên `ktsApplications/{uid}`. Founder xem nhận xét này khi duyệt KTS.

## 4 tài khoản thật (Auth + Firestore `users/{uid}`)

Mật khẩu: KHÔNG ghi trong repo public (hỏi Founder). Lưu ý bảo mật: mật khẩu cũ từng lộ trong lịch sử Git → Founder đã đổi toàn bộ 4 tài khoản qua Admin SDK (13/07/2026), đã bật 2FA cho Google + GitHub. TUYỆT ĐỐI không commit mật khẩu/secret vào repo này.

| Vai | Username | UID | name |
|-----|----------|-----|------|
| founder | `founder.tranlong` | `h4kEguPEyMcwJwl89stc0Q6j2si2` | KTS. Trần Đại Long |
| kts | `kts.tranlong` | `kw5TgVDggIfboEqERS1cAphn3263` | (giống founder) |
| dn | `dn.tkhouse` | `aTyHR3oQw6P87xpA9p8hTr2NbGA2` | Công ty TK House |
| cn | `cn.trannam` | `G4RhRH5ECMYcE9aFcKYVn5Wdy952` | Trần Nam |

Mỗi `users/{uid}` có: `username, name, role, email`.

Designer dùng username prefix `des.` — đăng ký qua `designer-apply.html`, chờ founder duyệt.

## Dữ liệu mẫu

`projects/ALN-9921` "Biệt thự Vườn Tân Cổ Điển" — `stage: 'C2'`, `sla_warn`, `totalFee: 125tr`, `escrow: 75tr`, `progress: {C1:1, C2:0.4, C3:0, C4:0}`, `memberUids: [cn.uid, kts.uid, dn.uid]` + 4 stages + 3 documents + 1 proposal. `cn.uid` = UID cn.trannam, `kts.uid` = UID kts.tranlong.

Khi CN duyệt proposal: `projects/{pid}.stage` tự advance C1→C2→C3→C4, `progress.{stage} = 1`.

## Cloud Functions (functions/index.js)

| Function | Trigger | Tác dụng |
|----------|---------|---------|
| `onKtsApply` | `ktsApplications/{uid}` onCreate | Push cho founder |
| `onDnApply` | `dnApplications/{uid}` onCreate | Push cho founder |
| `onDesignerApply` | `designerApplications/{uid}` onCreate | Push cho founder |
| `onStageAdvanced` | `projects/{pid}` onUpdate (stage thay đổi) | Push cho KTS |
| `onDocUploaded` | `projects/{pid}/documents/{id}` onCreate (uploader.role=kts) | Push cho CN + DN |

**Cron định kỳ (pubsub.schedule, giờ VN):**

| Function | Lịch | Tác dụng |
|----------|------|---------|
| `dailyDigest` | 08:00 | Tổng hợp cho Founder: lead mới/quá hạn + đơn KTS/DN/Designer chờ duyệt |
| `seoDailyReport` | 08:30 | Kéo Search Console + GA4 (`functions/seoAnalytics.js`) → lưu `seoReports/{date}` + push Founder. Config `settings/seoReport`; panel đọc qua callable `seoReportNow` (không cần mở rules). Cấp quyền: docs/SEO_VIEC_TAY.md mục 9 |
| `reservationLifecycle` | 09:00 | Giữ chỗ ≤48h chưa nộp → nhắc (tối đa 3 lần); quá 3 ngày → `expired` + báo Founder |
| `projectSlaNudge` | 09:10 | Dự án/designProjects đứng bánh >5 ngày (`SLA_STALL_DAYS`, theo `updatedAt`) → cờ `sla_warn` + nhắc KTS/Designer + báo Founder; tự gỡ cờ khi chạy lại |
| `weeklyMarketingDrafts` | Thứ 2 07:00 | AI soạn bài Marketing tuần |
| `scanC2Suspicion` | mỗi 12h | Quét dấu hiệu "đi đêm" ở chặng C2 |
| `clearExpiredTemporaryLocations` | mỗi 6h | Dọn vị trí chia sẻ tạm hết hạn |
| `scheduledFirestoreBackup` | CN 03:00 | Sao lưu toàn bộ Firestore ra Storage |

> Bảng trên là các hàm đáng chú ý; còn nhiều `onCall`/trigger khác (MyMy chatbot, matchKts, createProjectForDN, onPaymentConfirmed…) — xem `functions/index.js` để đủ.

Deploy tất cả: `firebase deploy --only functions`
Deploy riêng: `firebase deploy --only "functions:tenHam1,functions:tenHam2" --project aln-platform` (cần `npm install` trong `functions/` trước nếu là worktree mới)

## Design System (QUAN TRỌNG — đọc trước khi thêm CSS)

### File shared: `aln-tokens.css`
Mọi trang đều import file này. **Không được xoá hoặc đổi tên.**

```html
<link rel="stylesheet" href="aln-tokens.css">          <!-- trang gốc -->
<link rel="stylesheet" href="../aln-tokens.css">       <!-- trang trong subdir -->
```

### Responsive font-size — pattern bắt buộc
Mọi trang mới phải dùng đúng pattern này trong `<style>`:
```css
html { font-size: 13px; }
@media (min-width: 1440px) { html { font-size: 14px; } }
@media (min-width: 1920px) { html { font-size: 16px; } }
body { font-size: 1rem; /* kế thừa từ html */ }
```
→ Text tự scale: 13px (laptop) → 14px (1440p) → 16px (27" 1920p+)

### Type scale — dùng cho code mới
| Token | @13px | @16px | Dùng cho |
|-------|-------|-------|---------|
| `--text-2xs` | 9.1px | 11.2px | fine print tối thiểu |
| `--text-xs` | 10.4px | 12.8px | label nhỏ |
| `--text-sm` | 11.4px | 14px | text phụ |
| `--text-base` | 13px | 16px | body |
| `--text-md` | 14.3px | 17.6px | body nổi bật |
| `--text-lg` | 16.9px | 20.8px | section heading |
| `--text-xl` | 19.5px | 24px | heading |
| `--text-2xl` | 26px | 32px | large heading |

**Quy tắc:** KHÔNG dùng `font-size: 9px` hay `font-size: 10px` cứng. Dùng `var(--text-xs)` để chữ scale trên màn to.

### Hai hệ màu song song (KHÔNG TRỘN)
| Theme | Trang | Bg token | Text token |
|-------|-------|----------|-----------|
| **Dark luxury** | `founder_panel`, `login`, `*-apply`, `dn-studio` | `--bg: #080c14` | `--text1: #dce6f4` |
| **Light professional** | `client_CN`, `client_DN`, `kts_dashboard`, `designer_dashboard` | `--ink: #f0f4f8` | `--text: #1e293b` |

**Code mới dùng `--c-*` prefix** (canonical, không conflict theme):
`--c-gold`, `--c-amber`, `--c-green`, `--c-red`, `--c-blue`, `--c-cyan`, `--c-purple`, `--c-violet`

### Contrast tối thiểu (dark theme)
| Token | Hex | Contrast vs `--bg` | Dùng cho |
|-------|-----|-------------------|---------|
| `--dim` | `#8090ae` | 6.8:1 ✅ | decorative labels, icon |
| `--sub` | `#9aaac4` | 9.2:1 ✅ | secondary text |
| `--text2` | `#bcc8dc` | 12:1 ✅ | content phụ |
| `--text1` | `#dce6f4` | 14:1 ✅ | primary content |

**KHÔNG dùng `opacity: 0.5` trên text** — dùng đúng token thay thế.

## Quy ước làm việc (QUAN TRỌNG)

1. **GOM TẤT CẢ LỖI ĐỂ SỬA MỘT LẦN**: audit toàn bộ trước (`node --check` phần script, grep tìm hàm/biến thiếu), sửa một lần, không vá lẻ tẻ.
2. **Khi sửa nhiều: LUÔN làm lại từ bản gốc**, tránh chồng sửa lên file đã chỉnh (dễ hỏng scope/cấu trúc).
3. **Hai scope tách biệt trong mỗi trang**:
   - `<script>` thường: KHÔNG được dùng optional chaining `?.` hay object shorthand → gây SyntaxError. Các hàm UI (`renderSidebar/renderMain/selectProj`) định nghĩa ở đây.
   - `<script type="module">`: chứa Firestore listener; được dùng cú pháp hiện đại.
   - Để module gọi hàm UI, phải đưa ra `window.*`. Khai báo sớm các biến `window.PROJECTS_CLIENT/activeProj/...` trong `<head>`. Guard mảng rỗng lúc init (`PROJECTS_CLIENT[0]?.id`).
4. Sau mỗi sửa: `node --check` phần module + kiểm tra còn đủ `</head></body></html>`.
5. **MỌI TRANG CÔNG KHAI MỚI PHẢI CÓ THẺ GA4** (`G-5CSL1TF0RC`) trong `<head>` — copy snippet từ `index.html` (dòng có comment "Google Analytics 4"). Đã tự động ở: 3 template `tools/template-*.html` (gen-tinh/mau/dutoan) và `scripts/lib/templates.js` (build-cam-nang). CI `code-check.yml` sẽ FAIL nếu trang công khai thiếu hoặc trùng thẻ. Ngoại lệ (không gắn): dashboard nội bộ (client_CN/DN, kts/designer/ks_dashboard, founder_*), draft, `seed.html`, `board-editor.html`, `home.html` (redirect).
6. **LÀM XONG VIỆC → LUÔN ĐỀ XUẤT DỌN DẸP KÈM THEO** (không tự xoá): sau khi hoàn thành một nhánh/tính năng, chủ động rà xem có nhánh nháp/file trùng lặp/bị thay thế nào còn sót lại không (VD: nhánh nháp bị một phiên/nhánh khác merge thẳng lên `main` khiến nội dung trùng, file `_draft`/`_v2` không còn dùng tới...). Nêu rõ trong báo cáo cuối và hỏi Founder có muốn dọn (xoá nhánh, gộp tài liệu...) hay không — không tự ý xoá nếu chưa được xác nhận.

## Query theo trang

- `client_CN.html`: `where('cn.uid','==',uid) orderBy('updatedAt','desc')` — trừ founder thì bỏ where, lấy tất cả.
- `kts_dashboard.html`: `where('kts.uid','==',uid) orderBy('updatedAt','desc')` trên `projects/`.
- `designer_dashboard.html`: `where('designer.uid','==',uid) orderBy('updatedAt','desc')` trên `designProjects/`.
- `client_DN.html`: `orderBy('updatedAt','desc')` (không where → mọi dự án).
- `founder_panel.html`: `orderBy('updatedAt')`.

## Indexes (Firestore)

- `projects`: `cn.uid` ASC + `updatedAt` DESC — ✅ Enabled.
- `projects`: `kts.uid` ASC + `updatedAt` DESC — ✅ Enabled (deployed 19/06/2026).
- DN + founder dùng `orderBy` không where → không cần index.

## Firestore Rules & App Check

- `fcmTokens`: create/update = `signedIn()` — cho phép mọi vai lưu token.
- `projects/{pid}` update: founder hoặc `uid in memberUids` → CN/KTS/DN trong project đều update được (dùng khi advance stage).
- `designerApplications/{uid}`: giống pattern ktsApplications — designer tự ghi, founder duyệt.
- `designProjects/{pid}`: founder create, `designer.uid`/`cn.uid`/`dn.uid`/`memberUids` read, `memberUids` update.
- **App Check**: đã chạy từ 02/07/2026. Bypass founder cứng ở đăng nhập thường (login.html chỗ A) đã gỡ 04/07/2026 → founder đọc role thật từ `users/{uid}`. Còn hardcode UID founder ở `doFounderLogin` (login.html) và `isFounder()` trong `firestore.rules` — có mật khẩu bảo vệ, dọn sau nếu cần quản lý founder bằng dữ liệu.

## Gian hàng NCC (Nhà cung cấp vật liệu/thiết bị) — directory quảng cáo, KHÔNG phải sàn giao dịch

Mục đích: NCC (sắt thép, gỗ nội thất, VLXD, sơn, điện nước, dịch vụ thi công, thiết bị vận chuyển...) có gian hàng công khai (ảnh, giá, liên hệ) để khách/KTS tìm — ALN không đứng ra giao dịch, không thẩm định chất lượng (disclaimer cố định trên `ncc_profile.html`).

- **Luồng:** đăng ký `ncc-apply.html` → `nccApplications/{uid}` (`status:pending`) → Founder duyệt (`founder_panel.html`, gán `tier`: basic/featured/diamond + `verified`) → `status:'approved'` → hiện công khai trên `ncc-showcase.html` (danh sách) và `ncc_profile.html?uid={uid}` (chi tiết) → NCC tự cập nhật nội dung tại `ncc-dashboard.html` (không tự đổi được `status/tier/verified`).
- **Field chính trên `nccApplications/{uid}`:** `name, category, province, tier, verified, phone, zalo, website, address, intro/bio, priceList[]` (dòng giá thuần item/unit/price), `products[]` (sản phẩm riêng: name/price/unit/**imageUrl** — thêm 18/07/2026, dùng khi NCC bán nhiều mặt hàng, VD cơ điện), `gallery[]` (ảnh chung, `gallery[0]` = ảnh bìa), `catalogPdfUrl/catalogPdfName`, `videos[]` (YouTube/TikTok/Facebook, tối đa 5), `leadCount` (đếm thật từ `nccLeads` qua Cloud Function `onNccLeadCreated`, 19/07/2026 — trước đó là field tĩnh; kèm `leadCountByType.{contact_view|catalog_view|quote_request}`; Founder xem ở cột "Lượt liên hệ" trong `founder_panel.html`), `alnProjects[]`.
- **8 danh mục** (gộp `sat_thep`+`gach_vlxd` → `sat_thep_vlxd`, thêm `thang_may`, đổi tên `dv_thicong` ngày 19/07/2026): `sat_thep_vlxd, go_noithat, son_hoanthien, dien_nuoc, dv_thicong ("Thợ - Đội thi công"), thietbi_vanchuyen, thang_may, khac`. Label map trùng lặp ở 4 nơi phải sửa đồng bộ: `ncc-showcase.html` (CATS), `ncc_profile.html` (CATS), `ncc-apply.html` (dropdown `#f_category`), `founder_panel.html` (`CAT_LABEL_NCC_MG`/`CAT_LABEL_NCC`) + `functions/index.js` (`onNccApply` CAT_LABEL, cần `firebase deploy --only functions:onNccApply` mới lên tác dụng cho thông báo push). 2 danh mục dịch vụ (`dv_thicong`, `thietbi_vanchuyen`) hiện disclaimer riêng: *"ALN không phải bên cung cấp dịch vụ thi công/vận chuyển..."*.
- **`nccLeads` collection:** ghi ẩn danh (`create: if true`), Founder-only đọc, immutable (`update/delete: if false`) — theo dõi `contact_view`/`quote_request` mà không thu thập PII người xem (tuân NĐ 13/2023/NĐ-CP).
- **Storage:** `ncc-catalogs/{uid}/{allPaths=**}` — đọc công khai (`true`), chỉ chủ gian ghi. Wildcard đã bao luôn `ncc-catalogs/{uid}/products/...` (ảnh từng sản phẩm) — **không cần sửa storage.rules khi thêm loại ảnh mới trong path này**.
- **Diễn đàn:** tab "Mạng lưới Thiết bị - Vật tư ALN" (`vat_lieu` — tên nội bộ giữ nguyên để tránh migrate dữ liệu; lịch sử tên hiển thị: "Gian hàng Thiết bị" → "Vật liệu & Giá" → "Mạng lưới Thiết bị - Vật tư ALN" ngày 19/07/2026, khớp tên brand chung) trên `forum.html` bấm vào là redirect thẳng sang `ncc-showcase.html` (không hiện feed bài viết nữa) — `CATEGORY_VISIBILITY.vat_lieu = 'public'`, khách vãng lai xem tự do không cần đăng nhập.
- **Demo data:** `SHOW_DEMO_FALLBACK=true` trong `ncc-showcase.html` trộn 14 gian hàng mẫu (`MOCK_DATA`, `isDemo:true`, không SĐT/Zalo/website thật, không tên thương hiệu thật) sau data thật; mỗi thẻ có badge "Minh hoạ". `ncc_profile.html` có `MOCK_DATA` riêng (phải sửa đồng bộ cả 2 nơi) + chế độ xem thử toàn trang `?demo=1`. `demo-06` "Thiết Bị Điện Phú Hưng" có sẵn 6 `products[]` mẫu để xem trước khối "Sản phẩm nổi bật".
- **Còn tồn đọng (chưa làm, chưa có xác nhận Founder):**
  1. ~~`home.html`/`index.html` chưa có link tới `ncc-showcase.html`~~ — đã thêm chip nhấp nháy nền xanh đen "Mạng lưới Thiết bị - Vật tư ALN" (kèm tagline nhỏ) trong dải `.recruit-strip` "Hợp tác cùng ALN:" trên `index.html` ngày 19/07/2026 (không dùng mục nav riêng, đã thử rồi bỏ vì trùng lặp). Floating badge dùng chung `ncc-network-badge.js` vẫn còn trên `forum.html`/`ncc_profile.html`/`aln_community.html` (đã gỡ khỏi `index.html` vì trùng với chip trên).
  2. Quyền đăng bài diễn đàn của NCC (`NCC_CATEGORIES=['vat_lieu']` trong `functions/forum.js`) gần như vô nghĩa vì tab đã redirect thẳng ra ngoài — chưa quyết giữ hay bỏ.
  3. Chính sách phí gói gian hàng cơ bản sau năm miễn phí đầu tiên (ưu đãi 50 doanh nghiệp đầu tiên trên `ncc-showcase.html`) — chưa quyết, cần chốt trước khi hết hạn miễn phí năm đầu.
  4. Nhánh nháp `claude/ncc-showcase-demo-cithdq` (nhánh làm việc của các phiên NCC, còn trên remote) — hỏi Founder có muốn xoá không, việc thật đã lên `main` trực tiếp.

## Các nút GHI đã được nối (Firestore/Storage)

| Trang | Hàm | Đích |
|-------|-----|------|
| kts_dashboard | `alnSubmitProposal()` | `projects/{pid}/stages/{s}/proposals` + Storage |
| kts_dashboard | `window.submitC3` (module) | `projects/{pid}/documents` + Storage |
| kts_dashboard | `window.submitRev` (module) | `projects/{pid}/documents` + Storage |
| kts_dashboard | `uploadProfileAvatar()` | Storage `kts-profiles/{uid}/` |
| client_CN | `_cnFbApprovePA` | proposal `status:approved` + advance `projects/{pid}.stage` |
| client_CN | `_cnSingleSend` | `projects/{pid}/documents` + Storage |
| client_DN | `_dnFbApprovePA` | proposal `status:approved` + advance `projects/{pid}.stage` |
| client_DN | `_dnSingleSend` | `projects/{pid}/documents` + Storage |
| founder_panel | `founderApprovePending` | `users/{uid}.status:active` + `ktsApplications/dnApplications/designerApplications/{uid}.status:approved` |
| designer_dashboard | `desSubmitProposal()` | `designProjects/{pid}/stages/{s}/proposals` + Storage |
| designer_dashboard | `window.desSubmitC3` (module) | `designProjects/{pid}/documents` + Storage |
| designer_dashboard | `window.desUploadAvatar` (module) | Storage `designer-profiles/{uid}/` |
| ncc-dashboard | `window.saveAll()` (module) | `nccApplications/{uid}` (intro/zalo/website/address/gallery/priceList/products/videos/catalog) |
| ncc-dashboard | `onPickImages/onPickPdf/onPickProductImg` (module) | Storage `ncc-catalogs/{uid}/` (+ `/products/` cho ảnh từng SP) |
| ncc_profile | `logLead()` (module) | `nccLeads` (create, ẩn danh — contact_view/quote_request) |

## QUYỀN TỰ ĐỘNG (dành cho phiên autonomous)

Claude được phép tự làm các việc sau mà không cần hỏi:
- Viết/sửa code HTML/JS/CSS
- `git add`, `git commit`, `git push`
- `firebase deploy --only functions` (sau khi đã review code)

Claude PHẢI HỎI trước khi:
- Thay đổi `firestore.rules` hoặc `storage.rules`
- Chạy `firebase deploy --only firestore:rules` (ảnh hưởng bảo mật sản xuất)
- Xoá dữ liệu Firestore
- Thay đổi cấu trúc `firebase.json` / `firestore.indexes.json`

**Ngoại lệ duy nhất cho "Xoá dữ liệu Firestore"** — được tự xoá KHÔNG cần hỏi trước CHỈ KHI thoả cả 3 điều kiện:
1. Dữ liệu có dấu hiệu test rõ ràng (SĐT test, tên chứa "Test", hoặc field đánh dấu test).
2. Do chính Claude tạo ra và xoá trong CÙNG một phiên làm việc liên tục (không xoá dữ liệu tạo ở phiên trước hoặc không rõ nguồn gốc).
3. Luôn báo cáo lại ngay sau khi xoá (không được xoá âm thầm).

Thiếu bất kỳ điều kiện nào ở trên, hoặc có bất kỳ nghi ngờ nào về việc dữ liệu có thể không phải do Claude tạo ra trong phiên hiện tại — vẫn PHẢI HỎI trước như quy định gốc.

## CÒN LẠI (cập nhật 04/07/2026)

### ✅ Đã xong (từng nằm trong danh sách này)
- **UI Founder tạo dự án mới** — có modal "Tạo dự án" + `createProject` trong `founder_panel.html`.
- **Thông báo CN khi được duyệt** — cơ chế in-app: `founderApprovePending` đặt `approvedNotified:false`; các dashboard (client_CN/DN, kts, designer) phát hiện `approvedNotified===false` lúc đăng nhập/đang online rồi báo + set `true`.
- **App Check** — enforcement đã chạy từ 02/07/2026 (site key đúng, 5 chữ A).
- **Node 22** — `functions/package.json` đã `"node":"22"`.
- **Đăng ký CN công khai** — `register.html` hoạt động (CN active ngay, KTS/DN chờ duyệt).
- **HTTPS applamnha.vn** — cert đã cấp, site chạy HTTPS.
- **Gỡ bypass founder cứng ở đăng nhập thường** — `login.html` (chỗ A) đã bỏ profile founder "chế"; founder đọc role thật từ `users/{uid}`.

### P2 — Kỹ thuật (tùy chọn dọn dẹp)
1. **Hardcode founder còn 2 chỗ** (không gấp — có mật khẩu bảo vệ): cổng founder riêng `doFounderLogin` (login.html) + `isFounder()` trong `firestore.rules` đều kiểm UID cứng `h4kEg…`. Chỉ đụng khi muốn quản lý founder bằng dữ liệu thay vì hardcode → sửa `firestore.rules` phải HỎI trước.

### P3 — Tương lai
2. **Escrow/payment** khi founder confirm chuyển tiền sau khi stage advance (C1→C4).

### Ngoài code (chờ bên ngoài / user làm)
- **FB Graph API** đăng bài tự động lên Fanpage — chờ Facebook duyệt App Review.
- **Zalo OA / mã số thuế** — đang hoãn.

## Lệnh Git thường dùng

```bash
git add -A && git commit -m "mô tả" && git push
```
GitHub Pages tự build lại sau ~1-2 phút.
