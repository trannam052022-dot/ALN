// Markdown → HTML tối giản cho nội dung bài Cẩm nang — KHÔNG dùng thư viện ngoài.
// Hỗ trợ đúng tập cú pháp bài Cẩm nang cần: H1 mở đầu (bỏ qua, template tự in
// H1 từ frontmatter), H2/H3 (kể cả khi dính liền đoạn văn theo sau, không cách
// dòng trống), đoạn văn, **đậm**, *nghiêng*, [link](url), danh sách "- item"
// (kể cả khi có 1 dòng dẫn in đậm phía trước), bảng GFM (| ... |), gạch ngang
// "---", khối HTML thô (dòng bắt đầu bằng "<"), marker [[CTA_MID]], và 2 dạng
// blockquote đặc biệt:
//   > **Nội dung chính**       → hộp tóm tắt (trích xuất riêng, không in inline)
//   > ... liên kết có "mymy"  → khối CTA giữa bài (nền navy)
// Blockquote khác (không khớp 2 dạng trên) → in như trích dẫn thường.

function inline(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (_, label, url) {
      var external = /^https?:\/\//.test(url);
      return '<a href="' + url + '"' + (external ? ' target="_blank" rel="noopener"' : '') + '>' + label + '</a>';
    });
}

function isListLine(l) {
  return /^-\s+/.test(l);
}

function renderList(lines) {
  var items = lines.map(function (l) { return '<li>' + inline(l.replace(/^-\s+/, '')) + '</li>'; });
  return '<ul>' + items.join('') + '</ul>';
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

// Render 1 block (đã tách theo dòng trống). Đệ quy để xử lý trường hợp
// heading/nhãn in đậm dính liền nội dung theo sau mà không cách dòng trống.
function renderBlock(block) {
  var lines = block.split('\n');

  var heading = lines[0].match(/^(#{2,3})\s+(.*)$/);
  if (heading) {
    var level = heading[1].length; // 2 hoặc 3
    var out = '<h' + level + '>' + inline(heading[2]) + '</h' + level + '>';
    var rest = lines.slice(1).join('\n').trim();
    return rest ? out + '\n\n' + renderBlock(rest) : out;
  }

  if (lines.every(isListLine)) {
    return renderList(lines);
  }

  // 1 dòng dẫn in đậm (không phải "- item"), các dòng còn lại là danh sách
  if (!isListLine(lines[0]) && lines.length > 1 && lines.slice(1).every(isListLine)) {
    return '<p>' + inline(lines[0]) + '</p>\n\n' + renderList(lines.slice(1));
  }

  if (lines[0].trim()[0] === '|' && lines[1] && /^\|?\s*-{2,}/.test(lines[1])) {
    return renderTable(lines);
  }

  if (block[0] === '<') {
    return block; // khối HTML thô — truyền thẳng, không xử lý inline
  }

  // Câu hỏi in đậm đứng riêng (FAQ) + câu trả lời liền dòng theo sau,
  // không cách dòng trống — tách thành 2 đoạn thay vì gộp làm một dòng.
  if (/^\*\*.+\*\*:?$/.test(lines[0].trim()) && lines.length > 1) {
    var answer = lines.slice(1).join(' ').trim();
    return '<p>' + inline(lines[0]) + '</p>\n\n<p>' + inline(answer) + '</p>';
  }

  return '<p>' + inline(lines.join(' ')) + '</p>';
}

function isBlockquote(lines) {
  return lines.every(function (l) { return /^>/.test(l.trim()); });
}

function stripBlockquote(lines) {
  return lines.map(function (l) { return l.trim().replace(/^>\s?/, ''); });
}

function renderMarkdown(body, data) {
  var blocks = body.split(/\n{2,}/).map(function (b) { return b.trim(); }).filter(Boolean);

  // Bỏ qua H1 mở đầu (trùng title trong frontmatter) — template tự in H1 riêng.
  if (blocks.length && /^#\s+.+/.test(blocks[0]) && !/^##/.test(blocks[0])) {
    blocks.shift();
  }

  var html = [];
  var summary = null;

  for (var i = 0; i < blocks.length; i++) {
    var block = blocks[i];
    var lines = block.split('\n');

    if (block === '[[CTA_MID]]') {
      html.push(renderCtaMid(data.ctaMid));
      continue;
    }

    if (block === '---' || block === '***') {
      html.push('<hr>');
      continue;
    }

    // Bỏ marker tác giả để lại cuối bài — CTA cuối bài đã tự render cố định,
    // marker này chỉ là ghi chú cho người viết, không cần xuất hiện trong HTML.
    if (/^<!--\s*CTA_BLOCK/.test(block)) {
      continue;
    }

    if (isBlockquote(lines)) {
      var stripped = stripBlockquote(lines);
      if (/^\*\*Nội dung chính\*\*$/i.test(stripped[0])) {
        summary = stripped.slice(1)
          .filter(function (l) { return /^-\s+/.test(l); })
          .map(function (l) { return inline(l.replace(/^-\s+/, '')); });
        continue;
      }
      var joined = stripped.join(' ').trim();
      if (/mymy/i.test(joined)) {
        html.push('<div class="cn-cta-mid"><p>' + inline(joined) + '</p></div>');
        continue;
      }
      html.push('<blockquote>' + inline(joined) + '</blockquote>');
      continue;
    }

    html.push(renderBlock(block));
  }

  return { html: html.join('\n\n'), summary: summary };
}

module.exports = { renderMarkdown: renderMarkdown };
