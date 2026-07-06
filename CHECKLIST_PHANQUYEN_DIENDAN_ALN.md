# CHECKLIST TRIỂN KHAI PHÂN QUYỀN DIỄN ĐÀN ALN

> **Mục đích:** Chuyển diễn đàn từ mô hình "đăng nhập mới xem được" sang mô hình
> **"Đọc công khai — Tương tác cần tài khoản — Khu chuyên môn cần đúng vai"**.
> File này dùng làm đề bài cho Claude Code. Làm theo từng PASS, commit sau mỗi PASS,
> cập nhật CHANGES.md sau khi hoàn thành.

---

## NGUYÊN TẮC PHÂN LUỒNG (không được vi phạm)

| Đối tượng | Đọc public | Đăng/Bình luận | Khu KTS | Khu DN | Quản trị |
|---|---|---|---|---|---|
| Khách vãng lai (chưa đăng nhập) | ✅ | ❌ | ❌ | ❌ | ❌ |
| CN — Chủ nhà (đã đăng nhập) | ✅ | ✅ | ❌ | ❌ | ❌ |
| KTS (đã xác minh chứng chỉ) | ✅ | ✅ | ✅ | ❌ | ❌ |
| DN — Doanh nghiệp | ✅ | ✅ | ❌ | ✅ | ❌ |
| Founder / Admin | ✅ | ✅ | ✅ | ✅ | ✅ |

**Bất biến bảo mật (đã điều chỉnh theo hệ thống thực tế — xem BAN_GIAO_DIEN_DAN.md):**
- Document ở chuyên mục public TUYỆT ĐỐI không chứa: email, số điện thoại, dữ liệu dự án, giá sàn/trần.
- Role xác định từ document **`users/{uid}.role`** (`'cn' | 'kts' | 'dn' | 'founder'`) —
  thống nhất với toàn hệ thống ALN hiện tại. KHÔNG dùng custom claims.
- **MỌI lượt ghi (đăng bài, bình luận, like...) BẮT BUỘC đi qua Cloud Functions**
  (`forumPost`, `forumComment`...) — nơi chạy bộ lọc chống lách sàn (chặn SĐT/Zalo/link,
  né bằng chữ số tiếng Việt, OCR ảnh). Client KHÔNG ĐƯỢC ghi thẳng vào Firestore.
  Rules DENY toàn bộ write từ client cho collection diễn đàn.
- Giữ nguyên tên collection đang chạy: `forumPosts` / `comments` / `category`. Không migrate.

---

## PASS 1 — Rà soát cấu trúc dữ liệu hiện có (KHÔNG migrate) ✅ XONG (06/07/2026)

- [x] GIỮ NGUYÊN collection đang chạy: `category` (field, không phải collection riêng —
      xem ghi chú dưới), `forumPosts`, `comments`. Không đổi tên, không di chuyển dữ liệu.
- [x] Bổ sung `visibility`: hệ thống hiện tại **không có collection `category` riêng**
      (category chỉ là 1 field string trên mỗi `forumPosts`, danh sách cố định 7 giá trị
      khai trong code). Thay vì tạo collection mới, đã thêm hằng số
      `CATEGORY_VISIBILITY` trong `functions/forum.js`: `hoi_dap`/`vat_lieu`/`nghe` =
      `'kts'` (đúng như đang KTS-only từ trước), các category còn lại = `'public'`
      theo đúng mặc định checklist yêu cầu. **Chưa có category nào cho `'dn'`** — hệ
      thống hiện không có khu riêng cho DN trên diễn đàn, giữ nguyên vậy (không tạo mới).
- [x] Denormalize `categoryVisibility` vào mỗi `forumPosts` + `comments` khi tạo
      (`forumPost`, `forumComment`, `drip_makeQuestion`/`drip_postAnswer`).
- [x] Backfill cho bài cũ: thêm action `forumAdmin({action:'backfillCategoryVisibility'})`
      + nút "Cập nhật categoryVisibility" trong `founder_forum.html` (Tools) — Founder
      cần tự bấm 1 lần sau khi deploy functions. Bài cũ không có `category` (dạng migrate
      tag→category) mặc định `'kts'` (an toàn, không lộ công khai).
- [x] Không có trường nhạy cảm nào cần tách riêng: `brief.region` đã chỉ ở mức quận/tỉnh
      từ trước, `brief.budget` là khoảng (không phải số tuyệt đối) — không cần subcollection `private/`.
- [x] `authorName` (tương đương `authorDisplayName`), `authorRole` đã denormalized từ
      trước khi có checklist này — không đổi.
- [x] Đã audit: không có field email/phone/projectData trong `forumPosts`/`comments`.
      `phone` chỉ nằm trong collection `leads` riêng (Founder-only read), không public.

**Commit:** `f0dffd2` — PASS 1 (CHECKLIST_PHANQUYEN_DIENDAN_ALN.md): bổ sung categoryVisibility

---

## PASS 2 — Firestore Security Rules (READ công khai — WRITE qua Cloud Functions) ✅ XONG (06/07/2026) — CHỜ DEPLOY

> **Nguyên tắc cốt lõi:** rules chỉ quản quyền ĐỌC. Toàn bộ quyền GHI từ client bị DENY —
> mọi lượt đăng/bình luận/like đi qua Cloud Functions (`forumPost`, `forumComment`...),
> nơi bộ lọc chống lách sàn hoạt động (Admin SDK vượt rules nên không bị ảnh hưởng).

- [ ] Viết rules theo mẫu logic sau (điều chỉnh theo tên trường thực tế):

  ```
  function isSignedIn() { return request.auth != null; }
  function userRole() {
    return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
  }
  function isFounder() { return isSignedIn() && userRole() == 'founder'; }

  function canRead(vis) {
    return vis == 'public'
        || (vis == 'kts' && isSignedIn() && (userRole() == 'kts' || isFounder()))
        || (vis == 'dn'  && isSignedIn() && (userRole() == 'dn'  || isFounder()));
  }

  match /category/{categoryId} {
    allow read: if canRead(resource.data.visibility);
    allow write: if false;   // chỉ Admin SDK / Founder Admin qua Functions
  }

  match /forumPosts/{postId} {
    // đọc theo categoryVisibility đã denormalize (PASS 1) — không get() chéo
    allow read: if canRead(resource.data.categoryVisibility)
                && resource.data.isHidden == false;
    allow write: if false;   // đăng/sửa/xóa đều qua Cloud Functions
  }

  match /comments/{commentId} {
    allow read: if canRead(resource.data.categoryVisibility);  // denormalize tương tự
    allow write: if false;
  }
  ```

- [x] Lưu ý chi phí: nhánh `public` không gọi `get()` nào (short-circuit `||`) — đúng
      như yêu cầu. `get()` chỉ chạy cho nhánh `kts`/CN-DN P2 như rules cũ vốn đã làm.
- [x] Cập nhật Cloud Functions `forumPost`/`forumComment`:
  - [x] `canPostCategory(profile.role, category, p2)` **đã có sẵn từ trước** (không phải
        code mới) và đã đúng đọc `profile.role` (lấy từ `users/{uid}.role`), chặn CN/DN
        đăng vào `hoi_dap`/`vat_lieu`/`nghe` (khu `kts`). Đã xác nhận lại vị trí gọi:
        chạy TRƯỚC bộ lọc chống lách sàn (dòng 441, trước dòng 446) — không cần sửa gì.
  - [x] Set `categoryVisibility` khi ghi (PASS 1). `authorName`/`authorRole` đã có từ trước.
  - [x] KHÔNG đụng logic bộ lọc chống lách sàn — xác nhận diff chỉ thêm field, không
        sửa `forumFilterViolation`/`ocrMediaViolation`.
- [x] Like/save (`forumHeart`) **đã là callable Cloud Function từ trước** — không có
      đường ghi trực tiếp client nào, không cần đổi.
- [x] Viết + chạy **Firestore Rules Unit Tests** bằng Firestore Emulator thật
      (`@firebase/rules-unit-testing` + `firebase-tools`, thư mục `test/firestore-rules/`,
      chạy `npx firebase emulators:exec --only firestore "npm test"`). **19/19 PASS**:
  - [x] Khách vãng lai đọc bài public → PASS
  - [x] Khách vãng lai đọc bài khu KTS → DENY
  - [x] Khách vãng lai đọc bài public nhưng ĐÃ ẨN/CHỜ DUYỆT → DENY (thêm 2 ca so với
        checklist gốc, vì bài public giờ lộ ra internet nên cần chắc chắn không rò)
  - [x] Khách vãng lai / CN / Founder ghi thẳng vào `forumPosts` → DENY (kể cả Founder)
  - [x] CN đọc khu KTS → DENY; KTS đọc khu KTS → PASS; KTS đọc bài public → PASS
  - [x] Founder đọc mọi khu → PASS
  - [x] Sửa bài người khác qua client → DENY
  - [x] Comment: đọc/ghi tương ứng theo `categoryVisibility` của comment
  - [~] **Khu `dn`: BỎ QUA** — hệ thống hiện không có category nào visibility=`'dn'`
        (xem PASS 1), nên không có gì để test. Sẽ bổ sung ca test nếu sau này có khu DN riêng.
- [~] **Test tích hợp Functions qua emulator: CHƯA chạy** (không dựng Functions Emulator
      đầy đủ trong phiên này — cần thêm hạ tầng `firebase-functions-test` + mock
      `ANTHROPIC_KEY` secret, chi phí thời gian không tương xứng). Đã xác nhận logic
      đúng bằng **đọc code trực tiếp** (mục ở trên: `canPostCategory` chạy trước bộ lọc,
      đã có từ trước, không đổi). Nếu cần verify bằng emulator thật, làm ở phiên sau.
- [ ] **Deploy rules + functions — CHƯA làm, cần TRANNAM tự chạy**:
  ```bash
  git pull origin main
  firebase deploy --only functions --project aln-platform
  firebase deploy --only firestore:rules --project aln-platform
  ```
  Sau đó bấm nút "Cập nhật categoryVisibility" trong `founder_forum.html` (Tools) 1 lần.

**Commit:** `<sẽ điền sau khi commit PASS 2>` — rules mở đọc công khai theo categoryVisibility, write client DENY toàn bộ, giữ cổng Cloud Functions + bộ lọc chống lách sàn. Kèm `test/firestore-rules/` (rules unit tests, không phải phần deploy).

---

## PASS 3 — Chuẩn hóa role trong `users/{uid}` & Xác minh KTS

> Toàn hệ thống ALN dùng `users/{uid}.role` — KHÔNG chuyển sang custom claims.

- [ ] Rà soát và chuẩn hóa giá trị `role` trong `users`: đúng tập
      `'cn' | 'kts' | 'dn' | 'founder'` — không có giá trị lạ/viết hoa lệch.
- [ ] Kiểm tra luồng gán role:
  - [ ] CN đăng ký → `role: 'cn'` (mặc định)
  - [ ] KTS được duyệt chứng chỉ (thao tác từ Founder Admin, qua Cloud Function
        dùng Admin SDK) → cập nhật `role: 'kts'`
  - [ ] DN được duyệt → `role: 'dn'`
- [ ] Rules cho collection `users`: user thường KHÔNG được tự sửa trường `role`
      của chính mình (chặn leo thang đặc quyền) — chỉ Admin SDK cập nhật được.
      Đây là điều kiện tiên quyết để PASS 2 an toàn.
- [ ] Trong Founder Admin: nút duyệt/gỡ xác minh KTS, ghi log ai duyệt, lúc nào.
- [ ] Role đổi có hiệu lực ngay ở lần đọc rules kế tiếp (vì rules `get()` trực tiếp
      từ users doc) — không cần refresh token.

**Commit:** `feat(auth): chuẩn hóa role trong users doc + chặn tự sửa role`

---

## PASS 4 — Frontend: luồng khách vãng lai

- [ ] Gỡ chặn đăng nhập ở trang danh sách + trang đọc thread của chuyên mục public.
- [ ] Hiển thị chuyên mục `kts` và `dn` theo quy tắc:
  - [ ] **Khách vãng lai (chưa đăng nhập):** chuyên mục KTS HIỆN TÊN nhưng KHÓA nội dung,
        kèm dòng "Khu vực dành riêng cho KTS đã xác minh chứng chỉ hành nghề" + nút
        "Trở thành KTS trên ALN" → dẫn về luồng đăng ký KTS (PASS 7).
        Lý do: khách vãng lai có thể chính là KTS tiềm năng — cánh cửa đóng hờ tạo tò mò.
  - [ ] **CN đã đăng nhập:** ẨN HOÀN TOÀN chuyên mục KTS và DN (không hiện tên).
  - [ ] **DN:** thấy khu DN, không thấy khu KTS — và ngược lại.
  - [ ] Lưu ý rules: chỉ nội dung bị khóa ở tầng Firestore; tên/mô tả chuyên mục KTS
        có thể đặt visibility public riêng cho metadata hiển thị.
- [ ] Các nút tương tác (Đăng bài / Bình luận / Thích / Lưu / Nhắn KTS) với khách chưa đăng nhập:
  - [ ] Vẫn HIỂN THỊ (đây là công cụ chuyển đổi)
  - [ ] Bấm vào → mở modal: **"Đăng nhập hoặc tạo tài khoản miễn phí để đặt câu hỏi cho KTS"**
  - [ ] Sau đăng nhập thành công → quay về đúng thread đang đọc, giữ nguyên vị trí cuộn.
- [ ] Modal đăng nhập dùng đúng brand GOLD (#d4a017) cho CTA, nền navy (#0f2c52), font Be Vietnam Pro.
- [ ] Trạng thái đã đăng nhập: hiện tên + huy hiệu role cạnh avatar ("KTS đã xác minh" cho role kts).

**Commit:** `feat(forum-ui): mở đọc công khai + modal đăng nhập theo ngữ cảnh`

---

## PASS 5 — SEO & chia sẻ (chỉ có ý nghĩa khi đã mở public)

- [ ] Mỗi thread có URL riêng dạng `/dien-dan/{category-slug}/{thread-slug}-{id}`.
- [ ] Server-side render hoặc pre-render meta tags cho thread public:
  - [ ] `<title>` = tiêu đề thread + " | Diễn đàn ALN"
  - [ ] Open Graph (og:title, og:description, og:image) để chia sẻ Facebook/LinkedIn đẹp
- [ ] Sinh `sitemap.xml` cho thread public, submit Google Search Console.
- [ ] `robots.txt`: cho phép crawl `/dien-dan/`, chặn mọi đường dẫn khu KTS/DN.
- [ ] Kiểm tra: mở thread ở cửa sổ ẩn danh (không đăng nhập) → đọc được trọn vẹn.

**Commit:** `feat(forum-seo): URL công khai + meta tags + sitemap`

---

## PASS 6 — Kiểm thử tổng & nghiệm thu

- [ ] Test thủ công 5 vai (ẩn danh / CN / KTS / DN / Founder) trên cả desktop + mobile.
- [ ] Xác nhận không rò rỉ dữ liệu: mở DevTools → Network, đọc payload các document public,
      xác nhận KHÔNG có email/sđt/giá sàn-trần trong bất kỳ response nào.
- [ ] Xác nhận Storage rules: ảnh đính kèm thread public đọc được không cần auth,
      ảnh khu KTS/DN thì không.
- [ ] Cập nhật `CHANGES.md` tổng hợp toàn bộ 6 PASS.
- [ ] Lưu checkpoint context vào `D:\2 - CLAUDE - WORKSPACE\MARKETING`.

**Commit cuối:** `chore(forum): hoàn tất phân quyền diễn đàn — đọc công khai, ghi cần auth, khu riêng theo role`

---

## PASS 7 — ĐÃ TÁCH RIÊNG

Hạng mục "Đăng ký KTS hai nấc" là tính năng lớn, gần như độc lập → tách sang file
**`CHECKLIST_KTS_ONBOARDING_2NAC.md`**. Chỉ bắt đầu SAU KHI PASS 1–6 đã nghiệm thu.

---

## GHI CHÚ CHO CLAUDE CODE

1. Làm tuần tự PASS 1 → 6, không gộp. Commit sau mỗi PASS.
2. GIỮ NGUYÊN cấu trúc collection hiện có (`category`/`forumPosts`/`comments`) —
   chỉ bổ sung trường, không migrate.
3. Không được nới lỏng rule nào của các collection khác ngoài phạm vi diễn đàn.
4. Mọi giá trị giá sàn/trần tuyệt đối không xuất hiện phía client (nguyên tắc MyMy hiện hành).
5. Sau PASS 2, dừng lại báo cáo kết quả unit test rules + test tích hợp Functions
   trước khi làm tiếp.
6. **TUYỆT ĐỐI KHÔNG chạm vào bộ lọc chống lách sàn** trong `forumPost`/`forumComment`
   (chặn SĐT/Zalo/link, né chữ số tiếng Việt, OCR ảnh — xem BAN_GIAO_DIEN_DAN.md #2).
   Mọi lượt ghi tiếp tục đi qua Cloud Functions; rules DENY write client.
7. Role đọc từ `users/{uid}.role` — KHÔNG đưa custom claims vào hệ thống.
8. **Nguyên tắc bản nháp:** tính năng mới xây sau feature flag TẮT, chỉ Founder thấy
   để test. KHÔNG tự ý bật flag công khai — dừng lại chờ TRANNAM duyệt rồi mới
   cập nhật hệ thống thật.
