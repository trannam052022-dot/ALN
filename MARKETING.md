# MARKETING.md — ALN (App Làm Nhà)

> Blueprint marketing automation. Đặt cạnh `CLAUDE.md` trong repo để Claude Code dựng theo.
> Mục tiêu: **(1) Kéo chủ nhà về đăng ký — (3) Chuyển lead thành giao dịch thật.**

## Nguyên tắc cốt lõi

1. **Speed-to-lead:** liên hệ trong **≤ 5 phút** sau khi điền form — đây là đòn bẩy chốt cao nhất trong ngành xây/thiết kế nhà.
2. **Nuôi lòng tin dài hạn:** xây nhà là quyết định lớn, chậm. Automation đưa người đủ tiêu chuẩn VÀO buổi tư vấn và giữ lead không nguội. **Con người (KTS) mới là người chốt.**
3. **Rẻ + real-time:** dùng Firebase (đã có) + register.html (đã có). Chỉ tốn tiền thật ở ngân sách quảng cáo.

## Kiến trúc Speed-to-Lead Loop

```mermaid
flowchart TD
  A[register.html: form chủ nhà] --> B[(Firestore: leads/{id})]
  B -->|onCreate trigger| C[Cloud Function: scoreLead]
  C --> D{Điểm lead}
  D -->|Nóng ≥7| E[Zalo/SMS cảm ơn + link đặt lịch]
  D -->|Ấm 4-6| E
  D -->|Nguội <4| E
  E --> F[Ghi Google Sheet / CRM]
  F --> G[Ping KTS/Sale: Zalo/Telegram để gọi lại]
  G --> H[Lên chuỗi nuôi dưỡng theo điểm]
  H --> I{3 ngày không phản hồi?}
  I -->|Có| J[Tự nhắc follow-up]
  I -->|Không / đã đặt lịch| K[Onboard: tạo tài khoản CN vào app]
```

## Schema lead (form register.html → Firestore `leads/{id}`)

Trường form cần thu (gọn, không lộ dữ liệu nhạy cảm thừa):

| Trường | Kiểu | Ghi chú |
|--------|------|--------|
| `name` | string | Tên chủ nhà |
| `phone` | string | SĐT (để Zalo/SMS + gọi) |
| `projectType` | enum | `xay_moi` / `thiet_ke` / `cai_tao` |
| `area` | number | Diện tích (m²) |
| `budget` | enum | `<1ty` / `1-2ty` / `>=2ty` |
| `hasLand` | bool | Đã có đất chưa |
| `timeline` | enum | `<3thang` / `3-6thang` / `>6thang` |
| `region` | string | Khu vực (tỉnh/quận) |
| `createdAt` | timestamp | serverTimestamp |
| `score` | number | Cloud Function tự điền |
| `tier` | enum | `nong`/`am`/`nguoi` — tự điền |
| `status` | enum | `new`/`contacted`/`booked`/`won`/`lost` |

## Chấm điểm lead (Cloud Function `scoreLead`)

```
score = 0
budget:   >=2ty +3 | 1-2ty +2 | <1ty +1
timeline: <3thang +3 | 3-6thang +2 | >6thang +1
hasLand:  true +2
projectType: xay_moi +2 | thiet_ke/cai_tao +1

tier: score>=7 -> 'nong' | 4-6 -> 'am' | <4 -> 'nguoi'
```

Hành động theo tier:
- **Nóng:** KTS gọi trong 5 phút (ping ngay). Zalo + SMS mời đặt lịch.
- **Ấm:** Zalo cảm ơn + link đặt lịch; gọi trong ngày; vào chuỗi nuôi.
- **Nguội:** Zalo cảm ơn; vào chuỗi nuôi dài; chưa cần gọi gấp.

## Spec Cloud Function (cho Claude Code dựng)

`functions/index.js` — Firestore trigger `onCreate` tại `leads/{id}`:
1. Đọc lead, tính `score` + `tier`, `updateDoc` ghi lại.
2. Gửi **Zalo ZNS** (template đã duyệt) cảm ơn + link đặt lịch (Calendly).
3. Gửi **SMS/email backup** qua Brevo (phòng khi chưa có Zalo).
4. Append lead vào **Google Sheet** (qua Apps Script webhook hoặc Sheets API).
5. Nếu `tier==='nong'`: gửi thông báo KTS/sale (Zalo group / Telegram bot).
6. Tạo doc `followups/{id}` hẹn nhắc sau 3 ngày (một scheduled function quét hằng ngày).

Một **scheduled function** (chạy mỗi sáng) quét `leads` có `status==='new'` quá 3 ngày → gửi nhắc + đánh dấu.

## ⚠️ Chuẩn an toàn & bảo mật (bắt buộc)

- **KHÔNG** đưa Firebase Admin service-account key, Zalo OA secret, Brevo API key vào repo/prompt. Dùng **Cloud Functions env config / Secret Manager**.
- Cấp **least privilege** cho mỗi tích hợp.
- Test trên **project/collection staging** trước khi bật trên dữ liệu thật.
- Tôn trọng quyền riêng tư: chỉ thu dữ liệu cần; có lối **chọn ngừng nhận tin** (opt-out) trong mỗi tin nuôi dưỡng.
- Tuân thủ quy định gửi tin VN (Zalo ZNS cần template được duyệt; tránh spam SMS).

## Chuỗi nội dung nuôi dưỡng (Zalo ưu tiên, email backup)

> Copy mẫu — chỉnh theo giọng thương hiệu. Chèn link đặt lịch + portfolio thật.
> Mỗi tin có lối opt-out cuối.

**Tin 0 — Ngay khi điền form (mọi lead):**
> Chào anh/chị {name}, App Làm Nhà đã nhận thông tin. KTS sẽ liên hệ trong ít phút để tư vấn miễn phí phương án + dự toán sơ bộ cho công trình {area}m² của mình. Anh/chị có thể chủ động đặt lịch tại: {link_dat_lich}

**Tin 1 — Ngày 1 — Bằng chứng năng lực:**
> Gửi anh/chị một vài công trình ALN đã thực hiện gần đây 👇 {link_portfolio}. Mỗi nhà là một câu chuyện riêng — buổi tư vấn sẽ giúp mình hình dung phương án cho chính ngôi nhà của anh/chị.

**Tin 2 — Ngày 3 — Giá trị (định vị chuyên gia):**
> 3 sai lầm khiến chi phí xây nhà đội lên 20–30%: ① thiết kế không khớp ngân sách từ đầu, ② chọn vật tư cảm tính, ③ không có dự toán chi tiết. ALN giúp anh/chị tránh cả 3 ngay từ bản vẽ. Đọc thêm: {link_bai_viet}

**Tin 3 — Ngày 5 — Bằng chứng xã hội:**
> "Nhờ có dự toán rõ ràng từ đầu, nhà mình xây không phát sinh ngoài kế hoạch" — anh T., chủ nhà tại {khu_vuc}. Anh/chị muốn nghe ALN phân tích phương án cho nhà mình chứ? Đặt lịch: {link_dat_lich}

**Tin 4 — Ngày 8 — Minh bạch (gỡ bất an):**
> Quy trình ALN gồm 4 chặng rõ ràng (C1 mặt bằng → C2 phối cảnh → C3 hồ sơ kỹ thuật → C4 thi công), mọi khoản phí công khai, theo dõi tiến độ ngay trên app. Tham khảo bảng giá: {link_bang_gia}

**Tin 5 — Ngày 12 — CTA có thời hạn nhẹ:**
> Tháng này ALN tặng **buổi tư vấn phương án + dự toán sơ bộ miễn phí** cho chủ nhà chuẩn bị khởi công. Slot có hạn — anh/chị giữ chỗ tại: {link_dat_lich}

**Tin 6 — Ngày 18 — Re-engage (nếu chưa phản hồi):**
> Anh/chị {name} còn đang cân nhắc xây/sửa nhà không ạ? Nếu chưa đúng thời điểm, ALN sẽ tạm dừng gửi tin và quay lại khi anh/chị sẵn sàng. Trả lời **CÓ** để nhận tư vấn, hoặc **DỪNG** để ngừng nhận tin.

## Chỉ số phải theo

- **CPL** — chi phí mỗi lead (kéo cầu rẻ tới đâu)
- **Lead → đặt lịch tư vấn (%)** — speed-to-lead + nuôi dưỡng cải thiện
- **Tư vấn → ký hợp đồng (%)** — chất lượng lead + KTS chốt
- **CPA** — chi phí mỗi giao dịch (quyết định lời/lỗ)

Đo bằng **Firebase Analytics + GA4** (miễn phí) + Meta Pixel. Gắn `source/campaign` vào lead để biết kênh nào ra giao dịch rẻ nhất → dồn ngân sách.

## Việc cho Claude Code (thứ tự)

1. Thêm các trường mới vào form `register.html` + ghi `leads/{id}` lên Firestore.
2. Viết Cloud Function `scoreLead` (onCreate) — chấm điểm + ghi lại.
3. Nối Zalo ZNS + Brevo (env vars) — gửi Tin 0 + thông báo KTS cho lead nóng.
4. Scheduled function nhắc follow-up 3 ngày.
5. Dựng chuỗi nuôi dưỡng (Tin 1–6) qua n8n/Make hoặc Cloud Functions + Brevo/Zalo.
6. Gắn Analytics + UTM để đo CPL/CPA.
