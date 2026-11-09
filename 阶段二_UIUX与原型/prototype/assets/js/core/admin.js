/* 茗脉 · 后台核心：登录态、导航、数据补丁、表格与弹层组件 */
window.MM = window.MM || {};

MM.admin = (function () {
  var STATE_KEY = "mm_admin_state";
  var ROLE_TEXT = { super: "超级管理员", admin: "管理员" };

  function esc(s) { return MM.dom.esc(s == null ? "" : String(s)); }

  function param(name) {
    var m = new RegExp("[?&]" + name + "=([^&]*)").exec(window.location.search);
    return m ? decodeURIComponent(m[1].replace(/\+/g, " ")) : "";
  }

  function readState() {
    var s = MM.store.read(STATE_KEY, null);
    if (!s) s = {};
    ["teas", "submissions", "comments", "reports", "users", "tags", "admins", "categories"].forEach(function (k) {
      if (!s[k]) s[k] = {};
    });
    if (!s.created) s.created = [];
    if (!s.audit) s.audit = [];
    if (!s.settings) s.settings = {};
    return s;
  }

  function saveState(s) { MM.store.write(STATE_KEY, s); }

  function patch(section, id, data) {
    var s = readState();
    var item = s[section][id] || {};
    Object.keys(data).forEach(function (k) { item[k] = data[k]; });
    s[section][id] = item;
    saveState(s);
    return item;
  }

  function merge(base, extra) {
    var out = {};
    Object.keys(extra || {}).forEach(function (k) { out[k] = extra[k]; });
    Object.keys(base).forEach(function (k) {
      if (!(k in out)) out[k] = base[k];
    });
    return out;
  }

  /* ---------- 用户端数据合并（前台投稿 / 评论 / 举报进入后台队列） ---------- */
  function userName() {
    var user = MM.store.session();
    return (user && user.nick) || (MM.demoUser && MM.demoUser.nick) || "茶友";
  }

  function userSideSubmissions() {
    var s = readState();
    return MM.store.read(MM.config.KEYS.submissions, []).map(function (u) {
      var base = {
        id: u.id,
        type: u.type || "t1",
        title: u.title || "（未命名投稿）",
        teaId: u.teaId || "",
        author: u.sign === "anon" ? "匿名茶友" : userName(),
        time: u.createdAt || "",
        body: u.body || "",
        status: u.status || "pending",
        retry: 2 - (typeof u.retryLeft === "number" ? u.retryLeft : 2),
        timeout: false,
        userSide: true
      };
      return merge(base, s.submissions[u.id]);
    });
  }

  function userSideComments() {
    var s = readState();
    return MM.store.read(MM.config.KEYS.userComments, []).map(function (c) {
      var base = {
        id: c.id,
        content: c.content || "",
        teaId: c.teaId || "",
        author: c.user || "匿名茶友",
        time: c.time || "",
        likes: c.likeCount || 0,
        reports: 0,
        status: c.status || "pending",
        hasImage: false,
        userSide: true
      };
      return merge(base, s.comments[c.id]);
    });
  }

  var USER_REPORT_TYPES = { copyright: "版权侵权", illegal: "违法违规", false: "内容不实", ad: "广告导流", other: "其他" };

  function userSideReports() {
    var s = readState();
    return MM.store.read(MM.config.KEYS.reports, []).map(function (r) {
      var base = {
        id: r.id,
        target: r.target || "该内容",
        type: r.typeText || USER_REPORT_TYPES[r.type] || "其他",
        reporter: r.reporter || userName(),
        time: r.createdAt || "",
        status: "pending",
        timeout: false,
        note: r.desc || "",
        evidenceCount: (r.evidence || []).length,
        userSide: true
      };
      return merge(base, s.reports[r.id]);
    });
  }

  /* 将后台处理结果写回用户端列表，并用站内消息通知 */
  function writeUserList(key, id, data) {
    var list = MM.store.read(key, []);
    var hit = null;
    list.forEach(function (item) {
      if (item.id !== id) return;
      hit = item;
      Object.keys(data).forEach(function (k) { item[k] = data[k]; });
    });
    if (hit) MM.store.write(key, list);
    return hit;
  }

  var db = {
    patch: patch,
    teas: function () {
      var s = readState();
      var list = MM.adminData.teas.map(function (t) {
        return merge(t, s.teas[t.id]);
      });
      return s.created.concat(list);
    },
    tea: function (id) {
      var list = db.teas();
      for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
      return null;
    },
    addCreated: function (tea) {
      var s = readState();
      s.created.unshift(tea);
      saveState(s);
      return tea;
    },
    submissions: function () {
      var s = readState();
      var seeds = MM.adminData.submissions.map(function (x) { return merge(x, s.submissions[x.id]); });
      return userSideSubmissions().concat(seeds);
    },
    submission: function (id) {
      var list = db.submissions();
      for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
      return null;
    },
    /* 审核投稿：同时写回用户端状态，并发送站内消息 */
    reviewSubmission: function (id, data) {
      patch("submissions", id, data);
      var item = db.submission(id) || {};
      var back = { status: data.status, reviewedAt: data.processedAt || MM.admin.now() };
      var cur = null;
      MM.store.read(MM.config.KEYS.submissions, []).forEach(function (x) { if (x.id === id) cur = x; });
      if (cur) {
        if (data.status === "rejected") {
          back.reason = data.reason || "";
          back.retryLeft = Math.max(0, (typeof cur.retryLeft === "number" ? cur.retryLeft : 2) - 1);
        }
        writeUserList(MM.config.KEYS.submissions, id, back);
        MM.store.pushMessage({
          type: "audit",
          title: data.status === "approved" ? "投稿已通过" : "投稿被驳回",
          summary: data.status === "approved"
            ? "《" + (item.title || "") + "》已通过审核，感谢你的分享。"
            : "《" + (item.title || "") + "》未通过审核。理由：" + (data.reason || "内容不符合收录规范"),
          target: "submissions.html"
        });
      }
      return item;
    },
    comments: function () {
      var s = readState();
      var seeds = MM.adminData.comments.map(function (x) { return merge(x, s.comments[x.id]); });
      return userSideComments().concat(seeds);
    },
    comment: function (id) {
      var list = db.comments();
      for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
      return null;
    },
    /* 审核评论：写回用户端状态并通知作者 */
    reviewComment: function (id, data) {
      patch("comments", id, data);
      var item = db.comment(id) || {};
      var hit = writeUserList(MM.config.KEYS.userComments, id, { status: data.status });
      if (hit) {
        var t = MM.config.tea(item.teaId);
        MM.store.pushMessage({
          type: "audit",
          title: data.status === "published" ? "评论已发布" : "评论未通过",
          summary: (t ? "你在《" + t.name + "》下的评论" : "你的评论") +
            (data.status === "published" ? "已通过审核并展示。" : "未通过审核。理由：" + (data.reason || "不符合社区规范")),
          target: t ? "detail.html?id=" + t.id : "detail.html"
        });
      }
      return item;
    },
    reports: function () {
      var s = readState();
      var seeds = MM.adminData.reports.map(function (x) { return merge(x, s.reports[x.id]); });
      return userSideReports().concat(seeds);
    },
    report: function (id) {
      var list = db.reports();
      for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
      return null;
    },
    /* 处理举报：写回用户端状态并发送处理结果通知 */
    resolveReport: function (id, data) {
      patch("reports", id, data);
      var item = db.report(id) || {};
      var hit = writeUserList(MM.config.KEYS.reports, id, { status: data.status || "resolved", resolution: data.resolution });
      if (hit) {
        MM.store.pushMessage({
          type: "report",
          title: "举报处理完成",
          summary: "你举报的「" + (item.target || "") + "」已处理：" + (data.resolution || "已核查") +
            (data.note ? "（" + data.note + "）" : ""),
          target: "messages.html"
        });
      }
      return item;
    },
    users: function () {
      var s = readState();
      return MM.adminData.users.map(function (x) { return merge(x, s.users[x.id]); });
    },
    user: function (id) {
      var list = db.users();
      for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
      return null;
    },
    tags: function () {
      var s = readState();
      var list = MM.adminData.tags.map(function (x) {
        return merge(x, s.tags[x.group + "|" + x.name]);
      });
      Object.keys(s.tags).forEach(function (key) {
        var exists = list.some(function (t) { return t.group + "|" + t.name === key; });
        if (!exists) list.push(merge({ group: "", name: key, count: 0, status: "pending" }, s.tags[key]));
      });
      return list;
    },
    tagKey: function (t) { return t.group + "|" + t.name; },
    admins: function () {
      var s = readState();
      return MM.adminData.admins.concat(s.adminList || []).map(function (x) {
        return merge(x, s.admins[x.id]);
      });
    },
    addAdmin: function (admin) {
      var s = readState();
      if (!s.adminList) s.adminList = [];
      s.adminList.unshift(admin);
      saveState(s);
      return admin;
    },
    categoryStatus: function (catId, sub) {
      var s = readState();
      var patch = s.categories[catId + "|" + sub];
      if (patch && patch.status) return patch.status;
      return MM.subclassStatus[sub] === "building" ? "building" : "normal";
    },
    settings: function () {
      return merge({ emptySubDefault: "building" }, readState().settings);
    },
    saveSettings: function (data) {
      var s = readState();
      Object.keys(data).forEach(function (k) { s.settings[k] = data[k]; });
      saveState(s);
    },
    audit: function () {
      return readState().audit.concat(MM.adminData.audit);
    },
    appendAudit: function (entry) {
      var s = readState();
      s.audit.unshift({
        id: "log-" + Date.now(),
        time: MM.admin.now(),
        actor: (MM.admin.session() || {}).nick || "系统",
        action: entry.action,
        target: entry.target || "",
        detail: entry.detail || "",
        ip: entry.ip || "10.0.0.12"
      });
      saveState(s);
    },
    stats: function () {
      var teas = db.teas();
      var subs = db.submissions();
      var reports = db.reports();
      return {
        pendingTeas: teas.filter(function (t) { return t.status === "pending"; }).length,
        pendingSubs: subs.filter(function (t) { return t.status === "pending"; }).length,
        pendingReports: reports.filter(function (t) { return t.status === "pending" || t.status === "processing"; }).length,
        overdue: teas.filter(function (t) { return t.status === "pending" && t.timeout; }).length +
          subs.filter(function (t) { return t.status === "pending" && t.timeout; }).length +
          reports.filter(function (t) { return t.status !== "resolved" && t.timeout; }).length
      };
    }
  };

  var NAV = [
    { title: "", items: [{ page: "dashboard", label: "工作台", href: "dashboard.html" }] },
    { title: "内容管理", items: [
      { page: "teas", label: "茶品管理", href: "teas.html", badgeKey: "pendingTeas" },
      { page: "tea-new", label: "新建茶品", href: "tea-new.html" },
      { page: "gallery", label: "图鉴与图片", href: "gallery.html" },
      { page: "categories", label: "分类与亚类", href: "categories.html" },
      { page: "import", label: "批量导入", href: "import.html" }
    ] },
    { title: "互动审核", items: [
      { page: "submissions", label: "投稿审核", href: "submissions.html", badgeKey: "pendingSubs" },
      { page: "comments", label: "评论审核", href: "comments.html" },
      { page: "tags", label: "标签库", href: "tags.html" }
    ] },
    { title: "用户与治理", items: [
      { page: "reports", label: "投诉处理", href: "reports.html", badgeKey: "pendingReports" },
      { page: "users", label: "用户管理", href: "users.html" }
    ] },
    { title: "系统设置", items: [
      { page: "admins", label: "管理员白名单", href: "admins.html", role: "super" },
      { page: "audit", label: "审计日志", href: "audit.html" },
      { page: "settings", label: "系统配置", href: "settings.html", role: "super" }
    ] }
  ];

  var BADGE = {
    online: ["badge--ok", "已上架"],
    pending: ["badge--pending", "待审核"],
    draft: ["badge--draft", "草稿"],
    offline: ["badge--draft", "已下架"],
    published: ["badge--ok", "已发布"],
    approved: ["badge--ok", "已通过"],
    rejected: ["badge--reject", "已驳回"],
    processing: ["badge--info", "处理中"],
    resolved: ["badge--ok", "已处理"],
    pending_report: ["badge--pending", "待受理"],
    normal: ["badge--ok", "正常"],
    muted: ["badge--pending", "禁言"],
    banned: ["badge--reject", "封禁"],
    active: ["badge--ok", "启用"],
    disabled: ["badge--draft", "已停用"],
    tag_pending: ["badge--pending", "待审核"],
    building: ["badge--building", "内容建设中"]
  };

  function badge(status) {
    var b = BADGE[status] || ["badge--draft", status];
    return '<span class="badge ' + b[0] + '">' + b[1] + "</span>";
  }

  function timeText(v) { return esc(v || "—"); }

  function remainText(row) {
    if (row.status === "resolved" || row.status === "approved" || row.status === "rejected") return "—";
    if (row.timeout) return '<span class="overdue-tag">已超时 ' + (row.overdueHours || 4) + " 小时</span>";
    return "剩 " + (row.leftHours || 12) + " 小时";
  }

  function pagerHTML(total, page, size) {
    var pages = Math.max(1, Math.ceil(total / size));
    var html = '<div class="pager">';
    html += '<button type="button" data-page="' + (page - 1) + '"' + (page <= 1 ? " disabled" : "") + ">上一页</button>";
    for (var i = 1; i <= pages; i++) {
      html += '<button type="button" data-page="' + i + '" class="' + (i === page ? "is-current" : "") + '">' + i + "</button>";
    }
    html += '<button type="button" data-page="' + (page + 1) + '"' + (page >= pages ? " disabled" : "") + ">下一页</button>";
    return html + "</div>";
  }

  function bindPager(root, onPage) {
    MM.dom.qsa("[data-page]", root).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var p = Number(btn.getAttribute("data-page"));
        if (p < 1) return;
        onPage(p);
      });
    });
  }

  function tableHTML(columns, rows, opts) {
    opts = opts || {};
    var head = columns.map(function (c) {
      return "<th" + (c.width ? ' style="width:' + c.width + '"' : "") + ">" + esc(c.label) + "</th>";
    }).join("");
    var body = rows.map(function (row, i) {
      var cls = row._rowClass || "";
      return '<tr class="' + cls + '">' + columns.map(function (c) {
        var val = c.render ? c.render(row, i) : esc(row[c.key]);
        return "<td" + (c.wrap ? ' class="cell-wrap"' : "") + ">" + val + "</td>";
      }).join("") + "</tr>";
    }).join("");
    return '<div class="table-wrap"><div class="table-scroll"><table class="data-table">' +
      "<thead><tr>" + head + "</tr></thead><tbody>" + body + "</tbody></table></div>" +
      (opts.foot ? '<div class="table-foot">' + opts.foot + "</div>" : "") + "</div>";
  }

  function emptyTable(title, desc, actionHTML) {
    return '<div class="table-wrap"><div class="empty-state"><h3>' + esc(title) + "</h3><p>" + esc(desc || "") +
      "</p>" + (actionHTML || "") + "</div></div>";
  }

  function field(o) {
    var id = o.name;
    var control;
    if (o.type === "textarea") {
      control = '<textarea class="textarea" id="' + id + '" name="' + id + '" rows="' + (o.rows || 4) + '" placeholder="' +
        esc(o.placeholder || "") + '">' + esc(o.value || "") + "</textarea>";
    } else if (o.type === "select") {
      control = '<select class="select" id="' + id + '" name="' + id + '">' + o.options.map(function (op) {
        return '<option value="' + esc(op.value) + '"' + (op.value === o.value ? " selected" : "") + ">" + esc(op.label) + "</option>";
      }).join("") + "</select>";
    } else {
      control = '<input class="input" id="' + id + '" name="' + id + '" type="' + (o.type || "text") + '" value="' +
        esc(o.value || "") + '" placeholder="' + esc(o.placeholder || "") + '">';
    }
    return '<div class="field' + (o.full ? " field--full" : "") + '"><label for="' + id + '">' + esc(o.label) +
      (o.required ? '<span class="required">*</span>' : "") + "</label>" + control +
      (o.hint || o.hintId
        ? '<span class="field__hint"' + (o.hintId ? ' id="' + o.hintId + '"' : "") + ">" + esc(o.hint || "") + "</span>"
        : "") + "</div>";
  }

  function openDrawer(o) {
    var mask = document.createElement("div");
    mask.className = "admin-overlay";
    var drawer = document.createElement("div");
    drawer.className = "admin-drawer";
    drawer.setAttribute("role", "dialog");
    drawer.setAttribute("aria-modal", "true");
    drawer.innerHTML =
      '<div class="admin-drawer__head"><div><h2>' + esc(o.title || "") + "</h2>" +
      (o.subtitle ? "<p>" + esc(o.subtitle) + "</p>" : "") + "</div>" +
      '<button class="btn btn-ghost btn-sm close" type="button" data-close>关闭</button></div>' +
      '<div class="admin-drawer__body">' + (o.body || "") + "</div>" +
      (o.foot ? '<div class="admin-drawer__foot">' + o.foot + "</div>" : "");
    document.body.appendChild(mask);
    document.body.appendChild(drawer);
    function close() {
      mask.remove();
      drawer.remove();
      document.removeEventListener("keydown", onKey);
      if (o.onClose) o.onClose();
    }
    function onKey(e) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", onKey);
    mask.addEventListener("click", close);
    MM.dom.qsa("[data-close]", drawer).forEach(function (b) {
      b.addEventListener("click", close);
    });
    return { el: drawer, close: close };
  }

  function formModal(o) {
    var mask = document.createElement("div");
    mask.className = "modal-mask";
    mask.innerHTML = '<div class="modal"><h3>' + esc(o.title) + "</h3>" +
      (o.desc ? "<p>" + esc(o.desc) + "</p>" : "") +
      (o.body || "") +
      '<p class="field__error" data-error style="margin-top:8px;display:none"></p>' +
      '<div class="modal__actions">' +
      '<button class="btn btn-secondary" data-cancel>' + esc(o.cancelText || "取消") + "</button>" +
      '<button class="btn ' + (o.kind || "btn-primary") + '" data-ok>' + esc(o.okText || "确定") + "</button></div></div>";
    document.body.appendChild(mask);
    function close() { mask.remove(); }
    mask.addEventListener("click", function (e) { if (e.target === mask) close(); });
    var cancel = mask.querySelector("[data-cancel]");
    if (cancel) cancel.addEventListener("click", close);
    var ok = mask.querySelector("[data-ok]");
    ok.addEventListener("click", function () {
      var values = {};
      MM.dom.qsa("[data-field]", mask).forEach(function (el) {
        values[el.getAttribute("data-field")] = el.value.trim();
      });
      var err = mask.querySelector("[data-error]");
      var msg = o.validate ? o.validate(values) : "";
      if (msg) {
        err.textContent = msg;
        err.style.display = "block";
        return;
      }
      close();
      if (o.onSubmit) o.onSubmit(values);
    });
    var first = mask.querySelector("input, textarea, select");
    if (first) first.focus();
    return { close: close, el: mask };
  }

  function confirm(o) {
    formModal({
      title: o.title || "确认操作",
      desc: o.desc,
      body: o.reason ? '<div class="field"><label>' + esc(o.reasonLabel || "原因") + '<span class="required">*</span></label>' +
        '<textarea class="textarea" data-field="reason" rows="3" placeholder="' + esc(o.placeholder || "请填写原因（不少于 10 字）") + '"></textarea></div>' : "",
      okText: o.okText || "确认",
      kind: o.kind || "btn-danger",
      validate: function (v) {
        if (o.reason && (!v.reason || v.reason.length < 10)) return "请填写至少 10 个字的原因";
        return "";
      },
      onSubmit: function (v) { var fn = o.onOk || o.onSubmit; if (fn) fn(v.reason || ""); }
    });
  }

  function catName(id) { return MM.config.category(id).name; }

  function catOptions(current, withAll) {
    var html = withAll ? '<option value="">全部茶类</option>' : "";
    MM.categories.forEach(function (c) {
      html += '<option value="' + c.id + '"' + (c.id === current ? " selected" : "") + ">" + c.name + "</option>";
    });
    return html;
  }

  function subOptions(catId, current, withAll, onlyWithTeas) {
    var html = withAll ? '<option value="">全部亚类</option>' : "";
    var cat = MM.config.category(catId);
    cat.subs.forEach(function (s) {
      if (onlyWithTeas && MM.config.subCount(catId, s) === 0) return;
      html += '<option value="' + esc(s) + '"' + (s === current ? " selected" : "") + ">" + esc(s) + "</option>";
    });
    return html;
  }

  function typeLabel(t) {
    return { t1: "T1 品鉴长文", t3: "T3 补图", t4: "T4 纠错" }[t] || t;
  }

  function guard() {
    var session = MM.admin.session();
    if (!session) {
      var file = window.location.pathname.split("/").pop() || "dashboard.html";
      window.location.href = "login.html?from=" + encodeURIComponent(file + window.location.search);
      return false;
    }
    return true;
  }

  function deny(title, desc) {
    var content = document.getElementById("admin-content");
    if (content) {
      content.innerHTML = '<div class="deny-wrap"><div class="deny-card">' +
        '<div class="code">403</div><h2>' + esc(title || "无访问权限") + "</h2>" +
        "<p>" + esc(desc || "当前账号无权访问该页面。") + "</p>" +
        '<div class="mt-4"><a class="btn btn-secondary" href="dashboard.html">返回工作台</a></div></div></div>';
    }
    return false;
  }

  /* 小屏提示：18 个后台 HTML 中的 .admin-mobile-tip 统一填充文案 */
  function fillMobileTip() {
    MM.dom.qsa(".admin-mobile-tip").forEach(function (tip) {
      if (!tip.innerHTML.trim()) {
        tip.innerHTML = '<div><b>请使用桌面端</b>后台管理页面最小支持宽度为 768px，请在电脑或平板横屏下访问。</div>';
      }
    });
  }

  function initChrome(activePage) {
    var session = MM.admin.session();
    var stats = db.stats();
    var side = document.getElementById("admin-sidebar");
    if (side) {
      side.innerHTML = '<div class="admin-brand"><a href="dashboard.html">茗脉</a><span>管理后台</span></div><nav class="admin-nav">' +
        NAV.map(function (group) {
          var items = group.items.filter(function (it) {
            return !it.role || (session && session.role === it.role);
          });
          if (!items.length) return "";
          return '<div class="admin-nav__group">' +
            (group.title ? '<div class="admin-nav__group-title">' + esc(group.title) + "</div>" : "") +
            items.map(function (it) {
              var count = it.badgeKey ? stats[it.badgeKey] : 0;
              return '<a class="admin-nav__item' + (it.page === activePage ? " is-active" : "") + '" href="' + it.href + '">' +
                "<span>" + esc(it.label) + "</span>" +
                (count ? '<span class="admin-nav__badge">' + count + "</span>" : "") + "</a>";
            }).join("") + "</div>";
        }).join("") + "</nav>";
    }
    var top = document.getElementById("admin-topbar");
    if (top) {
      top.innerHTML = '<div class="admin-crumbs" id="admin-crumbs"></div>' +
        '<div class="admin-user">' +
          '<span class="avatar">' + esc((session.nick || "管").slice(0, 1)) + "</span>" +
          "<span>" + esc(session.nick) + '</span><span class="admin-user__role">' + esc(ROLE_TEXT[session.role] || "管理员") + "</span>" +
          '<button class="btn btn-ghost btn-sm" type="button" id="admin-logout">退出</button>' +
        "</div>";
      document.getElementById("admin-logout").addEventListener("click", function () {
        MM.admin.logout();
        window.location.href = "login.html";
      });
    }
    fillMobileTip();
  }

  function setCrumbs(items) {
    var box = document.getElementById("admin-crumbs");
    if (!box) return;
    box.innerHTML = items.map(function (it, i) {
      var last = i === items.length - 1;
      return (last ? "<span>" + esc(it.label) + "</span>" : '<a href="' + it.href + '">' + esc(it.label) + "</a>") +
        (last ? "" : "<span>/</span>");
    }).join("");
  }

  var handlers = {};
  function page(name, fn) { handlers[name] = fn; }

  function boot() {
    var p = document.body.getAttribute("data-page") || "";
    fillMobileTip();
    if (p === "login") return;
    if (!guard()) return;
    var session = MM.admin.session();
    var conf = (MM.adminPages && MM.adminPages[p]) || {};
    var needsSuper = conf.superOnly || p === "admins" || p === "settings";
    initChrome(p);
    if (needsSuper && session.role !== "super") {
      deny("仅超级管理员可访问", "该页面涉及管理员与系统配置，普通管理员无权查看。");
      return;
    }
    if (conf.crumb) setCrumbs(conf.crumb);
    MM.admin.attachImageFallback(document);
    if (handlers[p]) handlers[p]();
  }

  return {
    esc: esc,
    param: param,
    db: db,
    badge: badge,
    timeText: timeText,
    remainText: remainText,
    pagerHTML: pagerHTML,
    bindPager: bindPager,
    tableHTML: tableHTML,
    emptyTable: emptyTable,
    field: field,
    openDrawer: openDrawer,
    formModal: formModal,
    confirm: confirm,
    deny: deny,
    initChrome: initChrome,
    setCrumbs: setCrumbs,
    page: page,
    boot: boot,
    attachImageFallback: function (node) { return MM.ui.attachImageFallback(node); },
    roleText: function (r) { return ROLE_TEXT[r] || r; },
    catName: catName,
    catOptions: catOptions,
    subOptions: subOptions,
    typeLabel: typeLabel,
    session: function () { return MM.store.read(MM.config.KEYS.adminSession, null); },
    login: function (role) {
      var user = { nick: role === "admin" ? "编辑部小林" : "阿茗", role: role || "super", openid: "mock-openid-****0001" };
      MM.store.write(MM.config.KEYS.adminSession, user);
      return user;
    },
    logout: function () {
      try { localStorage.removeItem(MM.config.KEYS.adminSession); } catch (e) { /* noop */ }
    },
    now: function () {
      var d = new Date();
      function p(n) { return (n < 10 ? "0" : "") + n; }
      return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
    }
  };
})();

document.addEventListener("DOMContentLoaded", function () {
  MM.admin.boot();
});
