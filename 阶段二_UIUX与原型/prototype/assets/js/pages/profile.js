/* P17 个人中心 */
(function () {
  function statusBadge(status) {
    var map = {
      pending: '<span class="badge badge--pending">待审核</span>',
      approved: '<span class="badge badge--ok">已通过</span>',
      rejected: '<span class="badge badge--reject">已驳回</span>',
      locked: '<span class="badge badge--reject">已锁定</span>'
    };
    return map[status] || '<span class="badge badge--draft">草稿</span>';
  }

  function typeLabel(type) {
    return ({ t1: "品鉴长文", t3: "补图", t4: "纠错" })[type] || "投稿";
  }

  function renderHead(user) {
    document.getElementById("profile-avatar").textContent = user.nick.slice(0, 1);
    document.getElementById("profile-avatar").style.background = user.color;
    document.getElementById("profile-nick").textContent = user.nick;
    document.getElementById("profile-meta").textContent =
      "微信授权登录 · " + MM.demoUser.joined + " 加入 · 状态正常";
  }

  function renderBanner(user) {
    var status = MM.store.accountStatus();
    var box = document.getElementById("status-banner");
    if (status.state === "cooling") {
      box.innerHTML = '<div class="banner banner--warn mt-4">账号注销冷静期至 ' + MM.dom.esc(status.until) +
        '，期间可浏览，但暂停评论、投稿与新增收藏。<a class="btn-link" href="settings.html">撤销注销</a></div>';
    } else {
      box.innerHTML = "";
    }
  }

  function renderStats(user) {
    var favs = MM.store.favorites().length;
    var hist = MM.store.history().length;
    var subs = MM.store.mySubmissions().filter(function (s) { return s.status !== "approved"; }).length;
    var unread = MM.store.unreadCount();
    document.getElementById("stat-grid").innerHTML =
      '<a class="stat-card" href="favorites.html"><b>' + favs + '</b><span>收藏</span></a>' +
      '<a class="stat-card" href="history.html"><b>' + hist + '</b><span>浏览历史</span></a>' +
      '<a class="stat-card" href="submissions.html"><b>' + subs + '</b><span>处理中的投稿</span></a>' +
      '<a class="stat-card" href="messages.html"><b>' + unread + '</b><span>未读消息</span></a>';
  }

  function renderQuick() {
    var items = [
      { href: "favorites.html", name: "我的收藏", mark: "藏" },
      { href: "history.html", name: "浏览历史", mark: "迹" },
      { href: "compare.html", name: "茶品对比", mark: "比" },
      { href: "submissions.html", name: "我的投稿", mark: "投" },
      { href: "messages.html", name: "站内消息", mark: "信" },
      { href: "settings.html", name: "账号设置", mark: "设" }
    ];
    document.getElementById("quick-grid").innerHTML = items.map(function (it) {
      return '<a class="quick-item" href="' + it.href + '"><i>' + it.mark + "</i>" + it.name + "</a>";
    }).join("");
  }

  function renderFavs() {
    var list = MM.store.favEntries().slice(0, 4).map(function (f) { return MM.config.tea(f.id); }).filter(Boolean);
    var box = document.getElementById("profile-favs");
    if (!list.length) {
      box.innerHTML = "";
      document.getElementById("profile-favs-empty").innerHTML = MM.ui.emptyHTML({
        title: "还没有收藏",
        desc: "在茶品详情页点击「收藏」，默认加入「想喝」分组。",
        actionText: "去逛逛茶类",
        actionHref: "category.html?type=green"
      });
      return;
    }
    box.innerHTML = list.map(function (t) { return MM.ui.teaCard(t); }).join("");
    MM.ui.attachImageFallback(box);
  }

  function renderHistory() {
    var entries = MM.store.history().slice(0, 5);
    var box = document.getElementById("profile-history");
    if (!entries.length) {
      box.innerHTML = '<p class="comment-empty">暂无浏览记录</p>';
      return;
    }
    box.innerHTML = entries.map(function (entry) {
      var t = MM.config.tea(entry.id);
      if (!t) return "";
      var cat = MM.config.category(t.cat);
      return '<div class="list-row">' +
        '<img class="thumb thumb--sm" src="' + MM.dom.esc(MM.config.imageUrl(t.name, "干茶")) + '" alt="" data-fb-name="' +
          MM.dom.esc(t.name) + '" data-fb-type="干茶" data-fb-cat="' + t.cat + '">' +
        '<div class="list-row__main"><a class="list-row__title" href="detail.html?id=' + t.id + '">' +
          MM.dom.esc(t.name) + "</a>" +
          '<div class="list-row__desc">' + cat.name + " · " + MM.dom.esc(t.sub) + " · " +
          MM.dom.esc(MM.config.gradeText(t)) + "</div></div>" +
        '<span class="list-row__time">' + MM.dom.esc(MM.store.whenText(entry.at)) + "</span></div>";
    }).join("");
    MM.ui.attachImageFallback(box);
  }

  function renderSubs() {
    var list = MM.store.mySubmissions().slice(0, 3);
    var box = document.getElementById("profile-subs");
    if (!list.length) {
      box.innerHTML = '<p class="comment-empty">还没有投稿，去写第一篇品鉴吧</p>';
      return;
    }
    box.innerHTML = list.map(function (s) {
      var tea = MM.config.tea(s.teaId);
      return '<div class="list-row"><div class="list-row__main">' +
        '<a class="list-row__title" href="preview.html?id=' + encodeURIComponent(s.id) + '">' +
        MM.dom.esc(s.title) + "</a>" +
        '<div class="list-row__desc">' + typeLabel(s.type) + " · " + (tea ? MM.dom.esc(tea.name) : "未关联") +
        " · " + MM.dom.esc(s.createdAt) + "</div></div>" +
        statusBadge(s.status) +
        '<a class="btn-link" href="preview.html?id=' + encodeURIComponent(s.id) + '">查看</a></div>';
    }).join("");
  }

  MM.dom.ready(function () {
    var user = MM.store.session();
    if (!user) {
      if (!MM.store.requirePageLogin("profile.html", "查看个人中心")) return;
      return;
    }
    MM.ui.initChrome("profile");
    document.body.classList.add("is-member");
    renderHead(user);
    renderBanner(user);
    renderStats(user);
    renderQuick();
    renderFavs();
    renderHistory();
    renderSubs();
  });
})();
