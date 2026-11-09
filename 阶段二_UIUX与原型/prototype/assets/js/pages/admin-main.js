/* 茗脉 · 后台页面（一）：工作台、茶品管理、茶品编辑、新建、图鉴 */
(function () {
  var A = MM.admin;
  var esc = A.esc;
  var content = function (html) { document.getElementById("admin-content").innerHTML = html; };

  function pageHead(title, desc, actions) {
    return '<div class="page-head"><div><h1>' + esc(title) + "</h1>" +
      (desc ? "<p>" + esc(desc) + "</p>" : "") + "</div>" +
      (actions ? '<div class="page-head__actions">' + actions + "</div>" : "") + "</div>";
  }

  function dayLabel(v) { return esc(v || "—"); }

  /* R-64：仅白茶、黑茶提示填写生产年份，其余茶类展示已映射的区间标签 */
  function yearHint(catId, year) {
    if (catId === "white" || catId === "dark") return "建议填写生产年份";
    return year ? MM.config.yearLabel({ year: year }) : "";
  }

  function afterDays(days) {
    var d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
  }

  function teaActions(t) {
    var html = '<a class="btn-link" href="tea.html?id=' + encodeURIComponent(t.id) + '">编辑</a>';
    if (t.status === "pending") {
      html += '<button class="btn-link" data-act="approve" data-id="' + t.id + '">通过</button>' +
        '<button class="btn-link" data-act="reject" data-id="' + t.id + '">驳回</button>';
    } else if (t.status === "draft") {
      html += '<button class="btn-link" data-act="submit" data-id="' + t.id + '">提交审核</button>';
    } else if (t.status === "online") {
      html += '<button class="btn-link" data-act="offline" data-id="' + t.id + '">下架</button>';
    } else if (t.status === "offline") {
      html += '<button class="btn-link" data-act="restore" data-id="' + t.id + '">恢复上架</button>';
    }
    html += '<a class="btn-link" href="gallery.html?id=' + encodeURIComponent(t.id) + '">图鉴</a>';
    return html;
  }

  function patchTea(id, data, audit) {
    A.db.patch("teas", id, data);
    if (audit) A.db.appendAudit(audit);
  }

  /* ================= A02 工作台 ================= */
  function renderDashboard() {
    var stats = A.db.stats();
    var todos = [];
    A.db.teas().forEach(function (t) {
      if (t.status !== "pending") return;
      todos.push({ timeout: t.timeout, time: t.updated, kind: "茶品", badge: "待审核", title: t.name + "（" + A.catName(t.cat) + "·" + t.sub + "）", href: "tea.html?id=" + t.id });
    });
    A.db.submissions().forEach(function (s) {
      if (s.status !== "pending") return;
      todos.push({ timeout: s.timeout, time: s.time, kind: "投稿", badge: A.typeLabel(s.type), title: s.title, href: "submission.html?id=" + s.id });
    });
    A.db.reports().forEach(function (r) {
      if (r.status === "resolved") return;
      todos.push({ timeout: r.timeout, time: r.time, kind: "投诉", badge: r.type, title: r.target, href: "report.html?id=" + r.id });
    });
    todos.sort(function (a, b) {
      if (a.timeout !== b.timeout) return a.timeout ? -1 : 1;
      return String(b.time).localeCompare(String(a.time));
    });
    todos = todos.slice(0, 8);

    var cards = [
      { label: "待审核茶品", num: stats.pendingTeas, href: "teas.html?status=pending", foot: "含超时 " + A.db.teas().filter(function (t) { return t.status === "pending" && t.timeout; }).length + " 条", danger: false },
      { label: "待审核投稿", num: stats.pendingSubs, href: "submissions.html?status=pending", foot: "T1 / T3 / T4 混合队列", danger: false },
      { label: "待处理投诉", num: stats.pendingReports, href: "reports.html", foot: "48 小时内需首次响应", danger: false },
      { label: "超时事项", num: stats.overdue, href: "reports.html?overdue=1", foot: "超过审核时限，优先处理", danger: true }
    ];

    var todoHTML = todos.length
      ? '<div class="todo-list">' + todos.map(function (t) {
          return '<div class="todo-row' + (t.timeout ? " is-overdue" : "") + '">' +
            '<span class="todo-row__type">' + A.badge(t.badge) + "</span>" +
            '<span class="todo-row__title"><a href="' + t.href + '">' + esc(t.title) + "</a></span>" +
            '<span class="todo-row__time">' + esc(t.time) + (t.timeout ? " · 已超时" : "") + "</span></div>";
        }).join("") + "</div>"
      : '<div class="empty-state"><h3>今日无待办</h3><p>所有队列均已清空，可稍后再来看看。</p></div>';

    content(
      pageHead("工作台", "按紧急度汇总今日待办，超时事项优先处理。", '<a class="btn btn-primary" href="tea-new.html">新建茶品</a>') +
      '<div class="stat-grid">' + cards.map(function (c) {
        return '<a class="stat-card' + (c.danger ? " stat-card--danger" : "") + '" href="' + c.href + '">' +
          '<span class="stat-card__label"><span class="dot"></span>' + c.label + "</span>" +
          '<div class="stat-card__num">' + c.num + "</div>" +
          '<div class="stat-card__foot">' + c.foot + "</div></a>";
      }).join("") + "</div>" +
      '<div class="dash-cols">' +
        '<div class="admin-card"><div class="admin-card__head"><h2>待办队列</h2><span class="caption">超时事项置顶</span></div>' + todoHTML + "</div>" +
        '<div>' +
          '<div class="admin-card"><div class="admin-card__head"><h2>快捷入口</h2></div>' +
            '<div class="quick-grid">' +
              '<a class="quick-item" href="tea-new.html">新建茶品<span>录入基础字段并保存草稿</span></a>' +
              '<a class="quick-item" href="import.html">批量导入<span>上传 xlsx / csv 素材</span></a>' +
              '<a class="quick-item" href="comments.html">评论审核<span>先审后发，处理举报评论</span></a>' +
            "</div></div>" +
          '<div class="admin-card"><div class="admin-card__head"><h2>最近操作</h2><a class="btn-link" href="audit.html">审计日志</a></div>' +
            '<ul class="audit-mini">' + A.db.audit().slice(0, 5).map(function (l) {
              return "<li><time>" + esc(l.time.slice(5)) + "</time><span>" + esc(l.actor + " · " + l.action + " · " + l.target) + "</span></li>";
            }).join("") + "</ul></div>" +
        "</div>" +
      "</div>"
    );
  }
  A.page("dashboard", renderDashboard);

  /* ================= A03 茶品管理列表 ================= */
  function renderTeas() {
    var state = { q: A.param("q") || "", cat: A.param("cat") || "", sub: A.param("sub") || "", status: A.param("status") || "", days: "", page: 1, size: 10 };
    var selected = {};

    var filterHTML =
      '<div class="filter-bar">' +
        '<div class="field field--grow"><label for="f-q">关键词</label><input class="input" id="f-q" placeholder="茶名 / 别名 / 产地" value="' + esc(state.q) + '"></div>' +
        '<div class="field"><label for="f-cat">茶类</label><select class="select" id="f-cat">' + A.catOptions(state.cat, true) + "</select></div>" +
        '<div class="field"><label for="f-sub">亚类</label><select class="select" id="f-sub">' + A.subOptions(state.cat || "green", state.sub, true, false) + "</select></div>" +
        '<div class="field"><label for="f-status">状态</label><select class="select" id="f-status">' +
          '<option value="">全部状态</option>' +
          '<option value="online"' + (state.status === "online" ? " selected" : "") + ">已上架</option>" +
          '<option value="pending"' + (state.status === "pending" ? " selected" : "") + ">待审核</option>" +
          '<option value="draft"' + (state.status === "draft" ? " selected" : "") + ">草稿</option>" +
          '<option value="offline"' + (state.status === "offline" ? " selected" : "") + ">已下架</option>" +
        "</select></div>" +
        '<div class="field"><label for="f-days">更新时间</label><select class="select" id="f-days">' +
          '<option value="">全部时间</option><option value="7">近 7 天</option><option value="30">近 30 天</option>' +
        "</select></div>" +
        '<div class="filter-bar__actions"><button class="btn btn-secondary" type="button" id="f-reset">重置</button></div>' +
      "</div>";

    content(pageHead("茶品管理", "管理茶品录入、审核状态与上下架；点击茶名进入编辑抽屉。",
      '<a class="btn btn-secondary" href="import.html">批量导入</a><a class="btn btn-primary" href="tea-new.html">新建茶品</a>') +
      filterHTML + '<div id="tea-slot"></div>');

    function list() {
      var q = state.q.toLowerCase();
      return A.db.teas().filter(function (t) {
        if (state.cat && t.cat !== state.cat) return false;
        if (state.sub && t.sub !== state.sub) return false;
        if (state.status && t.status !== state.status) return false;
        if (state.days && String(t.updated) < afterDays(Number(state.days))) return false;
        if (q) {
          var hay = (t.name + " " + (t.alias || "") + " " + (t.id || "")).toLowerCase();
          if (hay.indexOf(q) === -1) return false;
        }
        return true;
      });
    }

    function tableHTML() {
      var rows = list();
      var pages = Math.max(1, Math.ceil(rows.length / state.size));
      if (state.page > pages) state.page = pages;
      var slice = rows.slice((state.page - 1) * state.size, state.page * state.size);
      var allChecked = slice.length > 0 && slice.every(function (r) { return selected[r.id]; });
      var columns = [
        { label: '<input type="checkbox" class="row-check" id="check-all"' + (allChecked ? " checked" : "") + ">", width: "36px", render: function (r) {
            return '<input type="checkbox" class="row-check" data-row="' + r.id + '"' + (selected[r.id] ? " checked" : "") + ">";
          } },
        { label: "茶品", render: function (r) {
            var orig = MM.config.tea(r.id);
            var img = orig ? '<img src="' + MM.config.imageUrl(orig.name, "干茶") + '" alt="" data-fb-name="' + esc(orig.name) +
              '" data-fb-type="干茶" data-fb-cat="' + orig.cat + '">' : "";
            return '<div class="cell-main">' + img + '<div><a href="tea.html?id=' + encodeURIComponent(r.id) + '">' + esc(r.name) + "</a>" +
              '<div class="cell-sub">' + esc(r.id) + "</div></div></div>";
          } },
        { label: "茶类 / 亚类", render: function (r) { return esc(A.catName(r.cat)) + " · " + esc(r.sub); } },
        { label: "状态", render: function (r) {
            return A.badge(r.status) + (r.timeout && r.status === "pending" ? ' <span class="overdue-tag">超时</span>' : "");
          } },
        { label: "图数", width: "72px", render: function (r) {
            var need = MM.config.imageTypes(MM.config.tea(r.id) || { imgs: 4 }).length;
            return '<span class="' + (r.images < 4 ? "overdue-tag" : "") + '">' + r.images + " / " + need + "</span>";
          } },
        { label: "更新时间", width: "110px", render: function (r) { return dayLabel(r.updated); } },
        { label: "操作", width: "220px", render: function (r) { return '<div class="cell-actions">' + teaActions(r) + "</div>"; } }
      ];
      var body = slice.map(function (r) {
        r._rowClass = r.timeout && r.status === "pending" ? "is-overdue" : "";
        return r;
      });
      var hasSel = Object.keys(selected).length > 0;
      var foot = '<span>共 <b>' + rows.length + "</b> 条 · 已选 " + Object.keys(selected).length + " 项" +
        ' · <button class="btn-link" id="bulk-submit"' + (hasSel ? "" : " disabled") + ">批量提交审核</button>" +
        ' · <button class="btn-link" id="bulk-offline"' + (hasSel ? "" : " disabled") + ">批量下架</button>" +
        ' · <button class="btn-link" id="bulk-restore"' + (hasSel ? "" : " disabled") + ">批量恢复</button>" +
        "</span>" +
        A.pagerHTML(rows.length, state.page, state.size);

      var html = rows.length ? A.tableHTML(columns, body, { foot: foot })
        : A.emptyTable("暂无茶品", "当前筛选条件下没有匹配结果，可重置筛选或新建茶品。",
          '<a class="btn btn-secondary" href="tea-new.html">新建茶品</a>');
      document.getElementById("tea-slot").innerHTML = html;
      bind();
      A.attachImageFallback(document.getElementById("tea-slot"));
    }

    function bind() {
      var all = document.getElementById("check-all");
      if (all) {
        all.addEventListener("change", function () {
          var rows = list().slice((state.page - 1) * state.size, state.page * state.size);
          rows.forEach(function (r) { if (all.checked) selected[r.id] = true; else delete selected[r.id]; });
          tableHTML();
        });
      }
      MM.dom.qsa("[data-row]").forEach(function (cb) {
        cb.addEventListener("change", function () {
          if (cb.checked) selected[cb.getAttribute("data-row")] = true;
          else delete selected[cb.getAttribute("data-row")];
          tableHTML();
        });
      });
      MM.dom.qsa("[data-act]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var id = btn.getAttribute("data-id");
          var act = btn.getAttribute("data-act");
          var tea = A.db.tea(id);
          if (act === "submit") {
            patchTea(id, { status: "pending", timeout: false }, { action: "提交审核", target: tea.name + "（" + id + "）", detail: "由草稿转为待审核" });
            MM.ui.toast("已提交审核");
            tableHTML();
          } else if (act === "approve") {
            A.confirm({ title: "通过茶品审核", desc: "通过后该茶品将上架展示。", okText: "通过", kind: "btn-primary", onSubmit: function () {
              patchTea(id, { status: "online", timeout: false }, { action: "通过审核", target: tea.name + "（" + id + "）", detail: "茶品审核通过并上架" });
              MM.ui.toast("已通过并上架");
              tableHTML();
            } });
          } else if (act === "reject") {
            A.confirm({ title: "驳回茶品审核", reason: true, okText: "驳回", onSubmit: function (reason) {
              patchTea(id, { status: "draft", timeout: false }, { action: "驳回审核", target: tea.name + "（" + id + "）", detail: "理由：" + reason });
              MM.ui.toast("已驳回并退回草稿");
              tableHTML();
            } });
          } else if (act === "offline") {
            A.confirm({ title: "下架茶品", desc: "下架后前台不再展示，操作会写入审计日志。", reason: true, okText: "确认下架", onSubmit: function (reason) {
              patchTea(id, { status: "offline", offlineReason: reason }, { action: "下架", target: tea.name + "（" + id + "）", detail: "原因：" + reason });
              MM.ui.toast("已下架");
              tableHTML();
            } });
          } else if (act === "restore") {
            A.confirm({ title: "恢复上架", desc: "恢复后前台重新展示该茶品。", reason: true, okText: "恢复上架", kind: "btn-primary", onSubmit: function (reason) {
              patchTea(id, { status: "online", offlineReason: "" }, { action: "恢复上架", target: tea.name + "（" + id + "）", detail: "原因：" + reason });
              MM.ui.toast("已恢复上架");
              tableHTML();
            } });
          }
        });
      });
      A.bindPager(document.getElementById("tea-slot"), function (p) {
        state.page = p;
        tableHTML();
      });
      var bulk = document.getElementById("bulk-submit");
      if (bulk) {
        bulk.addEventListener("click", function () {
          var ids = Object.keys(selected).filter(function (id) { return A.db.tea(id) && A.db.tea(id).status === "draft"; });
          if (!ids.length) { MM.ui.toast("所选茶品中没有草稿"); return; }
          ids.forEach(function (id) {
            patchTea(id, { status: "pending" }, { action: "批量提交审核", target: id, detail: "批量提交 " + ids.length + " 条" });
          });
          selected = {};
          MM.ui.toast("已提交 " + ids.length + " 条茶品审核");
          tableHTML();
        });
      }
      var bulkOff = document.getElementById("bulk-offline");
      if (bulkOff) {
        bulkOff.addEventListener("click", function () {
          var ids = Object.keys(selected).filter(function (id) { return A.db.tea(id) && A.db.tea(id).status === "online"; });
          if (!ids.length) { MM.ui.toast("所选茶品中没有已上架茶品"); return; }
          A.confirm({ title: "批量下架", desc: "将下架 " + ids.length + " 条茶品，操作会写入审计日志。", reason: true, okText: "确认下架", onSubmit: function (reason) {
            ids.forEach(function (id) {
              patchTea(id, { status: "offline", offlineReason: reason }, { action: "批量下架", target: id, detail: "原因：" + reason });
            });
            selected = {};
            MM.ui.toast("已下架 " + ids.length + " 条茶品");
            tableHTML();
          } });
        });
      }
      var bulkRestore = document.getElementById("bulk-restore");
      if (bulkRestore) {
        bulkRestore.addEventListener("click", function () {
          var ids = Object.keys(selected).filter(function (id) { return A.db.tea(id) && A.db.tea(id).status === "offline"; });
          if (!ids.length) { MM.ui.toast("所选茶品中没有已下架茶品"); return; }
          A.confirm({ title: "批量恢复上架", desc: "将恢复 " + ids.length + " 条茶品上架展示。", reason: true, okText: "确认恢复", onSubmit: function (reason) {
            ids.forEach(function (id) {
              patchTea(id, { status: "online", offlineReason: "" }, { action: "批量恢复上架", target: id, detail: "原因：" + reason });
            });
            selected = {};
            MM.ui.toast("已恢复 " + ids.length + " 条茶品");
            tableHTML();
          } });
        });
      }
    }

    var qInput = document.getElementById("f-q");
    qInput.addEventListener("input", MM.dom.debounce(function () {
      state.q = qInput.value.trim();
      state.page = 1;
      tableHTML();
    }, 250));
    document.getElementById("f-cat").addEventListener("change", function () {
      state.cat = this.value;
      state.sub = "";
      document.getElementById("f-sub").innerHTML = A.subOptions(state.cat || "green", "", true, false);
      state.page = 1;
      tableHTML();
    });
    document.getElementById("f-sub").addEventListener("change", function () { state.sub = this.value; state.page = 1; tableHTML(); });
    document.getElementById("f-status").addEventListener("change", function () { state.status = this.value; state.page = 1; tableHTML(); });
    document.getElementById("f-days").addEventListener("change", function () { state.days = this.value; state.page = 1; tableHTML(); });
    document.getElementById("f-reset").addEventListener("click", function () {
      state.q = ""; state.cat = ""; state.sub = ""; state.status = ""; state.days = ""; state.page = 1;
      qInput.value = "";
      document.getElementById("f-cat").value = "";
      document.getElementById("f-sub").innerHTML = A.subOptions("green", "", true, false);
      document.getElementById("f-status").value = "";
      document.getElementById("f-days").value = "";
      tableHTML();
    });

    tableHTML();
    A.attachImageFallback(document);
  }
  A.page("teas", renderTeas);

  /* ================= A04 茶品编辑 / 审核 ================= */
  var IMG_TYPES = ["干茶", "汤色", "叶底", "细节", "包装"];
  var DIMS = [
    { key: "shape", label: "干茶形态" },
    { key: "color", label: "色泽" },
    { key: "soup", label: "汤色" },
    { key: "ferment", label: "发酵度" },
    { key: "aroma", label: "香气" }
  ];

  function tagsOfGroup(group) {
    return A.db.tags().filter(function (t) { return t.group === group && t.status !== "disabled"; });
  }

  function renderTeaDetail() {
    var id = A.param("id");
    var tea = A.db.tea(id);
    if (!tea) {
      content(pageHead("茶品编辑", "未找到对应茶品。") + A.emptyTable("茶品不存在", "链接参数可能不正确。",
        '<a class="btn btn-secondary" href="teas.html">返回列表</a>'));
      return;
    }
    var orig = MM.config.tea(id) || { name: tea.name, cat: tea.cat, sub: tea.sub, grade: [], shape: [], color: [], soup: [], aroma: [], ferment: "", desc: "", temp: "", ratio: "", vessel: "", seconds: "", times: 0, std: [], pick: "", year: "", updated: tea.updated, imgs: tea.images };
    var imageCount = tea.images;
    var localImages = [];
    var tabs = ["基本信息", "图鉴", "品质与冲泡", "来源与历史"];
    var activeTab = 0;
    var draft = {};
    var selectedTags = {
      shape: (orig.shape || []).slice(),
      color: (orig.color || []).slice(),
      soup: (orig.soup || []).slice(),
      ferment: orig.ferment ? [orig.ferment] : [],
      aroma: (orig.aroma || []).slice()
    };

    function slotHTML(type, idx) {
      var hasImg = idx < imageCount;
      return '<div class="image-slot' + (hasImg ? "" : " is-empty") + '" data-slot="' + idx + '">' +
        (hasImg
          ? '<img src="' + (localImages[idx] || MM.config.imageUrl(orig.name, type)) + '" alt="" data-fb-name="' + esc(orig.name) + '" data-fb-type="' + esc(type) + '" data-fb-cat="' + orig.cat + '">'
          : "<div>" + esc(type) + "<br><span class=\"field__hint\">点击上传（4:3）</span></div>") +
        '<div class="image-slot__label"><span>' + esc(type) + (hasImg ? "" : " · 待补图") + "</span>" +
        (hasImg ? '<button class="btn-link" type="button" data-img-del="' + idx + '">删除</button>' : "") +
        "</div></div>";
    }

    function tabBody() {
      if (activeTab === 0) {
        return '<div class="form-section"><h3>基础信息</h3><div class="form-grid">' +
          A.field({ label: "茶名", name: "f-name", value: tea.name, required: true }) +
          A.field({ label: "别名", name: "f-alias", value: orig.alias || "", placeholder: "多个别名用顿号分隔" }) +
          A.field({ label: "茶类", name: "f-cat", type: "select", value: tea.cat, options: MM.categories.map(function (c) { return { value: c.id, label: c.name }; }) }) +
          A.field({ label: "亚类", name: "f-sub", type: "select", value: tea.sub, options: MM.categories.map(function (c) { return { value: c.id, label: c.name }; }).length ? MM.config.category(tea.cat).subs.map(function (s) { return { value: s, label: s }; }) : [] }) +
          A.field({ label: "产地", name: "f-origin", value: orig.origin || "", required: true, hint: "格式：省份 + 具体产区" }) +
          A.field({ label: "生产年份", name: "f-year", type: "number", value: orig.year || "",
            hint: yearHint(tea.cat, orig.year), hintId: "f-year-hint" }) +
          A.field({ label: "采摘时间", name: "f-pick", value: orig.pick || "", placeholder: "如 3 月下旬～4 月上旬" }) +
          A.field({ label: "标准号", name: "f-std", value: (orig.std || []).join("；"), hint: "国标 / 行标 / 地标，多个用分号分隔" }) +
          '<div class="field field--full"><label>等级分档</label><div class="chip-row" id="grade-row">' +
            ["特级", "一级", "二级", "未分档"].map(function (g) {
              var on = g === "未分档" ? !(orig.grade || []).length : (orig.grade || []).indexOf(g) > -1;
              return '<button type="button" class="chip chip--btn' + (on ? " chip--active" : "") + '" data-grade="' + g + '">' + g + "</button>";
            }).join("") + "</div></div>" +
        "</div></div>" +
        '<div class="form-section"><h3>状态与归属</h3><div class="form-grid">' +
          '<div class="field"><label>当前状态</label><div>' + A.badge(tea.status) + "</div></div>" +
          A.field({ label: "提交人", name: "f-submitter", value: tea.submitter, readonly: true }) +
        "</div></div>";
      }
      if (activeTab === 1) {
        var need = imageCount >= 4;
        return '<div class="drawer-alert' + (need ? " drawer-alert--info" : " drawer-alert--warn") + '">当前已上传 <b>' + imageCount + " / 5</b> 张。" +
          (need ? "达到上架门槛（4 张），可提交审核。" : "提交审核需至少 4 张，2～3 张仅可保存草稿。") + "</div>" +
          '<div class="image-slots">' + IMG_TYPES.map(function (t, i) { return slotHTML(t, i); }).join("") + "</div>" +
          '<div class="form-section"><h3>来源与版权</h3><div class="form-grid">' +
            A.field({ label: "来源类型", name: "f-source", type: "select", value: "editor", options: [
              { value: "editor", label: "编辑自拍" }, { value: "org", label: "机构授权" },
              { value: "stock", label: "商用图库" }, { value: "user", label: "用户书面授权" }
            ] }) +
            A.field({ label: "授权编号", name: "f-license", value: "LIC-2026-0342" }) +
            A.field({ label: "版权声明", name: "f-copy", type: "textarea", value: "图片版权归茗脉内容团队或授权方所有，未经许可不得转载。", full: true, rows: 3 }) +
          "</div></div>";
      }
      if (activeTab === 2) {
        return '<div class="form-section"><h3>五维标签 <span class="caption">上架时必填</span></h3>' +
          DIMS.map(function (d) {
            var list = tagsOfGroup(d.label);
            return '<div class="field field--full" style="margin-bottom:12px"><label>' + d.label + "</label>" +
              '<div class="chip-row" data-dim="' + d.key + '">' +
              (list.length ? list.map(function (t) {
                var on = selectedTags[d.key].indexOf(t.name) > -1;
                return '<button type="button" class="chip chip--btn' + (on ? " chip--active" : "") + '" data-tag="' + esc(t.name) + '" data-dim-key="' + d.key + '">' + esc(t.name) + "</button>";
              }).join("") : '<span class="field__hint">该维度暂无可选标签，请先在标签库维护</span>') +
              "</div></div>";
          }).join("") +
        "</div>" +
        '<div class="form-section"><h3>品质描述</h3>' +
          A.field({ label: "品质特征", name: "f-desc", type: "textarea", value: orig.desc || "", rows: 4, full: true }) +
        "</div>" +
        '<div class="form-section"><h3>冲泡参数</h3><div class="form-grid">' +
          A.field({ label: "水温", name: "f-temp", value: orig.temp || "" }) +
          A.field({ label: "茶水比", name: "f-ratio", value: orig.ratio || "" }) +
          A.field({ label: "器具", name: "f-vessel", value: orig.vessel || "" }) +
          A.field({ label: "出汤时间", name: "f-seconds", value: orig.seconds || "" }) +
          A.field({ label: "可冲泡次数", name: "f-times", type: "number", value: orig.times || "" }) +
        "</div></div>";
      }
      return '<div class="form-section"><h3>来源与时间</h3><div class="form-grid">' +
          A.field({ label: "资料来源", name: "f-ref", value: "GB/T 标准文本、产区公开资料、编辑实地记录", full: true }) +
          A.field({ label: "最后更新时间", name: "f-updated", value: tea.updated }) +
          A.field({ label: "提交人", name: "f-submitter2", value: tea.submitter }) +
        "</div></div>" +
        '<div class="form-section"><h3>修订历史 <span class="caption">最近 5 条</span></h3>' +
          '<div class="meta-list">' +
            '<li><span class="label">2026-11-05 10:12</span><span class="value">编辑部小林 · 提交审核</span></li>' +
            '<li><span class="label">2026-10-28 16:40</span><span class="value">审核员老周 · 修改冲泡参数</span></li>' +
            '<li><span class="label">2026-10-20 09:15</span><span class="value">编辑部小林 · 补充图鉴 1 张</span></li>' +
          "</ul></div>" +
        (tea.offlineReason ? '<div class="drawer-alert">下架原因：' + esc(tea.offlineReason) + "</div>" : "");
    }

    var headHTML = '<div class="admin-drawer__head"><div><h2>' + esc(tea.name) + " " + A.badge(tea.status) + "</h2>" +
      "<p>提交人 " + esc(tea.submitter) + " · 更新于 " + esc(tea.updated) + (tea.timeout ? " · <span class=\"overdue-tag\">审核超时</span>" : "") + "</p></div>" +
      '<button class="btn btn-ghost btn-sm close" type="button" data-close>关闭</button></div>';

    var footerHTML = '<button class="btn btn-secondary" type="button" id="d-save">保存草稿</button>' +
      '<button class="btn btn-primary" type="button" id="d-submit">提交审核</button>' +
      '<span class="spacer"></span>' +
      (tea.status === "pending" ? '<button class="btn btn-danger" type="button" id="d-reject">驳回</button><button class="btn btn-primary" type="button" id="d-pass">通过</button>' : "") +
      (tea.status === "online" ? '<button class="btn btn-danger" type="button" id="d-offline">下架</button>' : "") +
      (tea.status === "offline" ? '<button class="btn btn-primary" type="button" id="d-restore">恢复上架</button>' : "");

    content(pageHead("茶品管理", "抽屉模式预览：点击空白区域或「关闭」返回列表。", '<a class="btn btn-secondary" href="teas.html">返回列表</a>') +
      '<div class="admin-card"><p class="form-foot-note">当前打开的是高保真编辑抽屉（480px，≥1440px 为 640px）。底部操作条固定，包含保存草稿 / 提交审核 / 通过 / 驳回。</p></div>');

    var drawer = A.openDrawer({ title: "", body: "", foot: footerHTML });
    drawer.el.querySelector(".admin-drawer__head").outerHTML = headHTML;

    var body = drawer.el.querySelector(".admin-drawer__body");
    function paint() {
      body.innerHTML =
        (tea.timeout ? '<div class="drawer-alert">该茶品审核已超时，请优先处理（承诺时限：工作日 24 小时）。</div>' : "") +
        '<div class="admin-tabs" id="d-tabs">' + tabs.map(function (t, i) {
          return '<button type="button" data-tab="' + i + '" class="' + (i === activeTab ? "is-active" : "") + '">' + t + "</button>";
        }).join("") + "</div>" + tabBody();
      bindBody();
      applyDraft();
    }

    function val(name) {
      var el = body.querySelector("#" + name);
      return el ? el.value.trim() : "";
    }

    function field(key) {
      var el = body.querySelector("#f-" + key);
      if (el) return el.value.trim();
      return draft[key] === undefined ? "" : String(draft[key]);
    }

    function applyDraft() {
      Object.keys(draft).forEach(function (key) {
        var el = body.querySelector("#f-" + key);
        if (!el) return;
        if (el.tagName === "SELECT") {
          var hit = Array.prototype.some.call(el.options, function (o) { return o.value === String(draft[key]); });
          if (hit) el.value = draft[key];
        } else {
          el.value = draft[key];
        }
      });
    }

    function markError(ids) {
      body.querySelectorAll(".input.is-error, .textarea.is-error, .select.is-error").forEach(function (el) { el.classList.remove("is-error"); });
      ids.forEach(function (id) {
        var el = body.querySelector("#" + id);
        if (el) el.classList.add("is-error");
      });
    }

    function collect() {
      var data = {};
      ["name", "alias", "cat", "sub", "origin", "year", "pick", "std", "desc", "temp", "ratio", "vessel", "seconds", "times"].forEach(function (key) {
        var el = body.querySelector("#f-" + key);
        if (!el) return;
        var v = el.value.trim();
        data[key] = (key === "year" || key === "times") && v ? Number(v) : v;
      });
      return data;
    }

    function switchTab(index) {
      Object.assign(draft, collect());
      activeTab = index;
      paint();
    }

    function validateBasic() {
      var miss = [];
      if (!field("name")) miss.push("f-name");
      if (!field("origin")) miss.push("f-origin");
      if (miss.length) {
        switchTab(0);
        markError(miss);
        MM.ui.toast("请补全必填字段");
        return false;
      }
      return true;
    }

    function saveDraft() {
      if (!validateBasic()) return;
      var data = Object.assign({}, draft, collect());
      data.updated = A.now().slice(0, 10);
      patchTea(tea.id, data, { action: "保存草稿", target: tea.name + "（" + tea.id + "）", detail: "编辑保存" });
      MM.ui.toast("草稿已保存");
    }

    function submit() {
      if (!validateBasic()) return;
      if (imageCount < 4) {
        MM.ui.toast("图鉴需至少 4 张方可提交审核（当前 " + imageCount + " 张）");
        switchTab(1);
        return;
      }
      var data = Object.assign({}, draft, collect());
      data.status = "pending";
      data.updated = A.now().slice(0, 10);
      patchTea(tea.id, data, { action: "提交审核", target: tea.name + "（" + tea.id + "）", detail: "提交审核" });
      MM.ui.toast("已提交审核");
      drawer.close();
      window.location.href = "teas.html?status=pending";
    }

    function bindBody() {
      MM.dom.qsa("[data-tab]", body).forEach(function (b) {
        b.addEventListener("click", function () {
          switchTab(Number(b.getAttribute("data-tab")));
        });
      });
      var catSel = body.querySelector("#f-cat");
      if (catSel) {
        catSel.addEventListener("change", function () {
          var sub = body.querySelector("#f-sub");
          sub.innerHTML = MM.config.category(catSel.value).subs.map(function (s) {
            return '<option value="' + esc(s) + '">' + esc(s) + "</option>";
          }).join("");
          var yearInput = body.querySelector("#f-year");
          var hintEl = body.querySelector("#f-year-hint");
          if (hintEl) hintEl.textContent = yearHint(catSel.value, yearInput ? yearInput.value : "");
        });
      }
      MM.dom.qsa("[data-grade]", body).forEach(function (b) {
        b.addEventListener("click", function () {
          var g = b.getAttribute("data-grade");
          if (g === "未分档") {
            MM.dom.qsa("[data-grade]", body).forEach(function (x) { x.classList.remove("chip--active"); });
            b.classList.add("chip--active");
          } else {
            var und = body.querySelector('[data-grade="未分档"]');
            if (und) und.classList.remove("chip--active");
            b.classList.toggle("chip--active");
          }
        });
      });
      MM.dom.qsa("[data-tag]", body).forEach(function (b) {
        b.addEventListener("click", function () {
          var key = b.getAttribute("data-dim-key");
          var tag = b.getAttribute("data-tag");
          var arr = selectedTags[key];
          var i = arr.indexOf(tag);
          if (key === "ferment" && i === -1) arr = [];
          if (i > -1) arr.splice(i, 1); else arr.push(tag);
          selectedTags[key] = arr;
          paint();
        });
      });
      MM.dom.qsa("[data-slot]", body).forEach(function (slot) {
        slot.addEventListener("click", function (e) {
          if (e.target.closest("[data-img-del]")) {
            e.stopPropagation();
            imageCount = Math.max(0, imageCount - 1);
            patchTea(tea.id, { images: imageCount }, { action: "删除图片", target: tea.name, detail: "剩余 " + imageCount + " 张" });
            paint();
            return;
          }
          if (slot.classList.contains("is-empty")) pickFile(function (data) {
            localImages[Number(slot.getAttribute("data-slot"))] = data;
            imageCount = Math.min(5, imageCount + 1);
            patchTea(tea.id, { images: imageCount }, { action: "上传图片", target: tea.name, detail: "当前 " + imageCount + " 张" });
            MM.ui.toast("已上传 1 张（原型仅本地预览）");
            paint();
          });
        });
      });
    }

    function pickFile(cb) {
      var input = document.createElement("input");
      input.type = "file";
      input.accept = "image/jpeg,image/png,image/webp";
      input.addEventListener("change", function () {
        var f = input.files[0];
        if (!f) return;
        if (f.size > 5 * 1024 * 1024) { MM.ui.toast("图片需小于 5MB"); return; }
        var r = new FileReader();
        r.onload = function () { cb(r.result); };
        r.readAsDataURL(f);
      });
      input.click();
    }

    body.addEventListener("click", function (e) {
      if (e.target.closest('[data-close]')) drawer.close();
    });

    paint();
    A.attachImageFallback(body);

    drawer.el.addEventListener("click", function (e) {
      if (e.target.closest("[data-close]")) { drawer.close(); return; }
      var id2 = e.target.id;
      if (id2 === "d-save") saveDraft();
      if (id2 === "d-submit") submit();
      if (id2 === "d-pass") {
        A.confirm({ title: "通过茶品审核", desc: "通过后立即上架展示。", okText: "通过", kind: "btn-primary", onSubmit: function () {
          patchTea(tea.id, { status: "online", timeout: false }, { action: "通过审核", target: tea.name, detail: "审核通过并上架" });
          MM.ui.toast("已通过并上架");
          drawer.close();
          window.location.href = "teas.html?status=pending";
        } });
      }
      if (id2 === "d-reject") {
        A.confirm({ title: "驳回茶品审核", reason: true, onSubmit: function (reason) {
          patchTea(tea.id, { status: "draft", timeout: false, rejectReason: reason }, { action: "驳回审核", target: tea.name, detail: "理由：" + reason });
          MM.ui.toast("已驳回至草稿");
          drawer.close();
          window.location.href = "teas.html?status=draft";
        } });
      }
      if (id2 === "d-offline") {
        A.confirm({ title: "下架茶品", reason: true, onSubmit: function (reason) {
          patchTea(tea.id, { status: "offline", offlineReason: reason }, { action: "下架", target: tea.name, detail: "原因：" + reason });
          MM.ui.toast("已下架");
          drawer.close();
          window.location.href = "teas.html?status=offline";
        } });
      }
      if (id2 === "d-restore") {
        A.confirm({ title: "恢复上架", reason: true, kind: "btn-primary", onSubmit: function (reason) {
          patchTea(tea.id, { status: "online", offlineReason: "" }, { action: "恢复上架", target: tea.name, detail: "原因：" + reason });
          MM.ui.toast("已恢复上架");
          drawer.close();
          window.location.href = "teas.html?status=online";
        } });
      }
    });

    /* 60 秒自动保存：有改动时真实写入补丁，而不是只弹提示 */
    var lastAuto = JSON.stringify(collect());
    var timer = setInterval(function () {
      if (!document.body.contains(drawer.el)) { clearInterval(timer); return; }
      var current = JSON.stringify(collect());
      if (current === lastAuto) return;
      lastAuto = current;
      var payload = collect();
      payload.updated = A.now().slice(0, 10);
      patchTea(tea.id, payload, { action: "自动保存草稿", target: tea.name + "（" + tea.id + "）", detail: "60 秒自动保存" });
      MM.ui.toast("草稿已自动保存");
    }, 60000);
  }
  A.page("tea", renderTeaDetail);

  /* ================= A05 新建茶品 ================= */
  function renderTeaNew() {
    var dirty = false;
    var images = [];

    content(pageHead("新建茶品", "新建条目状态固定为草稿；图鉴达到 4 张后可提交审核。",
      '<a class="btn btn-secondary" href="teas.html">返回列表</a>') +
      '<div class="admin-card">' +
        '<div class="form-section"><h3>基础信息</h3><div class="form-grid">' +
          A.field({ label: "茶名", name: "f-name", required: true, placeholder: "如 西湖龙井" }) +
          A.field({ label: "别名", name: "f-alias" }) +
          A.field({ label: "茶类", name: "f-cat", type: "select", value: "green", options: MM.categories.map(function (c) { return { value: c.id, label: c.name }; }) }) +
          A.field({ label: "亚类", name: "f-sub", type: "select", value: MM.categories[0].subs[0], options: MM.categories[0].subs.map(function (s) { return { value: s, label: s }; }) }) +
          A.field({ label: "产地", name: "f-origin", required: true, placeholder: "如 浙江杭州西湖" }) +
          A.field({ label: "生产年份", name: "f-year", type: "number", placeholder: "如 2026",
            hint: yearHint("green", ""), hintId: "f-year-hint" }) +
          A.field({ label: "采摘时间", name: "f-pick", placeholder: "如 3 月下旬～4 月上旬" }) +
          A.field({ label: "标准号", name: "f-std", placeholder: "如 GB/T 18650" }) +
          A.field({ label: "品质特征", name: "f-desc", type: "textarea", full: true, rows: 3 }) +
        "</div></div>" +
        '<div class="form-section"><h3>图鉴 <span class="caption">4～5 张方可提交</span></h3>' +
          '<div class="image-slots" id="new-slots"></div>' +
          '<p class="form-foot-note" style="margin-top:8px">图片需 4:3、小于 5MB；排序可在保存后进入图鉴管理调整。</p>' +
        "</div>" +
      "</div>" +
      '<div class="page-head__actions" style="margin-top:16px;justify-content:flex-end">' +
        '<a class="btn btn-secondary" href="teas.html" id="new-cancel">取消</a>' +
        '<button class="btn btn-secondary" id="new-save">保存草稿</button>' +
        '<button class="btn btn-primary" id="new-submit">提交审核</button>' +
      "</div>");

    function paintSlots() {
      document.getElementById("new-slots").innerHTML = IMG_TYPES.map(function (t, i) {
        var has = images[i];
        return '<div class="image-slot' + (has ? "" : " is-empty") + '" data-slot="' + i + '">' +
          (has ? '<img src="' + has + '" alt="">' : "<div>" + t + "<br><span class=\"field__hint\">点击上传</span></div>") +
          '<div class="image-slot__label"><span>' + t + "</span>" +
          (has ? '<button class="btn-link" type="button" data-del="' + i + '">删除</button>' : "") + "</div></div>";
      }).join("");
    }

    function count() { return images.filter(Boolean).length; }

    function pick() {
      var input = document.createElement("input");
      input.type = "file";
      input.accept = "image/jpeg,image/png,image/webp";
      input.addEventListener("change", function () {
        var f = input.files[0];
        if (!f) return;
        if (f.size > 5 * 1024 * 1024) { MM.ui.toast("图片需小于 5MB"); return; }
        var r = new FileReader();
        r.onload = function () {
          var idx = images.length;
          for (var i = 0; i < 5; i++) if (!images[i]) { idx = i; break; }
          images[idx] = r.result;
          dirty = true;
          paintSlots();
        };
        r.readAsDataURL(f);
      });
      input.click();
    }

    document.getElementById("new-slots").addEventListener("click", function (e) {
      if (e.target.closest("[data-del]")) {
        images[Number(e.target.closest("[data-del]").getAttribute("data-del"))] = null;
        paintSlots();
        return;
      }
      var slot = e.target.closest("[data-slot]");
      if (slot && slot.classList.contains("is-empty")) pick();
    });

    document.getElementById("f-cat").addEventListener("change", function () {
      document.getElementById("f-sub").innerHTML = MM.config.category(this.value).subs.map(function (s) {
        return '<option value="' + esc(s) + '">' + esc(s) + "</option>";
      }).join("");
      document.getElementById("f-year-hint").textContent =
        yearHint(this.value, document.getElementById("f-year").value);
    });

    document.getElementById("admin-content").addEventListener("input", function () { dirty = true; });
    document.getElementById("new-cancel").addEventListener("click", function (e) {
      if (!dirty) return;
      e.preventDefault();
      A.formModal({
        title: "放弃未保存的内容？", desc: "当前填写的内容尚未保存，离开后将丢失。",
        okText: "放弃并离开", kind: "btn-danger",
        onSubmit: function () { window.location.href = "teas.html"; }
      });
    });

    function value(id) {
      var el = document.getElementById(id);
      return el ? el.value.trim() : "";
    }

    function collect(status, imagesCount) {
      return {
        id: "new-" + Date.now(),
        name: value("f-name"),
        alias: value("f-alias"),
        cat: value("f-cat"),
        sub: value("f-sub"),
        origin: value("f-origin"),
        year: value("f-year") ? Number(value("f-year")) : "",
        pick: value("f-pick"),
        std: value("f-std"),
        desc: value("f-desc"),
        status: status,
        images: imagesCount,
        updated: A.now().slice(0, 10),
        submitter: (A.session() || {}).nick || "管理员",
        timeout: false,
        timeoutHours: 0
      };
    }

    function checkRequired() {
      var miss = [];
      if (!value("f-name")) miss.push("f-name");
      if (!value("f-origin")) miss.push("f-origin");
      MM.dom.qsa("#admin-content .input.is-error").forEach(function (el) { el.classList.remove("is-error"); });
      miss.forEach(function (id) { document.getElementById(id).classList.add("is-error"); });
      if (miss.length) { MM.ui.toast("请补全必填字段（茶名、产地）"); return false; }
      return true;
    }

    function duplicate(status) {
      var name = value("f-name"), cat = value("f-cat"), sub = value("f-sub");
      var hit = A.db.teas().filter(function (t) {
        return t.name === name && t.cat === cat && t.sub === sub;
      })[0];
      if (hit) {
        A.formModal({
          title: "检测到重复茶品",
          desc: "茶名 + 茶类 + 亚类已存在：" + hit.name + "（" + hit.id + "），请直接编辑已有条目。",
          okText: "前往编辑", cancelText: "留在本页",
          onSubmit: function () { window.location.href = "tea.html?id=" + hit.id; }
        });
        return true;
      }
      create(status);
      return false;
    }

    function create(status) {
      var tea = A.db.addCreated(collect(status, count()));
      A.db.appendAudit({ action: status === "draft" ? "保存草稿" : "提交审核", target: tea.name + "（" + tea.id + "）", detail: "新建茶品" });
      MM.ui.toast(status === "draft" ? "已保存草稿" : "已提交审核");
      window.location.href = "teas.html?status=" + status;
    }

    document.getElementById("new-save").addEventListener("click", function () {
      if (!checkRequired()) return;
      if (duplicate("draft")) return;
    });
    document.getElementById("new-submit").addEventListener("click", function () {
      if (!checkRequired()) return;
      if (count() < 4) { MM.ui.toast("图鉴需至少 4 张方可提交（当前 " + count() + " 张）"); return; }
      if (duplicate("pending")) return;
    });

    paintSlots();
  }
  A.page("tea-new", renderTeaNew);

  /* ================= A06 图鉴与图片管理 ================= */
  function renderGallery() {
    var teaId = A.param("id") || A.db.teas()[0].id;
    var tea = A.db.tea(teaId) || A.db.teas()[0];
    var orig = MM.config.tea(tea.id) || { name: tea.name, cat: tea.cat, imgs: 4 };
    var imageCount = tea.images;
    var previews = {};

    function paint() {
      var slots = MM.config.imageTypes(orig).map(function (type, i) {
        var has = i < imageCount;
        return '<div class="image-slot' + (has ? "" : " is-empty") + '" data-slot="' + i + '">' +
          (has ? '<img src="' + (previews[i] || MM.config.imageUrl(orig.name, type)) + '" alt="" data-fb-name="' + esc(orig.name) + '" data-fb-type="' + esc(type) + '" data-fb-cat="' + orig.cat + '">'
            : "<div>" + esc(type) + "<br><span class=\"field__hint\">待补图 · 点击上传</span></div>") +
          '<div class="image-slot__label"><span>' + esc(type) + "</span>" +
          (has ? '<button class="btn-link" data-del="' + i + '">删除</button>' : "") + "</div></div>";
      }).join("");

      var userCards = MM.userGallery.filter(function (g) { return g.teaId === tea.id; });
      var userHTML = userCards.length ? '<div class="grid-tea" style="grid-template-columns:repeat(4,1fr)">' +
        userCards.map(function (g) {
          return '<div class="gallery-card"><div class="gallery-card__media"><img src="' + MM.config.imageUrl(orig.name, g.type) +
            '" alt="" data-fb-name="' + esc(orig.name) + '" data-fb-type="' + esc(g.type) + '" data-fb-cat="' + orig.cat + '"></div>' +
            '<div class="gallery-card__meta"><span>' + esc(g.type) + " · " + esc(g.user) + "</span>" +
            '<span class="badge ' + (g.authorized ? "badge--ok" : "badge--reject") + '">' + (g.authorized ? "已授权" : "未授权") + "</span>" +
            '<div class="mt-2"><button class="btn-link" data-adopt="' + g.id + '"' + (g.authorized ? "" : " disabled") + ">采纳</button>" +
            '<button class="btn-link" data-refuse="' + g.id + '">拒绝</button></div></div></div>';
        }).join("") + "</div>" : '<div class="empty-state"><h3>暂无用户实拍</h3><p>该茶品还没有用户补图投稿。</p></div>';

      content(pageHead("图鉴与图片管理", "维护官方图鉴顺序、来源与版权，并审核用户实拍。",
        '<a class="btn btn-secondary" href="tea.html?id=' + encodeURIComponent(tea.id) + '">返回编辑</a>') +
        '<div class="filter-bar"><div class="field field--grow"><label>当前茶品</label><select class="select" id="g-tea">' +
          A.db.teas().map(function (t) {
            return '<option value="' + esc(t.id) + '"' + (t.id === tea.id ? " selected" : "") + ">" + esc(t.name) + "（" + esc(t.id) + "）</option>";
          }).join("") + "</select></div>" +
          '<span class="caption">图数 ' + imageCount + " / " + MM.config.imageTypes(orig).length + "，上架门槛 4 张</span></div>" +
        '<div class="admin-card"><div class="admin-card__head"><h2>官方图鉴</h2><span class="caption">4:3 · ≤5MB · 可拖拽排序（原型点击即上传）</span></div>' +
          '<div class="image-slots">' + slots + "</div>" +
          '<div class="form-grid" style="margin-top:16px">' +
            A.field({ label: "来源类型", name: "g-source", type: "select", value: "editor", options: [
              { value: "editor", label: "编辑自拍" }, { value: "org", label: "机构授权" },
              { value: "stock", label: "商用图库" }, { value: "user", label: "用户书面授权" }
            ] }) +
            A.field({ label: "授权编号", name: "g-license", value: "LIC-2026-0342" }) +
            A.field({ label: "版权声明", name: "g-copy", type: "textarea", full: true, rows: 3, value: "图片版权归茗脉内容团队或授权方所有。" }) +
          "</div></div>" +
        '<div class="admin-card"><div class="admin-card__head"><h2>用户实拍</h2><span class="caption">无书面授权不可采纳</span></div>' + userHTML + "</div>");
      bind();
      A.attachImageFallback(document);
    }

    function bind() {
      document.getElementById("g-tea").addEventListener("change", function () {
        window.location.href = "gallery.html?id=" + encodeURIComponent(this.value);
      });
      MM.dom.qsa("[data-slot]").forEach(function (slot) {
        slot.addEventListener("click", function (e) {
          if (e.target.closest("[data-del]")) {
            imageCount = Math.max(0, imageCount - 1);
            A.db.patch("teas", tea.id, { images: imageCount });
            A.db.appendAudit({ action: "删除图片", target: tea.name, detail: "剩余 " + imageCount + " 张" });
            paint();
            return;
          }
          if (slot.classList.contains("is-empty")) {
            var input = document.createElement("input");
            input.type = "file";
            input.accept = "image/jpeg,image/png,image/webp";
            input.addEventListener("change", function () {
              var f = input.files[0];
              if (!f) return;
              if (f.size > 5 * 1024 * 1024) { MM.ui.toast("图片需小于 5MB"); return; }
              var r = new FileReader();
              r.onload = function () {
                previews[slot.getAttribute("data-slot")] = r.result;
                imageCount = Math.min(5, imageCount + 1);
                A.db.patch("teas", tea.id, { images: imageCount });
                A.db.appendAudit({ action: "上传图片", target: tea.name, detail: "当前 " + imageCount + " 张" });
                MM.ui.toast("已上传 1 张（本地预览）");
                paint();
              };
              r.readAsDataURL(f);
            });
            input.click();
          }
        });
      });
      MM.dom.qsa("[data-adopt]").forEach(function (b) {
        b.addEventListener("click", function () {
          A.confirm({ title: "采纳用户实拍", desc: "采纳后图片将进入官方图鉴，并标注投稿人。", okText: "采纳", kind: "btn-primary", onSubmit: function () {
            A.db.appendAudit({ action: "采纳用户实拍", target: "gallery/" + b.getAttribute("data-adopt"), detail: "已加入官方图鉴" });
            MM.ui.toast("已采纳");
            paint();
          } });
        });
      });
      MM.dom.qsa("[data-refuse]").forEach(function (b) {
        b.addEventListener("click", function () {
          A.confirm({ title: "拒绝用户实拍", reason: true, onSubmit: function (reason) {
            A.db.appendAudit({ action: "拒绝用户实拍", target: "gallery/" + b.getAttribute("data-refuse"), detail: "理由：" + reason });
            MM.ui.toast("已拒绝");
            paint();
          } });
        });
      });
    }

    paint();
  }
  A.page("gallery", renderGallery);

  MM.adminPages = MM.adminPages || {};
  MM.adminPages.dashboard = { crumb: [{ label: "工作台", href: "dashboard.html" }] };
  MM.adminPages.teas = { crumb: [{ label: "工作台", href: "dashboard.html" }, { label: "茶品管理", href: "teas.html" }] };
  MM.adminPages.tea = { crumb: [{ label: "工作台", href: "dashboard.html" }, { label: "茶品管理", href: "teas.html" }, { label: "编辑 / 审核" }] };
  MM.adminPages["tea-new"] = { crumb: [{ label: "工作台", href: "dashboard.html" }, { label: "茶品管理", href: "teas.html" }, { label: "新建茶品" }] };
  MM.adminPages.gallery = { crumb: [{ label: "工作台", href: "dashboard.html" }, { label: "图鉴与图片", href: "gallery.html" }] };
})();
