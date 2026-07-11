#!/usr/bin/env node
/**
 * gen-sitemap.js — Sinh sitemap.xml cho ALN (chạy lại mỗi khi thêm trang mới)
 *
 * Cách chạy (từ gốc repo):  node tools/gen-sitemap.js
 *
 * Nguồn URL:
 *  1. STATIC_PAGES — danh sách trang tĩnh cố định (sửa tay khi thêm trang lẻ).
 *  2. Quét thư mục cam-nang/  — mỗi bài là 1 thư mục con chứa index.html.
 *  3. Quét thư mục mau/       — trang mẫu nhà tự sinh (Trụ 1), file *.html.
 *  4. Quét thư mục du-toan/   — tool dự toán + biến thể tỉnh (Trụ 2), file *.html.
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

// [đường dẫn, changefreq, priority]
const STATIC_PAGES = [
  ['home.html', 'weekly', '1.0'],
  ['forum.html', 'daily', '0.9'],
  ['register.html', 'monthly', '0.6'],
  ['kts-apply.html', 'monthly', '0.5'],
  ['dn-studio.html', 'monthly', '0.5'],
  ['designer-apply.html', 'monthly', '0.5'],
  ['ks-apply.html', 'monthly', '0.5'],
  ['recruit.html', 'monthly', '0.6'],
  ['tuyen-kts.html', 'monthly', '0.6'],
  ['aln-giu-cho/phong-cho.html', 'monthly', '0.5'],
  ['aln-giu-cho/giu-cho.html', 'monthly', '0.5'],
  ['privacy.html', 'yearly', '0.3'],
  ['cam-nang/', 'weekly', '0.9'],
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

// 1. Trang tĩnh cố định
for (const [p, cf, pr] of STATIC_PAGES) {
  const abs = path.join(ROOT, p.endsWith('/') ? p + 'index.html' : p);
  if (!fs.existsSync(abs)) {
    console.warn('  [bỏ qua] không thấy file: ' + p);
    continue;
  }
  push(BASE_URL + '/' + p, cf, pr, null);
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
