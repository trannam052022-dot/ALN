// Markdown → HTML tối giản cho nội dung bài Cẩm nang — KHÔNG dùng thư viện ngoài.
// Hỗ trợ đúng tập cú pháp bài Cẩm nang cần: H2/H3, đoạn văn, **đậm**,
// [link](url), danh sách "- item", bảng GFM (| ... |), khối HTML thô
// (dòng bắt đầu bằng "<"), và marker [[CTA_MID]] để chèn khối CTA giữa bài.

function inline(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (_, label, url) {
      var external = /^https?:\/\//.test(url);
      return '<a href="' + url + '"' + (external ? ' target="_blank" rel="noopener"' : '') + '>' + label + '</a>';
    });
}

function renderTable(lines) {
  var header = lines[0].replace(/^\||\|$/g, '').split('|').map(function (c) { return c.trim(); });
  var rows = lines.slice(2).map(function (l) {
    return l.replace(/^\||\|$/g, '').split('|').map(function (c) { return c.trim(); });
  });
  var thead = '<thead><tr>' + header.map(function (c) { return '<th>' + inline(c) + '</th>'; }).join('') + '</tr></thead>';
  var tbody = '<tbody>' + rows.map(function (r) {
    return '<tr>' + r.map(function (c) { return '<td>' + inline(c) + '</td>'; }).join('') + '</tr>';
  }).join('') + '</tbody>';
  return '<div class="cn-table-wrap"><table class="cn-table">' + thead + tbody + '</table></div>';
}

function renderCtaMid(ctaMid) {
  var text = (ctaMid || 'Muốn biết chi phí thiết kế chính xác cho ngôi nhà của bạn?\nChat miễn phí với MyMy →').split('\n');
  return '<div class="cn-cta-mid">\n' +
    '  <p>' + text.map(inline).join('<br>') + '</p>\n' +
    '  <a class="btn btn-on-navy" href="{{ROOT}}home.html?mymy=1#pricing"><i class="ph-duotone ph-chat-circle-dots"></i>Chat với MyMy</a>\n' +
    '</div>';
}

function renderMarkdown(body, data) {
  var blocks = body.split(/\n{2,}/).map(function (b) { return b.trim(); }).filter(Boolean);
  var html = [];

  for (var i = 0; i < blocks.length; i++) {
    var block = blocks[i];
    var lines = block.split('\n');

    if (block === '[[CTA_MID]]') {
      html.push(renderCtaMid(data.ctaMid));
      continue;
    }

    var heading = block.match(/^(#{2,3})\s+(.*)$/);
    if (heading) {
      var level = heading[1].length; // 2 hoặc 3
      html.push('<h' + level + '>' + inline(heading[2]) + '</h' + level + '>');
      continue;
    }

    if (lines.every(function (l) { return /^-\s+/.test(l); })) {
      var items = lines.map(function (l) { return '<li>' + inline(l.replace(/^-\s+/, '')) + '</li>'; });
      html.push('<ul>' + items.join('') + '</ul>');
      continue;
    }

    if (lines[0].trim()[0] === '|' && lines[1] && /^\|?\s*-{2,}/.test(lines[1])) {
      html.push(renderTable(lines));
      continue;
    }

    if (block[0] === '<') {
      html.push(block); // khối HTML thô — truyền thẳng, không xử lý inline
      continue;
    }

    html.push('<p>' + inline(block.replace(/\n/g, ' ')) + '</p>');
  }

  return html.join('\n\n');
}

module.exports = { renderMarkdown: renderMarkdown };
