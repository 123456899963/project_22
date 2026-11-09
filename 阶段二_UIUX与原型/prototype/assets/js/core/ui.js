/* 茗脉 · 共享 UI：页头页脚、卡片、弹层、空态、离线 */
window.MM = window.MM || {};

MM.ui = {
  initChrome: function (active) {
    var header = document.getElementById("site-header");
    if (header) {
      header.innerHTML =
        '<header class="site-header"><div class="container header-inner">' +
          '<a class="brand" href="index.html">茗脉</a>' +
          '<nav class="main-nav" aria-label="主导航">' +
            '<a href="index.html" class="' + (active === "home" ? "is-active" : "") + '">首页</a>' +
            '<a href="category.html?type=green" class="' + (active === "category" ? "is-active" : "") + '">茶类</a>' +
            '<a href="gallery.html" class="' + (active === "gallery" ? "is-active" : "") + '">图鉴</a>' +
            '<a href="selfcheck.html" class="' + (active === "selfcheck" ? "is-active" : "") + '">识茶</a>' +
            '<a href="compare.html" class="' + (active === "compare" ? "is-active" : "") + '">对比</a>' +
            '<a href="submissions.html" class="' + (active === "submit" ? "is-active" : "") + '">投稿</a>' +
          '</nav>' +
          '<div class="header-actions">' +
            '<a class="btn btn-secondary btn-sm" href="search.html">搜索</a>' +
            '<span id="header-user"></span>' +
          '</div>' +
        '</div></header>';
      this.refreshHeaderUser();
    }

    var footer = document.getElementById("site-footer");
    if (footer) {
      footer.innerHTML =
        '<footer class="site-footer"><div class="container footer-inner">' +
          '<div><span class="footer-brand">茗脉</span><div>六大茶类结构化知识库与图鉴 · 原型演示</div></div>' +
          '<div class="footer-links"><a href="about.html">关于与协议</a><a href="about.html#privacy">隐私政策</a><a href="about.html#disclaimer">免责声明</a></div>' +
          '<div>内容仅供参考，不构成医疗建议。图片与数据均为原型 Mock。</div>' +
        '</div></footer>';
    }

    var self = this;
    MM.dom.qsa("[data-soon]").forEach(function (el) {
      el.addEventListener("click", function (e) {
        e.preventDefault();
        self.toast(el.getAttribute("data-soon") + "将在后续批次开放");
      });
    });
    this.bindOffline();
    this.attachImageFallback(document);
  },

  refreshHeaderUser: function () {
    var box = document.getElementById("header-user");
    if (!box) return;
    var user = MM.store.session();
    var self = this;
    if (user) {
      var unread = MM.store.unreadCount();
      box.innerHTML = '<a class="header-user" href="profile.html" title="个人中心">' +
        '<span class="avatar" style="background:' + user.color + '">' + MM.dom.esc(user.nick.slice(0, 1)) + '</span>' +
        '<span class="header-user__name">' + MM.dom.esc(user.nick) + '</span>' +
        '<span class="header-user__dot' + (unread ? " is-on" : "") + '"></span></a>' +
        '<button class="btn btn-ghost btn-sm" data-logout>退出</button>';
      box.querySelector("[data-logout]").addEventListener("click", function () {
        MM.store.logout();
        self.refreshHeaderUser();
        self.toast("已退出登录");
      });
    } else {
      box.innerHTML = '<a class="btn btn-primary btn-sm" href="login.html">登录</a>';
    }
  },

  requireLogin: function (feature, onSuccess) {
    if (MM.store.isLoggedIn()) { onSuccess(); return; }
    this.loginPrompt(feature, function () {
      MM.ui.refreshHeaderUser();
      if (onSuccess) onSuccess();
    });
  },

  loginPrompt: function (feature, onSuccess) {
    var self = this;
    this.modal({
      title: "登录后" + feature,
      desc: "本项目仅支持微信授权登录。原型演示中点击下方按钮即可模拟授权成功，登录状态保存在本地浏览器。",
      actions: [
        { label: "暂不登录", kind: "btn-secondary" },
        { label: "模拟微信登录", kind: "btn-primary", onClick: function () {
            MM.store.login();
            self.toast("已登录（演示账号：茶友小茗）");
            if (onSuccess) onSuccess();
          } }
      ]
    });
  },

  toast: function (message) {
    var old = document.querySelector(".toast");
    if (old) old.remove();
    var el = document.createElement("div");
    el.className = "toast";
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 2600);
  },

  modal: function (opts) {
    var mask = document.createElement("div");
    mask.className = "modal-mask";
    var actions = opts.actions || [];
    var html = '<div class="modal" role="dialog" aria-modal="true" aria-label="' + MM.dom.esc(opts.title || "提示") + '">' +
      (opts.title ? "<h3>" + MM.dom.esc(opts.title) + "</h3>" : "") +
      (opts.body || (opts.desc ? "<p>" + MM.dom.esc(opts.desc) + "</p>" : "")) +
      (opts.form || "") +
      '<div class="modal__actions">' +
      actions.map(function (a, i) {
        return '<button class="btn ' + (a.kind || "btn-secondary") + '" data-act="' + i + '">' + MM.dom.esc(a.label) + "</button>";
      }).join("") +
      "</div></div>";
    mask.innerHTML = html;
    document.body.appendChild(mask);

    function close() { mask.remove(); }
    MM.dom.qsa("[data-act]", mask).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var action = actions[Number(btn.getAttribute("data-act"))];
        if (action && action.onClick) action.onClick(close);
        close();
      });
    });
    mask.addEventListener("click", function (e) { if (e.target === mask) close(); });
    document.addEventListener("keydown", function esc(e) {
      if (e.key === "Escape") { close(); document.removeEventListener("keydown", esc); }
    });
    return { close: close, el: mask };
  },

  emptyHTML: function (opts) {
    var action = "";
    if (opts.actionText) {
      action = opts.actionHref
        ? '<a class="btn btn-secondary" href="' + opts.actionHref + '">' + MM.dom.esc(opts.actionText) + "</a>"
        : '<button class="btn btn-secondary" data-empty-action>' + MM.dom.esc(opts.actionText) + "</button>";
    }
    return '<div class="empty-state"><h3>' + MM.dom.esc(opts.title) + "</h3><p>" +
      MM.dom.esc(opts.desc || "") + "</p>" + action + "</div>";
  },

  statusBadge: function (status) {
    var map = {
      draft: ["badge--draft", "草稿"],
      pending: ["badge--pending", "待审核"],
      published: ["badge--ok", "已发布"],
      approved: ["badge--ok", "已通过"],
      rejected: ["badge--reject", "已驳回"],
      active: ["badge--ok", "已上架"],
      offline: ["badge--draft", "已下架"],
      building: ["badge--building", "内容建设中"]
    };
    var item = map[status] || ["badge--draft", status];
    return '<span class="badge ' + item[0] + '">' + item[1] + "</span>";
  },

  teaCard: function (tea) {
    var c = MM.config.category(tea.cat);
    var esc = MM.dom.esc;
    var grade = tea.grade && tea.grade.length ? tea.grade[0] : "未分档";
    var aromas = (tea.aroma || []).slice(0, 2).map(function (a) {
      return '<span class="chip">' + esc(a) + "</span>";
    }).join("");
    return '<a class="tea-card" data-cat="' + tea.cat + '" href="detail.html?id=' + encodeURIComponent(tea.id) + '">' +
      '<div class="tea-card__media">' +
        '<img src="' + MM.config.imageUrl(tea.name, "干茶") + '" alt="' + esc(tea.name) + ' 干茶图" loading="lazy" ' +
          'data-fb-name="' + esc(tea.name) + '" data-fb-type="干茶" data-fb-cat="' + tea.cat + '">' +
        '<span class="chip chip--cat tea-card__tag">' + esc(c.name) + "</span>" +
      "</div>" +
      '<div class="tea-card__body">' +
        '<h3 class="tea-card__name">' + esc(tea.name) + "</h3>" +
        '<p class="tea-card__meta">' + esc(tea.sub) + " · " + esc(grade) +
          (tea.year ? ' · <span class="tea-card__year">' + esc(tea.year) + " 年</span>" : "") + "</p>" +
        '<div class="tea-card__chips">' + aromas + "</div>" +
      "</div></a>";
  },

  attachImageFallback: function (root) {
    MM.dom.qsa("img[data-fb-name]", root || document).forEach(function (img) {
      if (img.dataset.fbBound) return;
      img.dataset.fbBound = "1";
      var apply = function () {
        if (img.dataset.fbDone) return;
        img.dataset.fbDone = "1";
        img.src = MM.ui.fallbackImage(
          img.getAttribute("data-fb-name"),
          img.getAttribute("data-fb-type"),
          img.getAttribute("data-fb-cat")
        );
      };
      img.addEventListener("error", apply);
      if (img.complete && img.naturalWidth === 0) apply();
    });
  },

  fallbackImage: function (name, type, catId) {
    var c = MM.config.category(catId);
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">' +
      '<rect width="800" height="600" fill="' + c.soft + '"/>' +
      '<rect x="36" y="36" width="728" height="528" fill="none" stroke="' + c.color + '" stroke-width="2"/>' +
      '<text x="400" y="290" fill="' + c.deep + '" font-size="40" font-family="serif" text-anchor="middle">' + type + "</text>" +
      '<text x="400" y="350" fill="' + c.deep + '" font-size="26" font-family="serif" text-anchor="middle">' + MM.dom.esc(name) + "</text>" +
      '<text x="400" y="404" fill="' + c.color + '" font-size="18" font-family="sans-serif" text-anchor="middle">图鉴图片占位（原型 Mock）</text>' +
      "</svg>";
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  },

  isOffline: function () { return !navigator.onLine; },

  bindOffline: function () {
    var self = this;
    function render() {
      var banner = document.getElementById("offline-banner");
      if (!banner) {
        banner = document.createElement("div");
        banner.id = "offline-banner";
        banner.className = "offline-banner";
        banner.textContent = "当前处于离线状态，仅可查看已缓存内容";
        document.body.insertBefore(banner, document.body.firstChild);
      }
      banner.hidden = navigator.onLine;
      if (navigator.onLine) banner.remove();
    }
    render();
    window.addEventListener("online", render);
    window.addEventListener("offline", render);
  }
};
