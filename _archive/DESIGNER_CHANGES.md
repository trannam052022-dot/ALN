# DESIGNER_CHANGES.md
> Tóm tắt tất cả thay đổi từ `kts_dashboard.html` → `designer_dashboard.html`
> Dùng làm tài liệu tham chiếu — không cần đọc lại toàn bộ file khi cần sửa tiếp.

---

## PASS 1 — Màu + Role + Identifiers (automated replace)

| Từ | Sang | Ghi chú |
|----|------|---------|
| `#d4a017` | `#7c3aed` | 20 chỗ — amber gold → violet |
| `#e8c44a` | `#9333ea` | hover/lighter gold → purple |
| `rgba(212,160,23,` | `rgba(124,58,237,` | rgba gold variants |
| `--gold: #d4a017` | `--gold: #7c3aed` | CSS variable root — tất cả `var(--gold)` giờ = violet |
| `const REQUIRED_ROLE = "kts"` | `const REQUIRED_ROLE = "designer"` | Auth guard |
| `KTS_PROJECT_ID` | `DES_PROJECT_ID` | 15 chỗ |
| `KTS_PROJECT_DATA` | `DES_PROJECT_DATA` | |
| `_KTS_ALL_PROJECTS` | `_DES_ALL_PROJECTS` | 2 chỗ |
| `KTS_USER` | `DES_USER` | 9 chỗ |
| `<title>` | `Designer Dashboard — ALN` | |

**Chưa đổi ở PASS 1 (intentional):**
- CSS class names: `.kts-work-grid`, `.kts-av`, `.kts-hero`, v.v.
- Element IDs: `ktsHeroAv`, `ktsHeroName`, `ktsChat`, v.v.
- JS function names: `ktsShowTab`, `ktsSendChat`, `switchKtsProject`, `_startKtsProjectListen`
- Firestore role strings (xử lý ở PASS CUỐI)

---

## PASS 2 — Labels UI + Gold variants

### Gold variants còn sót sau PASS 1
| Chỗ | Từ | Sang |
|-----|----|------|
| `.mpl-fb.on` (active filter) | `color:#1a1400` | `color:#fff` |
| `.profile-view-btn` | `color:#b8860b` | `color:#6d28d9` |
| Toggle-optional button | `color:#1a1400` | `color:#fff` |

### Labels tiếng Việt (UI-visible)
| Từ | Sang |
|----|------|
| `Studio KTS` | `Studio Designer` |
| Avatar initial `K` | `D` |
| `KTS. —` (sidebar name) | `DES. —` |
| `Chuẩn KTS · 84.5đ` | `Designer · 84.5đ` |
| `Bảng KTS` | `Bảng Designer` |
| `KTS. Trần Đại Long` (greeting) | `DES. —` |
| `KTS nhận NET` | `Designer nhận NET` |
| `Phương án KTS đã gửi` | `Phương án Designer đã gửi` |
| `Chuẩn KTS` (rank) | `Tiêu Chuẩn` |
| `✓ Chuẩn KTS` | `✓ Tiêu Chuẩn` |
| `kts.tranlong` (settings) | `des.example` |
| `KTS (Kiến trúc sư)` | `Designer (Nội thất)` |
| `STUDIO KTS ALN` | `STUDIO DESIGNER ALN` |
| `Tag "Top KTS"` | `Tag "Top Designer"` |
| `|| 'KTS'` (greeting fallback) | `|| 'Designer'` |
| `📐 KTS vừa gửi` | `📐 Designer vừa gửi` |
| placeholder `KTS. Trần Đại Long` | `Designer Nguyễn Văn A` |
| placeholder `KTS-2021-xxxxx` | `DES-2021-xxxxx` |

---

## PASS 3 — C3 Upload Slots (nội thất thay kiến trúc)

### Trước (KTS):
```javascript
{id:'arch',   label:'Hồ sơ Kiến trúc',  accept:'.pdf,.dwg'}
{id:'struct', label:'Hồ sơ Kết cấu',    accept:'.pdf,.dwg'}
{id:'mep',    label:'Điện nước M&E',     accept:'.pdf,.dwg'}
{id:'steel',  label:'Thống kê Thép',     accept:'.xlsx,.xls', optional:true}
{id:'mat',    label:'Bảng Vật tư',       accept:'.xlsx,.xls', optional:true}
{id:'budget', label:'Dự toán Chi phí',   accept:'.xlsx,.xls', optional:true}
```

### Sau (Designer):
```javascript
{id:'color',     label:'Bảng màu & Vật liệu',       accept:'.pdf,.jpg,.png'}
{id:'render',    label:'Phối cảnh 3D Nội thất',      accept:'.pdf,.jpg,.png,.zip'}
{id:'layout',    label:'Bản vẽ Mặt bằng Nội thất',  accept:'.pdf,.dwg'}
{id:'furniture', label:'Chi tiết Đồ nội thất',       accept:'.pdf,.dwg',         optional:true}
{id:'matspec',   label:'Hồ sơ Vật tư',               accept:'.xlsx,.xls',        optional:true}
{id:'quote',     label:'Dự toán Nội thất',            accept:'.xlsx,.xls',        optional:true}
```

### Cập nhật kèm theo:
| Thành phần | Thay đổi |
|-----------|---------|
| `enabledOptional` | `{steel,mat,budget}` → `{furniture,matspec,quote}` |
| Status bar span IDs | `v-arch/v-struct/v-mep/v-steel/v-mat/v-budget` → `v-color/v-render/v-layout/v-furniture/v-matspec/v-quote` |
| Status bar labels | "Kiến trúc/Kết cấu/M&E/Thép Excel/Vật tư/Dự toán" → "Bảng màu/Render 3D/Mặt bằng/Chi tiết NT/Vật tư/Dự toán NT" |
| Folder mapping | `kien_truc/ket_cau/me/thep/vat_tu/du_toan` → `bang_mau/phoi_canh_3d/mat_bang/chi_tiet_nt/vat_tu/du_toan_nt` |

---

## PASS CUỐI — Functional fixes + bổ sung

### ALNRealtime
| Thay đổi | Dòng |
|---------|------|
| `role: 'kts'` → `role: 'designer'` | 2042 |
| `userId: ... \|\| 'kts.minhtran'` → `\|\| 'des.example'` | 2043 |
| `DES_USER` default fallback: `"KTS. Trần Đại Long"` → `"Designer. —"` | 2039 |
| `_ktsName` fallback: `'KTS. Trần Đại Long'` → `'Designer. —'` | 2121 |

### Chat & Audience filtering
| Thay đổi | Dòng |
|---------|------|
| `d._role !== 'kts'` → `'designer'` | 2055 |
| `d.audience.includes('kts')` → `'designer'` (ALN_CHAT) | 2055 |
| `d.audience.includes('kts')` → `'designer'` (DN_FILE_UPLOADED) | 2079 |
| `d.audience.includes('kts')` → `'designer'` (CN_FILE_UPLOADED) | 2091 |
| `senderRole: 'kts'` → `'designer'` | 2157 |

### Realtime event types
| Từ | Sang |
|----|------|
| `KTS_RATED` | `DESIGNER_RATED` |
| `KTS_DOC_UPLOAD` | `DESIGNER_DOC_UPLOAD` |
| `KTS_C3_SUBMITTED` | `DESIGNER_C3_SUBMITTED` |
| `ktsName:` (payload field) | `desName:` |
| `kts:` (doc metadata field) | `designer:` |

### Firestore query
| Thay đổi | Dòng |
|---------|------|
| `collection(db, 'projects')` → `collection(db, 'designProjects')` | 2495–2496 |
| `where('kts.uid', '==', uid)` → `where('designer.uid', '==', uid)` | 2495 |

### Profile name display logic
| Thay đổi | Dòng |
|---------|------|
| Prefix logic saveProfile: smart regex thay `startsWith('KTS')` | 2975 |
| Prefix logic auth guard: smart regex thay `startsWith('KTS')` | 3204 |
| Regex strip prefix: `/^KTS\.?\s*/i` → `/^(DES\|Designer)\.?\s*/i` | 2952, 2980, 3206 |
| Initials fallback char: `'K'` → `'D'` | 2953 |
| Smart prefix: `/(KTS\|DES\|CN\|DN\|Designer)\.?\s/i.test(nm)` — giữ nguyên nếu đã có role prefix | 2975, 3204 |

### PAGE_BY_ROLE
```javascript
// Thêm entry:
designer: "designer_dashboard.html"
```
(Dòng 3128 — để các trang khác biết redirect designer về đây)

---

## Chưa đổi — để nguyên (intentional)

| Thành phần | Lý do |
|-----------|-------|
| CSS class `.kts-work-*`, `.kts-av`, `.kts-hero`, `.kts-rank` | CSS internal — không ảnh hưởng chức năng |
| Element IDs `ktsHeroAv`, `ktsHeroName`, `ktsChat`, `ktsChatInput` | Được reference đúng trong JS — rename không cần thiết |
| JS function `ktsShowTab`, `ktsSendChat`, `switchKtsProject`, `_startKtsProjectListen` | Internal functions — tên không expose ra ngoài |
| `roleLabel = upRole==='kts' ? 'KTS'` (review board) | Đúng: hiển thị "KTS" khi KTS upload tài liệu vào dự án |
| Line 1496 demo names map | Chỉ trigger khi có URL params `?u=...&r=...` (dev/test only) |
| Line 3115 founder bypass mock name | `'KTS. Trần Đại Long'` là tên thật founder trong DB — giữ nguyên |
| Comments, console.log chứa "KTS" | Không hiển thị ra UI |

---

## Tóm tắt số lượng thay đổi

| Pass | Số thay đổi |
|------|------------|
| PASS 1 | ~60 replacements (automated) |
| PASS 2 | 21 label + 3 color fixes |
| PASS 3 | 6 slots + 4 dependent updates |
| PASS CUỐI | 18 functional fixes |
| **Tổng** | **~106 thay đổi** |
