// Template HTML cho khu Cẩm nang — build script build-cam-nang.js gọi các hàm
// này để lắp trang. Toàn bộ markup/class CSS giữ nguyên như bản Pass 2 đã
// được Founder duyệt (dùng đúng màu/font trích xuất từ home.html).

var CATEGORIES = {
  'chi-phi-bao-gia': 'Chi phí & Báo giá',
  'phap-ly-giay-phep': 'Pháp lý & Giấy phép',
  'kinh-nghiem-lam-nha': 'Kinh nghiệm làm nhà',
  'chon-kien-truc-su': 'Chọn Kiến trúc sư',
  'khu-vuc': 'Xây nhà theo khu vực',
};

function categoryLabel(slug) {
  return CATEGORIES[slug] || slug;
}

function formatDateVN(iso) {
  var m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(iso);
  return m[3] + '/' + m[2] + '/' + m[1];
}

function headTags(opts) {
  // opts: {title, description, canonical, ogType, ogImage, jsonLd, root}
  var lines = [];
  lines.push('<meta charset="UTF-8">');
  lines.push('<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">');
  lines.push('');
  lines.push('<title>' + opts.title + '</title>');
  lines.push('<meta name="description" content="' + opts.description + '">');
  lines.push('<meta name="robots" content="index, follow">');
  lines.push('<link rel="canonical" href="' + opts.canonical + '">');
  lines.push('<meta property="og:type" content="' + (opts.ogType || 'website') + '">');
  lines.push('<meta property="og:url" content="' + opts.canonical + '">');
  lines.push('<meta property="og:title" content="' + (opts.ogTitle || opts.title) + '">');
  lines.push('<meta property="og:description" content="' + (opts.ogDescription || opts.description) + '">');
  if (opts.ogImage) lines.push('<meta property="og:image" content="' + opts.ogImage + '">');
  lines.push('<meta property="og:site_name" content="App Làm Nhà">');
  lines.push('<meta property="og:locale" content="vi_VN">');
  lines.push('<meta name="twitter:card" content="summary_large_image">');
  if (opts.jsonLd) {
    lines.push('');
    lines.push('<script type="application/ld+json">');
    lines.push(JSON.stringify(opts.jsonLd, null, 2));
    lines.push('</script>');
  }
  lines.push('');
  lines.push('<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,600;1,300;1,600&family=DM+Sans:wght@300;400;500;600;700&family=Syne:wght@700;800&display=swap" rel="stylesheet">');
  lines.push('<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.1/src/duotone/style.css">');
  lines.push('<link rel="stylesheet" href="' + opts.root + 'aln-tokens.css">');
  lines.push('<link rel="stylesheet" href="' + opts.cn + 'cam-nang.css">');
  lines.push('<link rel="icon" href="' + opts.root + 'icon-192.png" type="image/png">');
  lines.push('<meta name="theme-color" content="#98690a">');
  return lines.join('\n');
}

function header(paths) {
  return (
    '<header id="cn-nav">\n' +
    '  <div class="wrap cn-nav-inner">\n' +
    '    <a href="' + paths.root + 'home.html" class="cn-brand">\n' +
    '      <div class="cn-logo"><img src="' + paths.root + 'icon-192.png" alt="ALN"></div>\n' +
    '      <div class="cn-name">ALN<small>Cẩm nang làm nhà</small></div>\n' +
    '    </a>\n' +
    '    <div class="cn-nav-links">\n' +
    '      <a class="cn-nav-link" href="' + paths.root + 'home.html">Trang chủ</a>\n' +
    '      <a class="cn-nav-link" href="' + paths.root + 'home.html#pricing">Bảng giá</a>\n' +
    '      <a class="cn-nav-link" href="' + paths.cn + 'index.html">Cẩm nang</a>\n' +
    '    </div>\n' +
    '    <a class="btn btn-gold" href="' + paths.root + 'home.html#pricing"><i class="ph-duotone ph-file-text"></i>Nhận báo giá</a>\n' +
    '  </div>\n' +
    '</header>'
  );
}

function footer(paths) {
  return (
    '<footer>\n' +
    '  <div class="wrap">\n' +
    '    <div class="foot-grid">\n' +
    '      <div class="foot-brand">\n' +
    '        <div class="cn-brand"><div class="cn-logo"><img src="' + paths.root + 'icon-192.png" alt="ALN"></div><div class="cn-name" style="font-size:15px">ALN</div></div>\n' +
    '        <p>ALN là nền tảng kết nối kiến trúc sư và đơn vị thi công đã thẩm định, thanh toán trực tiếp minh bạch từng chặng C1–C4.</p>\n' +
    '      </div>\n' +
    '      <div class="foot-col">\n' +
    '        <h5>Điều hướng</h5>\n' +
    '        <a href="' + paths.root + 'home.html#why">Vì sao chọn ALN</a>\n' +
    '        <a href="' + paths.root + 'home.html#process">Quy trình C1–C4</a>\n' +
    '        <a href="' + paths.root + 'home.html#pricing">Bảng giá</a>\n' +
    '        <a href="' + paths.cn + 'index.html">Cẩm nang</a>\n' +
    '      </div>\n' +
    '      <div class="foot-col">\n' +
    '        <h5>Truy cập</h5>\n' +
    '        <a href="' + paths.root + 'login.html">Đăng nhập</a>\n' +
    '        <a href="' + paths.root + 'register.html">Đăng ký chủ nhà</a>\n' +
    '        <a href="' + paths.root + 'kts-apply.html">Đăng ký KTS</a>\n' +
    '      </div>\n' +
    '      <div class="foot-col">\n' +
    '        <h5>Liên hệ</h5>\n' +
    '        <a href="tel:0909829696"><i class="ph-duotone ph-phone" style="margin-right:6px;color:var(--gold)"></i>0909 82 9696</a>\n' +
    '        <a href="https://applamnha.vn" target="_blank" rel="noopener"><i class="ph-duotone ph-globe" style="margin-right:6px;color:var(--gold)"></i>applamnha.vn</a>\n' +
    '        <p><i class="ph-duotone ph-map-pin" style="margin-right:6px;color:var(--gold)"></i>TP. Hồ Chí Minh</p>\n' +
    '      </div>\n' +
    '    </div>\n' +
    '    <div class="foot-bottom">© ALN — App Làm Nhà Corp. · applamnha.vn</div>\n' +
    '  </div>\n' +
    '</footer>'
  );
}

function page(headHtml, bodyHtml) {
  return (
    '<!DOCTYPE html>\n' +
    '<html lang="vi">\n' +
    '<head>\n' + headHtml + '\n</head>\n' +
    '<body>\n\n' + bodyHtml + '\n\n</body>\n' +
    '</html>\n'
  );
}

function renderIndexCard(article) {
  var imgBlock = article.image
    ? '<img src="' + article.image + '" alt="' + (article.imageAlt || article.title) + '">'
    : 'Ảnh minh hoạ 16:9';
  return (
    '      <a class="cn-card" href="' + article.slug + '/" data-category="' + article.category + '">\n' +
    '        <div class="cn-card-img">' + imgBlock + '</div>\n' +
    '        <div class="cn-card-body">\n' +
    '          <span class="tag-gold">' + categoryLabel(article.category) + '</span>\n' +
    '          <h3>' + article.title + '</h3>\n' +
    '          <p>' + article.description + '</p>\n' +
    '        </div>\n' +
    '      </a>'
  );
}

function renderIndexPage(articles, siteBase) {
  var paths = { root: '../', cn: '' };
  var head = headTags({
    title: 'Cẩm nang làm nhà — Kiến thức từ Kiến trúc sư ALN',
    description: 'Cẩm nang làm nhà ALN: chi phí thiết kế, pháp lý xây dựng, kinh nghiệm chọn Kiến trúc sư — kiến thức thực tế, cập nhật 2026.',
    canonical: siteBase + '/cam-nang/',
    ogDescription: 'Chi phí, pháp lý, kinh nghiệm làm nhà — kiến thức thực tế từ đội ngũ KTS App Làm Nhà.',
    root: paths.root,
    cn: paths.cn,
  });

  var filters = Object.keys(CATEGORIES).map(function (slug) {
    return '      <button class="cn-filter" data-filter="' + slug + '">' + CATEGORIES[slug] + '</button>';
  }).join('\n');

  var cards = articles.map(renderIndexCard).join('\n\n');
  var emptyNote = articles.length < 9
    ? '\n\n      <div class="cn-empty-note">Các bài tiếp theo đang được đội ngũ KTS ALN biên soạn — cập nhật hàng tuần.</div>'
    : '';

  var body =
    header(paths) + '\n\n' +
    '<main>\n' +
    '  <div class="wrap">\n' +
    '    <section class="cn-hero">\n' +
    '      <div class="eyebrow" style="justify-content:center"><span class="ln"></span>CẨM NANG LÀM NHÀ<span class="ln"></span></div>\n' +
    '      <h1>Kiến thức thực tế từ <em>Kiến trúc sư ALN</em></h1>\n' +
    '      <p>Chi phí, pháp lý, kinh nghiệm làm nhà — viết bởi đội ngũ KTS đang trực tiếp thẩm định hồ sơ mỗi ngày, không phải nội dung copy lại.</p>\n' +
    '    </section>\n\n' +
    '    <nav class="cn-filters" aria-label="Lọc theo chuyên mục">\n' +
    '      <button class="cn-filter active" data-filter="all">Tất cả</button>\n' +
    filters + '\n' +
    '    </nav>\n\n' +
    '    <div class="cn-grid" id="cnGrid">\n' +
    cards +
    emptyNote + '\n' +
    '    </div>\n\n' +
    '    <div class="cn-pagination">\n' +
    '      <span class="cn-page-btn active">1</span>\n' +
    '    </div>\n' +
    '  </div>\n' +
    '</main>\n\n' +
    footer(paths) + '\n\n' +
    '<script>\n' +
    '(function(){\n' +
    "  var filters = document.querySelectorAll('.cn-filter');\n" +
    "  var cards = document.querySelectorAll('#cnGrid .cn-card');\n" +
    '  for (var i = 0; i < filters.length; i++) {\n' +
    "    filters[i].addEventListener('click', function(e){\n" +
    "      var f = e.currentTarget.getAttribute('data-filter');\n" +
    '      for (var j = 0; j < filters.length; j++) { filters[j].classList.remove(\'active\'); }\n' +
    "      e.currentTarget.classList.add('active');\n" +
    '      for (var k = 0; k < cards.length; k++) {\n' +
    "        var cat = cards[k].getAttribute('data-category');\n" +
    "        cards[k].style.display = (f === 'all' || f === cat) ? '' : 'none';\n" +
    '      }\n' +
    '    });\n' +
    '  }\n' +
    '})();\n' +
    '</script>';

  return page(head, body);
}

function renderRelated(article, allArticles, paths) {
  var sameCategory = allArticles.filter(function (a) {
    return a.slug !== article.slug && a.category === article.category;
  });
  var realCards = sameCategory.slice(0, 3).map(function (a) {
    return (
      '      <a class="cn-related-card" href="' + paths.cn + a.slug + '/">\n' +
      '        <span class="tag-gold">' + categoryLabel(a.category) + '</span>\n' +
      '        <h4>' + a.title + '</h4>\n' +
      '      </a>'
    );
  });
  var upcoming = (article.relatedUpcoming || []).slice(0, 3 - realCards.length).map(function (title) {
    return (
      '      <div class="cn-related-card">\n' +
      '        <span class="tag-gold">' + categoryLabel(article.category) + '</span>\n' +
      '        <h4>' + title + '</h4>\n' +
      '        <span class="soon">Sắp ra mắt</span>\n' +
      '      </div>'
    );
  });
  var cards = realCards.concat(upcoming);
  if (cards.length === 0) return '';
  return (
    '  <div class="wrap cn-related">\n' +
    '    <h2>Bài liên quan — ' + categoryLabel(article.category) + '</h2>\n' +
    '    <div class="cn-related-grid">\n' +
    cards.join('\n\n') + '\n' +
    '    </div>\n' +
    '  </div>'
  );
}

function renderArticlePage(article, contentHtml, allArticles, siteBase) {
  var paths = { root: '../../', cn: '../' };
  var canonical = siteBase + '/cam-nang/' + article.slug + '/';
  var jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description,
    image: article.image ? siteBase + article.image : undefined,
    datePublished: article.date,
    dateModified: article.updated || article.date,
    author: { '@type': 'Organization', name: article.author || 'Đội ngũ KTS App Làm Nhà' },
    publisher: {
      '@type': 'Organization',
      name: 'App Làm Nhà',
      logo: { '@type': 'ImageObject', url: siteBase + '/icon-512.png' },
    },
    mainEntityOfPage: canonical,
  };

  var head = headTags({
    title: article.title,
    description: article.description,
    canonical: canonical,
    ogType: 'article',
    ogImage: article.image ? siteBase + article.image : undefined,
    jsonLd: jsonLd,
    root: paths.root,
    cn: paths.cn,
  });

  var heroImg = article.image
    ? '<img src="' + article.image + '" alt="' + (article.imageAlt || article.title) + '">'
    : 'Ảnh minh hoạ 16:9 — chờ Founder cung cấp ảnh thật';

  var summaryItems = (article.summary || []).map(function (s) { return '        <li>' + s + '</li>'; }).join('\n');

  // Khối thế mạnh ALN — dẫn bằng điều làm được NGAY (chỉ trang khu vực),
  // rồi mới tới thông tin xây dựng địa phương (tham khảo). Tránh "hứa" thi công.
  var strengthsBlock = article.category !== 'khu-vuc' ? '' :
    '    <div class="cn-aln-strengths">\n' +
    '      <h2>App Làm Nhà đồng hành cùng bạn — làm được ngay hôm nay</h2>\n' +
    '      <div class="cn-str-grid">\n' +
    '        <div class="cn-str-item"><i class="ph-duotone ph-users-three"></i><h3>Mạng lưới kiến trúc sư thẩm định</h3><p>Kết nối bạn với KTS được thẩm định, hợp gu và ngân sách — luôn đứng về phía chủ nhà, từ bản vẽ đến giám sát.</p></div>\n' +
    '        <div class="cn-str-item"><i class="ph-duotone ph-video-camera"></i><h3>Phòng Hội Kiến — làm việc mọi nơi</h3><p>Họp trực tuyến với KTS ngay trên nền tảng, dù bạn ở tỉnh nào hay đang ở nước ngoài. Xem bản vẽ, chốt phương án không cần đi lại.</p></div>\n' +
    '        <div class="cn-str-item"><i class="ph-duotone ph-steps"></i><h3>Thanh toán theo từng chặng</h3><p>Trả theo tiến độ minh bạch C1–C4 — làm tới đâu trả tới đó, an tâm không ứng trước rủi ro.</p></div>\n' +
    '      </div>\n' +
    '      <p class="cn-str-bridge">Dưới đây là thông tin xây dựng tại địa phương, để bạn tham khảo khi lên kế hoạch:</p>\n' +
    '    </div>\n\n';

  var body =
    header(paths) + '\n\n' +
    '<main>\n' +
    '  <div class="cn-article-head">\n' +
    '    <div class="wrap">\n' +
    '      <nav class="cn-crumb" aria-label="Breadcrumb">\n' +
    '        <a href="' + paths.root + 'home.html">Trang chủ</a><span class="sep">›</span>\n' +
    '        <a href="' + paths.cn + 'index.html">Cẩm nang</a><span class="sep">›</span>\n' +
    '        <span class="cur">' + categoryLabel(article.category) + '</span>\n' +
    '      </nav>\n' +
    '    </div>\n' +
    '  </div>\n\n' +
    '  <div class="cn-article-body">\n' +
    '    <h1 class="cn-h1">' + article.title + '</h1>\n\n' +
    '    <div class="cn-meta">\n' +
    '      <span>Cập nhật ' + formatDateVN(article.updated || article.date) + '</span><span class="dot"></span>\n' +
    '      <span>' + (article.readTime || '5 phút đọc') + '</span><span class="dot"></span>\n' +
    '      <span>' + (article.author || 'Đội ngũ KTS App Làm Nhà') + '</span>\n' +
    '    </div>\n\n' +
    '    <figure>\n' +
    '      <div class="cn-hero-img">' + heroImg + '</div>\n' +
    (article.imageCaption ? '      <p class="cn-caption">' + article.imageCaption + '</p>\n' : '') +
    '    </figure>\n\n' +
    strengthsBlock +
    (summaryItems ?
      '    <div class="cn-summary">\n' +
      '      <h2>Nội dung chính</h2>\n' +
      '      <ul>\n' + summaryItems + '\n      </ul>\n' +
      '    </div>\n\n' : '') +
    '    <div class="cn-prose">\n' +
    contentHtml.replace(/\{\{ROOT\}\}/g, paths.root) + '\n' +
    '    </div>\n\n' +
    '    <div class="cn-cta-end">\n' +
    '      <h2>' + (article.ctaEndTitle || 'Nhận báo giá thiết kế chính xác cho ngôi nhà của bạn') + '</h2>\n' +
    '      <p>' + (article.ctaEndText || 'Miễn phí tư vấn phương án + dự toán sơ bộ, không ràng buộc.') + '</p>\n' +
    '      <div class="cn-cta-btns">\n' +
    '        <a class="btn btn-gold" href="' + paths.root + 'home.html#pricing"><i class="ph-duotone ph-file-text"></i>Nhận báo giá ngay</a>\n' +
    '        <a class="btn btn-on-navy" href="' + paths.root + 'home.html?mymy=1#pricing"><i class="ph-duotone ph-chat-circle-dots"></i>Chat với MyMy</a>\n' +
    '      </div>\n' +
    '    </div>\n' +
    '  </div>\n\n' +
    renderRelated(article, allArticles, paths) + '\n' +
    '</main>\n\n' +
    footer(paths);

  return page(head, body);
}

module.exports = {
  CATEGORIES: CATEGORIES,
  categoryLabel: categoryLabel,
  renderIndexPage: renderIndexPage,
  renderArticlePage: renderArticlePage,
};
