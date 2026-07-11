#!/usr/bin/env node
/**
 * gen-sitemap.js — Sinh sitemap.xml cho ALN (chạy lại mỗi khi thêm trang mới)
 *
 * Cách chạy (từ gốc repo):  node tools/gen-sitemap.js
 *
 * NGUYÊN TẮC (whitelist nghiêm ngặt): sitemap CHỈ chứa trang public muốn Google
 * xếp hạng tìm kiếm — KHÔNG phải mọi trang crawl được. Trang chỉ phục vụ 1 luồng
 * cụ thể (đăng ký, form nội bộ, landing quảng cáo trả phí) KHÔNG được liệt ở đây
 * dù không bị chặn trong robots.txt. Mọi trang bị Disallow trong robots.txt chắc
 * chắn không được thêm vào STATIC_PAGES/SCAN_DIRS bên dưới.
 *
 * Nguồn URL:
 *  1. STATIC_PAGES — danh sách trang tĩnh cố định đã DUYỆT (sửa tay khi thêm trang
 *     lẻ — chỉ thêm trang thật sự muốn organic search tìm thấy).
 *  2. Quét thư mục cam-nang/     — nội dung SEO (mỗi bài 1 thư mục con index.html).
 *  3. Quét thư mục mau/          — trang mẫu nhà tự sinh (Trụ 1), file *.html.
 *  4. Quét thư mục du-toan/      — tool dự toán + biến thể tỉnh (Trụ 2), file *.html.
 *  5. Quét thư mục thiet-ke-nha/ — trang dịch vụ theo tỉnh (Trụ 3), file *.html.
 *
 * lastmod lấy từ git (ngày commit cuối của file); nếu không có git thì bỏ qua.
 * TODO: nếu đổi domain thì sửa BASE_URL bên dưới (hiện dùng applamnha.vn).
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BASE_URL = 'https://applamnha.vn';
const ROOT = path.join(__dirname, '..');

// Trang tĩnh đã DUYỆT cho sitemap — whitelist, KHÔNG quét toàn bộ *.html ở gốc repo.
// { file: đường dẫn kiểm tra tồn tại, url: URL tương đối (rỗng = trang chủ '/') }
const STATIC_PAGES = [
  { file: 'index.html', url: '', cf: 'weekly', pr: '1.0' },       // trang chủ (root — GitHub Pages trả về index.html)
  { file: 'recruit.html', url: 'recruit.html', cf: 'monthly', pr: '0.6' },
  { file: 'forum.html', url: 'forum.html', cf: 'daily', pr: '0.8' },
  { file: 'cam-nang/index.html', url: 'cam-nang/', cf: 'weekly', pr: '0.9' },
];

// [thư mục, kiểu quét, changefreq, priority]
// 'dirs'  = mỗi thư mục con có index.html → URL dạng thu-muc/ten-bai/
// 'files' = mỗi file .html (trừ index.html đã khai báo riêng nếu cần)
const SCAN_DIRS = [
  ['cam-nang', 'dirs', 'monthly', '0.8'],
  ['mau', 'files', 'monthly', '0.8'],
  ['du-toan', 'files', 'monthly', '0.8'],
  ['thiet-ke-nha', 'files', 'monthly', '0.8'],
];

function gitLastmod(relPath) {
  try {
    const out = execSync('git log -1 --format=%cs -- "' + relPath + '"', {
      cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return out || null;
  } catch (e) {
    return null;
  }
}

function urlEntry(loc, changefreq, priority, lastmod) {
  let s = '  <url>\n    <loc>' + loc + '</loc>\n';
  if (lastmod) s += '    <lastmod>' + lastmod + '</lastmod>\n';
  s += '    <changefreq>' + changefreq + '</changefreq>\n';
  s += '    <priority>' + priority + '</priority>\n  </url>\n';
  return s;
}

const entries = [];
const seen = new Set();

function push(loc, cf, pr, lastmod) {
  if (seen.has(loc)) return;
  seen.add(loc);
  entries.push(urlEntry(loc, cf, pr, lastmod));
}

// 1. Trang tĩnh đã duyệt
for (const { file, url, cf, pr } of STATIC_PAGES) {
  const abs = path.join(ROOT, file);
  if (!fs.existsSync(abs)) {
    console.warn('  [bỏ qua] không thấy file: ' + file);
    continue;
  }
  push(BASE_URL + '/' + url, cf, pr, gitLastmod(file));
}

// 2. Quét thư mục
for (const [dir, mode, cf, pr] of SCAN_DIRS) {
  const absDir = path.join(ROOT, dir);
  if (!fs.existsSync(absDir)) continue;
  const items = fs.readdirSync(absDir).sort();
  for (const item of items) {
    const absItem = path.join(absDir, item);
    if (mode === 'dirs') {
      if (!fs.statSync(absItem).isDirectory()) continue;
      const idx = path.join(absItem, 'index.html');
      if (!fs.existsSync(idx)) continue;
      const rel = dir + '/' + item + '/index.html';
      push(BASE_URL + '/' + dir + '/' + item + '/', cf, pr, gitLastmod(rel));
    } else {
      if (!item.endsWith('.html')) continue;
      const rel = dir + '/' + item;
      if (item === 'index.html') {
        push(BASE_URL + '/' + dir + '/', 'weekly', '0.9', gitLastmod(rel));
      } else {
        push(BASE_URL + '/' + rel, cf, pr, gitLastmod(rel));
      }
    }
  }
}

const xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
  + entries.join('')
  + '</urlset>\n';

fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), xml, 'utf8');
console.log('Đã sinh sitemap.xml với ' + entries.length + ' URL.');
