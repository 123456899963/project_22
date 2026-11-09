/* 茗脉 · 本地状态（模拟登录态、收藏、点赞、草稿、投稿、对比、消息） */
window.MM = window.MM || {};

MM.store = {
  read: function (key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) { return fallback; }
  },

  write: function (key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* 隐私模式忽略 */ }
  },

  /* 本地时间字符串（YYYY-MM-DD HH:mm），避免 toISOString 的 UTC 偏移 */
  nowText: function () {
    var d = new Date();
    var p = function (n) { return n < 10 ? "0" + n : "" + n; };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) +
      " " + p(d.getHours()) + ":" + p(d.getMinutes());
  },

  session: function () {
    return this.read(MM.config.KEYS.session, null);
  },

  isLoggedIn: function () {
    return !!this.session();
  },

  login: function () {
    var user = { nick: MM.demoUser.nick, color: MM.demoUser.color, openid: MM.demoUser.openid };
    this.write(MM.config.KEYS.session, user);
    var favs = this.favorites();
    if (favs.length === 0 && MM.loginBonus) {
      MM.loginBonus.favorites.forEach(function (id) { MM.store.addFav(id, "want"); });
    }
    var hist = this.history();
    if (hist.length === 0 && MM.loginBonus) {
      this.write(MM.config.KEYS.history, MM.loginBonus.history);
    }
    return user;
  },

  logout: function () {
    try { localStorage.removeItem(MM.config.KEYS.session); } catch (e) { /* noop */ }
  },

  /* ---------- 收藏（两组：want 想喝 / drunk 已喝） ---------- */
  favEntries: function () {
    var raw = this.read(MM.config.KEYS.favorites, []);
    return raw.map(function (item) {
      return typeof item === "string"
        ? { id: item, group: "want", time: "2026-11-05 10:00" }
        : item;
    });
  },

  favorites: function () {
    return this.favEntries().map(function (f) { return f.id; });
  },

  isFav: function (teaId) {
    return this.favorites().indexOf(teaId) > -1;
  },

  addFav: function (teaId, group) {
    if (this.isFav(teaId)) return true;
    if (this.favorites().length >= 500) return false;
    var list = this.favEntries();
    list.unshift({
      id: teaId,
      group: group || "want",
      time: this.nowText()
    });
    this.write(MM.config.KEYS.favorites, list);
    return true;
  },

  removeFav: function (teaId) {
    this.write(MM.config.KEYS.favorites, this.favEntries().filter(function (f) { return f.id !== teaId; }));
  },

  toggleFav: function (teaId) {
    if (this.isFav(teaId)) { this.removeFav(teaId); return false; }
    this.addFav(teaId, "want");
    return true;
  },

  moveFav: function (teaId, group) {
    var list = this.favEntries();
    list.forEach(function (f) { if (f.id === teaId) f.group = group; });
    this.write(MM.config.KEYS.favorites, list);
  },

  favsOf: function (group) {
    return this.favEntries().filter(function (f) { return f.group === group; });
  },

  /* ---------- 点赞 ---------- */
  likes: function () {
    return this.read(MM.config.KEYS.likes, {});
  },

  isLiked: function (commentId) {
    return !!this.likes()[commentId];
  },

  toggleLike: function (commentId) {
    var map = this.likes();
    if (map[commentId]) delete map[commentId]; else map[commentId] = true;
    this.write(MM.config.KEYS.likes, map);
    return !!map[commentId];
  },

  /* ---------- 评论 ---------- */
  userComments: function () {
    return this.read(MM.config.KEYS.userComments, []);
  },

  addUserComment: function (teaId, content) {
    var user = this.session();
    var list = this.userComments();
    var item = {
      id: "uc-" + Date.now(),
      teaId: teaId,
      user: user ? user.nick : "匿名茶友",
      content: content,
      likeCount: 0,
      time: this.nowText(),
      status: "pending",
      mine: true
    };
    list.unshift(item);
    this.write(MM.config.KEYS.userComments, list);
    return item;
  },

  /* ---------- 草稿 ---------- */
  drafts: function () {
    return this.read(MM.config.KEYS.drafts, {});
  },

  getDraft: function (id) {
    return this.drafts()[id] || null;
  },

  saveDraft: function (id, data) {
    var all = this.drafts();
    all[id] = data;
    this.write(MM.config.KEYS.drafts, all);
  },

  removeDraft: function (id) {
    var all = this.drafts();
    delete all[id];
    this.write(MM.config.KEYS.drafts, all);
  },

  /* ---------- 投稿 ---------- */
  submissions: function () {
    var local = this.read(MM.config.KEYS.submissions, []);
    var seeds = (MM.seedSubmissions || []).slice();
    return local.concat(seeds);
  },

  /* 本地草稿（P12 保存的）在投稿中心以「草稿」行展示 */
  draftSubmissions: function () {
    var all = this.drafts();
    return Object.keys(all).map(function (key) {
      var d = all[key] || {};
      return {
        id: "draft-" + key,
        draftKey: key,
        type: "t1",
        teaId: d.tea || "",
        title: d.title || "（未命名草稿）",
        body: d.body || "",
        sign: d.sign || "nick",
        status: "draft",
        createdAt: d.savedAt || "",
        retryLeft: 2
      };
    });
  },

  mySubmissions: function () {
    return this.draftSubmissions().concat(this.submissions());
  },

  removeSubmission: function (id) {
    if (/^draft-/.test(id)) {
      this.removeDraft(id.replace(/^draft-/, ""));
      return true;
    }
    var list = this.read(MM.config.KEYS.submissions, []);
    var next = list.filter(function (s) { return s.id !== id; });
    if (next.length === list.length) return false;
    this.write(MM.config.KEYS.submissions, next);
    return true;
  },

  addSubmission: function (data) {
    var list = this.read(MM.config.KEYS.submissions, []);
    var item = {
      id: "sub-" + Date.now(),
      createdAt: this.nowText(),
      status: "pending",
      type: "t1",
      retryLeft: 2
    };
    Object.keys(data).forEach(function (k) { item[k] = data[k]; });
    list.unshift(item);
    this.write(MM.config.KEYS.submissions, list);
    return item;
  },

  findSubmission: function (id) {
    var list = this.draftSubmissions().concat(this.submissions());
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  },

  updateSubmission: function (id, patch) {
    var list = this.read(MM.config.KEYS.submissions, []);
    for (var i = 0; i < list.length; i++) {
      if (list[i].id !== id) continue;
      Object.keys(patch).forEach(function (k) { list[i][k] = patch[k]; });
      this.write(MM.config.KEYS.submissions, list);
      return list[i];
    }
    return null;
  },

  /* ---------- 浏览历史（元素为 {id, at}，兼容旧的纯 id 字符串） ---------- */
  history: function () {
    var raw = this.read(MM.config.KEYS.history, []);
    if (!Array.isArray(raw)) return [];
    return raw.map(function (item) {
      return typeof item === "string" ? { id: item, at: "" } : { id: item.id, at: item.at || "" };
    }).filter(function (e) { return !!e.id; });
  },

  historyIds: function () {
    return this.history().map(function (e) { return e.id; });
  },

  pushHistory: function (teaId) {
    var list = this.history().filter(function (e) { return e.id !== teaId; });
    list.unshift({ id: teaId, at: this.nowText() });
    this.write(MM.config.KEYS.history, list.slice(0, 50));
  },

  clearHistory: function () {
    this.write(MM.config.KEYS.history, []);
  },

  /* 相对时间文案：刚刚 / N 分钟前 / N 小时前 / N 天前 / 日期 */
  whenText: function (at) {
    if (!at) return "—";
    var d = new Date(String(at).replace(" ", "T"));
    if (isNaN(d.getTime())) return String(at);
    var mins = Math.floor((Date.now() - d.getTime()) / 60000);
    if (mins < 1) return "刚刚";
    if (mins < 60) return mins + " 分钟前";
    if (mins < 1440) return Math.floor(mins / 60) + " 小时前";
    if (mins < 43200) return Math.floor(mins / 1440) + " 天前";
    return String(at).slice(0, 10);
  },

  /* ---------- 对比（最多 3 款） ---------- */
  compare: function () {
    return this.read(MM.config.KEYS.compare, []);
  },

  addCompare: function (teaId) {
    var list = this.compare();
    if (list.indexOf(teaId) > -1) return { ok: true, added: false };
    if (list.length >= 3) return { ok: false, reason: "最多对比 3 款茶品" };
    list.push(teaId);
    this.write(MM.config.KEYS.compare, list);
    return { ok: true, added: true };
  },

  removeCompare: function (teaId) {
    this.write(MM.config.KEYS.compare, this.compare().filter(function (id) { return id !== teaId; }));
  },

  clearCompare: function () {
    this.write(MM.config.KEYS.compare, []);
  },

  /* ---------- 账号状态 ---------- */
  accountStatus: function () {
    return this.read(MM.config.KEYS.accountStatus, { state: "normal", until: null });
  },

  setAccountStatus: function (status) {
    this.write(MM.config.KEYS.accountStatus, status);
  },

  /* ---------- 站内消息 ---------- */
  messages: function () {
    var local = this.read(MM.config.KEYS.messages, null);
    return local == null ? (MM.seedMessages || []).slice() : local;
  },

  markRead: function (id) {
    var list = this.messages();
    list.forEach(function (m) { if (m.id === id) m.read = true; });
    this.write(MM.config.KEYS.messages, list);
  },

  markAllRead: function () {
    var list = this.messages();
    list.forEach(function (m) { m.read = true; });
    this.write(MM.config.KEYS.messages, list);
  },

  unreadCount: function () {
    return this.messages().filter(function (m) { return !m.read; }).length;
  },

  /* 审核结果 / 举报处理结果写入站内消息 */
  pushMessage: function (msg) {
    var list = this.messages();
    list.unshift({
      id: "msg-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
      type: msg.type || "system",
      title: msg.title || "系统通知",
      summary: msg.summary || "",
      target: msg.target || "messages.html",
      time: this.nowText(),
      read: false
    });
    this.write(MM.config.KEYS.messages, list);
  },

  /* ---------- 举报 ---------- */
  reports: function () {
    return this.read(MM.config.KEYS.reports, []);
  },

  addReport: function (data) {
    var list = this.reports();
    data.id = "rep-" + Date.now();
    data.createdAt = this.nowText();
    list.unshift(data);
    this.write(MM.config.KEYS.reports, list);
    return data;
  },

  /* ---------- 判断是否可进入需登录页 ---------- */
  requirePageLogin: function (from, action) {
    if (this.isLoggedIn()) return true;
    window.location.href = "login.html?from=" + encodeURIComponent(from || window.location.pathname.split("/").pop()) +
      "&action=" + encodeURIComponent(action || "");
    return false;
  }
};
