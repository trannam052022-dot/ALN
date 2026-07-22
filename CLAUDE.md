# CLAUDE.md — Dự án ALN (App Làm Nhà)

> File này giúp Claude Code tự nạp context mỗi phiên. Đặt ở thư mục gốc repo: `C:\Users\HP\Documents\ALN\CLAUDE.md`

## NGUYÊN TẮC ĐỊNH VỊ ALN (bắt buộc, không suy diễn)

- **ALN là Tổng thầu THIẾT KẾ** (không phải thi công) — ký HĐ trực tiếp với khách hàng, tiền khách trả là doanh thu ALN, ALN chịu trách nhiệm toàn bộ hợp đồng, KTS là CTV/nhà thầu phụ theo Quy trình 4 bước C1–C4.
- **CẤM:** "xây nhà trọn gói", "ALN là nhà thầu/tổng thầu thi công" — mảng thi công chưa được phép triển khai (chưa có chứng chỉ năng lực). Nếu nhắc thi công, luôn ghi **"đơn vị thi công đối tác"** (chủ thể khác ALN).
- **CẤM:** "giữ tiền trung gian", "bên trung gian", "giữ hộ tiền" khi mô tả ALN với khách hàng — tự mâu thuẫn với việc ký HĐ trực tiếp, gây cảm giác kém uy tín.
- **Câu chuẩn thay thế:** *"ALN là Tổng thầu Thiết kế — ký hợp đồng trực tiếp với khách hàng, trực tiếp chịu trách nhiệm toàn bộ dự án. Thanh toán theo Quy trình 4 bước đảm bảo (C1–C4)."* Bản rút gọn: *"Tổng thầu Thiết kế — hợp đồng trực tiếp, thanh toán theo Quy trình 4 bước đảm bảo."*
- **Ngữ cảnh thuật ngữ** (không lẫn nhau): khách hàng → **"Quy trình 4 bước đảm bảo"**; KTS → **"Làm bước nào thanh toán bước đó"** (cập nhật 15/07/2026, thay cho "Tiền đã có sẵn tại ALN chờ bạn"); nội bộ → **"Quỹ bảo đảm 4 bước"**.
- Trước khi publish nội dung mới (Cẩm nang, trang mẫu, trang tỉnh...), đối chiếu với lint content (đã thêm ở Phase 3) để chặn tái phạm.
- **Bài Cẩm nang MỚI (từ 15/07/2026) mặc định thêm `facebook: true` vào frontmatter** để tự động đăng Fanpage khi tới `publishDate` (cơ chế có sẵn ở `scripts/build-cam-nang.js`, chống trùng qua `content/cam-nang/.fb-posted.json`). **KHÔNG** mặc định thêm field này vào bài Cẩm nang cũ đã publish trước ngày trên — bật hàng loạt sẽ khiến cron đăng dồn nhiều bài cùng lúc lên Fanpage thật trong 1 lượt, dễ bị Facebook đánh dấu spam. Chỉ bật thủ công cho bài cũ nếu Founder yêu cầu rõ ràng (đã làm với 2 bài "thủ tục hoàn công nhà ở" 17/07 và "chữ ký kiến trúc sư có giá trị gì" 21/07 — xem mục 22/07/2026 bên dưới).
- **21/07/2026:** phát hiện 25 trang `cam-nang/xay-nha-tron-goi-{tỉnh}/` (24 tỉnh) + `cam-nang/index.html` dùng đúng cụm bị cấm "xây nhà trọn gói" (title/H1/meta/nội dung, cả nguồn `content/cam-nang/*.md` lẫn HTML đã build) — bản thân "Phase 3 lint" nhắc ở trên **chưa từng tồn tại thật trong `.github/workflows/code-check.yml`**. Đã sửa toàn bộ sang **"xây nhà hoàn thiện"** (giữ nguyên URL slug `xay-nha-tron-goi-*` để không ảnh hưởng SEO/backlink), sửa luôn 1 dropdown ẩn trong `founder_panel.html` (mục tạo nội dung quảng cáo MyMy), và **đã thêm thật** bước lint chặn cụm cấm vào `code-check.yml` (step "Kiểm tra cụm từ định vị bị cấm").
- **22/07/2026 (2):** Founder phát hiện qua "Thông tin tổng quan do AI tạo" (AI Overview) của Google khi tìm "App Làm Nhà" — AI tự tổng hợp sai thành **"đóng vai trò Tổng thầu thiết kế VÀ THI CÔNG"**, đúng cụm bị cấm. Truy ra nguồn: `index.html` dòng `description` trong **JSON-LD Organization schema** (đầu file) ghi chung chung *"Nền tảng quản lý công trình xây dựng, kết nối chủ nhà với KTS và đơn vị thi công đã thẩm định"* — không hề nhắc "Thiết kế", trong khi đây là dữ liệu có cấu trúc mà AI/công cụ tìm kiếm ưu tiên tin cao nhất khi tổng hợp câu trả lời (hơn cả nội dung hiển thị cho người). Đã sửa lại rõ: *"ALN là Tổng thầu Thiết kế... ALN không trực tiếp thi công."* Đồng thời sửa 3 chỗ khác trong `index.html` dùng **"tổng thầu" trơn** (thiếu chữ "Thiết kế") — 2 ở section "Vì sao chọn ALN"/"Cách ALN làm việc", 1 ở câu trả lời FAQ "ALN có phải trung gian giữ tiền không?". **Bài học quy trình mới:** khi audit cụm từ cấm (lint CI hiện tại chỉ grep nội dung HTML hiển thị), cần kiểm tra thêm **JSON-LD/schema.org và các thẻ meta description/og** trên mọi trang công khai — đây là nơi AI Overview/AI tìm kiếm ưu tiên đọc, lỗi ở đây khó phát hiện bằng mắt thường vì không hiện trực tiếp trên trang.
- **22/07/2026:** phát hiện nhánh `claude/design-portfolio-legal-4vwkmt` (3 commit) chưa từng được merge vào `main` — mất theo đó: 5 bài Cẩm nang đã viết xong hẹn ngày đăng 23/07–31/07 (facebook:true sẵn), và cờ `facebook: true` bật tay cho 2 bài lỡ hẹn (17/07, 21/07). Đã merge lại vào `main` + fix nguồn markdown cho đồng bộ với bản HTML đã sửa cụm cấm ở trên. **Bài học quy trình:** nhánh Claude tạo ra PHẢI được merge vào `main` (hoặc ít nhất mở PR) ngay trong phiên tạo ra nó — không để trôi nổi trên remote, dễ mất nội dung/bugfix đã làm.

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
| `ctv_dashboard.html` | Trang game "Cộng tác viên" CÔNG KHAI (thêm 22/07/2026, đổi sang mô hình đơn giản cùng ngày) — KHÔNG cần đăng nhập/tài khoản, ai cũng vào chơi được, chỉ điền Tên + SĐT khi nhận thưởng |

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

**Game "Cộng tác viên" công khai (thêm 22/07/2026, đổi mô hình cùng ngày):** KHÔNG phải 1 vai trong bảng trên (không có Firebase Auth account, không role trong `users/{uid}` theo uid) — Founder chốt làm đơn giản tối đa để tăng tỷ lệ tham gia: ai cũng vào `ctv_dashboard.html` chơi ngay, làm nhiệm vụ tự khai báo (theo dõi Fanpage `facebook.com/applamnha`, quan tâm Zalo OA `zalo.me/alnsanthietke`, bình luận bài viết, chia sẻ link giới thiệu), chỉ điền **Tên + SĐT** khi bấm "Nhận Gạch ngay". Không mật khẩu, không đăng nhập, không màn hình đăng ký riêng.
- Backend: `functions/ctvGame.js` — Cloud Function `onCall` KHÔNG yêu cầu `request.auth`: `ctvGetProfile({phone})` tra Gạch/Kim Cương, `ctvClaimTasks({name,phone,taskIds,refBy})` cộng Gạch idempotent (ledger `ctv_task_{taskId}_{sđt}`, chặn nộp trùng). Ghi vào `users/{sđt}` — **doc ID là số điện thoại**, không có Auth account tương ứng, `role:'ctv_lead'`. Đi qua Admin SDK nên không cần mở `firestore.rules` cho đọc/ghi ẩn danh.
- Link giới thiệu sau khi nhận thưởng lần đầu: `register.html?cref={sđt}` → ghi field `referredByCtv` (giá trị là SĐT, khác định dạng uid Firebase của NCC) lên user CN mới đăng ký. `bricksOnFirstPayment` (`functions/bricks.js`) đọc field này song song `referredByNcc`. **HỢP NHẤT 22/07/2026 (3):** trước đó 2 đường tách biệt (NCC nhận 1 Kim Cương, CTV nhận 15% C1 VNĐ) — gộp lại vì cùng hành vi (giới thiệu khách ký HĐ) mà 2 mức thưởng khác nhau tạo lệch lạc động lực (NCC có lý do bỏ gian hàng, dùng SĐT cá nhân chơi CTV để hưởng mức cao hơn). Giờ **CẢ NCC lẫn CTV đều nhận 15% tiền C1 thật bằng VNĐ như nhau** (`REFERRAL_PAYOUT_PCT`, hàm `awardReferralPayout`, cộng dồn `users/{id}.referralPendingVnd` — field DÙNG CHUNG, `id` là uid Firebase Auth cho NCC hoặc SĐT cho CTV — ledger `referral_payout_c1paid_{pid}` unit `vnd`, push Founder "💰 Thưởng giới thiệu mới"). Hàm `awardDiamond`/field `alnDiamonds` vẫn giữ trong code (không xoá) nhưng hiện KHÔNG còn sự kiện tự động nào gọi tới. **Chưa có luồng RÚT tiền tự động** (OTP Firebase Phone Auth + form ngân hàng + khấu trừ thuế TNCN) — số dư chỉ tích luỹ hiển thị (đã thêm vào `ncc-dashboard.html` card "Gạch & Kim Cương ALN"), Founder chi tay khi nhận push.
- Nhiệm vụ: 4 loại cố định (sửa ở `CTV_TASKS` trong `functions/ctvGame.js` + mảng `TASKS` trong `ctv_dashboard.html`, phải sửa ĐỒNG BỘ cả 2 nơi): theo dõi Fanpage, quan tâm Zalo OA, bình luận bài viết, chia sẻ link — mỗi loại 1 lần/đời/SĐT. **Từ 22/07/2026 thêm cơ chế giữ chân (không cần cron/config nào):** (1) **nhiệm vụ TUẦN** — `WEEKLY_TASK_BANK` (5 mẫu, 20 Gạch) rotate tự động theo số tuần epoch (`currentWeeklyTask()`, taskId dạng `weekly_{key}_w{wk}` tự nhúng tuần nên ledger idempotent có sẵn tự cho làm lại mỗi tuần); (2) **chuỗi tuần (streak)** — làm nhiệm vụ tuần liên tiếp được bonus tăng dần +5/+10/... trần +25 (`streakBonusOf`, field `ctvWeeklyStreak`/`ctvLastWeeklyWeek`, ledger `ctv_streak_w{wk}_{sđt}`); (3) **vòng quay may mắn** — 1 lượt/tuần sau khi làm nhiệm vụ tuần, giải 5/10/15/20/50 Gạch có trọng số (`ctvSpinWheel`, `SPIN_PRIZES` phải khớp `WHEEL_PRIZES` trong `ctv_dashboard.html`, ledger `ctv_spin_w{wk}_{sđt}`); (4) **bảng xếp hạng công khai** top 20 ẩn 3 số cuối SĐT (`ctvLeaderboard`, sort trong bộ nhớ — không cần index). **Chưa có** nhiệm vụ "đi chợ giùm"/"nhật ký xây nhà" (cần nộp ảnh/bài, phức tạp hơn honor-system đơn giản hiện tại).
- **Quy trình đăng bài nuôi game (chốt 22/07/2026, không cần code):** mỗi bài Fanpage mới nên kèm dòng nhiệm vụ tuần ở cuối caption (vd *"🧱 CTV ALN: bình luận bài này = +20 Gạch + 1 lượt quay may mắn → applamnha.vn/ctv_dashboard.html"*); mỗi tuần đăng 1 bài vinh danh Top 3 CTV (lấy từ bảng xếp hạng ngay trên `ctv_dashboard.html`) — vừa giữ chân người chơi cũ vừa là quảng cáo tuyển CTV mới.
- **Mời bạn cùng chơi (thêm 22/07/2026)** — 2 link giới thiệu TÁCH BIỆT trên `ctv_dashboard.html`, đừng nhầm lẫn:
  1. **`ctv_dashboard.html?ref={sđt người mời}`** (thẻ "Rủ bạn cùng chơi") — dành cho việc mở rộng MẠNG LƯỚI CTV. Người được mời vào chơi + hoàn thành nhiệm vụ ĐẦU TIÊN (bất kỳ nhiệm vụ nào) → người mời được cộng thẳng **+15 Gạch, một lần duy nhất/người được mời** (`awardCtvInviteBonus` trong `functions/ctvGame.js`, ledger `ctv_invite_{sđt mời}_{sđt mới}`). Đây là thưởng MỘT TẦNG — không ăn theo hoạt động về sau của người được mời (đúng nguyên tắc "KHÔNG thưởng đa tầng" đã chốt ở mục Gạch & Kim Cương phía trên, tránh cấu trúc đa cấp).
  2. **`register.html?cref={sđt CTV}`** (thẻ "Link giới thiệu khách xây nhà", có từ trước) — dành cho việc giới thiệu KHÁCH HÀNG (CN sắp xây nhà), thưởng 15% tiền C1 khi CN ký HĐ thật (xem mục "Chương trình NCC/CTV giới thiệu Chủ nhà" phía trên).
  - Client đọc `?ref=` lúc vào trang, nhớ qua `localStorage` (key `aln_ctv_refby`) phòng khi rời trang rồi quay lại mới nhận thưởng, gửi kèm field `refBy` khi gọi `ctvClaimTasks`.
- **Chống gian lận (thêm 22/07/2026)** — vì game công khai, ẩn danh, không OTP nên là mục tiêu dễ bị bot/script farm nhất trên toàn hệ thống. Đã chốt 3 lớp:
  1. **`enforceAppCheck: true`** bật cho CẢ 5 hàm `ctvGetProfile/ctvGetWeeklyTask/ctvLeaderboard/ctvClaimTasks/ctvSpinWheel` — KHÁC với mọi `onCall` khác trong hệ thống (toàn bộ các hàm còn lại đang để KHÔNG enforce, xem `project_appcheck_task` — lý do cũ là token hay fail trên thiết bị thật). Đã test thật trên domain `applamnha.vn` sau khi bật: console vẫn báo `appCheck/recaptcha-error` lặp lại nhiều phút, NHƯNG cuộc gọi `ctvClaimTasks` thật vẫn thành công (SDK tự retry nền, token sau cùng vẫn lấy được) — rủi ro thấp hơn lo ngại ban đầu nhưng CHƯA loại trừ hẳn (thiết bị chặn reCAPTCHA hẳn — ad-block, mạng công ty — vẫn có thể bị chặn). Nếu Founder thấy tỷ lệ claim lỗi tăng bất thường, đây là chỗ đầu tiên cần kiểm tra/tắt.
  2. **Trần thưởng mời**: `CTV_INVITE_DAILY_CAP = 10` lượt/SĐT người mời/ngày (giờ VN, field `ctvInviteDailyDate`/`ctvInviteDailyCount` trên `users/{sđt}`) — chặn kịch bản script tự sinh SĐT giả hàng loạt để cày +15 Gạch vô hạn qua link mời.
  3. **`scanCtvSuspicion`** — cron 08:20 giờ VN hàng ngày (`functions/ctvGame.js`), CHỈ CẢNH BÁO Founder qua push (không tự khoá/thu hồi, cùng nguyên tắc `scanC2Suspicion`): phát hiện (a) tài khoản hoàn thành nhiệm vụ <15s sau khi tạo (honor-system không thể xong thật nhanh vậy), (b) nhiều SĐT liền kề nhau tạo trong 24h (dấu hiệu sinh hàng loạt), (c) 1 người mời nhận ≥5 thưởng mời/ngày dù đã có trần.
  - **Vẫn còn hở, chấp nhận được cho tới khi có redemption thật:** honor-system 4 nhiệm vụ tĩnh + nhiệm vụ tuần không xác minh được nội dung thật (chỉ chặn nộp trùng) — nhưng Gạch tự nó KHÔNG quy đổi được ra tiền (chỉ đường 1000 Gạch→1 Kim Cương→100k, CHƯA code, sẽ bắt buộc OTP Firebase Phone Auth mới rút được — đây mới là chốt chặn Sybil thật sự trước khi có tiền thật liên quan).
  - **Đã hỏi lại Founder (22/07/2026) về việc "CTV khai đã làm nhưng chưa làm thật":** giữ nguyên honor-system cho follow Fanpage/Zalo/bình luận/chia sẻ — KHÔNG thêm mã xác nhận (từ chối đề xuất), vì xác minh thật đòi hỏi Facebook/Zalo OAuth (user phải đăng nhập, phá vỡ đúng thứ Founder muốn tránh) và Facebook App Review vẫn chưa duyệt (xem mục "Ngoài code" cuối file). **Phát hiện + đã sửa 1 bug thật khi bàn việc này:** `WEEKLY_TASK_BANK` từng có mục `forum_comment` ("Bình luận trên Diễn đàn ALN") — nhưng `forumComment` (`functions/forum.js`) bắt buộc `requireAuth`, tức CTV ẩn danh (không Firebase Auth) KHÔNG THỂ hoàn thành nhiệm vụ này dù có muốn — đã thay bằng `share_group` ("Chia sẻ bài viết ALN vào 1 nhóm Facebook xây nhà/nội thất"), không cần tài khoản, cùng dạng honor-system với 4 mục còn lại. Bài học: mọi nhiệm vụ mới thêm vào `WEEKLY_TASK_BANK` PHẢI tự làm được mà không cần đăng ký/đăng nhập bất kỳ hệ thống nào của ALN.
- **Đánh đổi đã chấp nhận:** không xác minh thật đã follow/comment hay chưa (honor system) — chỉ chặn nộp trùng nhiều lần qua ledger. Tra cứu bằng SĐT không có xác thực (không OTP) — ai biết SĐT người khác cũng xem được số Gạch của họ; chấp nhận được vì Gạch không quy đổi tiền trực tiếp, đổi lại giữ được sự đơn giản Founder yêu cầu.
- ~~CHƯA deploy~~ — đã deploy thành công 22/07/2026 (`functions:ctvGetProfile,functions:ctvClaimTasks,functions:bricksOnFirstPayment`). Backend đang chạy thật.

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
- **Demo data:** `SHOW_DEMO_FALLBACK=true` trong `ncc-showcase.html` trộn 14 gian hàng mẫu (`MOCK_DATA`, `isDemo:true`, không SĐT/Zalo/website thật, không tên thương hiệu thật) sau data thật; mỗi thẻ có badge "Minh hoạ". Từ 20/07/2026: tự ẩn theo TỪNG DANH MỤC — danh mục nào đã có ≥`MOCK_HIDE_THRESHOLD` (mặc định 3) NCC thật thì mock của đúng danh mục đó tự biến mất, không cần Founder sửa tay. `ncc_profile.html` có `MOCK_DATA` riêng (phải sửa đồng bộ cả 2 nơi) + chế độ xem thử toàn trang `?demo=1`. `demo-06` "Thiết Bị Điện Phú Hưng" có sẵn 6 `products[]` mẫu để xem trước khối "Sản phẩm nổi bật".
- **Điểm chạm trong luồng dự án (20/07/2026):** `kts_dashboard.html` (panel chi tiết dự án `mplRenderDetail`), `client_CN.html` và `client_DN.html` (`renderMain`) hiện khối "Gợi ý NCC vật tư" khi `projects/{pid}.stage !== 'C1'` (tức từ C2 "Phối cảnh 3D" trở đi — lúc bắt đầu chọn vật liệu/nội thất cho phương án, không đợi tới C4) — ưu tiên NCC cùng `meetingProvince` với dự án, dự phòng NCC toàn quốc nếu tỉnh chưa đủ, tối đa 4 gian hàng, ưu tiên tier cao. Data tải 1 lần lúc vào trang qua `window.NCC_SUGGEST_LIST` (không realtime). Tên NCC do người dùng tự nhập nên các hàm render đều tự escape (`_nccEscH`).
- **Chương trình NCC giới thiệu Chủ nhà (thêm 21/07/2026):** mỗi NCC có link riêng `register.html?ref={ncc_uid}` (hiện trên `ncc-dashboard.html`, card "Giới thiệu khách hàng" + nút copy) — CN đăng ký qua link này được ghi `referredByNcc` trên `users/{uid}`; Cloud Function `onCnRegisteredViaNcc` (`functions/index.js`, trigger `users/{uid}` onCreate) tăng `referralCount` trên `nccApplications/{ncc_uid}`. Founder xem số liệu ở cột "Giới thiệu" trong tab NCC của `founder_panel.html`. **2 cơ chế thưởng KHÁC NHAU, đừng nhầm:** (1) thưởng theo `referralCount` (thang tier/ưu tiên hiển thị gian hàng) — **mới scaffold phần đếm, CHƯA có logic thưởng tự động**, cần làm thêm nếu Founder chốt áp dụng thật; (2) thưởng tiền C1 thật qua `bricksOnFirstPayment` — **ĐÃ chạy thật** từ 22/07/2026 (3), NCC nhận 15% tiền C1 khi CN được giới thiệu ký HĐ + đóng C1, giống hệt CTV (xem mục Game CTV phía trên).
- **Còn tồn đọng (chưa làm, chưa có xác nhận Founder):**
  1. ~~`home.html`/`index.html` chưa có link tới `ncc-showcase.html`~~ — đã thêm chip nhấp nháy nền xanh đen "Mạng lưới Thiết bị - Vật tư ALN" (kèm tagline nhỏ) trong dải `.recruit-strip` "Hợp tác cùng ALN:" trên `index.html` ngày 19/07/2026 (không dùng mục nav riêng, đã thử rồi bỏ vì trùng lặp). Floating badge dùng chung `ncc-network-badge.js` vẫn còn trên `forum.html`/`ncc_profile.html`/`aln_community.html` (đã gỡ khỏi `index.html` vì trùng với chip trên).
  2. Quyền đăng bài diễn đàn của NCC (`NCC_CATEGORIES=['vat_lieu']` trong `functions/forum.js`) gần như vô nghĩa vì tab đã redirect thẳng ra ngoài — chưa quyết giữ hay bỏ.
  3. Chính sách phí gói gian hàng cơ bản sau năm miễn phí đầu tiên (ưu đãi 50 doanh nghiệp đầu tiên trên `ncc-showcase.html`) — chưa quyết, cần chốt trước khi hết hạn miễn phí năm đầu.
  4. ~~Nhánh nháp `claude/ncc-showcase-demo-cithdq`~~ — Founder đã xoá 21/07/2026.
  5. Logic thưởng theo `referralCount` (ưu tiên hiển thị / nâng tier tạm thời / trừ phí năm 2) — mới có đếm số, CHƯA có hành động tự động khi đạt mốc.
  6. **Chiến dịch "Đầu quân về ALN" — Thợ - Đội thi công (Founder CHỐT khung 22/07/2026):** danh mục `dv_thicong` là **lực lượng đầu quân** chuẩn bị cho dịch vụ sửa vặt. **Bắt buộc giữ khuôn pháp lý**: ALN CHỈ kết nối/chuyển lead, KHÔNG là bên cung cấp dịch vụ sửa chữa, KHÔNG thu tiền sửa chữa (cùng ranh giới "đơn vị thi công đối tác" — từng bị AI Overview hiểu sai 22/07/2026, xem mục JSON-LD). Kế hoạch 3 giai đoạn / 6 tuần:
     - **GĐ1 Tuyển quân (23/07→05/08):** bài Fanpage tuyển đội (nội dung đã soạn sẵn, Founder đăng qua MyMy Marketing, tag `ncc-recruit-jul26`) + bản ngắn Founder tự đăng tay vào nhóm FB thợ xây + nhiệm vụ tuần CTV `share_group` lan truyền + Founder nhắn tay mời KTS giới thiệu đội quen (mạng lưới nhỏ, nhắn tay thân tình hơn — KHÔNG build cơ chế thông báo trong kts_dashboard) + bài Cẩm nang `cach-chon-doi-thi-cong-khi-da-co-ban-ve` tự đăng 02/08.
     - **GĐ2 Kích hoạt (05/08→19/08):** mỗi đội đăng ký mới → nhắn Zalo hướng dẫn 3 việc (ảnh công trình lên gian hàng, bảng giá nhân công, lấy link giới thiệu 15% C1); Fanpage đăng 1-2 bài giới thiệu gian hàng tiêu biểu.
     - **GĐ3 Pilot sửa vặt TP.HCM (từ ~01/09, điều kiện: ≥10 đội tỉnh HCM):** form công khai "Cần thợ sửa vặt" (tái dùng pattern `submitHomeLead`), ALN chuyển lead cho 2-3 đội phù hợp, đội tự báo giá + làm việc thẳng với khách. Giá trị chiến lược: mỗi ca sửa vặt = 1 quan hệ chủ nhà tiềm năng xây nhà 2-3 năm tới. **Form CHƯA build — làm khi chạm điều kiện ≥10 đội HCM.**
     - **Mục tiêu 6 tuần:** +15-20 gian hàng `dv_thicong` hoạt động thật; ≥3 CN đăng ký qua link giới thiệu của đội thợ; 10 lead sửa vặt đầu tiên. Chi phí 0đ (organic thuần) — chỉ cân nhắc ads nhỏ 200-500k nếu sau 2 tuần tuyển chậm.

## Diễn đàn (forum.html) — cơ chế "mồi" giữ diễn đàn trông sống động

Diễn đàn không chỉ là nơi hỏi đáp — đúng vai trò là **trang mồi** để đón traffic từ ads/tìm kiếm, cần trông luôn hoạt động (không "eo sèo") để không mất uy tín với khách mới vào.

- **`founder_forum.html` → tab "Công cụ"** có sẵn bộ 3 nút cho mục "🕒 RẢI BÀI THEO NGÀY (drip)":
  1. **"Nạp kho drip"** — nạp các câu hỏi hardcode trong `hoiKtsBank()` (`functions/forum.js`) vào collection `hoiKtsQueue` (status `queued`), bỏ qua item đã `published/done` (idempotent).
  2. **"Bật / Tắt drip"** — toggle cờ `FORUM_HOIKTS_DRIP_ENABLED` (`forumConfig/flags`). Cron `exports.forumHoiKtsDrip` (`0 8,11,14,17,20 * * *` giờ VN) chỉ chạy thật khi cờ này bật — mỗi lần chạy random đăng 0-2 câu mới + tự "trổ" dần câu trả lời của các câu đã đăng trước theo mốc giờ định sẵn trong `D` (2h/6h/18h/30h/48h/66h sau khi đăng), tự nhiên như người thật đang thảo luận.
  3. **"Đăng ngay 1 câu (test)"** — chạy thử ngay 1 vòng để xem kết quả tức thì, không cần đợi cron.
- **21/07/2026 phát hiện:** cờ drip **đã BẬT sẵn** nhưng forum vẫn "eo sèo" (bài mới nhất dừng ở 9/7) — nguyên nhân thật là **kho `hoiKtsBank()` đã cạn** (toàn bộ ~16 câu gốc đã `published`, "Nạp kho drip" không tạo thêm được gì vì code idempotent bỏ qua item đã đăng). Đã viết bổ sung tổng cộng **30 câu mới** (2 đợt: 10 + 20) — kho hiện có 46 câu, ước chạy được ~2 tuần ở tốc độ 2-4 câu/ngày.
- **Cần lặp lại định kỳ (~10-12 ngày/lần):** viết thêm câu hỏi mới vào cuối mảng `hoiKtsBank()` (kiểm tra tránh trùng chủ đề các câu đã có), giữ đúng văn phong (chủ nhà hỏi thực tế + nhiều KTS persona trả lời, 1 câu đánh dấu `best:true`), tránh cụm từ cấm ("xây nhà trọn gói"...). Sau khi thêm, deploy `functions:forumAdmin,functions:forumHoiKtsDrip`, nhắc Founder bấm lại "Nạp kho drip". Đã tự đặt lịch nhắc (`send_later`) cho đợt tiếp theo ~02/08/2026 — không cần Founder tự nhớ.
- **Lưu ý key persona:** mọi item trong `hoiKtsBank()` dùng `k: KP.<key>` — `<key>` phải khớp đúng tên biến trong object `KP` (vd `khanh` không phải `baokhanh`, dù `uid`/`name` bên trong là "baokhanh"/"Bảo Khánh") — sai key gây lỗi runtime khi drip chạy tới item đó. Luôn `node --check` sau khi sửa `functions/forum.js`.
- **Ngoài cơ chế Hỏi KTS**, còn có `seedForumData()` (11 bài đủ chuyên mục, chạy 1 lần qua nút "Nạp dữ liệu mẫu") và `seedHoiKtsData()` (20 câu bản gốc, khác với `hoiKtsQueue`/drip) — đã rà và sửa 1 chỗ dùng cụm "xây nhà trọn gói" trong tiêu đề bài seed của `seedForumData()` ngày 21/07/2026.

## Gạch & Kim Cương ALN — hệ thống điểm thưởng gamification (P1, thêm 21/07/2026)

Ý tưởng Founder: "game hoá" đóng góp của mọi vai (đặc biệt nhắm nhóm rảnh rỗi/chị em nội trợ — nguồn khách CN tiềm năng qua mối quan hệ cá nhân, không tốn quảng cáo). Đã chốt **định vị pháp lý 2 tầng** sau khi thảo luận kỹ (tránh cả 2 bẫy: tiền ảo bất hợp pháp VÀ mô hình đa cấp hình sự):

- **Gạch** (`alnBricks`) — điểm thưởng khuyến mãi thuần: KHÔNG mua bằng tiền, KHÔNG đổi ra tiền, KHÔNG chuyển nhượng giữa người dùng. Chỉ đổi ưu đãi dịch vụ trong ALN (giảm phí thiết kế, nâng hạng NCC, quà...). Sinh ra từ: đăng ký tài khoản (welcome), chặng dự án được duyệt (CN + KTS), NCC có CN đăng ký qua link ref. Founder trao tay được qua `founderAwardBricks` (nhiệm vụ chưa tự động hoá: chia sẻ bài, "đi chợ giùm" chụp giá vật liệu, viết nhật ký xây nhà, thử thách tuần...).
- **Thưởng giới thiệu** (trước gọi "Kim Cương"/`alnDiamonds`, đã đổi sang trả THẲNG VNĐ từ 22/07/2026 (3) — xem field `referralPendingVnd`) — CHỈ trao khi có **kết quả doanh thu thật đã xác nhận** (CN được giới thiệu ký hợp đồng + tiền C1 đã thực nhận vào tài khoản ALN — không trao khi mới đăng ký), mức **15% tiền C1**, áp dụng NHƯ NHAU cho NCC và CTV. Bản chất là hoa hồng giới thiệu (hợp pháp, khác tiền ảo). Founder duyệt tay từng lệnh chi — **CHƯA làm** luồng RÚT tự động (OTP + form ngân hàng + khấu trừ thuế TNCN), mới dừng ở cộng dồn `referralPendingVnd` + push báo Founder. Field `alnDiamonds` vẫn còn trong code (hàm `awardDiamond`) nhưng hiện không có sự kiện tự động nào gọi tới — giữ lại phòng khi Founder muốn dùng cho việc khác.
- **KHÔNG có thưởng đa tầng** (ăn theo hoạt động tuyến dưới của người mình giới thiệu) — tránh cấu trúc đa cấp cần giấy phép (Điều 217a BLHS nếu làm chui).
- Tên gọi công khai: luôn dùng **"Gạch"/"Kim Cương"**, KHÔNG dùng "xu/coin/tiền ALN" — tránh liên tưởng tiền ảo.

**Kiến trúc (`functions/bricks.js`):**
- `bricksLedger/{ledgerId}` — sổ cái bất biến, `ledgerId` đặt cố định theo sự kiện (vd `welcome_{uid}`, `stage_approved_cn_{pid}_{stage}`, `referral_payout_c1paid_{pid}` cho thưởng giới thiệu) → tự idempotent, trigger chạy lại không cộng đúp. CHỈ Cloud Functions ghi (Admin SDK bypass rules) — **không cần sửa `firestore.rules`** cho P1 vì client không đọc/ghi trực tiếp collection này.
- Số dư cache `users/{id}.alnBricks` / `.alnDiamonds` / `.referralPendingVnd` — đọc được ngay vì rule `users/{uid}` đã có `allow read: if signedIn()` từ trước, không cần mở rule mới.
- Trigger tự động: `bricksOnUserCreated` (welcome + NCC ref — **loại trừ `role==='ctv_lead'`** từ 22/07/2026, xem bug bên dưới), `bricksOnStageAdvanced` (chặng C1-C4 duyệt xong), `bricksOnFirstPayment` (thưởng giới thiệu 15% C1 khi chuyển `status:'paid'` lần đầu, tra `referredByNcc` HOẶC `referredByCtv` trên user CN — thống nhất từ 22/07/2026 (3)).
- **Bug đã sửa 22/07/2026 (phát hiện qua smoke test E2E thật trước khi mở thử nghiệm CTV):** `bricksOnUserCreated` lắng nghe `users/{uid}` onCreate — trigger cho MỌI doc mới trong collection, kể cả `users/{sđt}` do `ctvGame.js` tạo cho CTV ẩn danh, vô tình cộng thêm +10 Gạch "welcome" ngoài ý muốn (CTV chỉ nên nhận Gạch qua nhiệm vụ). Đã thêm `if (d.role === "ctv_lead") return null;` đầu hàm.
- `founderAwardBricks` (onCall, chỉ FOUNDER_UID) — trao/thu tay, trần ±1000 Gạch/lần, bắt buộc `reason`.

**Còn tồn đọng (chưa làm):**
1. ~~UI hiển thị~~ — đã làm xong TOÀN BỘ 5 trang (21-22/07/2026): card "Gạch của tôi" ở sidebar `client_CN.html`, `kts_dashboard.html`, `designer_dashboard.html`, `ncc-dashboard.html` (hiện tên cấp bậc + thanh tiến độ + Kim Cương nếu >0, cập nhật realtime qua `onSnapshot users/{uid}`, hàm dùng chung `renderAlnBricksCard()` định nghĩa riêng từng file cùng logic) + `founder_panel.html` có tab riêng "Gạch & Kim Cương" (nhóm THÀNH VIÊN) — bảng xếp hạng toàn hệ thống (lọc vai, tìm kiếm), nút "Trao Gạch" gọi `founderAwardBricks`. Lưu ý `ncc-dashboard.html`: Gạch/Kim Cương đọc từ `users/{uid}` qua biến `USER_PROFILE` riêng (khác `nccApplications/{uid}` nơi dữ liệu gian hàng `DATA` sống).
2. ~~Cấp bậc~~ — đã chốt 21/07/2026: **Nền Móng (0) → Khung Nhà (50) → Mái Ấm (150) → Biệt Thự (400) → Dinh Thự (1000)** Gạch, đề xuất của Claude dựa theo tốc độ tích Gạch từ các sự kiện đã code (`BRICK_AMOUNTS` trong `functions/bricks.js`) — đã đưa vào mảng `ALN_TIERS` (client-side, lặp lại ở CẢ 5 file trên, chưa refactor thành 1 nguồn chung — nợ kỹ thuật, chưa gấp).
3. **Chuyên mục diễn đàn "Tổ ấm & Nhà đẹp"** + thử thách tuần + chương trình "Đại sứ ALN khu phố" — mới là ý tưởng, chưa có category/cơ chế thật.
4. **Thể lệ chi trả Kim Cương ra tiền thật** — mức quy đổi, ngưỡng rút, form nhập tài khoản ngân hàng, khấu trừ thuế TNCN, màn duyệt chi cho Founder — hoàn toàn CHƯA làm, mới dừng ở trao Kim Cương + thông báo.
5. Nhiệm vụ "đi chợ giùm" (chụp giá vật liệu) và "nhật ký xây nhà" — chưa có form nộp + hàng chờ duyệt trong `founder_panel.html`/`founder_forum.html`.
6. ~~Chưa deploy~~ — đã deploy thành công 21/07/2026 (`functions:bricksOnUserCreated,functions:bricksOnStageAdvanced,functions:bricksOnFirstPayment,functions:founderAwardBricks`). Backend + UI (client_CN, kts_dashboard) đang chạy thật.
7. ~~Không có cửa vào cho người ngoài mạng lưới ALN~~ — đã làm 22/07/2026, **2 lần**: lần 1 làm vai `ctv` có tài khoản (Firebase Auth, `register.html` tab riêng) — Founder thấy vẫn rườm rà, yêu cầu đơn giản hơn nữa. Lần 2 (cùng ngày) **thay thế hoàn toàn**: `ctv_dashboard.html` giờ là trang công khai không cần đăng nhập, `functions/ctvGame.js` xử lý qua SĐT — xem chi tiết mục "Game Cộng tác viên công khai" phía trên (ngay sau bảng Vai trò hệ thống). Thưởng giới thiệu khi CTV giới thiệu CN ký HĐ + đóng C1 **đã nối xong** — từ 22/07/2026 CTV nhận **15% tiền C1 bằng VNĐ** (không phải Kim Cương đếm số như NCC — xem chi tiết mục "Game Cộng tác viên công khai"). Hình ngôi nhà xây dần theo Gạch (`alnHouseSVG`) có ở cả `ctv_dashboard.html` lẫn `client_CN/kts_dashboard/designer_dashboard/ncc-dashboard`, **chưa có ở `founder_panel.html`** (bảng xếp hạng dạng bảng, chưa cần hình — lưu ý bảng xếp hạng đó sẽ KHÔNG thấy người chơi CTV ẩn danh vì họ không phải Firebase Auth user, cần query thêm nếu muốn Founder xem cả nhóm này). ~~Vòng quay may mắn và bảng xếp hạng công khai~~ — đã làm + deploy 22/07/2026 (cùng nhiệm vụ tuần + streak, xem mục Game CTV). **Còn thiếu:** nhiệm vụ "đi chợ giùm"/"nhật ký xây nhà" (cần nộp ảnh/bài, chưa hợp với honor-system đơn giản hiện tại); màn RÚT tiền thưởng giới thiệu cho CTV (OTP + form ngân hàng).

## MyMy Marketing (module Founder-only: đăng Buffer + báo cáo GA4) — thêm 20/07/2026

Agent RIÊNG, KHÔNG dùng chung allowlist/session với `runMyMyTurn`/`runMyMyTurnCN` (2 cái đó chạy theo uid khách DN/CN, không có role check — không an toàn nếu gắn tool chi tiền/đăng công khai vào chung).

- **Function:** `runMyMyMarketingTurn` (`functions/mymyMarketing.js`), gate `request.auth.uid === FOUNDER_UID`. Session: `mymy_marketing_sessions/{founderUid}`. UI: nút "Chat với MyMy Marketing" trong `founder_panel.html` tab Trợ lý Marketing.
- **Tool:** `scheduleMarketingPost` (đăng Buffer, UTM, khung giờ vàng 11:30-13:00/19:30-21:00 giờ VN, idempotency, luôn qua `request_confirmation` kể cả bài organic), `getMarketingReport` (đọc GA4 theo `campaign_tag`, tái dùng `settings/seoReport.ga4PropertyId` có sẵn — KHÔNG tạo config GA4 riêng), `cancelMarketingPost`.
- **Buffer API:** GraphQL (`api.buffer.com`, header `Authorization: Bearer`) — API REST cũ (`api.bufferapp.com/1/...`) đã bị Buffer khai tử, đã xác nhận schema thật qua `developers.buffer.com/reference.html` (không phải đoán). Secret `BUFFER_ACCESS_TOKEN`. Config kênh: `settings/marketing.bufferChannels = {facebook: "<channel id>"}` — Channel ID lấy qua GraphQL `channels(input:{organizationId})`, KHÔNG phải "profile_id" kiểu cũ.
- **Đã deploy & set secret xong**, Facebook "App Làm Nhà" đã kết nối Buffer + đã lấy Channel ID thật (`6a5debc8e2638b94d79e8f3f`) + đã ghi vào `settings/marketing.bufferChannels.facebook`.
- **Còn tồn đọng (chưa làm/chưa test):**
  1. ~~`scheduleMarketingPost`/`cancelMarketingPost` CHƯA từng chạy thật lần nào~~ — đã test thật 21/07/2026: phát hiện + sửa 2 bug thật qua vòng test trực tiếp (idempotency coi bài thất bại là trùng lặp chặn thử lại; thiếu `metadata.<network>.type` khiến Buffer từ chối bài Facebook với lỗi "require a type", đúng enum là chữ thường `"post"` không phải `"POST"`) — bài test đã lên lịch `scheduled` thành công, Founder chọn để đăng thật lúc 19:30 tối 21/07. `cancelMarketingPost` vẫn CHƯA test (Founder chọn không huỷ bài test).
  2. ~~`getMarketingReport` chưa test~~ — đã test thật 21/07/2026: phát hiện + sửa bug thật — `runMyMyMarketingTurn` thiếu ghim `serviceAccount: "aln-platform@appspot.gserviceaccount.com"` (functions v2 mặc định chạy SA `compute` khác với `appspot` mà Founder đã cấp quyền GA4, gây lỗi 403 dù cấp đúng quyền — cùng bug/cách sửa đã áp dụng cho `seoReportNow`). Sau khi sửa, tool chạy được, trả về sessions=0/conversions=0 cho campaign `test-mymy-jul21` — **hợp lý** vì bài test chưa có ai bấm link, không phải lỗi. **Chưa test được** trường hợp có traffic thật + key event GA4 đã bật (cần đợi 1 campaign thật có người tương tác để xác nhận nốt).
  3. Instagram + TikTok chưa có tài khoản — chưa kết nối Buffer, `settings/marketing.bufferChannels` mới có `facebook`.
  4. Không có UI trong `founder_panel.html` để sửa `bufferChannels` — phải vào thẳng Firestore Console.
  5. Không có dashboard xem lại lịch sử `marketing_posts` — chỉ hỏi qua chat MyMy.
  6. ~~Quy tắc đặt tên `campaign_tag`~~ — đã chốt 21/07/2026, xem bảng quy ước ngay dưới đây.
  7. Đổi model AI (`claude-sonnet-4-6` → mới hơn) cho cả 3 agent MyMy — xem mục P2 bên dưới.
  8. ~~Nhánh `claude/review-optimization-r49lr4`~~ — Founder đã xoá 21/07/2026.
- **Tiện thể sửa luôn (20/07/2026):** `runMyMyTurn` (MyMy DN) trước đó thiếu xưng hô anh/chị theo giới tính dù đã có field `users/{uid}.gender` sẵn (client_CN.html đã làm đúng từ lâu, DN bị bỏ sót) — đã sửa, đọc thẳng `gender` server-side, không cần sửa `client_DN.html`. MyMy Marketing xưng "anh Long" (lấy tên thật Founder). Cả 2 đã deploy nhưng CHƯA được Founder xác nhận lại đã đúng trong chat thật.

### Quy ước đặt tên `campaign_tag` (chốt 21/07/2026)

Format: `{mục-đích}-{mô-tả-ngắn tuỳ chọn}-{tháng}{năm 2 số}` — chỉ chữ thường/số, nối bằng gạch ngang, ≤60 ký tự (khớp regex validate trong `mymyMktValidCampaignTag`).

| Mục đích | Prefix | Ví dụ |
|---|---|---|
| Tuyển KTS | `kts-recruit` | `kts-recruit-jul26` |
| Tuyển DN (chủ đầu tư/doanh nghiệp) | `dn-recruit` | `dn-recruit-jul26` |
| Tuyển Designer nội thất | `designer-recruit` | `designer-recruit-jul26` |
| Tuyển gian hàng NCC | `ncc-recruit` | `ncc-recruit-jul26` |
| Quảng bá Mạng lưới NCC | `ncc-showcase` | `ncc-showcase-jul26` |
| Hợp tác đối tác (BD, agency, sàn BĐS...) | `bd-partner` | `bd-partner-jul26` |
| Nội dung thường kỳ (Cẩm nang, kiến thức) | `content-weekly` | `content-weekly-jul26` |
| Quảng bá thương hiệu chung | `brand-awareness` | `brand-awareness-jul26` |
| Sự kiện/khuyến mãi theo mùa | `event-promo` | `event-promo-jul26` |
| Test/nội bộ (không tính vào báo cáo thật) | `test-mymy` | `test-mymy-jul21` |

Cần mô tả chi tiết hơn (theo tỉnh/chiến dịch riêng) thì chèn giữa: `bd-partner-hcm-jul26`. MyMy Marketing nên gợi ý chuẩn hoá theo bảng này khi Founder đặt tên khác định dạng (đã có sẵn ở QUY TẮC BẮT BUỘC mục 4 trong system prompt).

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
2. **Nâng cấp model AI cho cả 3 agent MyMy** (chưa quyết, chờ Founder chốt) — `runMyMyTurn` (DN), `runMyMyTurnCN` (CN), `runMyMyMarketingTurn` (Marketing, chỉ Founder) đang gọi cứng `model:"claude-sonnet-4-6"` trong từng file (`functions/index.js` cho 2 cái đầu, `functions/mymyMarketing.js` cho cái sau). Đổi sang model mới hơn (vd `claude-sonnet-5`) sẽ trả lời tự nhiên/thông minh hơn nhưng tốn phí/lượt gọi cao hơn — cần quyết đổi cả 3 cho đồng bộ hay chỉ riêng 1 agent.

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
