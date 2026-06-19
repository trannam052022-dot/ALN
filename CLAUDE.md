# CLAUDE.md — Dự án ALN (App Làm Nhà)

> File này giúp Claude Code tự nạp context mỗi phiên. Đặt ở thư mục gốc repo: `C:\Users\HP\Documents\ALN\CLAUDE.md`

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
| `founder_panel.html` | Trang quản trị founder — dark luxury, tab Duyệt đăng ký KTS/DN/Designer |
| `kts-apply.html` | Form đăng ký KTS (dark luxury) → ghi `ktsApplications/{uid}` |
| `dn-studio.html` | Form đăng ký DN (dark luxury) → ghi `dnApplications/{uid}` |
| `designer-apply.html` | Form đăng ký Designer NT (dark luxury, violet) → ghi `designerApplications/{uid}` |
| `seed.html` | Nạp dữ liệu mẫu lên Firestore |
| `firebase-config.js` | Khởi tạo Firebase + export hàm dùng chung |
| `firebase-messaging-sw.js` | Service worker cho web push |
| `functions/index.js` | Cloud Functions (Node 20, asia-southeast1) |
| `index.html`, `manifest.json`, `icon-*.png` | PWA |

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

## 4 tài khoản thật (Auth + Firestore `users/{uid}`)

Mật khẩu chung: `Test@1234`

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

Deploy: `firebase deploy --only functions`

## Quy ước làm việc (QUAN TRỌNG)

1. **GOM TẤT CẢ LỖI ĐỂ SỬA MỘT LẦN**: audit toàn bộ trước (`node --check` phần script, grep tìm hàm/biến thiếu), sửa một lần, không vá lẻ tẻ.
2. **Khi sửa nhiều: LUÔN làm lại từ bản gốc**, tránh chồng sửa lên file đã chỉnh (dễ hỏng scope/cấu trúc).
3. **Hai scope tách biệt trong mỗi trang**:
   - `<script>` thường: KHÔNG được dùng optional chaining `?.` hay object shorthand → gây SyntaxError. Các hàm UI (`renderSidebar/renderMain/selectProj`) định nghĩa ở đây.
   - `<script type="module">`: chứa Firestore listener; được dùng cú pháp hiện đại.
   - Để module gọi hàm UI, phải đưa ra `window.*`. Khai báo sớm các biến `window.PROJECTS_CLIENT/activeProj/...` trong `<head>`. Guard mảng rỗng lúc init (`PROJECTS_CLIENT[0]?.id`).
4. Sau mỗi sửa: `node --check` phần module + kiểm tra còn đủ `</head></body></html>`.

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
- **App Check bypass còn tồn tại**: founder UID cứng được mock `role:founder` mà không đọc Firestore → cần điều tra và bỏ bypass sau.

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

## CÒN LẠI (thứ tự ưu tiên)

### P1 — Quan trọng, làm ngay
1. **UI Founder tạo dự án mới** — `founder_panel.html` cần tab/modal "Tạo dự án": chọn CN (dropdown `users` where `role=cn`), chọn KTS, chọn DN (optional), nhập tên dự án + tổng phí + escrow → `setDoc('projects/{newId}', {..., memberUids:[cn,kts,dn], stage:'C1', progress:{C1:0,C2:0,C3:0,C4:0}})`. ID dự án tự sinh `ALN-` + 4 chữ số ngẫu nhiên.
2. **Thông báo cho CN khi founder duyệt account** — khi `founderApprovePending(uid, 'cn')` chạy, gọi Cloud Function hoặc ghi doc vào `notifications/{uid}` để CN biết mình đã được kích hoạt.

### P2 — Kỹ thuật
3. **App Check** — điều tra tại sao `getDoc(users/founderUID)` trả `exists:false`. Nếu App Check chặn, tắt enforcement trên Firebase Console rồi bỏ bypass cứng.
4. Nâng `functions/package.json` Node lên 22 (Node 20 deprecated 30/04/2026, decommission 30/10/2026).

### P3 — Tương lai
5. Escrow/payment khi founder confirm chuyển tiền sau khi stage advance.
6. `register.html` đăng ký công khai CN (dùng ngay), KTS/DN chờ duyệt.

## Lệnh Git thường dùng

```bash
git add -A && git commit -m "mô tả" && git push
```
GitHub Pages tự build lại sau ~1-2 phút.
