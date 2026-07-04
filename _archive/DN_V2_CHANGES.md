# DN V2 Changes — client_DN_v2.html

Tất cả thay đổi so với `client_DN.html` gốc. File gốc được giữ nguyên tại `client_DN_backup.html`.

---

## Phần 1 — CSS tokens + Topbar Express button

### CSS tokens mới (thêm vào `:root`)
```css
--express:#c85a3a;
--express-bg:rgba(200,90,58,.08);
--express-border:rgba(200,90,58,.25);
```

### Class mới
```css
.tb-express-btn   /* nút "Dự án Gấp" trên topbar */
```

### HTML — nút trên topbar (trước chuông thông báo)
```html
<button class="tb-express-btn" onclick="openExpressModal()">
  <i class="ph-duotone ph-lightning"></i> Dự án Gấp
</button>
```

### JS functions mới
- `openExpressModal()` — mở modal Express (nâng cấp ở Phần 3)
- `openNewProjectModal(opts)` — mở modal tạo dự án, hỗ trợ `{defaultPriority:'express'}`
- `closeNewProjectModal()`

---

## Phần 2 — Modal tạo dự án mới 3 bước

### HTML — modal `#npOverlay`
3 bước:
- **Bước 1 (`#npSec1`)**: Tên công trình, loại công trình, diện tích, tỉnh/thành, ngân sách
- **Bước 2 (`#npSec2`)**: Sở thích KTS (phong cách, giới tính, kinh nghiệm, ghi chú)
- **Bước 3 (`#npSec3`)**: Mức độ ưu tiên (Bình thường / Express Lane) + xác nhận

Field ẩn: `<input type="hidden" id="npProjectType" value="aln_direct">`

### JS functions mới
- `npNext()`, `npBack()`, `_npRenderStep()` — điều hướng bước
- `_npValidateStep1()` — validate tên, loại, tỉnh
- `_npSubmit()` — thu thập form → gọi `submitNewProject()`
- `_npGetRadio(groupId)`, `pickRadio(groupId, el, val)` — radio group helper
- `toggleChip(el, val)`, `syncMeetingProvince()` — chip chọn phong cách
- `async submitNewProject(formData)` — ghi `matchingRequests/` Firestore + gửi ALNRealtime event `NEW_PROJECT_REQUEST`

---

## Phần 3 — Badge Express + Màn hình chờ Founder

### CSS classes mới
```css
.sb-badge, .express-badge, .pending-badge
.pending-founder-state
.pf-icon, .pf-title, .pf-sub, .pf-pref, .pf-pref-title, .pf-pref-val
.info-pf-card, .info-pf-lbl, .info-pf-val
```

### renderSidebar() — cập nhật
- Tính `isPending` / `isExpress` cho từng dự án
- Hiển thị badge `⚡ Express` (cam) hoặc `⏳ Chờ duyệt` (amber) trên sidebar

### renderMain() — cập nhật
- Early return nếu `p.status === 'pending_founder'` → gọi `_renderPendingFounder(p)`

### JS functions mới
- `_renderPendingFounder(p)` — màn hình chờ Founder ghép KTS, có countdown cho Express
- `_startPendingCountdown(deadline)` — cập nhật `#pfCountdown` mỗi 30 giây
- `openExpressModal()` (nâng cấp) — nếu có dự án active → `_showExpressPicker()`, nếu không → mở modal với Express preset
- `_showExpressPicker(projects)` — mini overlay chọn dự án active
- `_closeExpressPicker()` — đóng overlay picker

---

## Phần 4 — Realtime events + Eligibility check + projectType

### Mục 1 — Realtime events mới (trong `ALNRealtime.init onMessage`)

**`MATCH_CONFIRMED`**
- Chuông thông báo: "Founder đã ghép KTS X cho dự án Y"
- Toast xanh
- Gọi `updateProjectStatus(projectId, 'active', ktsId, ktsName)` → UI chuyển từ pending sang active

**`EXPRESS_TIMEOUT`**
- Chuông thông báo: "Dự án Gấp không ghép được KTS trong 4h — phí ưu tiên sẽ được hoàn"
- Toast amber
- Reset `priority → 'normal'`, xóa `founderDeadline`, re-render

### `updateProjectStatus(projectId, newStatus, ktsId, ktsName)`
Cập nhật project trong `window.PROJECTS_CLIENT` theo ID, re-render sidebar + main.

### Mục 2 — Kiểm tra điều kiện tạo dự án

**`async checkDnEligibility()`**
- Đọc `users/{uid}.membershipActive` từ Firestore
- Nếu `false` → toast đỏ "Cần kích hoạt gói Thành viên để tạo dự án" + return `false`
- Fail-open nếu lỗi đọc (không chặn người dùng)

**`openNewProjectModal(opts)`** → chuyển thành `async`, gọi `await checkDnEligibility()` trước khi mở modal.

### Mục 3 — projectType whitelabel

Trong `submitNewProject()`: đọc `users/{uid}.whitelabel` trước khi ghi Firestore.
- Nếu `whitelabel: true` → `projectType: 'whitelabel'`
- Ngược lại → `projectType: 'aln_direct'` (default)

---

## Firestore collections liên quan

| Collection | Thao tác | Điều kiện |
|-----------|---------|----------|
| `matchingRequests/` | `addDoc` | DN tạo dự án mới |
| `matchingRequests/{id}` | `updateDoc` | Set `founderDeadline` cho Express |
| `users/{uid}` | `getDoc` | Đọc `membershipActive` + `whitelabel` |

## ALNRealtime events

| Event | Hướng | Xử lý |
|-------|-------|-------|
| `NEW_PROJECT_REQUEST` | DN → Founder | Thông báo yêu cầu mới |
| `MATCH_CONFIRMED` | Founder → DN | Cập nhật UI pending → active |
| `EXPRESS_TIMEOUT` | System → DN | Reset priority, hoàn phí |
