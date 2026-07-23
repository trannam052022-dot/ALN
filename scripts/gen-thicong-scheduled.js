/**
 * gen-thicong-scheduled.js — sinh file HTML tĩnh cho các bài SEO "Thi công"
 * đã được Founder duyệt nội dung (thi cong/content-approved/*.md), đặt vào
 * thicong/blog/_scheduled/ theo tên YYYY-MM-DD-slug.html để
 * .github/workflows/auto-publish-thicong.yml quét và xuất bản đúng ngày.
 *
 * Dùng lại nguyên khung HTML/CSS của 3 bài gốc trong thicong/blog/<slug>/index.html
 * (aln-tokens.css + cam-nang.css, header/footer/nav giống hệt). Nội dung mỗi
 * bài lấy nguyên văn từ thi cong/content-approved/NOI_DUNG_BAI_*.md — script
 * này chỉ chuyển định dạng, không viết lại câu chữ.
 *
 * Chạy: node scripts/gen-thicong-scheduled.js
 * Batch tiếp theo (#13+): thêm entry mới vào mảng POSTS bên dưới rồi chạy lại.
 */
const fs = require("fs");
const path = require("path");

const OUT_DIR = path.join(__dirname, "..", "thicong", "blog", "_scheduled");

const CTA_MID_A =
  'Đang tìm hiểu quy trình để chuẩn bị làm việc với đơn vị thi công? <strong><a href="../../lead-form.html">Đăng ký nhận tư vấn miễn phí →</a></strong> — ALN giới thiệu đơn vị thi công đối tác phù hợp khi bạn cần.';
const CTA_MID_B =
  'Muốn được giới thiệu đơn vị thi công đối tác đã đăng ký theo đúng khu vực của bạn? <strong><a href="../../lead-form.html">Đăng ký nhận tư vấn →</a></strong>';

const DISCLAIMER_BULLET =
  "ALN không trực tiếp thi công — nội dung này mang tính tham khảo để bạn làm việc hiệu quả hơn với đơn vị thi công đối tác.";

/* Icon cho card trên thicong/blog/index.html khi publish-thicong-scheduled.js
   dựng entry mới — đọc lại từ comment ALN-SCHEDULE-META trong <head>. */
const TAG_ICON = {
  "Chi phí": "ph-receipt",
  "Khu vực": "ph-map-pin",
  "Chọn nhà thầu": "ph-magnifying-glass",
  "Chuẩn bị": "ph-clipboard-text",
};

const POSTS = [
  {
    date: "2026-07-27",
    slug: "5-sai-lam-chi-phi-xay-nha-doi-gia",
    tag: "Chi phí",
    crumbCur: "Chi phí",
    readTime: "5 phút đọc",
    h1: "5 Sai Lầm Khiến Chi Phí Xây Nhà Đội 20–30% — Và Cách Phòng Tránh",
    metaTitle: "5 Sai Lầm Khiến Chi Phí Xây Nhà Đội 20-30% | ALN",
    metaDesc:
      "Vì sao chi phí xây nhà thường phát sinh vượt dự toán ban đầu? 5 sai lầm phổ biến chủ nhà cần biết trước khi khởi công — và cách phòng tránh.",
    summary: [
      "Chốt thiết kế trước khi có ngân sách rõ ràng",
      "Không có dự toán chi tiết trước khi ký hợp đồng",
      "Chọn vật tư theo cảm tính, không có bảng so sánh",
      DISCLAIMER_BULLET,
    ],
    bodyHtml: `
<p>Rất nhiều chủ nhà khi khởi công với một con số dự toán trong đầu, nhưng đến lúc hoàn thiện lại phải chi thêm 20–30%, thậm chí hơn, so với dự tính ban đầu. Điều đáng nói là phần lớn khoản phát sinh này không đến từ nhà thầu "làm ăn gian dối" như nhiều người vẫn nghĩ, mà đến từ chính khâu chuẩn bị trước khi khởi công. Dưới đây là 5 sai lầm phổ biến nhất — và cách để tránh chúng ngay từ đầu.</p>

<h2>1. Chốt thiết kế trước khi có ngân sách rõ ràng</h2>
<p>Một sai lầm rất thường gặp: chủ nhà bị cuốn theo một bản vẽ đẹp, ưng ý về mặt thẩm mỹ, rồi mới bắt đầu tính xem mình có đủ tiền hay không. Kết quả là khi triển khai thi công, ngân sách không đủ để giữ nguyên thiết kế ban đầu, buộc phải cắt xén hạng mục hoặc đổi vật liệu giữa chừng — và mỗi lần thay đổi giữa chừng đều phát sinh thêm chi phí, cả về vật tư lẫn công thợ làm lại.</p>
<p><strong>Cách phòng tránh:</strong> xác định ngân sách trần trước tiên, sau đó làm việc với kiến trúc sư để thiết kế nằm gọn trong khung ngân sách đó ngay từ bản vẽ đầu tiên, thay vì thiết kế xong mới đi tìm cách "vừa túi tiền".</p>

<h2>2. Không có dự toán chi tiết trước khi ký hợp đồng</h2>
<p>Nhiều hợp đồng thi công chỉ ghi một con số tổng "trọn gói", không tách rõ từng hạng mục: phần móng, phần khung, phần hoàn thiện, phần điện nước... Khi không có sự tách bạch này, chủ nhà không biết đâu là chi phí cố định, đâu là khoản dễ bị đội lên, và cũng khó có căn cứ để chất vấn khi có phát sinh.</p>
<p><strong>Cách phòng tránh:</strong> luôn yêu cầu dự toán được tách theo từng hạng mục cụ thể trước khi đặt bút ký hợp đồng. Một bảng dự toán rõ ràng không chỉ giúp kiểm soát chi phí mà còn là căn cứ để đối chiếu khi có bất kỳ khoản phát sinh nào xuất hiện trong quá trình thi công.</p>

<h2>3. Chọn vật tư theo cảm tính, không có bảng so sánh</h2>
<p>Rất nhiều quyết định về vật tư — gạch, sơn, thiết bị vệ sinh, cửa... — được đưa ra ngay tại công trình, theo lời tư vấn miệng của thợ hoặc người bán vật liệu, mà không có sự so sánh trước. Hệ quả là chủ nhà dễ đổi ý giữa chừng vì không ưng, hoặc vô tình mua đắt hơn giá thị trường vì thiếu thông tin đối chiếu.</p>
<p><strong>Cách phòng tránh:</strong> lập một bảng vật tư chính ngay từ giai đoạn lên dự toán — ghi rõ loại, thương hiệu, mức giá tham khảo cho từng hạng mục quan trọng — và chốt trước khi bước vào thi công phần liên quan.</p>

<div class="cn-cta-mid"><p>${CTA_MID_A}</p></div>

<h2>4. Bỏ qua khảo sát địa chất và hiện trạng trước khi thi công</h2>
<p>Tại nhiều khu vực ở TP.HCM, nền đất yếu hoặc hiện trạng nhà liền kề phức tạp là điều không hiếm gặp. Nếu bỏ qua bước khảo sát kỹ trước khi thi công, các vấn đề về nền móng thường chỉ lộ ra khi đã đào móng — lúc đó việc xử lý phát sinh vừa tốn kém vừa làm chậm tiến độ.</p>
<p><strong>Cách phòng tránh:</strong> xem khảo sát địa chất và hiện trạng là một bước bắt buộc, không phải thủ tục "làm cho có" — đây thường là khoản đầu tư nhỏ giúp tránh được những phát sinh lớn nhất trong toàn bộ quá trình xây dựng.</p>

<h2>5. Không có điều khoản rõ ràng về xử lý phát sinh trong hợp đồng</h2>
<p>Ngay cả khi đã chuẩn bị kỹ, một số phát sinh thực sự nằm ngoài dự tính vẫn có thể xảy ra do điều kiện thi công thực tế. Vấn đề là nhiều hợp đồng không quy định trước cách xử lý những trường hợp này: ai là người xác nhận phát sinh, giới hạn tỷ lệ cho phép là bao nhiêu, thời gian phản hồi ra sao. Thiếu điều khoản này, tranh chấp giữa chủ nhà và nhà thầu rất dễ xảy ra vì không bên nào có căn cứ rõ ràng để đối chiếu.</p>
<p><strong>Cách phòng tránh:</strong> yêu cầu hợp đồng có hẳn một điều khoản quy định quy trình duyệt phát sinh, minh bạch ngay từ đầu.</p>

<hr>

<p>Phần lớn chi phí đội giá không đến từ những điều bất khả kháng, mà đến từ những lỗ hổng có thể phòng tránh được ngay từ khâu chuẩn bị: ngân sách, dự toán, vật tư, khảo sát, và hợp đồng. Càng chuẩn bị kỹ ở những bước này, chủ nhà càng chủ động và yên tâm hơn khi bước vào giai đoạn thi công thực tế.</p>

<p>ALN đang xây dựng mạng lưới kết nối chủ nhà với các đơn vị thiết kế và thi công hoạt động minh bạch, tuân thủ quy trình dự toán rõ ràng ngay từ đầu.</p>`,
    related: [
      { tag: "Chi phí", title: "Cách đọc bảng dự toán thi công không bị \"lùa gà\"", href: "../cach-doc-du-toan-thi-cong/" },
      { tag: "Chuẩn bị", title: "Hợp đồng thi công cần có những điều khoản nào để tránh tranh chấp", href: "../hop-dong-thi-cong-can-dieu-khoan-nao/" },
      { tag: "Cẩm nang làm nhà", title: "Dự toán xây nhà 60 giây", href: "https://applamnha.vn/du-toan/" },
    ],
  },
  {
    date: "2026-07-30",
    slug: "thi-cong-nha-pho-tan-binh",
    tag: "Khu vực",
    crumbCur: "Tân Bình",
    readTime: "3 phút đọc",
    h1: "Thi Công Nhà Phố Tân Bình: Điều Cần Biết Trước Khi Khởi Công",
    metaTitle: "Thi Công Nhà Phố Tân Bình: Điều Cần Biết Trước Khi Khởi Công | ALN",
    metaDesc:
      "Xây nhà tại Tân Bình cần lưu ý gì về hiện trạng khu dân cư, thủ tục pháp lý và lựa chọn đơn vị thi công? Tổng hợp những điều chủ nhà nên biết.",
    summary: [
      "Đặc thù hiện trạng khu vực: hẻm nhỏ, mật độ xây dựng cao",
      "Lưu ý về nhà liền kề: chống lún, chống nứt tường chung",
      "Thủ tục pháp lý cần xác nhận tại UBND quận/phường",
      DISCLAIMER_BULLET,
    ],
    bodyHtml: `
<p>Tân Bình là một trong những khu vực có mật độ dân cư và mật độ xây dựng cao tại TP.HCM, với nhiều tuyến hẻm nhỏ và nhà liền kề san sát. Đặc điểm này khiến việc thi công tại đây có một số lưu ý riêng mà chủ nhà nên nắm trước khi khởi công.</p>

<h2>Đặc thù hiện trạng khu vực</h2>
<p>Nhiều tuyến hẻm tại Tân Bình có chiều rộng hạn chế, ảnh hưởng trực tiếp đến việc vận chuyển vật tư và tập kết máy móc thi công. Trước khi lên kế hoạch, chủ nhà nên khảo sát thực tế đường vào công trình để đơn vị thi công có phương án phù hợp — ví dụ chia nhỏ vật tư, chọn thời điểm vận chuyển hợp lý để tránh giờ cao điểm.</p>

<h2>Lưu ý về nhà liền kề</h2>
<p>Vì mật độ xây dựng dày đặc, thi công tại Tân Bình cần đặc biệt chú ý đến ảnh hưởng với nhà liền kề — từ việc chống lún, chống nứt tường chung, đến việc đảm bảo không gây hư hại trong quá trình đào móng hoặc thi công phần thô. Đây là khu vực mà bước khảo sát hiện trạng nhà liền kề trước khi thi công càng quan trọng hơn so với những nơi có mật độ xây dựng thấp.</p>

<div class="cn-cta-mid"><p>${CTA_MID_B}</p></div>

<h2>Thủ tục pháp lý</h2>
<p>Giấy phép xây dựng, chỉ giới xây dựng, và các quy định liên quan đến khoảng lùi, chiều cao công trình tại khu vực đông dân cư cần được xác nhận cụ thể tại UBND quận/phường nơi xây dựng — vì mỗi khu vực có thể có quy định chi tiết khác nhau tùy theo quy hoạch địa phương. Chủ nhà nên chủ động xác minh trước khi chốt phương án thiết kế, tránh trường hợp thiết kế xong mới phát hiện không phù hợp quy hoạch.</p>

<h2>Chọn đơn vị thi công phù hợp với khu vực đông đúc</h2>
<p>Không phải đơn vị thi công nào cũng có kinh nghiệm xử lý các công trình trong hẻm nhỏ, mật độ dân cư cao. Khi tìm hiểu nhà thầu, chủ nhà nên hỏi cụ thể về kinh nghiệm thi công tại khu vực tương tự, cách họ xử lý vấn đề vận chuyển vật tư và bảo vệ nhà liền kề trong quá trình thi công.</p>

<hr>

<p>Thi công tại Tân Bình đòi hỏi sự chuẩn bị kỹ hơn ở khâu khảo sát hiện trạng và lựa chọn đơn vị có kinh nghiệm phù hợp với đặc thù khu vực đông dân cư. Việc chuẩn bị kỹ từ đầu giúp hạn chế tối đa các vấn đề phát sinh trong quá trình thi công.</p>

<p>ALN kết nối chủ nhà tại Tân Bình với các đơn vị thiết kế và thi công hiểu rõ đặc thù khu vực.</p>`,
    related: [
      { tag: "Khu vực", title: "Thi công nhà phố Quận 7: lưu ý về hạ tầng & pháp lý", href: "../thi-cong-nha-pho-quan-7/" },
      { tag: "Khu vực", title: "Thi công nhà phố Thủ Đức: đặc thù địa hình và chi phí phát sinh", href: "../thi-cong-nha-pho-thu-duc/" },
      { tag: "Quy trình", title: "Quy trình thi công nhà ở gồm những bước nào?", href: "../quy-trinh-thi-cong-nha-o/" },
    ],
  },
  {
    date: "2026-08-03",
    slug: "cach-doc-du-toan-thi-cong",
    tag: "Chi phí",
    crumbCur: "Chi phí",
    readTime: "4 phút đọc",
    h1: 'Cách Đọc Bảng Dự Toán Thi Công Không Bị "Lùa Gà"',
    metaTitle: 'Cách Đọc Dự Toán Thi Công Không Bị "Lùa Gà" | ALN',
    metaDesc:
      "Một bảng dự toán thi công rõ ràng cần có những gì? Hướng dẫn cách đọc và kiểm tra dự toán để tránh bị đội giá vô lý trước khi ký hợp đồng.",
    summary: [
      "Dự toán có được tách theo hạng mục không",
      "Đơn giá có đi kèm khối lượng cụ thể không",
      "Vật tư có ghi rõ chủng loại, thương hiệu không",
      DISCLAIMER_BULLET,
    ],
    bodyHtml: `
<p>Một bảng dự toán thi công đầy đủ và minh bạch là công cụ quan trọng nhất giúp chủ nhà kiểm soát chi phí trước khi ký hợp đồng. Nhưng không phải ai cũng biết cách đọc một bảng dự toán đúng cách để phát hiện những điểm bất hợp lý. Dưới đây là những phần cần kiểm tra kỹ.</p>

<h2>Dự toán có được tách theo hạng mục không</h2>
<p>Một bảng dự toán đáng tin cậy cần tách rõ theo từng hạng mục: phần móng, phần khung kết cấu, phần hoàn thiện (tô trát, sơn nước), phần điện nước, phần nội thất cơ bản (nếu có). Nếu bảng dự toán chỉ đưa ra một con số tổng duy nhất mà không tách bạch, đây là dấu hiệu cần yêu cầu làm rõ thêm trước khi ký.</p>

<h2>Đơn giá có đi kèm khối lượng cụ thể không</h2>
<p>Mỗi hạng mục trong dự toán nên có đơn giá và khối lượng thi công tương ứng (ví dụ: m² tô trát, m³ bê tông, md dài của một loại vật tư). Nếu dự toán chỉ ghi số tiền mà không có khối lượng cụ thể đi kèm, chủ nhà sẽ không có căn cứ để đối chiếu khi có thay đổi khối lượng thực tế trong quá trình thi công.</p>

<h2>Vật tư có ghi rõ chủng loại, thương hiệu không</h2>
<p>Một dự toán mập mờ thường chỉ ghi chung chung "gạch ốp lát", "sơn nước" mà không ghi rõ chủng loại hoặc phân khúc giá. Điều này tạo kẽ hở để nhà thầu sử dụng vật tư giá thấp hơn so với kỳ vọng của chủ nhà mà vẫn đúng theo hợp đồng. Yêu cầu ghi rõ chủng loại, thương hiệu tham khảo (hoặc phân khúc giá tương đương) cho từng hạng mục vật tư chính.</p>

<div class="cn-cta-mid"><p>${CTA_MID_A}</p></div>

<h2>Phần phát sinh có được quy định rõ cách xử lý không</h2>
<p>Một dự toán tốt nên đi kèm với điều khoản rõ ràng về cách xử lý phát sinh: giới hạn tỷ lệ phát sinh được chấp nhận, quy trình xác nhận trước khi thực hiện, và ai là người có thẩm quyền duyệt. Thiếu phần này, dự toán ban đầu dù chi tiết đến đâu cũng không bảo vệ được chủ nhà khỏi phát sinh sau này.</p>

<h2>So sánh với ít nhất một dự toán khác</h2>
<p>Trước khi quyết định, nên có ít nhất một bảng dự toán thứ hai để đối chiếu — không nhất thiết để chọn giá thấp nhất, mà để nhận ra những khoản chênh lệch bất thường cần được giải thích rõ trước khi ký hợp đồng.</p>

<hr>

<p>Một bảng dự toán minh bạch không chỉ là con số, mà là công cụ giúp chủ nhà chủ động kiểm soát toàn bộ quá trình thi công. Dành thời gian đọc kỹ và đặt câu hỏi trước khi ký là bước đầu tư nhỏ nhưng giúp tránh được rất nhiều rắc rối về sau.</p>

<p>ALN kết nối chủ nhà với các đơn vị thiết kế và thi công cung cấp dự toán minh bạch, tách bạch rõ ràng theo từng hạng mục.</p>`,
    related: [
      { tag: "Chi phí", title: "5 sai lầm khiến chi phí xây nhà đội 20-30%", href: "../5-sai-lam-chi-phi-xay-nha-doi-gia/" },
      { tag: "Chuẩn bị", title: "Hợp đồng thi công cần có những điều khoản nào để tránh tranh chấp", href: "../hop-dong-thi-cong-can-dieu-khoan-nao/" },
      { tag: "Chi phí", title: "Minh bạch chi phí thi công: cách đọc báo giá tránh phát sinh", href: "../minh-bach-chi-phi-thi-cong/" },
    ],
  },
  {
    date: "2026-08-06",
    slug: "thi-cong-nha-pho-quan-7",
    tag: "Khu vực",
    crumbCur: "Quận 7",
    readTime: "3 phút đọc",
    h1: "Thi Công Nhà Phố Quận 7: Lưu Ý Về Hạ Tầng & Pháp Lý Khu Vực",
    metaTitle: "Thi Công Nhà Phố Quận 7: Lưu Ý Về Hạ Tầng & Pháp Lý | ALN",
    metaDesc:
      "Xây nhà tại Quận 7 cần lưu ý gì về nền đất, hạ tầng khu đô thị mới và thủ tục pháp lý? Những điều chủ nhà nên nắm trước khi khởi công.",
    summary: [
      "Đặc thù nền đất khu vực ven sông",
      "Quy định riêng tại các khu đô thị quy hoạch",
      "Hạ tầng thi công và tiếp cận công trình",
      DISCLAIMER_BULLET,
    ],
    bodyHtml: `
<p>Quận 7 là khu vực có tốc độ đô thị hóa nhanh, tập trung nhiều khu dân cư quy hoạch mới bên cạnh khu vực dân cư hiện hữu lâu năm. Sự đa dạng này khiến việc thi công tại Quận 7 có những lưu ý riêng tùy khu vực cụ thể.</p>

<h2>Đặc thù nền đất khu vực ven sông</h2>
<p>Quận 7 có nhiều khu vực gần sông, kênh rạch — nền đất tại những khu vực này thường yếu hơn so với khu vực trung tâm. Việc khảo sát địa chất trước khi thi công đặc biệt quan trọng ở đây, vì xử lý nền móng không phù hợp có thể dẫn đến chi phí phát sinh lớn hoặc ảnh hưởng đến độ bền công trình về lâu dài.</p>

<h2>Quy định riêng tại các khu đô thị quy hoạch</h2>
<p>Với những khu vực nằm trong các khu đô thị được quy hoạch bài bản, thường có thêm quy định riêng về kiến trúc mặt tiền, chiều cao, khoảng lùi ngoài quy định chung của thành phố. Chủ nhà xây dựng tại những khu vực này cần xác nhận rõ với ban quản lý khu đô thị hoặc cơ quan quản lý xây dựng địa phương trước khi chốt thiết kế, để tránh phải điều chỉnh giữa chừng.</p>

<div class="cn-cta-mid"><p>${CTA_MID_B}</p></div>

<h2>Hạ tầng thi công và tiếp cận công trình</h2>
<p>Một số khu vực mới phát triển tại Quận 7 có hạ tầng giao thông đang hoàn thiện dần — điều này có thể ảnh hưởng đến việc vận chuyển vật tư, tập kết máy móc trong giai đoạn đầu thi công. Nên khảo sát thực tế đường vào công trình và trao đổi với đơn vị thi công về phương án phù hợp trước khi lên kế hoạch chi tiết.</p>

<h2>Lựa chọn đơn vị thi công hiểu rõ đặc thù khu vực</h2>
<p>Vì Quận 7 có sự khác biệt lớn giữa các khu vực (ven sông, khu đô thị mới, khu dân cư hiện hữu), kinh nghiệm thi công tại từng loại địa hình là yếu tố quan trọng khi lựa chọn đơn vị thi công — không phải đơn vị nào có kinh nghiệm ở khu vực này cũng phù hợp với khu vực khác.</p>

<hr>

<p>Thi công tại Quận 7 đòi hỏi sự lưu ý riêng về nền đất và quy định khu vực tùy từng vị trí cụ thể. Khảo sát kỹ và xác nhận quy định địa phương trước khi thiết kế là bước chuẩn bị quan trọng giúp quá trình thi công diễn ra suôn sẻ hơn.</p>

<p>ALN kết nối chủ nhà tại Quận 7 với các đơn vị thiết kế và thi công có kinh nghiệm phù hợp với từng khu vực.</p>`,
    related: [
      { tag: "Khu vực", title: "Thi công nhà phố Tân Bình: điều cần biết trước khi khởi công", href: "../thi-cong-nha-pho-tan-binh/" },
      { tag: "Khu vực", title: "Thi công nhà phố Thủ Đức: đặc thù địa hình và chi phí phát sinh", href: "../thi-cong-nha-pho-thu-duc/" },
      { tag: "Chọn nhà thầu", title: "Cách chọn nhà thầu thi công uy tín: 7 tiêu chí cần kiểm tra", href: "../cach-chon-nha-thau-thi-cong-uy-tin/" },
    ],
  },
  {
    date: "2026-08-10",
    slug: "tieu-chi-tham-dinh-nang-luc-nha-thau",
    tag: "Chọn nhà thầu",
    crumbCur: "Chọn nhà thầu",
    readTime: "4 phút đọc",
    h1: "7 Tiêu Chí Thẩm Định Năng Lực Nhà Thầu Thi Công",
    metaTitle: "7 Tiêu Chí Thẩm Định Năng Lực Nhà Thầu Thi Công | ALN",
    metaDesc:
      "Làm sao biết một nhà thầu thi công có đủ năng lực và đáng tin cậy? 7 tiêu chí cụ thể chủ nhà nên kiểm tra trước khi ký hợp đồng.",
    summary: [
      "Có tư cách pháp nhân đầy đủ",
      "Có chứng chỉ năng lực hoạt động xây dựng phù hợp quy mô công trình",
      "Có nhân sự chỉ huy trưởng/giám sát đủ điều kiện",
      DISCLAIMER_BULLET,
    ],
    bodyHtml: `
<p>Chọn sai nhà thầu là một trong những rủi ro lớn nhất khi xây nhà — không chỉ ảnh hưởng đến chi phí mà còn đến chất lượng và an toàn công trình lâu dài. Dưới đây là 7 tiêu chí cụ thể giúp chủ nhà đánh giá năng lực thực sự của một nhà thầu, thay vì chỉ dựa vào cảm tính hay lời giới thiệu.</p>

<h2>1. Có tư cách pháp nhân đầy đủ</h2>
<p>Kiểm tra giấy chứng nhận đăng ký doanh nghiệp, mã số thuế — đây là bước cơ bản nhưng nhiều chủ nhà bỏ qua khi làm việc với các đội thi công tự do, không có pháp nhân rõ ràng.</p>

<h2>2. Có chứng chỉ năng lực hoạt động xây dựng phù hợp quy mô công trình</h2>
<p>Theo quy định hiện hành, tổ chức thi công công trình từ cấp II trở lên bắt buộc phải có chứng chỉ năng lực hoạt động xây dựng do Sở Xây dựng hoặc tổ chức xã hội - nghề nghiệp được công nhận cấp. Chủ nhà nên yêu cầu xem bản chứng chỉ này và đối chiếu hạng chứng chỉ với quy mô công trình dự kiến.</p>

<h2>3. Có nhân sự chỉ huy trưởng/giám sát đủ điều kiện</h2>
<p>Ngoài chứng chỉ của tổ chức, cần có cá nhân đảm nhận vai trò chỉ huy trưởng công trường với chứng chỉ hành nghề còn hiệu lực, đúng lĩnh vực. Hỏi rõ ai sẽ là người trực tiếp phụ trách công trình của mình, không chỉ dựa vào tên công ty.</p>

<h2>4. Có hồ sơ năng lực với công trình đã thực hiện</h2>
<p>Một nhà thầu đáng tin cậy thường sẵn sàng cung cấp danh sách công trình đã thi công, kèm hình ảnh hoặc thông tin liên hệ chủ nhà cũ để tham khảo (nếu được đồng ý chia sẻ).</p>

<div class="cn-cta-mid"><p>${CTA_MID_B}</p></div>

<h2>5. Có quy trình hợp đồng và dự toán rõ ràng</h2>
<p>Cách một nhà thầu soạn hợp đồng và dự toán phản ánh mức độ chuyên nghiệp. Nhà thầu uy tín thường có mẫu hợp đồng chi tiết, tách bạch hạng mục, không ngại giải thích rõ từng điều khoản khi được hỏi.</p>

<h2>6. Có khả năng huy động nhân lực và thiết bị ổn định</h2>
<p>Hỏi về đội ngũ thi công cố định, không phụ thuộc hoàn toàn vào thợ thời vụ thuê ngoài cho từng công trình — điều này ảnh hưởng đến tính ổn định của tiến độ và chất lượng.</p>

<h2>7. Có phản hồi rõ ràng về bảo hành sau bàn giao</h2>
<p>Một nhà thầu có trách nhiệm sẽ nói rõ chính sách bảo hành công trình sau khi hoàn thành, thay vì chỉ tập trung vào việc hoàn tất và nhận thanh toán.</p>

<hr>

<p>Đánh giá năng lực nhà thầu không nên chỉ dựa vào giá chào thầu thấp nhất. 7 tiêu chí trên giúp chủ nhà có cái nhìn toàn diện hơn — từ pháp lý, nhân sự, đến quy trình làm việc — trước khi đưa ra quyết định hợp tác.</p>

<p>ALN kết nối chủ nhà với các đơn vị thi công được xác minh rõ ràng về năng lực pháp lý và hồ sơ hoạt động.</p>`,
    related: [
      { tag: "Chọn nhà thầu", title: "Dấu hiệu cảnh báo: khi nào nên dừng hợp tác với nhà thầu", href: "../dau-hieu-canh-bao-nha-thau/" },
      { tag: "Chọn nhà thầu", title: "Chứng chỉ năng lực xây dựng là gì — vì sao chủ nhà nên hỏi trước khi ký", href: "../chung-chi-nang-luc-xay-dung-la-gi/" },
      { tag: "Chọn nhà thầu", title: "Cách chọn nhà thầu thi công uy tín: 7 tiêu chí cần kiểm tra", href: "../cach-chon-nha-thau-thi-cong-uy-tin/" },
    ],
  },
  {
    date: "2026-08-13",
    slug: "dau-hieu-canh-bao-nha-thau",
    tag: "Chọn nhà thầu",
    crumbCur: "Chọn nhà thầu",
    readTime: "4 phút đọc",
    h1: "Dấu Hiệu Cảnh Báo: Khi Nào Nên Dừng Hợp Tác Với Nhà Thầu",
    metaTitle: "Dấu Hiệu Cảnh Báo Khi Nào Nên Dừng Hợp Tác Với Nhà Thầu | ALN",
    metaDesc:
      "Những dấu hiệu nào cho thấy chủ nhà nên cân nhắc dừng hợp tác với nhà thầu thi công? Nhận biết sớm để tránh rủi ro lớn hơn về sau.",
    summary: [
      "Tiến độ chậm liên tục không có lý do rõ ràng",
      "Thay đổi vật tư mà không thông báo trước",
      "Né tránh cung cấp hồ sơ, chứng chỉ khi được hỏi",
      DISCLAIMER_BULLET,
    ],
    bodyHtml: `
<p>Không phải lúc nào vấn đề với nhà thầu cũng bộc lộ ngay từ đầu. Nhận biết sớm các dấu hiệu cảnh báo giúp chủ nhà có phương án xử lý kịp thời, tránh để vấn đề nhỏ trở thành rủi ro lớn cho toàn bộ công trình.</p>

<h2>Tiến độ chậm liên tục không có lý do rõ ràng</h2>
<p>Chậm tiến độ đôi lúc là điều bình thường do thời tiết hoặc điều kiện khách quan, nhưng nếu tình trạng này lặp lại liên tục mà không có giải thích thuyết phục, đây là dấu hiệu cần lưu ý về năng lực quản lý thi công của nhà thầu.</p>

<h2>Thay đổi vật tư mà không thông báo trước</h2>
<p>Nếu phát hiện vật tư sử dụng thực tế khác với những gì đã thống nhất trong hợp đồng mà không có sự trao đổi trước, đây là dấu hiệu nghiêm trọng về tính minh bạch — cần yêu cầu giải trình ngay lập tức.</p>

<h2>Né tránh cung cấp hồ sơ, chứng chỉ khi được hỏi</h2>
<p>Một nhà thầu uy tín không có lý do gì để né tránh cung cấp chứng chỉ năng lực, hồ sơ nhân sự chỉ huy trưởng khi chủ nhà yêu cầu xem. Sự né tránh này thường là dấu hiệu của vấn đề pháp lý chưa được giải quyết.</p>

<div class="cn-cta-mid"><p>${CTA_MID_A}</p></div>

<h2>Yêu cầu thanh toán vượt tiến độ thực tế</h2>
<p>Nếu nhà thầu liên tục yêu cầu thanh toán trước khi hoàn thành khối lượng tương ứng, đây là dấu hiệu cảnh báo về tình hình tài chính của nhà thầu — có thể ảnh hưởng đến khả năng hoàn thành công trình.</p>

<h2>Nhân sự thi công thay đổi liên tục, thiếu ổn định</h2>
<p>Đội thi công thay người liên tục, không có người phụ trách cố định theo dõi xuyên suốt công trình, là dấu hiệu cho thấy nhà thầu có thể đang gặp khó khăn trong quản lý nhân lực.</p>

<h2>Cách xử lý khi gặp các dấu hiệu trên</h2>
<p>Khi nhận thấy một hoặc nhiều dấu hiệu này, bước đầu tiên là trao đổi trực tiếp, yêu cầu giải trình bằng văn bản. Nếu vấn đề không được giải quyết thỏa đáng, cần rà lại điều khoản hợp đồng về quyền chấm dứt hợp tác và các bước xử lý phần việc dở dang trước khi đưa ra quyết định cuối cùng.</p>

<hr>

<p>Nhận biết sớm các dấu hiệu cảnh báo giúp chủ nhà chủ động hơn trong việc bảo vệ quyền lợi của mình, thay vì chỉ phản ứng khi sự việc đã đi quá xa.</p>

<p>ALN kết nối chủ nhà với các đơn vị thi công minh bạch, đồng thời cung cấp thông tin để chủ nhà tự bảo vệ mình trong quá trình hợp tác.</p>`,
    related: [
      { tag: "Chọn nhà thầu", title: "7 tiêu chí thẩm định năng lực nhà thầu thi công", href: "../tieu-chi-tham-dinh-nang-luc-nha-thau/" },
      { tag: "Chuẩn bị", title: "Hợp đồng thi công cần có những điều khoản nào để tránh tranh chấp", href: "../hop-dong-thi-cong-can-dieu-khoan-nao/" },
      { tag: "Chọn nhà thầu", title: "Cách chọn nhà thầu thi công uy tín: 7 tiêu chí cần kiểm tra", href: "../cach-chon-nha-thau-thi-cong-uy-tin/" },
    ],
  },
  {
    date: "2026-08-17",
    slug: "tu-ban-ve-den-giay-phep-xay-dung",
    tag: "Chuẩn bị",
    crumbCur: "Chuẩn bị",
    readTime: "4 phút đọc",
    h1: "Từ Bản Vẽ Đến Giấy Phép Xây Dựng: Các Bước Hay Bị Bỏ Sót",
    metaTitle: "Từ Bản Vẽ Đến Giấy Phép Xây Dựng: Các Bước Hay Bị Bỏ Sót | ALN",
    metaDesc:
      "Sau khi có bản vẽ thiết kế, chủ nhà cần làm gì để xin giấy phép xây dựng? Những bước quan trọng thường bị bỏ sót trong quá trình chuẩn bị.",
    summary: [
      "Kiểm tra quy hoạch trước khi hoàn thiện bản vẽ",
      "Chuẩn bị hồ sơ pháp lý đất đai đầy đủ",
      "Thời gian xử lý hồ sơ cần được tính vào kế hoạch tổng thể",
      DISCLAIMER_BULLET,
    ],
    bodyHtml: `
<p>Có bản vẽ thiết kế đẹp mới chỉ là bước đầu. Trước khi khởi công, còn một chặng đường thủ tục pháp lý mà nhiều chủ nhà không lường trước hết, dẫn đến chậm trễ hoặc phải điều chỉnh thiết kế giữa chừng.</p>

<h2>Kiểm tra quy hoạch trước khi hoàn thiện bản vẽ</h2>
<p>Một sai lầm phổ biến là hoàn thiện bản vẽ chi tiết trước khi xác nhận quy hoạch, chỉ giới xây dựng của khu đất. Nên xác nhận thông tin quy hoạch tại cơ quan quản lý xây dựng địa phương ngay từ giai đoạn đầu thiết kế, tránh trường hợp bản vẽ hoàn chỉnh xong mới phát hiện không phù hợp.</p>

<h2>Chuẩn bị hồ sơ pháp lý đất đai đầy đủ</h2>
<p>Giấy chứng nhận quyền sử dụng đất, các giấy tờ liên quan đến hiện trạng đất cần được rà soát kỹ, đảm bảo không có vướng mắc về ranh giới hoặc tranh chấp trước khi nộp hồ sơ xin phép xây dựng.</p>

<h2>Hồ sơ thiết kế nộp xin phép cần đúng yêu cầu</h2>
<p>Hồ sơ xin giấy phép xây dựng có yêu cầu riêng về nội dung bản vẽ (khác với bản vẽ thi công chi tiết), cần được kiến trúc sư hoặc đơn vị có chuyên môn chuẩn bị đúng định dạng để tránh bị trả hồ sơ yêu cầu bổ sung nhiều lần.</p>

<div class="cn-cta-mid"><p>${CTA_MID_B}</p></div>

<h2>Thời gian xử lý hồ sơ cần được tính vào kế hoạch tổng thể</h2>
<p>Nhiều chủ nhà lên kế hoạch khởi công mà không tính đủ thời gian xử lý hồ sơ xin phép, dẫn đến bị động về tiến độ. Nên chủ động tìm hiểu thời gian xử lý dự kiến tại cơ quan có thẩm quyền và đưa vào kế hoạch tổng thể ngay từ đầu.</p>

<h2>Thông báo khởi công sau khi có giấy phép</h2>
<p>Sau khi được cấp phép, một số địa phương yêu cầu thông báo khởi công trước khi triển khai — đây là bước thủ tục nhỏ nhưng dễ bị bỏ quên, có thể dẫn đến vướng mắc không đáng có nếu bỏ sót.</p>

<hr>

<p>Giai đoạn từ bản vẽ đến giấy phép xây dựng có nhiều bước thủ tục dễ bị xem nhẹ. Chuẩn bị kỹ và chủ động xác nhận thông tin với cơ quan có thẩm quyền giúp quá trình chuyển từ thiết kế sang thi công diễn ra suôn sẻ hơn.</p>

<p>ALN đồng hành cùng chủ nhà từ giai đoạn thiết kế đến khi chuẩn bị bước vào thi công, kết nối với các đơn vị thi công hiểu rõ quy trình pháp lý.</p>`,
    related: [
      { tag: "Chi phí", title: "5 sai lầm khiến chi phí xây nhà đội 20-30%", href: "../5-sai-lam-chi-phi-xay-nha-doi-gia/" },
      { tag: "Chuẩn bị", title: "Thời gian thi công nhà phố 1 trệt 3 lầu mất bao lâu là hợp lý", href: "../thoi-gian-thi-cong-nha-pho/" },
      { tag: "Pháp lý & Giấy phép", title: "Hồ sơ thiết kế thế nào là đủ điều kiện pháp lý", href: "https://applamnha.vn/cam-nang/ho-so-thiet-ke-du-dieu-kien-phap-ly/" },
    ],
  },
  {
    date: "2026-08-20",
    slug: "hop-dong-thi-cong-can-dieu-khoan-nao",
    tag: "Chuẩn bị",
    crumbCur: "Chuẩn bị",
    readTime: "4 phút đọc",
    h1: "Hợp Đồng Thi Công Cần Có Những Điều Khoản Nào Để Tránh Tranh Chấp",
    metaTitle: "Hợp Đồng Thi Công Cần Điều Khoản Nào Để Tránh Tranh Chấp | ALN",
    metaDesc:
      "Một hợp đồng thi công đầy đủ cần có những điều khoản nào để bảo vệ quyền lợi chủ nhà và tránh tranh chấp về sau?",
    summary: [
      "Phạm vi công việc được mô tả cụ thể",
      "Tiến độ thi công theo từng giai đoạn cụ thể",
      "Điều khoản thanh toán gắn với khối lượng nghiệm thu",
      DISCLAIMER_BULLET,
    ],
    bodyHtml: `
<p>Phần lớn tranh chấp giữa chủ nhà và nhà thầu bắt nguồn từ một hợp đồng thiếu chặt chẽ ngay từ đầu. Dưới đây là những điều khoản quan trọng nên có trong bất kỳ hợp đồng thi công nào.</p>

<h2>Phạm vi công việc được mô tả cụ thể</h2>
<p>Hợp đồng cần nêu rõ phạm vi công việc: những hạng mục nào nhà thầu chịu trách nhiệm, những hạng mục nào không bao gồm (ví dụ nội thất rời, sân vườn...). Mô tả càng cụ thể, càng ít khả năng phát sinh tranh cãi về sau.</p>

<h2>Tiến độ thi công theo từng giai đoạn cụ thể</h2>
<p>Thay vì chỉ ghi một mốc hoàn thành chung, nên có tiến độ chi tiết theo từng giai đoạn (móng, khung, hoàn thiện...) kèm điều khoản xử lý khi chậm tiến độ — bao gồm cả trường hợp do khách quan và do nhà thầu.</p>

<h2>Điều khoản thanh toán gắn với khối lượng nghiệm thu</h2>
<p>Thanh toán nên gắn với khối lượng công việc đã hoàn thành và được nghiệm thu, thay vì thanh toán theo mốc thời gian cố định không liên quan đến tiến độ thực tế.</p>

<div class="cn-cta-mid"><p>${CTA_MID_A}</p></div>

<h2>Quy trình xử lý phát sinh rõ ràng</h2>
<p>Như đã đề cập ở các bài trước, cần có điều khoản quy định cách xác nhận, giới hạn tỷ lệ, và quy trình phê duyệt khi có phát sinh thực sự cần thiết ngoài dự toán ban đầu.</p>

<h2>Điều khoản bảo hành sau bàn giao</h2>
<p>Cần ghi rõ thời gian bảo hành, phạm vi bảo hành (kết cấu, chống thấm, hoàn thiện...) và trách nhiệm xử lý khi phát sinh lỗi trong thời gian bảo hành.</p>

<h2>Điều khoản chấm dứt hợp đồng và xử lý phần việc dở dang</h2>
<p>Trong trường hợp một trong hai bên muốn chấm dứt hợp đồng giữa chừng, cần có điều khoản quy định cách xử lý phần việc đã thực hiện, thanh toán tương ứng, và trách nhiệm của mỗi bên.</p>

<hr>

<p>Một hợp đồng thi công chặt chẽ không phải để đề phòng lẫn nhau, mà là công cụ giúp cả chủ nhà và nhà thầu có cùng một điểm tham chiếu rõ ràng trong suốt quá trình hợp tác — giảm thiểu tối đa rủi ro tranh chấp không đáng có.</p>

<p>ALN kết nối chủ nhà với các đơn vị thi công có quy trình hợp đồng minh bạch, đầy đủ điều khoản bảo vệ quyền lợi hai bên.</p>`,
    related: [
      { tag: "Chi phí", title: 'Cách đọc bảng dự toán thi công không bị "lùa gà"', href: "../cach-doc-du-toan-thi-cong/" },
      { tag: "Chọn nhà thầu", title: "Dấu hiệu cảnh báo: khi nào nên dừng hợp tác với nhà thầu", href: "../dau-hieu-canh-bao-nha-thau/" },
      { tag: "Chọn nhà thầu", title: "Cách chọn nhà thầu thi công uy tín: 7 tiêu chí cần kiểm tra", href: "../cach-chon-nha-thau-thi-cong-uy-tin/" },
    ],
  },
  {
    date: "2026-08-24",
    slug: "thi-cong-nha-pho-thu-duc",
    tag: "Khu vực",
    crumbCur: "Thủ Đức",
    readTime: "3 phút đọc",
    h1: "Thi Công Nhà Phố Thủ Đức: Đặc Thù Địa Hình Và Chi Phí Phát Sinh",
    metaTitle: "Thi Công Nhà Phố Thủ Đức: Đặc Thù Địa Hình Và Chi Phí Phát Sinh | ALN",
    metaDesc:
      "Xây nhà tại TP. Thủ Đức cần lưu ý gì về địa hình, hiện trạng khu vực và chi phí dễ phát sinh? Tổng hợp những điều chủ nhà nên biết.",
    summary: [
      "Địa hình không đồng nhất giữa các khu vực",
      "Khu vực gần sông, suối cần lưu ý về nền đất yếu",
      "Tốc độ đô thị hóa nhanh kéo theo biến động quy hoạch",
      DISCLAIMER_BULLET,
    ],
    bodyHtml: `
<p>TP. Thủ Đức có địa hình đa dạng, từ khu vực đồi thấp đến khu vực trũng thấp gần sông rạch, cùng tốc độ đô thị hóa nhanh trong những năm gần đây. Sự đa dạng này ảnh hưởng trực tiếp đến cách lập kế hoạch thi công tại đây.</p>

<h2>Địa hình không đồng nhất giữa các khu vực</h2>
<p>Khác với những quận có địa hình tương đối bằng phẳng, Thủ Đức có sự chênh lệch cao độ đáng kể giữa các khu vực. Việc khảo sát địa hình thực tế trước khi thiết kế móng là bước quan trọng để tránh phát sinh chi phí xử lý nền không lường trước.</p>

<h2>Khu vực gần sông, suối cần lưu ý về nền đất yếu</h2>
<p>Tương tự như một số khu vực ở Quận 7, những vị trí gần sông Sài Gòn hoặc các suối nhỏ tại Thủ Đức thường có nền đất yếu hơn, cần khảo sát địa chất kỹ trước khi xác định phương án móng phù hợp.</p>

<div class="cn-cta-mid"><p>${CTA_MID_B}</p></div>

<h2>Tốc độ đô thị hóa nhanh kéo theo biến động quy hoạch</h2>
<p>Vì đang trong giai đoạn phát triển mạnh, một số khu vực tại Thủ Đức có thể có điều chỉnh quy hoạch theo thời gian. Chủ nhà nên xác nhận thông tin quy hoạch mới nhất tại cơ quan quản lý xây dựng địa phương trước khi chốt thiết kế, thay vì dựa vào thông tin cũ.</p>

<h2>Lựa chọn đơn vị thi công có kinh nghiệm với địa hình đa dạng</h2>
<p>Với đặc thù địa hình không đồng nhất, kinh nghiệm xử lý nhiều loại nền đất khác nhau là một tiêu chí quan trọng khi chọn đơn vị thi công tại khu vực này.</p>

<hr>

<p>Thi công tại Thủ Đức đòi hỏi sự chú ý đặc biệt đến khảo sát địa hình và cập nhật thông tin quy hoạch, do đặc thù khu vực đang trong giai đoạn phát triển nhanh với địa hình không đồng nhất.</p>

<p>ALN kết nối chủ nhà tại Thủ Đức với các đơn vị thiết kế và thi công có kinh nghiệm xử lý địa hình đa dạng.</p>`,
    related: [
      { tag: "Khu vực", title: "Thi công nhà phố Quận 7: lưu ý về hạ tầng & pháp lý", href: "../thi-cong-nha-pho-quan-7/" },
      { tag: "Khu vực", title: "Thi công nhà phố Tân Bình: điều cần biết trước khi khởi công", href: "../thi-cong-nha-pho-tan-binh/" },
      { tag: "Quy trình", title: "Quy trình thi công nhà ở gồm những bước nào?", href: "../quy-trinh-thi-cong-nha-o/" },
    ],
  },
  {
    date: "2026-08-27",
    slug: "chung-chi-nang-luc-xay-dung-la-gi",
    tag: "Chọn nhà thầu",
    crumbCur: "Chọn nhà thầu",
    readTime: "4 phút đọc",
    h1: "Chứng Chỉ Năng Lực Xây Dựng Là Gì — Vì Sao Chủ Nhà Nên Hỏi Trước Khi Ký",
    metaTitle: "Chứng Chỉ Năng Lực Xây Dựng Là Gì? Vì Sao Nên Hỏi Trước Khi Ký | ALN",
    metaDesc:
      "Chứng chỉ năng lực hoạt động xây dựng là gì, khác gì với chứng chỉ hành nghề cá nhân? Vì sao chủ nhà nên yêu cầu xem trước khi ký hợp đồng thi công.",
    summary: [
      "Phân biệt chứng chỉ hành nghề (cá nhân) và chứng chỉ năng lực (tổ chức)",
      "Vì sao chủ nhà nên yêu cầu xem cả hai loại",
      "Cách kiểm tra hạng chứng chỉ có phù hợp quy mô công trình không",
      DISCLAIMER_BULLET,
    ],
    bodyHtml: `
<p>Nhiều chủ nhà khi tìm hiểu nhà thầu thường chỉ hỏi về kinh nghiệm, ít khi biết đến khái niệm "chứng chỉ năng lực hoạt động xây dựng" — một loại giấy tờ pháp lý quan trọng mà tổ chức thi công cần có theo quy định.</p>

<h2>Phân biệt hai loại chứng chỉ dễ gây nhầm lẫn</h2>
<p>Có hai loại giấy tờ pháp lý khác nhau trong lĩnh vực xây dựng:</p>
<ul>
<li><strong>Chứng chỉ hành nghề</strong> — cấp cho <strong>cá nhân</strong>, xác nhận một người đủ điều kiện chuyên môn để đảm nhận vai trò cụ thể (thiết kế, giám sát thi công, chỉ huy trưởng...).</li>
<li><strong>Chứng chỉ năng lực hoạt động xây dựng</strong> — cấp cho <strong>tổ chức/công ty</strong>, xác nhận doanh nghiệp đó đủ điều kiện để đứng ra thực hiện hoạt động xây dựng (thiết kế, thi công, giám sát) ở một hạng nhất định.</li>
</ul>
<p>Một công ty có chứng chỉ năng lực không đồng nghĩa mọi nhân sự của công ty đó đều có chứng chỉ hành nghề cá nhân, và ngược lại — một cá nhân có chứng chỉ hành nghề không có nghĩa công ty họ đại diện tự động có chứng chỉ năng lực tổ chức.</p>

<h2>Vì sao chủ nhà nên yêu cầu xem cả hai loại</h2>
<p>Khi làm việc với một nhà thầu, chủ nhà nên yêu cầu xem:</p>
<ol>
<li>Chứng chỉ năng lực hoạt động xây dựng của công ty (kiểm tra hạng, lĩnh vực, thời hạn hiệu lực).</li>
<li>Chứng chỉ hành nghề của cá nhân sẽ trực tiếp phụ trách công trình (chỉ huy trưởng/giám sát), kiểm tra đúng lĩnh vực và còn hiệu lực.</li>
</ol>

<div class="cn-cta-mid"><p>${CTA_MID_A}</p></div>

<h2>Cách kiểm tra hạng chứng chỉ có phù hợp quy mô công trình không</h2>
<p>Chứng chỉ năng lực được phân theo hạng (thường là hạng I, II, III), mỗi hạng tương ứng với quy mô/cấp công trình được phép thực hiện. Chủ nhà nên đối chiếu quy mô công trình dự kiến (số tầng, diện tích) với hạng chứng chỉ của nhà thầu để đảm bảo phù hợp về mặt pháp lý.</p>

<h2>Cách xác thực chứng chỉ không bị làm giả</h2>
<p>Ngoài việc xem bản chứng chỉ, có thể tra cứu thông tin trên cổng thông tin của cơ quan cấp chứng chỉ (Sở Xây dựng địa phương hoặc tổ chức xã hội - nghề nghiệp được công nhận cấp chứng chỉ) để xác nhận tính hợp lệ, tránh trường hợp chứng chỉ giả hoặc đã bị thu hồi.</p>

<hr>

<p>Hiểu rõ sự khác biệt giữa chứng chỉ hành nghề cá nhân và chứng chỉ năng lực tổ chức giúp chủ nhà đặt đúng câu hỏi khi tìm hiểu nhà thầu — một bước kiểm tra đơn giản nhưng có thể tránh được rủi ro pháp lý lớn về sau.</p>

<p>ALN kết nối chủ nhà với các đơn vị thi công đã được xác minh về chứng chỉ năng lực và hồ sơ nhân sự phù hợp quy định.</p>`,
    related: [
      { tag: "Chọn nhà thầu", title: "7 tiêu chí thẩm định năng lực nhà thầu thi công", href: "../tieu-chi-tham-dinh-nang-luc-nha-thau/" },
      { tag: "Chọn nhà thầu", title: "Giám sát thi công: chủ nhà tự làm được hay cần thuê riêng?", href: "../giam-sat-thi-cong-tu-lam-hay-thue-rieng/" },
      { tag: "Chọn nhà thầu", title: "Cách chọn nhà thầu thi công uy tín: 7 tiêu chí cần kiểm tra", href: "../cach-chon-nha-thau-thi-cong-uy-tin/" },
    ],
  },
  {
    date: "2026-08-31",
    slug: "giam-sat-thi-cong-tu-lam-hay-thue-rieng",
    tag: "Chọn nhà thầu",
    crumbCur: "Chọn nhà thầu",
    readTime: "4 phút đọc",
    h1: "Giám Sát Thi Công: Chủ Nhà Tự Làm Được Hay Cần Thuê Riêng?",
    metaTitle: "Giám Sát Thi Công: Chủ Nhà Tự Làm Được Hay Cần Thuê Riêng? | ALN",
    metaDesc:
      "Chủ nhà có thể tự giám sát thi công không, hay nên thuê đơn vị giám sát độc lập? Phân tích ưu nhược điểm để đưa ra lựa chọn phù hợp.",
    summary: [
      "Vai trò thực sự của giám sát thi công",
      "Khi nào chủ nhà có thể tự giám sát",
      "Khi nào nên thuê đơn vị giám sát độc lập",
      DISCLAIMER_BULLET,
    ],
    bodyHtml: `
<p>Giám sát thi công là một mắt xích quan trọng nhưng thường bị xem nhẹ trong quá trình xây nhà. Câu hỏi nhiều chủ nhà đặt ra là: có nên tự mình giám sát, hay cần thuê một đơn vị giám sát độc lập, tách biệt với nhà thầu thi công?</p>

<h2>Vai trò thực sự của giám sát thi công</h2>
<p>Giám sát thi công không chỉ đơn thuần là "đến công trình xem thợ làm" — công việc này bao gồm kiểm tra chất lượng vật tư đầu vào, đối chiếu thi công thực tế với bản vẽ kỹ thuật, giám sát các mốc nghiệm thu quan trọng (móng, kết cấu, chống thấm...) và xác nhận khối lượng trước khi thanh toán từng giai đoạn.</p>

<h2>Khi nào chủ nhà có thể tự giám sát</h2>
<p>Nếu chủ nhà có kiến thức chuyên môn về xây dựng, có thời gian theo sát công trình thường xuyên, việc tự giám sát ở mức độ cơ bản (theo dõi tiến độ, đối chiếu vật tư theo hợp đồng) là khả thi. Tuy nhiên, việc kiểm tra kỹ thuật chuyên sâu (chất lượng bê tông, cốt thép, hệ thống chống thấm...) đòi hỏi kiến thức chuyên môn mà không phải chủ nhà nào cũng có.</p>

<div class="cn-cta-mid"><p>${CTA_MID_B}</p></div>

<h2>Khi nào nên thuê đơn vị giám sát độc lập</h2>
<p>Việc thuê một đơn vị giám sát độc lập — tách biệt với nhà thầu thi công — giúp đảm bảo tính khách quan, vì đơn vị giám sát không có xung đột lợi ích với bên thi công. Đây là lựa chọn phù hợp với những công trình có quy mô lớn, phức tạp về kỹ thuật, hoặc khi chủ nhà không có đủ thời gian/chuyên môn để tự theo sát.</p>

<h2>Chi phí giám sát nên được cân nhắc như một khoản đầu tư, không phải chi phí thừa</h2>
<p>Nhiều chủ nhà cân nhắc bỏ qua giám sát độc lập để tiết kiệm chi phí ban đầu, nhưng về lâu dài, một đơn vị giám sát tốt thường giúp phát hiện sớm các vấn đề kỹ thuật, tránh được chi phí sửa chữa lớn hơn nhiều về sau.</p>

<hr>

<p>Không có câu trả lời đúng tuyệt đối cho mọi trường hợp — lựa chọn phụ thuộc vào quy mô công trình, thời gian và chuyên môn của chủ nhà. Nhưng dù chọn cách nào, việc hiểu rõ vai trò của giám sát thi công giúp chủ nhà chủ động hơn trong việc bảo vệ chất lượng công trình của mình.</p>

<p>ALN kết nối chủ nhà với các đơn vị thi công có cơ chế giám sát rõ ràng, minh bạch trong từng giai đoạn.</p>`,
    related: [
      { tag: "Chọn nhà thầu", title: "Chứng chỉ năng lực xây dựng là gì — vì sao chủ nhà nên hỏi trước khi ký", href: "../chung-chi-nang-luc-xay-dung-la-gi/" },
      { tag: "Chọn nhà thầu", title: "7 tiêu chí thẩm định năng lực nhà thầu thi công", href: "../tieu-chi-tham-dinh-nang-luc-nha-thau/" },
      { tag: "Chọn nhà thầu", title: "Cách chọn nhà thầu thi công uy tín: 7 tiêu chí cần kiểm tra", href: "../cach-chon-nha-thau-thi-cong-uy-tin/" },
    ],
  },
  {
    date: "2026-09-03",
    slug: "thoi-gian-thi-cong-nha-pho",
    tag: "Chuẩn bị",
    crumbCur: "Chuẩn bị",
    readTime: "4 phút đọc",
    h1: "Thời Gian Thi Công Nhà Phố 1 Trệt 3 Lầu Mất Bao Lâu Là Hợp Lý",
    metaTitle: "Thời Gian Thi Công Nhà Phố 1 Trệt 3 Lầu Mất Bao Lâu Là Hợp Lý | ALN",
    metaDesc:
      "Xây nhà phố 1 trệt 3 lầu thường mất bao lâu? Những yếu tố ảnh hưởng đến tiến độ và cách nhận biết tiến độ có hợp lý hay không.",
    summary: [
      "Các yếu tố ảnh hưởng đến thời gian thi công",
      "Các giai đoạn chính trong quá trình thi công",
      "Dấu hiệu cho thấy tiến độ đang hợp lý",
      DISCLAIMER_BULLET,
    ],
    bodyHtml: `
<p>Một trong những câu hỏi phổ biến nhất của chủ nhà trước khi khởi công là: công trình của mình sẽ mất bao lâu để hoàn thành? Đây là thông tin quan trọng để lên kế hoạch tài chính và sinh hoạt trong suốt quá trình thi công.</p>

<h2>Các yếu tố ảnh hưởng đến thời gian thi công</h2>
<p>Thời gian thi công không chỉ phụ thuộc vào diện tích và số tầng, mà còn chịu ảnh hưởng bởi: điều kiện nền đất (có cần xử lý móng đặc biệt không), điều kiện tiếp cận công trình (hẻm nhỏ hay mặt tiền rộng), thời điểm thi công (mùa mưa hay mùa khô), và mức độ hoàn thiện yêu cầu (hoàn thiện cơ bản hay chi tiết cao).</p>

<h2>Các giai đoạn chính trong quá trình thi công</h2>
<p>Quá trình thi công thường trải qua các giai đoạn: xử lý nền móng, thi công phần thô (khung kết cấu), thi công hoàn thiện (tô trát, sơn nước, lắp đặt thiết bị), và nghiệm thu bàn giao. Mỗi giai đoạn có yêu cầu thời gian khác nhau, và giai đoạn hoàn thiện thường là phần dễ bị kéo dài nhất nếu có nhiều thay đổi giữa chừng.</p>

<div class="cn-cta-mid"><p>${CTA_MID_A}</p></div>

<h2>Dấu hiệu cho thấy tiến độ đang hợp lý</h2>
<p>Một công trình có tiến độ hợp lý thường có mốc thời gian rõ ràng cho từng giai đoạn ngay từ hợp đồng, và nhà thầu chủ động thông báo khi có bất kỳ điều chỉnh nào về tiến độ kèm lý do cụ thể — thay vì để chủ nhà tự nhận ra công trình đang chậm.</p>

<h2>Vì sao nên có mốc tiến độ chi tiết trong hợp đồng</h2>
<p>Như đã đề cập ở bài viết về hợp đồng thi công, việc chia tiến độ thành các mốc cụ thể theo từng giai đoạn (không chỉ một ngày hoàn thành chung) giúp chủ nhà dễ dàng theo dõi và phát hiện sớm nếu có dấu hiệu chậm trễ bất thường.</p>

<hr>

<p>Thời gian thi công hợp lý phụ thuộc vào nhiều yếu tố cụ thể của từng công trình, không có một con số áp dụng chung cho tất cả. Điều quan trọng là có mốc tiến độ rõ ràng ngay từ đầu để chủ nhà chủ động theo dõi và đánh giá.</p>

<p>ALN kết nối chủ nhà với các đơn vị thi công cam kết tiến độ rõ ràng, minh bạch theo từng giai đoạn.</p>`,
    related: [
      { tag: "Chuẩn bị", title: "Từ bản vẽ đến giấy phép xây dựng: các bước hay bị bỏ sót", href: "../tu-ban-ve-den-giay-phep-xay-dung/" },
      { tag: "Chuẩn bị", title: "Hợp đồng thi công cần có những điều khoản nào để tránh tranh chấp", href: "../hop-dong-thi-cong-can-dieu-khoan-nao/" },
      { tag: "Quy trình", title: "Quy trình thi công nhà ở gồm những bước nào?", href: "../quy-trinh-thi-cong-nha-o/" },
    ],
  },
];

function relatedCard(r) {
  return `      <a class="cn-related-card" href="${r.href}">
        <span class="tag-gold">${r.tag}</span>
        <h4>${r.title}</h4>
      </a>`;
}

function summaryList(items) {
  return items.map((s) => `        <li>${s}</li>`).join("\n");
}

function render(p) {
  const canonical = `https://applamnha.vn/thicong/blog/${p.slug}/`;
  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<!-- ALN-SCHEDULE-META: ${JSON.stringify({ tag: p.tag, icon: TAG_ICON[p.tag] || "ph-file-text" })} -->

<title>${p.metaTitle}</title>
<meta name="description" content="${p.metaDesc}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="article">
<meta property="og:url" content="${canonical}">
<meta property="og:title" content="${p.metaTitle}">
<meta property="og:description" content="${p.metaDesc}">
<meta property="og:image" content="https://applamnha.vn/icon-512.png">
<meta property="og:site_name" content="App Làm Nhà">
<meta property="og:locale" content="vi_VN">
<meta name="twitter:card" content="summary_large_image">

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "${p.h1.replace(/"/g, '\\"')}",
  "description": "${p.metaDesc.replace(/"/g, '\\"')}",
  "datePublished": "${p.date}",
  "dateModified": "${p.date}",
  "author": { "@type": "Organization", "name": "Đội ngũ ALN" },
  "publisher": {
    "@type": "Organization",
    "name": "App Làm Nhà",
    "logo": { "@type": "ImageObject", "url": "https://applamnha.vn/icon-512.png" }
  },
  "mainEntityOfPage": "${canonical}"
}
</script>

<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,600;1,300;1,600&family=DM+Sans:wght@300;400;500;600;700&family=Syne:wght@700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.1/src/duotone/style.css">
<link rel="stylesheet" href="../../../aln-tokens.css">
<link rel="stylesheet" href="../../../cam-nang/cam-nang.css">
<link rel="icon" href="../../../icon-192.png" type="image/png">
<meta name="theme-color" content="#98690a">
<!-- Google Analytics 4 (ALN — G-5CSL1TF0RC, dùng chung property với applamnha.vn) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-5CSL1TF0RC"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-5CSL1TF0RC');
</script>
<!-- End GA4 -->
</head>
<body>

<header id="cn-nav">
  <div class="wrap cn-nav-inner">
    <a href="../../index.html" class="cn-brand">
      <div class="cn-logo"><img src="../../../icon-192.png" alt="ALN"></div>
      <div class="cn-name">ALN<small>Thi công — Mạng lưới đối tác</small></div>
    </a>
    <div class="cn-nav-links">
      <a class="cn-nav-link" href="../../index.html">Giới thiệu</a>
      <a class="cn-nav-link" href="../index.html">Kiến thức thi công</a>
    </div>
    <a class="btn btn-gold" href="../../lead-form.html"><i class="ph-duotone ph-clipboard-text"></i>Đăng ký nhận tư vấn</a>
  </div>
</header>

<main>
  <div class="cn-article-head">
    <div class="wrap">
      <nav class="cn-crumb" aria-label="Breadcrumb">
        <a href="../../index.html">Thi công ALN</a><span class="sep">›</span>
        <a href="../index.html">Kiến thức thi công</a><span class="sep">›</span>
        <span class="cur">${p.crumbCur}</span>
      </nav>
    </div>
  </div>

  <div class="cn-article-body">
    <h1 class="cn-h1">${p.h1}</h1>

    <div class="cn-meta">
      <span>Cập nhật ${p.date.split("-").reverse().join("/")}</span><span class="dot"></span>
      <span>${p.readTime}</span><span class="dot"></span>
      <span>Đội ngũ ALN</span>
    </div>

    <div class="cn-summary">
      <h2>Nội dung chính</h2>
      <ul>
${summaryList(p.summary)}
      </ul>
    </div>

    <div class="cn-prose">
${p.bodyHtml.trim()}
    </div>

    <div class="cn-cta-end">
      <h2>Đăng ký nhận tư vấn thi công — miễn phí</h2>
      <p>ALN kết nối bạn với đơn vị thi công đối tác phù hợp khu vực và loại công trình.</p>
      <div class="cn-cta-btns">
        <a class="btn btn-gold" href="../../lead-form.html"><i class="ph-duotone ph-clipboard-text"></i>Đăng ký nhận tư vấn</a>
        <a class="btn btn-on-navy" href="https://applamnha.vn/forum.html?cat=hoi_dap"><i class="ph-duotone ph-chat-circle-dots"></i>Hỏi Diễn đàn ALN</a>
      </div>
    </div>

  </div>

  <div class="wrap cn-related">
    <h2>Bài liên quan — Kiến thức thi công</h2>
    <div class="cn-related-grid">
${p.related.map(relatedCard).join("\n")}
    </div>
  </div>
</main>

<footer>
  <div class="wrap">
    <div class="foot-grid">
      <div class="foot-brand">
        <div class="cn-brand"><div class="cn-logo"><img src="../../../icon-192.png" alt="ALN"></div><div class="cn-name" style="font-size:15px">ALN</div></div>
        <p>ALN là Tổng thầu Thiết kế, kết nối chủ nhà với Kiến trúc sư và đơn vị thi công đối tác đã đăng ký. ALN không trực tiếp thi công.</p>
      </div>
      <div class="foot-col">
        <h5>Thi công ALN</h5>
        <a href="../../index.html">Trang giới thiệu</a>
        <a href="../index.html">Kiến thức thi công</a>
        <a href="../../lead-form.html">Đăng ký nhận tư vấn</a>
      </div>
      <div class="foot-col">
        <h5>Hệ sinh thái ALN</h5>
        <a href="https://applamnha.vn/">Trang chủ ALN</a>
        <a href="https://applamnha.vn/cam-nang/">Cẩm nang làm nhà</a>
        <a href="https://applamnha.vn/ncc-showcase.html">Mạng lưới Thiết bị - Vật tư</a>
      </div>
      <div class="foot-col">
        <h5>Liên hệ</h5>
        <a href="tel:0909829696"><i class="ph-duotone ph-phone" style="margin-right:6px;color:var(--gold)"></i>0909 82 9696</a>
        <a href="https://applamnha.vn" target="_blank" rel="noopener"><i class="ph-duotone ph-globe" style="margin-right:6px;color:var(--gold)"></i>applamnha.vn</a>
      </div>
    </div>
    <div class="foot-bottom">© ALN — App Làm Nhà Corp. · applamnha.vn</div>
  </div>
</footer>

</body>
</html>
`;
}

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

for (const p of POSTS) {
  const fname = `${p.date}-${p.slug}.html`;
  fs.writeFileSync(path.join(OUT_DIR, fname), render(p), "utf8");
  console.log("Wrote", fname);
}
console.log(`\nXong ${POSTS.length} file trong ${OUT_DIR}`);
