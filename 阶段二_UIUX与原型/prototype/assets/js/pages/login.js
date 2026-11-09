/* P14 登录 / 微信授权 */
(function () {
  var timerId = null;
  var seconds = 60;
  var fromUrl = "";

  function qrSvg() {
    var n = 25;
    var seed = 20261105;
    function rnd() {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    }
    function finder(x, y) {
      var cells = [];
      for (var r = 0; r < 7; r++) {
        for (var c = 0; c < 7; c++) {
          var edge = r === 0 || r === 6 || c === 0 || c === 6;
          var core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          if (edge || core) cells.push([x + c, y + r]);
        }
      }
      return cells;
    }
    var fixed = {};
    function mark(x, y, v) { fixed[x + "," + y] = v; }
    finder(0, 0).forEach(function (p) { mark(p[0], p[1], 1); });
    finder(n - 7, 0).forEach(function (p) { mark(p[0], p[1], 1); });
    finder(0, n - 7).forEach(function (p) { mark(p[0], p[1], 1); });
    for (var i = 8; i < n - 8; i++) {
      mark(i, 6, i % 2 === 0 ? 1 : 0);
      mark(6, i, i % 2 === 0 ? 1 : 0);
    }
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + n + " " + n +
      '" shape-rendering="crispEdges"><rect width="' + n + '" height="' + n + '" fill="#fff"/>';
    for (var y = 0; y < n; y++) {
      for (var x = 0; x < n; x++) {
        var v = fixed[x + "," + y];
        if (v === undefined) v = rnd() > 0.52 ? 1 : 0;
        if (v) svg += '<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="#1a1815"/>';
      }
    }
    svg += "</svg>";
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  function resetQr() {
    seconds = 60;
    document.getElementById("qr-img").src = qrSvg();
    document.getElementById("qr-mask").hidden = true;
    document.getElementById("qr-timer").textContent = seconds;
    document.getElementById("qr-status").innerHTML = '请使用微信扫一扫 · <span id="qr-timer">' + seconds + " 秒后失效</span>";
    if (timerId) clearInterval(timerId);
    timerId = setInterval(tick, 1000);
  }

  function tick() {
    seconds--;
    var el = document.getElementById("qr-timer");
    if (el) el.textContent = seconds;
    if (seconds <= 0) {
      clearInterval(timerId);
      document.getElementById("qr-mask").hidden = false;
    }
  }

  function showLogged(user) {
    document.getElementById("auth-card").classList.add("hidden");
    var card = document.getElementById("logged-card");
    card.classList.remove("hidden");
    document.getElementById("logged-avatar").textContent = user.nick.slice(0, 1);
    document.getElementById("logged-avatar").style.background = user.color;
    document.getElementById("logged-nick").textContent = user.nick;
    document.getElementById("logged-since").textContent = "自 " + MM.demoUser.joined + " 加入茗脉";
    var back = fromUrl ? decodeURIComponent(fromUrl) : "index.html";
    document.getElementById("continue-btn").href = back;
  }

  function loginNow() {
    if (!document.getElementById("agree").checked) {
      MM.ui.toast("请先阅读并同意用户协议与隐私政策");
      return;
    }
    var user = MM.store.login();
    MM.ui.refreshHeaderUser();
    MM.ui.toast("登录成功，已同步收藏与浏览历史");
    if (fromUrl) {
      window.location.href = decodeURIComponent(fromUrl);
      return;
    }
    showLogged(user);
  }

  MM.dom.ready(function () {
    MM.ui.initChrome("login");
    fromUrl = MM.dom.param("from") || "";
    if (fromUrl) document.getElementById("back-link").href = decodeURIComponent(fromUrl);
    var user = MM.store.session();
    if (user) {
      showLogged(user);
      return;
    }
    resetQr();
    document.getElementById("qr-refresh").addEventListener("click", resetQr);
    document.getElementById("agree").addEventListener("change", function (e) {
      document.getElementById("mock-login").disabled = !e.target.checked;
    });
    document.getElementById("mock-login").addEventListener("click", loginNow);
    document.getElementById("qr-box").addEventListener("click", function () {
      if (document.getElementById("qr-mask").hidden) {
        MM.ui.toast("原型演示：请点击下方按钮模拟扫码成功");
      }
    });
    document.getElementById("logout-btn").addEventListener("click", function () {
      MM.store.logout();
      MM.ui.refreshHeaderUser();
      MM.ui.toast("已退出登录");
      window.location.reload();
    });
  });
})();
