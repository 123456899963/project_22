/* 茗脉 · 全局配置与数据查询 */
window.MM = window.MM || {};

MM.config = {
  PAGE_SIZE: 12,
  IMG_BASE: "https://trae-api-cn.mchost.guru/api/ide/v1/tool_text_to_image",
  KEYS: {
    session: "mm_session",
    favorites: "mm_favorites",
    likes: "mm_likes",
    drafts: "mm_drafts",
    submissions: "mm_submissions",
    userComments: "mm_user_comments",
    history: "mm_history",
    compare: "mm_compare",
    accountStatus: "mm_account_status",
    messages: "mm_messages",
    adminSession: "mm_admin_session",
    reports: "mm_reports"
  },

  imageTypes: function (tea) {
    return tea && tea.imgs === 5
      ? ["干茶", "汤色", "叶底", "细节", "包装"]
      : ["干茶", "汤色", "叶底", "包装"];
  },

  imageUrl: function (name, type) {
    var prompt = name + " " + type + " 茶叶实拍，浅米色同色系背景，柔和自然光，静物摄影，高清细节，画面无文字";
    return this.IMG_BASE + "?prompt=" + encodeURIComponent(prompt) + "&image_size=landscape_4_3";
  },

  category: function (id) {
    for (var i = 0; i < MM.categories.length; i++) {
      if (MM.categories[i].id === id) return MM.categories[i];
    }
    return MM.categories[0];
  },

  /* 前端数据层：合并后台修改（mm_admin_state 的 teas 补丁与 created 新建），
     使后台上下架、字段修改、新建茶品能即时反映到前台各页 */
  liveTeas: function () {
    var state = (MM.store && MM.store.read) ? (MM.store.read("mm_admin_state", null) || {}) : {};
    var patches = state.teas || {};
    var created = state.created || [];
    var base = (MM.teas || []).map(function (t) {
      var p = patches[t.id] || {};
      var out = {};
      Object.keys(t).forEach(function (k) { out[k] = t[k]; });
      Object.keys(p).forEach(function (k) { out[k] = p[k]; });
      return MM.config.normalizeTea(out);
    });
    return created.map(function (t) {
      var p = patches[t.id] || {};
      var out = {};
      Object.keys(t).forEach(function (k) { out[k] = t[k]; });
      Object.keys(p).forEach(function (k) { out[k] = p[k]; });
      return MM.config.normalizeTea(out);
    }).concat(base);
  },

  /* 新建茶品可能缺少前台渲染所需字段，这里统一补齐为种子数据同构 */
  normalizeTea: function (t) {
    if (!t) return t;
    if (!Array.isArray(t.grade)) t.grade = t.grade ? [String(t.grade)] : [];
    if (typeof t.std === "string") t.std = t.std ? [t.std] : ["—"];
    else if (!Array.isArray(t.std)) t.std = ["—"];
    if (!t.ferment) t.ferment = "—";
    if (!t.alias) t.alias = "";
    if (!t.updated) t.updated = "";
    if (!t.imgs) t.imgs = 4;
    return t;
  },

  /* 前台可见 = 未设置状态或已上架 */
  isLiveTea: function (t) {
    return !t || !t.status || t.status === "online";
  },

  tea: function (id) {
    var list = this.liveTeas();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  },

  teasOf: function (catId) {
    var list = this.liveTeas().filter(function (t) { return MM.config.isLiveTea(t); });
    if (!catId) return list;
    return list.filter(function (t) { return t.cat === catId; });
  },

  subTeas: function (catId, sub) {
    return this.teasOf(catId).filter(function (t) { return t.sub === sub; });
  },

  subCount: function (catId, sub) {
    return this.subTeas(catId, sub).length;
  },

  isBuilding: function (catId, sub) {
    if (this.subTeas(catId, sub).length > 0) return false;
    var state = (MM.store && MM.store.read) ? (MM.store.read("mm_admin_state", null) || {}) : {};
    var patch = (state.categories || {})[catId + "|" + sub];
    if (patch && patch.status) return patch.status === "building";
    return MM.subclassStatus[sub] === "building";
  },

  totalTeas: function () {
    return this.liveTeas().filter(function (t) { return MM.config.isLiveTea(t); }).length;
  },

  allComments: function (teaId) {
    var local = MM.store.userComments().filter(function (c) { return c.teaId === teaId; });
    return MM.comments.filter(function (c) { return c.teaId === teaId; }).concat(local);
  },

  publishedComments: function (teaId) {
    return this.allComments(teaId).filter(function (c) { return c.status === "published"; });
  },

  PROVINCES: ["浙江", "江苏", "安徽", "福建", "湖南", "湖北", "四川", "云南", "广东", "广西", "台湾", "海南", "印度"],

  regionOf: function (tea) {
    var origin = (tea && tea.origin) || "";
    for (var i = 0; i < this.PROVINCES.length; i++) {
      if (origin.indexOf(this.PROVINCES[i]) === 0) return this.PROVINCES[i];
    }
    return origin.split(" ")[0] || "其他";
  },

  seasonsOf: function (tea) {
    var pick = (tea && tea.pick) || "";
    var list = [];
    if (/3 月/.test(pick)) list.push("明前");
    if (/4 月/.test(pick)) list.push("雨前");
    if (/3 月|4 月|5 月/.test(pick)) list.push("春茶");
    if (/6 月|7 月|8 月/.test(pick)) list.push("夏茶");
    if (/9 月|10 月/.test(pick)) list.push("秋茶");
    if (/全年/.test(pick)) list.push("全年");
    return list;
  },

  yearRange: function (year) {
    if (!year) return "";
    var diff = new Date().getFullYear() - Number(year);
    if (diff <= 3) return "新茶";
    if (diff <= 10) return "中期茶";
    return "老茶";
  },

  yearLabel: function (tea) {
    return tea && tea.year ? tea.year + " 年 · " + this.yearRange(tea.year) : "";
  },

  gradeText: function (tea) {
    return tea && tea.grade && tea.grade.length ? tea.grade.join(" / ") : "未分档";
  }
};
