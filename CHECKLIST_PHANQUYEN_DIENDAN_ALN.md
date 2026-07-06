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

## PASS 3 — Chuẩn hóa role trong `users/{uid}` & Xác minh KTS ✅ XONG (06/07/2026) — CHỜ DEPLOY

> Toàn hệ thống ALN dùng `users/{uid}.role` — KHÔNG chuyển sang custom claims.

- [x] **Kéo lên làm TRƯỚC PASS 2** (theo chỉ đạo TRANNAM, vì rules PASS 2 tin tưởng
      `users/{uid}.role`): `firestore.rules` — user thường KHÔNG tự sửa được `role`
      của chính mình nữa (`request.resource.data.role == resource.data.role` bắt buộc
      trừ khi `isFounder()`). Đã phát hiện đây là lỗ hổng CÓ THẬT (rules cũ cho phép
      tự sửa mọi field kể cả role) — xem thêm phần "PHÁT HIỆN THÊM" dưới đây.
- [x] Rà soát + chuẩn hóa giá trị `role`: thêm callable `founderNormalizeUsers`
      (`functions/index.js`) — tự sửa role bị lệch hoa/thường hoặc thừa khoảng trắng
      (vd `"KTS "` → `"kts"`) nếu sau chuẩn hoá khớp tập hợp lệ `cn|kts|dn|designer|ks|founder`;
      role hoàn toàn lạ (không đoán được) → CHỈ liệt kê cho Founder tự xem, không tự sửa.
      Nút "Chuẩn hoá dữ liệu users" trong `founder_forum.html` → Tools.
- [x] Kiểm tra luồng gán role — **đã đúng từ trước, không cần sửa**: CN đăng ký
      (`register.html`) → `role:'cn'` ngay; KTS/DN/Designer/KS nộp đơn → `role` đã đúng
      từ lúc nộp (`kts-apply.html`... ghi `role:'kts'` ngay), chỉ `status:'pending'→'active'`
      khi Founder duyệt (`founderApprovePending`, không đổi `role`) — khớp tinh thần
      checklist dù cơ chế khác chữ (không phải "duyệt xong mới gán role qua Cloud Function").
- [x] **MONETIZATION_KTS.md — chừa trường `plan:'free'`, `credits:{}`:** thêm vào cả
      5 luồng tạo user (`register.html`, `kts-apply.html`, `dn-studio.html`,
      `designer-apply.html`, `ks-apply.html`, `createUserByFounder`) cho user MỚI, và
      `founderNormalizeUsers` backfill cho user CŨ (chỉ set nếu field chưa tồn tại,
      không ghi đè). Đúng yêu cầu: chỉ chừa trường, không có logic/UI/rules gì thêm.
- [~] **CHƯA làm:** "ghi log ai duyệt KTS, lúc nào" — `founderApprovePending` hiện không
      ghi log riêng. Không nằm trong 3 việc TRANNAM chỉ đạo lần này (chuẩn hoá role +
      chặn tự sửa role + chừa plan/credits) nên để lại, làm sau nếu cần.
- [x] Role đổi hiệu lực ngay lần đọc rules kế tiếp — đúng, vì rules `get()` trực tiếp
      từ `users` doc (không dùng custom claims), không cần refresh token.

### ✅ PHÁT HIỆN THÊM — ĐÃ VÁ (TRANNAM duyệt 06/07/2026: "vá cả 3 điểm")

Đường ghi **`create`** của `users/{uid}` trước đây chỉ kiểm `request.auth.uid == uid`,
KHÔNG kiểm giá trị `role`: ai bỏ qua giao diện đăng ký (gọi thẳng Firestore SDK) có thể
tự tạo doc `users/{uid_mình}` với `role:'kts', status:'active'` → `isKts()` (chỉ kiểm
`role=='kts'`, không kiểm status, và `allow write` stages KHÔNG có member check) sẽ cấp
quyền ghi stages của **mọi dự án**. Lỗ hổng leo thang đặc quyền thật; bản vá `role`-update
(07f1506) KHÔNG chặn được đường `create`.

Đã vá **3 điểm khớp nhau** (`firestore.rules`):
1. **create** — `role` phải thuộc `['cn','kts','dn','designer','ks']` (chặn `'founder'`);
   `status` buộc `'pending'` cho mọi role trừ `'cn'` (active ngay). Founder tạo tự do.
2. **update** — pin thêm `status` (ngoài `role`): user thường không tự kích `active`.
3. **isKts()/isDesigner()** — thêm `&& status == 'active'`: KTS `pending`/`rejected`
   không có quyền dù `role=='kts'`.

Kèm 10 ca unit test mới (`test/firestore-rules/forum-rules.test.js`): create tự phong
founder/tự-active → DENY, đăng ký KTS pending → PASS, tự kích status → DENY, KTS
pending/rejected ghi stages → DENY, KTS active → PASS.

> ⚠️ **THỨ TỰ DEPLOY BẮT BUỘC** (vì rules mới cần mọi `users/{uid}` có field `status`):
> `functions` → bấm **"Cập nhật categoryVisibility"** → bấm **"Chuẩn hoá dữ liệu users"**
> (nút này giờ còn backfill `status:'active'` cho 4 tài khoản seed thật vốn thiếu field
> `status`) → xác nhận xong MỚI `firestore:rules`. Deploy rules trước khi normalize sẽ
> khoá nhầm các tài khoản cũ thiếu `status`.

**Commit:** `07f1506` (chặn tự sửa role) + `<PASS 3>` (chuẩn hoá role + plan/credits)
+ `<sẽ điền>` (vá create-role + isKts status-gate + backfill status)

---

## PASS 4 — Frontend: luồng khách vãng lai ✅ XONG (06/07/2026 — chờ merge + test production)

> Chỉ sửa `forum.html` (không đụng rules/index/backend/login.html). Dùng **USER sentinel**
> `{uid:null, role:'guest'}` để hầu hết code render tự an toàn; thêm nhánh guest ở điểm then
> chốt + guard handler ghi → modal đăng nhập. Query khách nhiều `==` + sort client-side →
> KHÔNG cần composite index mới. ⚠️ LỆCH nhẹ: khu KTS-only bấm vào ra modal đăng nhập chung
> thay vì nút "Trở thành KTS" (luồng đăng ký KTS thuộc PASS 7 chưa làm); "quay lại đúng thread"
> chỉ tự động khi user trở lại forum.html trong 30' vì không đụng login.html theo chỉ đạo.

- [x] Gỡ chặn đăng nhập ở trang danh sách + trang đọc thread của chuyên mục public.
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

## PASS 5 — SEO & chia sẻ ✅ MỨC A XONG (06/07/2026 — chờ merge)

> Host tĩnh GitHub Pages → KHÔNG SSR. Đã làm **Mức A**: `robots.txt` chặn trang nội bộ +
> cho crawl forum; `sitemap.xml` thêm `forum.html`; `forum.html` có OG/meta mặc định + JS
> cập nhật `<title>`/OG động + `history.replaceState(?thread=ID)` khi mở thread (link chia sẻ
> được, Google render JS index được từng thread).
> ⚠️ Mức B (phiên sau): thẻ FB/Zalo per-thread thật (cần prerender bot); sitemap per-thread
> (build đọc Firestore); submit Google Search Console (user tự làm).

### (đề gốc — tham khảo)

- [ ] Mỗi thread có URL riêng dạng `/dien-dan/{category-slug}/{thread-slug}-{id}`.
- [ ] Server-side render hoặc pre-render meta tags cho thread public:
  - [ ] `<title>` = tiêu đề thread + " | Diễn đàn ALN"
  - [ ] Open Graph (og:title, og:description, og:image) để chia sẻ Facebook/LinkedIn đẹp
- [ ] Sinh `sitemap.xml` cho thread public, submit Google Search Console.
- [ ] `robots.txt`: cho phép crawl `/dien-dan/`, chặn mọi đường dẫn khu KTS/DN.
- [ ] Kiểm tra: mở thread ở cửa sổ ẩn danh (không đăng nhập) → đọc được trọn vẹn.

**Commit:** `feat(forum-seo): URL công khai + meta tags + sitemap`

---

## PASS 6 — Kiểm thử tổng & nghiệm thu ⏳ CODE-LEVEL XONG — chờ test 5 vai (06/07/2026)

> **Code-level đã làm:**
> - [x] Soát rò rỉ: `forumPosts`/`comments` payload public chỉ có authorName/role/rank/text/
>   media/brief(quận-tỉnh) — KHÔNG email/phone. `phone` chỉ ở collection `leads` (Founder-only).
> - [x] `storage.rules` `community/` → `allow read: if true` (khách xem ảnh bài public). Chờ deploy `firebase deploy --only storage`.
> - [x] `CHANGES.md` tổng hợp 6 PASS.
> **Còn lại (user tự chạy):** test thủ công 5 vai desktop+mobile theo ma trận (khách/CN/KTS/DN/Founder).


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
