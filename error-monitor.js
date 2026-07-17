/* Giám sát lỗi JS — bắt window.onerror + unhandledrejection, gửi Cloud
   Function logClientError (không ghi thẳng Firestore, không cần đăng nhập/
   App Check). Không thu thập tên/SĐT/uid — chỉ message/stack/url.
   Tối đa 10 lỗi/phiên để tránh spam khi 1 trang lỗi lặp liên tục. */
(function () {
  // Bỏ qua khi mở file cục bộ (file://) — đây là môi trường dev/xem trước lúc
  // sửa code, không phải người dùng thật trên site, không cần báo lỗi.
  if (location.protocol === "file:") return;

  var ENDPOINT = "https://asia-southeast1-aln-platform.cloudfunctions.net/logClientError";
  var MAX_PER_SESSION = 10;
  var sent = 0;

  function report(message, stack) {
    if (sent >= MAX_PER_SESSION) return;
    sent++;
    var payload = JSON.stringify({
      message: String(message || "").slice(0, 500),
      stack: String(stack || "").slice(0, 1000),
      url: location.href.slice(0, 300)
    });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(ENDPOINT, new Blob([payload], { type: "application/json" }));
      } else {
        fetch(ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body: payload, keepalive: true });
      }
    } catch (e) { /* im lặng — công cụ giám sát không được tự gây lỗi thêm */ }
  }

  window.addEventListener("error", function (e) {
    report(e.message, e.error && e.error.stack);
  });
  window.addEventListener("unhandledrejection", function (e) {
    var reason = e.reason;
    report((reason && reason.message) || String(reason), reason && reason.stack);
  });
})();
