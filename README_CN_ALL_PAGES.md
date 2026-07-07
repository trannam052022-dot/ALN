# Handoff: Office Masthead — áp dụng cho TẤT CẢ trang Chủ nhà (CN)

## Trạng thái
`client_CN.html` đã áp xong thiết kế masthead "Văn phòng KTS của bạn" (biển hiệu bo góc viền vàng + thẻ KTS phụ trách trong khung riêng + sidebar brand "Không gian Chủ nhà / ALN Workspace"). Khi repo có thêm trang khác thuộc vai trò Chủ nhà (vd trang hồ sơ CN, trang thanh toán, trang xem hợp đồng... — bất kỳ trang nào dùng chung layout `sidebar-cn` + `main-cn`), nhân bản đúng khối dưới đây sang trang đó.

## 1. Khối cần copy nguyên vẹn sang mỗi trang CN khác

### a) CSS — `<style id="officeMastheadStyle">`
Toàn bộ block này (ngay sau `<div class="main-cn">`, trước `<div id="mainContent">` trong `client_CN.html`) định nghĩa:
- `.office-masthead` — khung nền `#0e1424`, viền vàng đặc `3px solid #e0b654`, bo góc `16px`, `margin:20px 24px 0`.
- `.om-sign*`, `.om-status*`, `.om-kts-card*` (khung riêng viền vàng bo góc `12px`), `.om-knock-btn*`, `.om-rooms/.om-chip*`, `.om-activity*` — toàn bộ style con.
- Media query `@media(min-width:769px){ .topbar{display:none} }` — ẩn topbar cũ trùng lặp trên desktop.

### b) CSS — sidebar brand
```css
.dn-sidebar-brand{padding:20px 18px 16px;border-bottom:1px solid var(--border);margin-top:20px}
.dn-sidebar-brand-top{font-size:9px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--muted)}
.dn-sidebar-brand-name{font-family:var(--serif);font-style:italic;font-weight:700;font-size:19px;color:var(--text);margin-top:4px;letter-spacing:-.01em}
.dn-sidebar-brand-name::after{content:"";display:block;width:26px;height:2px;background:var(--gold);margin-top:9px;border-radius:2px}
```
`margin-top:20px` là để mí trên của khung "Không gian Chủ nhà" (sidebar) thẳng hàng với mí trên khung navy — giữ nguyên khi áp cho trang khác có cùng sidebar.

### c) HTML — markup sidebar brand (thay cho logo cũ)
```html
<div class="dn-sidebar-brand">
  <div class="dn-sidebar-brand-top">Không gian Chủ nhà</div>
  <div class="dn-sidebar-brand-name">ALN Workspace</div>
</div>
```
Không đổi phần "Company profile card" ngay dưới (avatar `cnSidebarAv` + tên `cnSidebarName`) — giữ nguyên logic/text mặc định hiện có của trang đó.

### d) HTML — markup masthead (`#officeMasthead`)
Copy nguyên khối `<div class="office-masthead" id="officeMasthead">...</div>` từ `client_CN.html` — gồm: biển hiệu trái (eyebrow "MẠNG LƯỚI KTS TOÀN QUỐC" + tiêu đề "Văn phòng KTS của bạn" + trạng thái mở/đóng cửa), thẻ KTS phụ trách phải (avatar, tên, nút "Gõ cửa" trong khung viền vàng riêng), hàng chip "Các phòng", khối nhật ký hoạt động.

**Vị trí chèn:** làm phần tử **đầu tiên** trong `<div class="main-cn">`, trước `<div id="mainContent">` (hoặc phần nội dung chính tương ứng của trang đó).

## 2. Script điều khiển — copy + điều chỉnh theo từng trang
Copy khối `<script>` cuối `client_CN.html` (ngay trước `</body>`, chứa `updateOfficeStatus`, `updateMasthead`, `omGoRoom`, `wireHooks`).

**Cần điều chỉnh cho từng trang khác:**
- 3 id anchor (`cnAnchorDesk`, `cnAnchorProgress`, `cnAnchorArchive`) hiện trỏ tới 3 khối cụ thể của Bàn làm việc. Nếu trang khác không có đúng 3 khối này, gắn id anchor tương đương lên khu vực nội dung chính tương ứng của trang đó, hoặc bỏ chip nào không có khu vực tương ứng — **không tạo chip giả không điều hướng được**.
- Hook `window.renderMain` / `window._addNotif` — chỉ wrap nếu trang đó có sẵn các hàm cùng tên; nếu trang dùng tên khác, đổi theo đúng hàm render nội dung chính + hàm thêm thông báo của trang đó.
- Nút "Gõ cửa" gọi `toggleZaloPopup()` — giữ nguyên nếu trang có sẵn khung chat này; nếu trang không có, có thể route sang trang có chat hoặc ẩn nút.

## 3. Dữ liệu cá nhân hoá
- Tên KTS phụ trách trong masthead: đọc từ `p.kts` (dự án đang active), fallback **"KTS. Trần Long"**.
- Avatar KTS: `p.ktsUid` tra trong `window._cnUserCache[...].avatarURL`, fallback initials từ tên.
- Avatar/tên Chủ nhà trong sidebar: id `cnSidebarAv`/`cnSidebarName` — giữ nguyên tên biến này ở các trang khác để tái dùng logic đã có, không đụng vào.

## 4. Token thiết kế cố định (không đổi giữa các trang)
- Nền `#0e1424`, viền vàng đặc `#e0b654` dày 3px, bo góc 16px, không gradient.
- Thẻ KTS phụ trách nằm trong khung riêng viền vàng `2px`, bo góc `12px`.
- Cormorant Garamond italic cho tiêu đề, Syne uppercase tracking rộng cho nhãn/chip, JetBrains Mono cho giờ/trạng thái.
- Chữ kem `#f0ead6`, phụ `#9aa8bd`, online `#3dd68c`.
- KHÔNG có hàng "Đang trong văn phòng" (KTS/Chủ nhà/Thư ký) — đã bỏ, không thêm lại ở trang khác.

## 5. Việc cần làm khi thêm vào trang CN mới
1. Xác nhận trang dùng chung `sidebar-cn` + `main-cn` layout.
2. Copy 4 khối ở mục 1 (CSS masthead, CSS sidebar brand, HTML sidebar brand, HTML masthead).
3. Copy + điều chỉnh script điều khiển theo mục 2.
4. Test: giờ mở/đóng cửa, click từng chip, nút Gõ cửa, responsive mobile (masthead + thẻ KTS xếp dọc dưới 700px).
5. Commit, deploy, hard-refresh kiểm tra.

## Tham chiếu
- `client_CN.html` — bản chuẩn đã hoàn thiện, dùng làm tham chiếu để nhân bản.
- `kts_dashboard.html` — bản tương ứng phía KTS (bố trí khung bản vẽ), cùng hệ thống token, xem `README.md` cho chi tiết vị trí chèn phía KTS.
