#!/usr/bin/env node
// Build script khu "Cẩm nang làm nhà" — Markdown → HTML tĩnh.
// KHÔNG dùng npm dependency ngoài, chỉ module built-in của Node.
//
// Chạy: node scripts/build-cam-nang.js
//
// Việc làm mỗi lần chạy (idempotent — chạy nhiều lần cho kết quả giống hệt):
//   1. Đọc mọi file content/cam-nang/*.md
//   2. Sinh cam-nang/{slug}/index.html cho từng bài
//   3. Sinh cam-nang/index.html (trang danh mục)
//   4. Sinh sitemap.xml (toàn site — bài Cẩm nang + danh sách trang public tĩnh)
//   5. Sinh robots.txt
//
// Founder KHÔNG cần chạy lệnh này — Claude Code chạy mỗi khi thêm bài mới
// rồi commit thẳng HTML sinh ra (xem CHANGES.md Pass 1, mục "Kiến trúc build").

var fs = require('fs');
var path = require('path');

var frontmatter = require('./lib/frontmatter');
var markdown = require('./lib/markdown');
var templates = require('./lib/templates');

var ROOT = path.join(__dirname, '..');
var CONTENT_DIR = path.join(ROOT, 'content', 'cam-nang');
var OUT_DIR = path.join(ROOT, 'cam-nang');
var SITE_BASE = 'https://applamnha.vn';

// ── Danh sách trang public tĩnh ngoài Cẩm nang — liệt kê thủ công (KHÔNG
// quét toàn bộ *.html) vì repo có nhiều trang nội bộ/admin cần đăng nhập
// (client_CN, client_DN, kts_dashboard, designer_dashboard, founder_panel,
// ks_dashboard, seed, kho-du-an, board-editor, aln_patch, aln_community,
// profile...) — KHÔNG được đưa vào sitemap để tránh Google index nhầm
// trang nội bộ. Nếu Founder muốn thêm/bớt trang, sửa mảng dưới đây.
var STATIC_PUBLIC_PAGES = [
  { url: '/home.html', priority: '1.0', changefreq: 'weekly' },
  { url: '/register.html', priority: '0.6', changefreq: 'monthly' },
  { url: '/login.html', priority: '0.4', changefreq: 'monthly' },
  { url: '/kts-apply.html', priority: '0.5', changefreq: 'monthly' },
  { url: '/dn-studio.html', priority: '0.5', changefreq: 'monthly' },
  { url: '/designer-apply.html', priority: '0.5', changefreq: 'monthly' },
  { url: '/ks-apply.html', priority: '0.5', changefreq: 'monthly' },
  { url: '/recruit.html', priority: '0.6', changefreq: 'monthly' },
  { url: '/tuyen-kts.html', priority: '0.6', changefreq: 'monthly' },
  { url: '/aln-giu-cho/phong-cho.html', priority: '0.5', changefreq: 'monthly' },
  { url: '/aln-giu-cho/giu-cho.html', priority: '0.5', changefreq: 'monthly' },
  { url: '/privacy.html', priority: '0.3', changefreq: 'yearly' },
];

function readArticles() {
  var files = fs.readdirSync(CONTENT_DIR).filter(function (f) { return f.endsWith('.md'); });
  var articles = files.map(function (file) {
    var raw = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8');
    var parsed = frontmatter.parseMarkdownFile(raw);
    var data = parsed.data;
    if (!data.slug) throw new Error(file + ': thiếu "slug" trong frontmatter');
    if (!templates.CATEGORIES[data.category]) {
      throw new Error(file + ': category "' + data.category + '" không hợp lệ. Hợp lệ: ' + Object.keys(templates.CATEGORIES).join(', '));
    }
    var rendered = markdown.renderMarkdown(parsed.body, data);
    data.bodyHtml = rendered.html;
    // Ưu tiên hộp tóm tắt trích từ blockquote "> **Nội dung chính**" trong
    // nội dung bài; fallback về frontmatter "summary" nếu bài không có (ví dụ
    // bài mẫu Pass 3 cũ dùng frontmatter thay vì blockquote).
    if (rendered.summary) data.summary = rendered.summary;
    data.sourceFile = file;
    return data;
  });
  // Bài mới nhất trước — sort theo "updated" (fallback "date"), dạng YYYY-MM-DD nên so sánh chuỗi là đủ.
  articles.sort(function (a, b) {
    var da = a.updated || a.date || '';
    var db = b.updated || b.date || '';
    return db.localeCompare(da);
  });
  return articles;
}

function writeFileIfChanged(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  var existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
  if (existing !== content) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }
  return false;
}

function buildArticles(articles) {
  var changed = 0;
  articles.forEach(function (article) {
    var html = templates.renderArticlePage(article, article.bodyHtml, articles, SITE_BASE);
    var outPath = path.join(OUT_DIR, article.slug, 'index.html');
    if (writeFileIfChanged(outPath, html)) changed++;
  });
  return changed;
}

function buildIndex(articles) {
  var html = templates.renderIndexPage(articles, SITE_BASE);
  var outPath = path.join(OUT_DIR, 'index.html');
  return writeFileIfChanged(outPath, html);
}

function buildSitemap(articles) {
  var urls = STATIC_PUBLIC_PAGES.map(function (p) {
    return { url: p.url, priority: p.priority, changefreq: p.changefreq };
  });
  urls.push({ url: '/cam-nang/', priority: '0.9', changefreq: 'weekly' });
  articles.forEach(function (a) {
    urls.push({
      url: '/cam-nang/' + a.slug + '/',
      priority: '0.8',
      changefreq: 'monthly',
      lastmod: a.updated || a.date,
    });
  });

  var body = urls.map(function (u) {
    var lines = ['  <url>', '    <loc>' + SITE_BASE + u.url + '</loc>'];
    if (u.lastmod) lines.push('    <lastmod>' + u.lastmod + '</lastmod>');
    lines.push('    <changefreq>' + u.changefreq + '</changefreq>');
    lines.push('    <priority>' + u.priority + '</priority>');
    lines.push('  </url>');
    return lines.join('\n');
  }).join('\n');

  var xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    body + '\n' +
    '</urlset>\n';

  return writeFileIfChanged(path.join(ROOT, 'sitemap.xml'), xml);
}

function buildRobots() {
  var txt = 'User-agent: *\nAllow: /\n\nSitemap: ' + SITE_BASE + '/sitemap.xml\n';
  return writeFileIfChanged(path.join(ROOT, 'robots.txt'), txt);
}

// ── Section "Cẩm nang làm nhà" trên home.html — CHỈ ghi đè phần nằm giữa
// 2 marker dưới đây (danh sách thẻ 3 bài mới nhất). Không đụng gì khác
// trong home.html. Nếu marker không tồn tại (home.html chưa có section
// Cẩm nang — ví dụ trước Pass 4), bỏ qua bước này thay vì lỗi.
var HOME_CARDS_START = '<!-- CAM_NANG_CARDS_START -->';
var HOME_CARDS_END = '<!-- CAM_NANG_CARDS_END -->';

function renderHomeCard(article) {
  var img = article.image
    ? '<img src="' + article.image + '" alt="' + (article.imageAlt || article.title) + '">'
    : 'Ảnh minh hoạ 16:9';
  return (
    '      <a class="cn-home-card" href="cam-nang/' + article.slug + '/">\n' +
    '        <div class="cn-home-img">' + img + '</div>\n' +
    '        <div class="cn-home-body">\n' +
    '          <span class="cn-home-tag">' + templates.categoryLabel(article.category) + '</span>\n' +
    '          <h3>' + article.title + '</h3>\n' +
    '        </div>\n' +
    '      </a>'
  );
}

function buildHomeSection(articles) {
  var homePath = path.join(ROOT, 'home.html');
  if (!fs.existsSync(homePath)) return false;
  var html = fs.readFileSync(homePath, 'utf8');
  var startIdx = html.indexOf(HOME_CARDS_START);
  var endIdx = html.indexOf(HOME_CARDS_END);
  if (startIdx === -1 || endIdx === -1) return false;

  var top3 = articles.slice(0, 3);
  var cards = top3.map(renderHomeCard).join('\n\n');
  var newHtml =
    html.slice(0, startIdx + HOME_CARDS_START.length) +
    '\n' + cards + '\n' +
    html.slice(endIdx);

  return writeFileIfChanged(homePath, newHtml);
}

function main() {
  var articles = readArticles();
  var articlesChanged = buildArticles(articles);
  var indexChanged = buildIndex(articles);
  var sitemapChanged = buildSitemap(articles);
  var robotsChanged = buildRobots();
  var homeChanged = buildHomeSection(articles);

  console.log('Cẩm nang build xong — ' + articles.length + ' bài.');
  console.log('  Bài viết đổi: ' + articlesChanged);
  console.log('  Trang danh mục đổi: ' + (indexChanged ? 'có' : 'không'));
  console.log('  home.html (khối 3 bài mới nhất) đổi: ' + (homeChanged ? 'có' : 'không'));
  console.log('  sitemap.xml đổi: ' + (sitemapChanged ? 'có' : 'không'));
  console.log('  robots.txt đổi: ' + (robotsChanged ? 'có' : 'không'));
}

main();
