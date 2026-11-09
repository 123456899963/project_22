/* 茗脉 · 后台页面（二）：审核、治理、系统配置与登录 */
(function () {
  var A = MM.admin;
  var esc = A.esc;
  var content = function (html) { document.getElementById("admin-content").innerHTML = html; };

  function pageHead(title, desc, actions) {
    return '<div class="page-head"><div><h1>' + esc(title) + "</h1>" +
      (desc ? "<p>" + esc(desc) + "</p>" : "") + "</div>" +
      (actions ? '<div class="page-head__actions">' + actions + "</div>" : "") + "</div>";
  }

  function footText(total, extra, page, size) {
    return "<span>共 <b>" + total + "</b> 条" + (extra || "") + "</span>" + A.pagerHTML(total, page, size);
  }

  function downloadCSV(name, text) {
    var blob = new Blob(["\ufeff" + text], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  function withinDays(text, days) {
    if (!days) return true;
    var d = new Date(String(text).replace(/-/g, "/"));
    if (isNaN(d.getTime())) return true;
    return Date.now() - d.getTime() <= Number(days) * 86400000;
  }

  /* ================= A07 投稿审核列表 ================= */
  function renderSubmissions() {
    var state = { type: A.param("type") || "", status: A.param("status") || "", cat: "", days: "", overdue: false, page: 1, size: 10 };

    function list() {
      return A.db.submissions().filter(function (s) {
        if (state.type && s.type !== state.type) return false;
        if (state.status && s.status !== state.status) return false;
        if (state.cat) {
          var t = MM.config.tea(s.teaId);
          if (!t || t.cat !== state.cat) return false;
        }
        if (state.overdue && !(s.status === "pending" && s.timeout)) return false;
        if (!withinDays(s.time, state.days)) return false;
        return true;
      });
    }

    content(pageHead("投稿审核", "审核 T1 品鉴长文、T3 补图与 T4 纠错投稿；超时投稿优先处理。") +
      '<div class="filter-bar">' +
        '<div class="field"><label>类型</label><select class="select" id="s-type"><option value="">全部类型</option>' +
          ["t1", "t3", "t4"].map(function (t) { return '<option value="' + t + '"' + (state.type === t ? " selected" : "") + ">" + A.typeLabel(t) + "</option>"; }).join("") +
        "</select></div>" +
        '<div class="field"><label>状态</label><select class="select" id="s-status"><option value="">全部状态</option>' +
          '<option value="pending"' + (state.status === "pending" ? " selected" : "") + ">待审核</option>" +
          '<option value="approved"' + (state.status === "approved" ? " selected" : "") + ">已通过</option>" +
          '<option value="rejected"' + (state.status === "rejected" ? " selected" : "") + ">已驳回</option></select></div>" +
        '<div class="field"><label>茶类</label><select class="select" id="s-cat">' + A.catOptions(state.cat, true) + "</select></div>" +
        '<div class="field"><label>提交时间</label><select class="select" id="s-days"><option value="">全部</option><option value="7">近 7 天</option><option value="30">近 30 天</option></select></div>' +
        '<label class="check-line"><input type="checkbox" id="s-overdue"> 仅看超时</label>' +
        '<div class="filter-bar__actions"><button class="btn btn-secondary" id="s-reset">重置</button></div>' +
      "</div>" +
      '<div id="s-slot"></div>');

    function table() {
      var rows = list();
      var pages = Math.max(1, Math.ceil(rows.length / state.size));
      if (state.page > pages) state.page = pages;
      var slice = rows.slice((state.page - 1) * state.size, state.page * state.size);
      var columns = [
        { label: "类型", width: "110px", render: function (r) { return '<span class="badge badge--info">' + A.typeLabel(r.type) + "</span>"; } },
        { label: "标题 / 摘要", wrap: true, render: function (r) {
            return '<div><a href="submission.html?id=' + encodeURIComponent(r.id) + '">' + esc(r.title) + '</a><div class="cell-sub">' +
              esc(String(r.title).slice(0, 42)) + " · 重提 " + (2 - (r.retry || 0)) + " 次</div></div>";
          } },
        { label: "关联茶品", render: function (r) {
            var t = MM.config.tea(r.teaId);
            return t ? '<a href="tea.html?id=' + t.id + '">' + esc(t.name) + "</a>" : esc(r.teaId);
          } },
        { label: "提交人", width: "110px", render: function (r) { return esc(r.author); } },
        { label: "提交时间", width: "130px", render: function (r) { return esc(r.time); } },
        { label: "状态", width: "100px", render: function (r) { return A.badge(r.status) + (r.timeout && r.status === "pending" ? ' <span class="overdue-tag">超时</span>' : ""); } },
        { label: "操作", width: "190px", render: function (r) {
            var html = '<div class="cell-actions"><a class="btn-link" href="submission.html?id=' + encodeURIComponent(r.id) + '">详情</a>';
            if (r.status === "pending") {
              html += '<button class="btn-link" data-pass="' + r.id + '">通过</button><button class="btn-link" data-reject="' + r.id + '">驳回</button>';
            }
            return html + "</div>";
          } }
      ];
      slice.forEach(function (r) { r._rowClass = r.status === "pending" && r.timeout ? "is-overdue" : ""; });
      document.getElementById("s-slot").innerHTML = rows.length
        ? A.tableHTML(columns, slice, { foot: footText(rows.length, "", state.page, state.size) })
        : A.emptyTable("没有匹配的投稿", "可调整筛选条件，或等待新的投稿进入队列。");
      A.bindPager(document.getElementById("s-slot"), function (p) { state.page = p; table(); });
      MM.dom.qsa("[data-pass]", document.getElementById("s-slot")).forEach(function (b) {
        b.addEventListener("click", function () {
          var s = A.db.submission(b.getAttribute("data-pass"));
          A.confirm({ title: "通过投稿", desc: "确认通过「" + s.title + "」？", okText: "通过", kind: "btn-primary", onSubmit: function () {
            A.db.reviewSubmission(s.id, { status: "approved", processedAt: A.now() });
            A.db.appendAudit({ action: "通过投稿", target: s.id, detail: s.title });
            MM.ui.toast("已通过");
            table();
          } });
        });
      });
      MM.dom.qsa("[data-reject]", document.getElementById("s-slot")).forEach(function (b) {
        b.addEventListener("click", function () {
          window.location.href = "submission.html?id=" + encodeURIComponent(b.getAttribute("data-reject")) + "&act=reject";
        });
      });
    }

    document.getElementById("s-type").addEventListener("change", function () { state.type = this.value; state.page = 1; table(); });
    document.getElementById("s-status").addEventListener("change", function () { state.status = this.value; state.page = 1; table(); });
    document.getElementById("s-cat").addEventListener("change", function () { state.cat = this.value; state.page = 1; table(); });
    document.getElementById("s-days").addEventListener("change", function () { state.days = this.value; state.page = 1; table(); });
    document.getElementById("s-overdue").addEventListener("change", function () { state.overdue = this.checked; state.page = 1; table(); });
    document.getElementById("s-reset").addEventListener("click", function () {
      state.type = ""; state.status = ""; state.cat = ""; state.days = ""; state.overdue = false; state.page = 1;
      document.getElementById("s-type").value = "";
      document.getElementById("s-status").value = "";
      document.getElementById("s-cat").value = "";
      document.getElementById("s-days").value = "";
      document.getElementById("s-overdue").checked = false;
      table();
    });

    table();
  }
  A.page("submissions", renderSubmissions);

  /* ================= A08 投稿审核详情 ================= */
  function renderSubmission() {
    var s = A.db.submission(A.param("id"));
    if (!s) {
      content(pageHead("投稿审核详情", "未找到投稿。") + A.emptyTable("投稿不存在", "链接参数可能不正确。",
        '<a class="btn btn-secondary" href="submissions.html">返回列表</a>'));
      return;
    }
    var tea = MM.config.tea(s.teaId);
    var done = s.status === "approved" || s.status === "rejected";

    function leftContent() {
      if (s.type === "t1") {
        var bodyText = s.body || "第一次喝这款茶是在朋友家，干茶外形与香气都很干净。按 1:40 的茶水比、90℃ 水温冲泡，前两泡 30 秒出汤，汤色明亮，入口清甜；第三泡开始滋味变淡，回甘仍在。叶底完整，色泽均匀。整体表现与页面描述基本一致，适合作为日常口粮茶。以上为本次品鉴记录，供编辑核对。";
        return '<div class="admin-card"><div class="admin-card__head"><h2>投稿正文</h2><span class="caption">T1 品鉴长文 · 约 ' + bodyText.length + " 字</span></div>" +
          '<blockquote class="quote-block">' + esc(bodyText) + "</blockquote>" +
          '<p class="form-foot-note" style="margin-top:12px">正文需 ≥300 字，且包含至少 1 项可核对的冲泡参数或对照结果。</p></div>';
      }
      if (s.type === "t3") {
        return '<div class="admin-card"><div class="admin-card__head"><h2>补图预览</h2><span class="caption">T3 · 用户已勾选书面授权</span></div>' +
          '<div class="evidence-grid">' + [1, 2, 3].map(function (i) {
            return '<img src="' + MM.config.imageUrl(tea ? tea.name : "茶品", "叶底 " + i) + '" alt="" data-fb-name="' + esc(tea ? tea.name : "茶品") +
              '" data-fb-type="叶底" data-fb-cat="' + (tea ? tea.cat : "green") + '">';
          }).join("") + "</div>" +
          '<p class="form-foot-note" style="margin-top:12px">图片授权：已勾选「本人拥有该图片著作权，并授权茗脉用于展示」。</p></div>';
      }
      return '<div class="admin-card"><div class="admin-card__head"><h2>字段差异</h2><span class="caption">T4 纠错</span></div>' +
        '<table class="diff-table"><thead><tr><th>字段</th><th>原值</th><th>新值</th><th>依据</th></tr></thead><tbody>' +
          '<tr><td>采摘时间</td><td class="old">' + esc(tea ? tea.pick : "4 月中旬") + '</td><td class="is-changed"><span class="new">' + esc(s.body || "4 月中旬～5 月上旬") + "</span></td><td>GB/T 19698</td></tr>" +
          '<tr><td>等级分档</td><td class="old">特级 / 一级</td><td class="is-changed"><span class="new">特级 / 一级 / 二级</span></td><td>产区公开资料</td></tr>' +
        "</tbody></table></div>";
    }

    function render() {
      var readOnly = done;
      content(pageHead("投稿审核详情", "核对内容后通过或驳回；驳回理由不少于 10 字。",
        '<a class="btn btn-secondary" href="submissions.html">返回列表</a>') +
        (s.timeout && !done ? '<div class="drawer-alert">该投稿已超时，请在今日内完成审核。</div>' : "") +
        '<div class="review-layout">' +
          '<div>' + leftContent() +
            '<div class="admin-card"><div class="admin-card__head"><h2>修订历史</h2></div><ul class="meta-list">' +
              '<li><span class="label">提交</span><span class="value">' + esc(s.time) + " · " + esc(s.author) + "</span></li>" +
              (s.processedAt ? '<li><span class="label">处理</span><span class="value">' + esc(s.processedAt) + " · " + (s.status === "approved" ? "通过" : "驳回") + "</span></li>" : "") +
              '<li><span class="label">重提次数</span><span class="value">' + (2 - (s.retry || 0)) + " / 2</span></li>" +
            "</ul></div></div>" +
          '<aside class="admin-card review-panel"><div class="admin-card__head"><h2>审核面板</h2>' + A.badge(s.status) + "</div>" +
            '<ul class="meta-list">' +
              '<li><span class="label">类型</span><span class="value">' + A.typeLabel(s.type) + "</span></li>" +
              '<li><span class="label">关联茶品</span><span class="value">' + (tea ? '<a href="tea.html?id=' + tea.id + '">' + esc(tea.name) + "</a>" : esc(s.teaId)) + "</span></li>" +
              '<li><span class="label">提交人</span><span class="value">' + esc(s.author) + "</span></li>" +
              '<li><span class="label">提交时间</span><span class="value">' + esc(s.time) + "</span></li>" +
            "</ul>" +
            (readOnly
              ? '<div class="drawer-alert drawer-alert--info" style="margin-top:16px">已处理：' + (s.status === "approved" ? "已通过" : "已驳回") + "，当前为只读状态。</div>"
              : '<div class="field" style="margin-top:16px"><label for="r-reason">审核意见（驳回必填）</label><textarea class="textarea" id="r-reason" rows="4" placeholder="不少于 10 字，将同步给投稿人"></textarea></div>' +
                '<div style="display:flex;gap:8px;margin-top:12px"><button class="btn btn-secondary btn-block" id="r-reject">驳回</button>' +
                '<button class="btn btn-primary btn-block" id="r-pass">通过</button></div>') +
          "</aside>" +
        "</div>");
      if (!readOnly) {
        document.getElementById("r-pass").addEventListener("click", function () {
          A.confirm({ title: "通过投稿", desc: "通过后内容将展示在前台对应茶品页。", okText: "通过", kind: "btn-primary", onSubmit: function () {
            A.db.reviewSubmission(s.id, { status: "approved", processedAt: A.now() });
            A.db.appendAudit({ action: "通过投稿", target: s.id, detail: s.title });
            MM.ui.toast("已通过");
            s = A.db.submission(s.id);
            render();
          } });
        });
        document.getElementById("r-reject").addEventListener("click", function () {
          var reason = document.getElementById("r-reason").value.trim();
          if (reason.length < 10) { MM.ui.toast("驳回理由需至少 10 字"); return; }
          A.db.reviewSubmission(s.id, { status: "rejected", processedAt: A.now(), reason: reason });
          A.db.appendAudit({ action: "驳回投稿", target: s.id, detail: "理由：" + reason });
          MM.ui.toast("已驳回");
          s = A.db.submission(s.id);
          render();
        });
      }
      A.attachImageFallback(document);
    }
    render();
  }
  A.page("submission", renderSubmission);

  /* ================= A09 评论审核 ================= */
  function renderComments() {
    var state = { status: A.param("status") || "", tea: "", reported: false, hasImage: false, page: 1, size: 10 };

    function list() {
      return A.db.comments().filter(function (c) {
        if (state.status && c.status !== state.status) return false;
        if (state.tea) {
          var t = MM.config.tea(c.teaId);
          if (!t || t.name.indexOf(state.tea) === -1) return false;
        }
        if (state.reported && !c.reports) return false;
        if (state.hasImage && !c.hasImage) return false;
        return true;
      });
    }

    content(pageHead("评论审核", "评论先审后发；被举报评论优先处理。") +
      '<div class="filter-bar">' +
        '<div class="field"><label>状态</label><select class="select" id="c-status"><option value="">全部状态</option>' +
          '<option value="pending"' + (state.status === "pending" ? " selected" : "") + ">待审核</option>" +
          '<option value="published"' + (state.status === "published" ? " selected" : "") + ">已发布</option></select></div>" +
        '<div class="field field--grow"><label>茶品</label><input class="input" id="c-tea" placeholder="输入茶品名称"></div>' +
        '<label class="check-line"><input type="checkbox" id="c-reported"> 仅看被举报</label>' +
        '<label class="check-line"><input type="checkbox" id="c-image"> 仅看含图</label>' +
        '<div class="filter-bar__actions"><button class="btn btn-secondary" id="c-reset">重置</button></div>' +
      "</div><div id='c-slot'></div>");

    function table() {
      var rows = list();
      var pages = Math.max(1, Math.ceil(rows.length / state.size));
      if (state.page > pages) state.page = pages;
      var slice = rows.slice((state.page - 1) * state.size, state.page * state.size);
      var columns = [
        { label: "评论内容", wrap: true, render: function (c) { return '<div>' + esc(c.content) + '<div class="cell-sub">' + c.id + "</div></div>"; } },
        { label: "茶品", width: "130px", render: function (c) {
            var t = MM.config.tea(c.teaId);
            return t ? '<a href="tea.html?id=' + t.id + '">' + esc(t.name) + "</a>" : esc(c.teaId);
          } },
        { label: "作者", width: "100px", render: function (c) { return esc(c.author); } },
        { label: "时间", width: "130px", render: function (c) { return esc(c.time); } },
        { label: "点赞", width: "64px", render: function (c) { return c.likes; } },
        { label: "举报", width: "64px", render: function (c) { return c.reports ? '<span class="overdue-tag">' + c.reports + " 次</span>" : "—"; } },
        { label: "状态", width: "96px", render: function (c) { return A.badge(c.status); } },
        { label: "操作", width: "180px", render: function (c) {
            return '<div class="cell-actions"><button class="btn-link" data-view="' + c.id + '">详情</button>' +
              (c.status === "pending" ? '<button class="btn-link" data-pass="' + c.id + '">通过</button>' : "") +
              '<button class="btn-link" data-del="' + c.id + '">删除</button></div>';
          } }
      ];
      document.getElementById("c-slot").innerHTML = rows.length
        ? A.tableHTML(columns, slice, { foot: footText(rows.length, "", state.page, state.size) })
        : A.emptyTable("没有匹配的评论", "可调整筛选条件后再试。");
      A.bindPager(document.getElementById("c-slot"), function (p) { state.page = p; table(); });
      bindRow();
    }

    function bindRow() {
      MM.dom.qsa("[data-view]", document.getElementById("c-slot")).forEach(function (b) {
        b.addEventListener("click", function () {
          var c = A.db.comment(b.getAttribute("data-view"));
          var t = MM.config.tea(c.teaId);
          A.openDrawer({
            title: "评论详情",
            subtitle: t ? t.name + " · " + c.author : c.author,
            body: '<div class="quote-block">' + esc(c.content) + "</div>" +
              (c.hasImage ? '<div class="mt-4"><img style="width:100%;border-radius:8px" src="' + MM.config.imageUrl(t ? t.name : "茶", "评论配图") +
                '" alt="" data-fb-name="' + esc(t ? t.name : "茶") + '" data-fb-type="评论配图" data-fb-cat="' + (t ? t.cat : "green") + '"></div>' : "") +
              '<ul class="meta-list mt-4"><li><span class="label">状态</span><span class="value">' + A.badge(c.status) + "</span></li>" +
              '<li><span class="label">点赞</span><span class="value">' + c.likes + "</span></li>" +
              '<li><span class="label">举报</span><span class="value">' + (c.reports || 0) + " 次</span></li>" +
              '<li><span class="label">提交时间</span><span class="value">' + esc(c.time) + "</span></li></ul>",
            foot: c.status === "pending" ? '<button class="btn btn-secondary" id="cd-reject">驳回</button><span class="spacer"></span><button class="btn btn-primary" id="cd-pass">通过</button>' : ""
          });
          A.attachImageFallback(document);
          var pass = document.getElementById("cd-pass");
          if (pass) pass.addEventListener("click", function () {
            A.db.reviewComment(c.id, { status: "published" });
            A.db.appendAudit({ action: "通过评论", target: c.id, detail: c.content.slice(0, 30) });
            MM.ui.toast("已通过");
            document.querySelector(".admin-overlay").click();
            table();
          });
          var rej = document.getElementById("cd-reject");
          if (rej) rej.addEventListener("click", function () {
            A.confirm({ title: "驳回评论", reason: true, onSubmit: function (reason) {
              A.db.reviewComment(c.id, { status: "rejected", reason: reason });
              A.db.appendAudit({ action: "驳回评论", target: c.id, detail: "理由：" + reason });
              MM.ui.toast("已驳回");
              table();
            } });
          });
        });
      });
      MM.dom.qsa("[data-pass]", document.getElementById("c-slot")).forEach(function (b) {
        b.addEventListener("click", function () {
          var c = A.db.comment(b.getAttribute("data-pass"));
          A.db.reviewComment(c.id, { status: "published" });
          A.db.appendAudit({ action: "通过评论", target: c.id, detail: c.content.slice(0, 30) });
          MM.ui.toast("已通过");
          table();
        });
      });
      MM.dom.qsa("[data-del]", document.getElementById("c-slot")).forEach(function (b) {
        b.addEventListener("click", function () {
          var c = A.db.comment(b.getAttribute("data-del"));
          A.confirm({ title: "删除评论", desc: "删除后前台不再展示，后台保留记录。", reason: true, okText: "删除", onSubmit: function (reason) {
            A.db.patch("comments", c.id, { status: "deleted", reason: reason });
            A.db.appendAudit({ action: "删除评论", target: c.id, detail: "理由：" + reason });
            MM.ui.toast("已删除");
            table();
          } });
        });
      });
    }

    document.getElementById("c-status").addEventListener("change", function () { state.status = this.value; state.page = 1; table(); });
    document.getElementById("c-tea").addEventListener("input", MM.dom.debounce(function () {
      state.tea = this.value.trim(); state.page = 1; table();
    }, 250));
    document.getElementById("c-reported").addEventListener("change", function () { state.reported = this.checked; state.page = 1; table(); });
    document.getElementById("c-image").addEventListener("change", function () { state.hasImage = this.checked; state.page = 1; table(); });
    document.getElementById("c-reset").addEventListener("click", function () {
      state.status = ""; state.tea = ""; state.reported = false; state.hasImage = false; state.page = 1;
      document.getElementById("c-status").value = "";
      document.getElementById("c-tea").value = "";
      document.getElementById("c-reported").checked = false;
      document.getElementById("c-image").checked = false;
      table();
    });

    table();
  }
  A.page("comments", renderComments);

  /* ================= A10 标签库 ================= */
  function renderTags() {
    var groups = ["干茶形态", "色泽", "汤色", "发酵度", "香气"];
    var active = 0;

    function paint() {
      var group = groups[active];
      var rows = A.db.tags().filter(function (t) { return t.group === group; });
      var columns = [
        { label: "标签名", render: function (t) { return "<b>" + esc(t.name) + "</b>"; } },
        { label: "所属维度", width: "120px", render: function (t) { return esc(t.group); } },
        { label: "状态", width: "100px", render: function (t) { return A.badge(t.status === "pending" ? "tag_pending" : t.status); } },
        { label: "关联茶品数", width: "110px", render: function (t) { return t.count; } },
        { label: "操作", width: "220px", render: function (t) {
            var html = "";
            if (t.status === "pending") {
              html += '<button class="btn-link" data-tpass="' + esc(t.name) + '">通过</button><button class="btn-link" data-treject="' + esc(t.name) + '">驳回</button>';
            } else if (t.status === "active") {
              html += '<button class="btn-link" data-disable="' + esc(t.name) + '">停用</button><a class="btn-link" href="teas.html?q=' + encodeURIComponent(t.name) + '">查看条目</a>';
            } else {
              html += '<button class="btn-link" data-enable="' + esc(t.name) + '">启用</button>';
            }
            return '<div class="cell-actions">' + html + "</div>";
          } }
      ];
      content(pageHead("标签库", "维护五维受控标签；停用不删除，历史条目仍保留。",
        '<button class="btn btn-primary" id="t-new">提交新标签</button>') +
        '<div class="admin-tabs" id="t-tabs">' + groups.map(function (g, i) {
          var n = A.db.tags().filter(function (t) { return t.group === g && t.status === "pending"; }).length;
          return '<button type="button" data-g="' + i + '" class="' + (i === active ? "is-active" : "") + '">' + g + (n ? "（" + n + " 待审）" : "") + "</button>";
        }).join("") + "</div>" +
        '<div id="t-slot"></div>');
      document.getElementById("t-slot").innerHTML = A.tableHTML(columns, rows, { foot: '<span>共 <b>' + rows.length + "</b> 个标签</span>" });
      MM.dom.qsa("[data-g]", document.getElementById("t-tabs")).forEach(function (b) {
        b.addEventListener("click", function () { active = Number(b.getAttribute("data-g")); paint(); });
      });
      MM.dom.qsa("[data-tpass]", document).forEach(function (b) {
        b.addEventListener("click", function () {
          A.db.patch("tags", group + "|" + b.getAttribute("data-tpass"), { status: "active" });
          A.db.appendAudit({ action: "新增标签", target: group + "：" + b.getAttribute("data-tpass"), detail: "标签审核通过" });
          MM.ui.toast("已通过");
          paint();
        });
      });
      MM.dom.qsa("[data-treject]", document).forEach(function (b) {
        b.addEventListener("click", function () {
          A.confirm({ title: "驳回新标签", reason: true, onSubmit: function (reason) {
            A.db.patch("tags", group + "|" + b.getAttribute("data-treject"), { status: "disabled" });
            A.db.appendAudit({ action: "驳回标签", target: b.getAttribute("data-treject"), detail: "理由：" + reason });
            MM.ui.toast("已驳回");
            paint();
          } });
        });
      });
      MM.dom.qsa("[data-disable]", document).forEach(function (b) {
        b.addEventListener("click", function () {
          A.db.patch("tags", group + "|" + b.getAttribute("data-disable"), { status: "disabled" });
          A.db.appendAudit({ action: "停用标签", target: b.getAttribute("data-disable"), detail: "停用后不出现在新选择项" });
          MM.ui.toast("已停用");
          paint();
        });
      });
      MM.dom.qsa("[data-enable]", document).forEach(function (b) {
        b.addEventListener("click", function () {
          A.db.patch("tags", group + "|" + b.getAttribute("data-enable"), { status: "active" });
          MM.ui.toast("已启用");
          paint();
        });
      });
      document.getElementById("t-new").addEventListener("click", function () {
        A.formModal({
          title: "提交新标签",
          desc: "新标签需审核通过后才可被选用。",
          body: '<div class="field"><label>所属维度</label><select class="select" data-field="group">' +
            groups.map(function (g) { return '<option value="' + g + '"' + (g === groups[active] ? " selected" : "") + ">" + g + "</option>"; }).join("") +
            '</select></div><div class="field" style="margin-top:10px"><label>标签名</label><input class="input" data-field="name" placeholder="如 兰花香"></div>',
          okText: "提交审核",
          validate: function (v) {
            if (!v.name) return "请填写标签名";
            if (A.db.tags().some(function (t) { return t.group === v.group && t.name === v.name; })) return "同维度下已存在该标签";
            return "";
          },
          onSubmit: function (v) {
            var st = MM.store.read("mm_admin_state", {});
            if (!st.tags) st.tags = {};
            st.tags[v.group + "|" + v.name] = { group: v.group, name: v.name, status: "pending", count: 0 };
            MM.store.write("mm_admin_state", st);
            A.db.appendAudit({ action: "新增标签", target: v.group + "：" + v.name, detail: "提交标签入库审核" });
            MM.ui.toast("已提交审核");
            paint();
          }
        });
      });
    }
    paint();
  }
  A.page("tags", renderTags);

  /* ================= A11 分类与亚类 ================= */
  function renderCategories() {
    var activeCat = MM.categories[0].id;

    function paint() {
      var cat = MM.config.category(activeCat);
      var rows = cat.subs.map(function (sub) {
        return {
          sub: sub,
          count: MM.config.subCount(cat.id, sub),
          status: A.db.categoryStatus(cat.id, sub),
          changed: "2026-10-30"
        };
      });
      var columns = [
        { label: "亚类", render: function (r) { return "<b>" + esc(r.sub) + "</b>"; } },
        { label: "茶品数", width: "100px", render: function (r) { return r.count; } },
        { label: "状态", width: "130px", render: function (r) {
            return A.badge(r.status === "building" ? "building" : "normal");
          } },
        { label: "最后变更", width: "120px", render: function (r) { return esc(r.changed); } },
        { label: "操作", width: "230px", render: function (r) {
            return '<div class="cell-actions"><button class="btn-link" data-toggle="' + esc(r.sub) + '">' +
              (r.status === "building" ? "转为正常" : "设为建设中") + "</button>" +
              '<a class="btn-link" href="teas.html?cat=' + cat.id + "&amp;sub=" + encodeURIComponent(r.sub) + '">查看茶品</a></div>';
          } }
      ];
      content(pageHead("分类与亚类", "V1 固定 6 茶类 / 23 亚类，不可新增或删除；可切换空亚类状态。") +
        '<div class="cat-layout"><div class="admin-card cat-list" id="cat-list">' +
          MM.categories.map(function (c) {
            return '<button type="button" data-cat="' + c.id + '" class="' + (c.id === activeCat ? "is-active" : "") + '">' +
              '<span><span class="swatch" style="background:' + c.color + ';display:inline-block;margin-right:6px"></span>' + c.name + "</span>" +
              "<span>" + MM.config.teasOf(c.id).length + "</span></button>";
          }).join("") + "</div>" +
          '<div class="admin-card"><div class="admin-card__head"><h2>' + cat.name + " · 亚类</h2><span class=\"caption\">每亚类目标 2 款，共 46 款</span></div>" +
            A.tableHTML(columns, rows, { foot: '<span>共 <b>' + rows.length + "</b> 个亚类</span>" }) +
          "</div></div>");
      MM.dom.qsa("[data-cat]", document.getElementById("cat-list")).forEach(function (b) {
        b.addEventListener("click", function () { activeCat = b.getAttribute("data-cat"); paint(); });
      });
      MM.dom.qsa("[data-toggle]", document).forEach(function (b) {
        b.addEventListener("click", function () {
          var sub = b.getAttribute("data-toggle");
          var cur = A.db.categoryStatus(cat.id, sub);
          A.confirm({
            title: cur === "building" ? "转为正常" : "设为内容建设中",
            desc: cur === "building" ? "该亚类将展示为正常可浏览状态。" : "前台该亚类将显示「内容建设中」。",
            okText: "确认",
            kind: "btn-primary",
            onSubmit: function () {
              A.db.patch("categories", cat.id + "|" + sub, { status: cur === "building" ? "normal" : "building" });
              A.db.appendAudit({ action: "切换亚类状态", target: cat.name + " / " + sub, detail: cur + " → " + (cur === "building" ? "normal" : "building") });
              MM.ui.toast("状态已更新（前台同步生效）");
              paint();
            }
          });
        });
      });
    }
    paint();
  }
  A.page("categories", renderCategories);

  /* ================= A12 批量导入 ================= */
  function renderImport() {
    var step = 1;
    var rows = [];
    var fileName = "";

    function stepsHTML() {
      return '<div class="steps">' + ["下载模板", "上传文件", "校验预览", "确认导入"].map(function (t, i) {
        var n = i + 1;
        return '<div class="step ' + (n === step ? "is-active" : n < step ? "is-done" : "") + '"><span class="step__num">' + n + "</span>" + t + "</div>" +
          (n < 4 ? '<span class="step__line"></span>' : "");
      }).join("") + "</div>";
    }

    function paint() {
      var resultHTML = "";
      if (rows.length) {
        var ok = rows.filter(function (r) { return r.ok; }).length;
        var bad = rows.length - ok;
        resultHTML = '<div class="admin-card"><div class="admin-card__head"><h2>校验结果</h2>' +
          '<span class="caption">成功 ' + ok + " / 失败 " + bad + " / 共 " + rows.length + " 行</span></div>" +
          (bad ? '<div class="drawer-alert">存在 ' + bad + " 行未通过校验，需全部通过后才允许导入（本页按「全部校验通过才允许导入」呈现）。</div>" : '<div class="drawer-alert drawer-alert--info">全部校验通过，可以导入。</div>') +
          '<table class="diff-table"><thead><tr><th>行号</th><th>茶名</th><th>茶类</th><th>亚类</th><th>校验结果</th></tr></thead><tbody>' +
          rows.map(function (r, i) {
            return "<tr><td>" + (i + 1) + "</td><td>" + esc(r.name) + "</td><td>" + esc(r.catLabel) + "</td><td>" + esc(r.sub) + "</td><td>" +
              (r.ok ? '<span class="badge badge--ok">通过</span>' : '<span class="badge badge--reject">' + esc(r.reason) + "</span>") + "</td></tr>";
          }).join("") + "</tbody></table></div>";
      }
      content(pageHead("批量导入", "支持 xlsx / csv，≤20MB；导入后统一保存为草稿。",
        '<button class="btn btn-secondary" id="i-template">下载模板</button>') +
        '<div class="admin-card">' + stepsHTML() +
          '<div class="upload-zone mt-4" id="i-zone"><b>点击或拖拽上传文件</b>支持 xlsx / csv，单文件不超过 20MB</div>' +
          (fileName ? '<p class="form-foot-note mt-2">已选择：' + esc(fileName) + "</p>" : "") +
          '<p class="form-foot-note mt-2">模板字段：茶名（必填）、茶类（必填）、亚类（必填）、产地、等级、生产年份、采摘时间、标准号。</p>' +
        "</div>" + resultHTML +
        (rows.length ? '<div class="page-head__actions" style="justify-content:flex-end;margin-top:16px">' +
          '<button class="btn btn-secondary" id="i-cancel">取消</button>' +
          '<button class="btn btn-primary" id="i-confirm"' + (rows.some(function (r) { return !r.ok; }) ? " disabled" : "") + ">确认导入</button></div>" : ""));

      document.getElementById("i-template").addEventListener("click", function () {
        downloadCSV("茗脉茶品导入模板.csv", "茶名,茶类,亚类,产地,等级,生产年份,采摘时间,标准号\n示例茶,绿茶,炒青,浙江杭州,特级,2026,3 月下旬,GB/T 18650\n");
        MM.ui.toast("模板已下载");
      });
      document.getElementById("i-zone").addEventListener("click", function () {
        var input = document.createElement("input");
        input.type = "file";
        input.accept = ".csv,.xlsx,.xls";
        input.addEventListener("change", function () {
          var f = input.files[0];
          if (!f) return;
          if (f.size > 20 * 1024 * 1024) { MM.ui.toast("文件需小于 20MB"); return; }
          fileName = f.name;
          step = 3;
          if (/\.csv$/i.test(f.name)) {
            var reader = new FileReader();
            reader.onload = function () {
              parseCSV(String(reader.result));
              paint();
            };
            reader.readAsText(f, "utf-8");
          } else {
            rows = [];
            for (var i = 0; i < 12; i++) {
              rows.push({ name: "导入示例茶 " + (i + 1), catLabel: "绿茶", cat: "green", sub: "炒青", ok: true });
            }
            rows[9] = { name: "重复条目", catLabel: "绿茶", cat: "green", sub: "炒青", ok: false, reason: "茶名+茶类+亚类重复" };
            rows[11] = { name: "缺少亚类", catLabel: "青茶", cat: "oolong", sub: "", ok: false, reason: "亚类缺失" };
            MM.ui.toast("xlsx 为演示解析结果：10 成功 / 2 失败");
            paint();
          }
        });
        input.click();
      });
      var confirm = document.getElementById("i-confirm");
      if (confirm) {
        confirm.addEventListener("click", function () {
          A.confirm({
            title: "确认导入", desc: "将导入 " + rows.length + " 条茶品，状态统一为草稿。", okText: "导入", kind: "btn-primary",
            onSubmit: function () {
              rows.forEach(function (r) {
                A.db.addCreated({
                  id: "import-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
                  name: r.name, cat: r.cat, sub: r.sub, status: "draft", images: 0,
                  updated: A.now().slice(0, 10), submitter: (A.session() || {}).nick || "管理员", timeout: false
                });
              });
              A.db.appendAudit({ action: "批量导入", target: fileName, detail: "成功导入 " + rows.length + " 条草稿" });
              MM.ui.toast("已导入 " + rows.length + " 条草稿");
              window.location.href = "teas.html?status=draft";
            }
          });
        });
      }
      var cancel = document.getElementById("i-cancel");
      if (cancel) cancel.addEventListener("click", function () { rows = []; fileName = ""; step = 1; paint(); });
    }

    function parseCSV(text) {
      var lines = text.replace(/\r/g, "").split("\n").filter(function (l) { return l.trim(); });
      rows = [];
      if (!lines.length) return;
      var header = lines[0].split(",");
      ["茶名", "茶类", "亚类"].forEach(function (need, idx) {
        if (header.indexOf(need) === -1) {
          rows.push({ name: "表头缺少「" + need + "」", catLabel: "—", cat: "green", sub: "", ok: false, reason: "表头字段缺失" });
        }
      });
      lines.slice(1).forEach(function (line) {
        var cells = line.split(",");
        var name = (cells[0] || "").trim();
        var catText = (cells[1] || "").trim();
        var sub = (cells[2] || "").trim();
        var cat = MM.categories.filter(function (c) { return c.name === catText || c.id === catText; })[0];
        var ok = !!name && !!cat && !!sub;
        var reason = !name ? "茶名缺失" : !cat ? "茶类无法识别" : !sub ? "亚类缺失" : "";
        rows.push({ name: name || "（空）", catLabel: cat ? cat.name : catText || "（空）", cat: cat ? cat.id : "green", sub: sub, ok: ok, reason: reason });
      });
      step = 3;
    }

    paint();
  }
  A.page("import", renderImport);

  /* ================= A13 举报 / 投诉列表 ================= */
  function renderReports() {
    var state = { type: "", status: A.param("status") || "", overdue: A.param("overdue") === "1", page: 1, size: 10 };
    var types = ["版权侵权", "广告导流", "内容不实", "违法违规"];

    function list() {
      return A.db.reports().filter(function (r) {
        if (state.type && r.type !== state.type) return false;
        if (state.status && r.status !== state.status) return false;
        if (state.overdue && (!r.timeout || r.status === "resolved")) return false;
        return true;
      });
    }

    content(pageHead("投诉处理", "处理图片、评论与字段举报，承诺 48 小时内首次响应。") +
      '<div class="filter-bar">' +
        '<div class="field"><label>举报类型</label><select class="select" id="rp-type"><option value="">全部类型</option>' +
          types.map(function (t) { return '<option value="' + t + '"' + (state.type === t ? " selected" : "") + ">" + t + "</option>"; }).join("") + "</select></div>" +
        '<div class="field"><label>状态</label><select class="select" id="rp-status"><option value="">全部状态</option>' +
          '<option value="pending"' + (state.status === "pending" ? " selected" : "") + ">待受理</option>" +
          '<option value="processing"' + (state.status === "processing" ? " selected" : "") + ">处理中</option>" +
          '<option value="resolved"' + (state.status === "resolved" ? " selected" : "") + ">已处理</option></select></div>" +
        '<label class="check-line"><input type="checkbox" id="rp-overdue"' + (state.overdue ? " checked" : "") + "> 仅看超时</label>" +
        '<div class="filter-bar__actions"><button class="btn btn-secondary" id="rp-reset">重置</button></div>' +
      "</div><div id=\"rp-slot\"></div>");

    function table() {
      var rows = list();
      var pages = Math.max(1, Math.ceil(rows.length / state.size));
      if (state.page > pages) state.page = pages;
      var slice = rows.slice((state.page - 1) * state.size, state.page * state.size);
      var columns = [
        { label: "举报对象", wrap: true, render: function (r) { return '<a href="report.html?id=' + r.id + '">' + esc(r.target) + "</a>"; } },
        { label: "类型", width: "110px", render: function (r) { return '<span class="badge badge--info">' + esc(r.type) + "</span>"; } },
        { label: "举报人", width: "100px", render: function (r) { return esc(r.reporter); } },
        { label: "时间", width: "130px", render: function (r) { return esc(r.time); } },
        { label: "响应时长", width: "130px", render: function (r) { return A.remainText(r); } },
        { label: "状态", width: "96px", render: function (r) {
            var b = r.status === "pending" ? "pending_report" : r.status;
            return A.badge(b);
          } },
        { label: "操作", width: "150px", render: function (r) {
            var html = '<div class="cell-actions"><a class="btn-link" href="report.html?id=' + r.id + '">详情</a>';
            if (r.status === "pending") html += '<button class="btn-link" data-accept="' + r.id + '">受理</button>';
            return html + "</div>";
          } }
      ];
      slice.forEach(function (r) { r._rowClass = r.timeout && r.status !== "resolved" ? "is-overdue" : ""; });
      document.getElementById("rp-slot").innerHTML = rows.length
        ? A.tableHTML(columns, slice, { foot: footText(rows.length, "", state.page, state.size) })
        : A.emptyTable("没有匹配的举报", "可调整筛选条件后再试。");
      A.bindPager(document.getElementById("rp-slot"), function (p) { state.page = p; table(); });
      MM.dom.qsa("[data-accept]", document.getElementById("rp-slot")).forEach(function (b) {
        b.addEventListener("click", function () {
          var r = A.db.report(b.getAttribute("data-accept"));
          A.db.patch("reports", r.id, { status: "processing" });
          A.db.appendAudit({ action: "受理投诉", target: r.id, detail: r.target });
          MM.ui.toast("已受理");
          table();
        });
      });
    }

    document.getElementById("rp-type").addEventListener("change", function () { state.type = this.value; state.page = 1; table(); });
    document.getElementById("rp-status").addEventListener("change", function () { state.status = this.value; state.page = 1; table(); });
    document.getElementById("rp-overdue").addEventListener("change", function () { state.overdue = this.checked; state.page = 1; table(); });
    document.getElementById("rp-reset").addEventListener("click", function () {
      state.type = ""; state.status = ""; state.overdue = false; state.page = 1;
      document.getElementById("rp-type").value = "";
      document.getElementById("rp-status").value = "";
      document.getElementById("rp-overdue").checked = false;
      table();
    });
    table();
  }
  A.page("reports", renderReports);

  /* ================= A14 投诉处理详情 ================= */
  function renderReportDetail() {
    var r = A.db.report(A.param("id"));
    if (!r) {
      content(pageHead("投诉处理详情", "未找到该投诉。") + A.emptyTable("投诉不存在", "链接参数可能不正确。",
        '<a class="btn btn-secondary" href="reports.html">返回列表</a>'));
      return;
    }
    var superAdmin = (A.session() || {}).role === "super";

    function render() {
      var done = r.status === "resolved";
      content(pageHead("投诉处理详情", "判定举报是否成立，执行下架 / 删除 / 驳回，并处理申诉。",
        '<a class="btn btn-secondary" href="reports.html">返回列表</a>') +
        (r.timeout && !done ? '<div class="drawer-alert">该投诉已超过 48 小时响应时限。</div>' : "") +
        '<div class="review-layout"><div>' +
          '<div class="admin-card"><div class="admin-card__head"><h2>举报对象与证据</h2>' + A.badge(done ? "resolved" : r.status) + "</div>" +
            '<ul class="meta-list"><li><span class="label">对象</span><span class="value">' + esc(r.target) + "</span></li>" +
            '<li><span class="label">举报类型</span><span class="value">' + esc(r.type) + "</span></li>" +
            '<li><span class="label">举报人</span><span class="value">' + esc(r.reporter) + "</span></li>" +
            '<li><span class="label">提交时间</span><span class="value">' + esc(r.time) + "</span></li>" +
            '<li><span class="label">响应时限</span><span class="value">' + (r.timeout ? '<span class="overdue-tag">已超时</span>' : "剩余 12 小时") + "</span></li></ul>" +
            '<div class="evidence-grid mt-4">' + (function () {
              var n = typeof r.evidenceCount === "number" ? r.evidenceCount : 3;
              if (!n) return '<p class="caption">举报人未上传证据材料。</p>';
              return [1, 2, 3].slice(0, n).map(function (i) {
                return '<img src="' + MM.config.imageUrl("举报证据", "截图 " + i) + '" alt="" data-fb-name="举报证据" data-fb-type="截图" data-fb-cat="green">';
              }).join("");
            })() + "</div>" +
            '<p class="form-foot-note mt-2">举报说明：' +
              esc(r.note || "该内容疑似侵犯第三方著作权，举报人已上传 3 张对比截图。") + "</p>" +
          "</div>" +
          '<div class="admin-card"><div class="admin-card__head"><h2>处理记录</h2></div><ul class="meta-list">' +
            '<li><span class="label">受理人</span><span class="value">' + esc(r.handler || "—") + "</span></li>" +
            '<li><span class="label">处理结果</span><span class="value">' + esc(r.resolution || "—") + "</span></li>" +
            '<li><span class="label">通知作者</span><span class="value">' + (done ? "已通知" : "未通知") + "</span></li></ul></div>" +
          (superAdmin ? '<div class="admin-card"><div class="admin-card__head"><h2>申诉复核</h2><span class="caption">仅超级管理员可操作</span></div>' +
            '<p class="form-foot-note">当前无待复核申诉。历史申诉记录将保留原处理结果。</p></div>' : "") +
        "</div>" +
        '<aside class="admin-card review-panel"><div class="admin-card__head"><h2>处理面板</h2></div>' +
          (done
            ? '<div class="drawer-alert drawer-alert--info">已处理：' + esc(r.resolution || "举报成立") + "。本页为只读。</div>"
            : '<div class="field"><label>判定</label><select class="select" id="rp-verdict"><option value="valid">举报成立</option><option value="invalid">举报不成立</option></select></div>' +
              '<div class="field" style="margin-top:10px"><label>处理动作</label><select class="select" id="rp-action"><option value="offline">下架内容</option><option value="delete">删除内容</option><option value="dismiss">驳回举报</option></select></div>' +
              '<div class="field" style="margin-top:10px"><label>处理说明</label><textarea class="textarea" id="rp-note" rows="3" placeholder="不少于 10 字，将记录到审计日志"></textarea></div>' +
              '<label class="check-line" style="margin-top:10px"><input type="checkbox" id="rp-notify" checked> 通知作者</label>' +
              '<button class="btn btn-primary btn-block" id="rp-submit" style="margin-top:14px">提交处理</button>') +
        "</aside></div>");
      A.attachImageFallback(document);
      var submit = document.getElementById("rp-submit");
      if (submit) submit.addEventListener("click", function () {
        var note = document.getElementById("rp-note").value.trim();
        if (note.length < 10) { MM.ui.toast("处理说明需至少 10 字"); return; }
        A.confirm({ title: "确认处理结果", desc: "处理后将通知举报人与作者，并写入审计日志。", okText: "确认", kind: "btn-primary", onSubmit: function () {
          A.db.resolveReport(r.id, {
            status: "resolved",
            handler: (A.session() || {}).nick,
            resolution: document.getElementById("rp-verdict").value === "valid" ? "举报成立" : "举报不成立",
            action: document.getElementById("rp-action").value,
            note: note
          });
          A.db.appendAudit({ action: "处理投诉", target: r.id, detail: note });
          MM.ui.toast("已处理");
          r = A.db.report(r.id);
          render();
        } });
      });
    }
    render();
  }
  A.page("report", renderReportDetail);

  /* ================= A15 用户管理 ================= */
  function renderUsers() {
    var state = { q: "", status: "", page: 1, size: 10 };

    function list() {
      return A.db.users().filter(function (u) {
        if (state.status && u.status !== state.status) return false;
        if (state.q && (u.nick + u.id).indexOf(state.q) === -1) return false;
        return true;
      });
    }

    content(pageHead("用户管理", "查询用户、执行禁言 / 封禁并查看处罚记录。") +
      '<div class="filter-bar">' +
        '<div class="field field--grow"><label>昵称 / openid</label><input class="input" id="u-q" placeholder="输入昵称或 openid 片段"></div>' +
        '<div class="field"><label>账号状态</label><select class="select" id="u-status"><option value="">全部状态</option>' +
          '<option value="normal">正常</option><option value="muted">禁言</option><option value="banned">封禁</option></select></div>' +
        '<div class="filter-bar__actions"><button class="btn btn-secondary" id="u-reset">重置</button></div>' +
      "</div><div id=\"u-slot\"></div>");

    function table() {
      var rows = list();
      var pages = Math.max(1, Math.ceil(rows.length / state.size));
      if (state.page > pages) state.page = pages;
      var slice = rows.slice((state.page - 1) * state.size, state.page * state.size);
      var columns = [
        { label: "用户", render: function (u) {
            return '<div class="cell-main"><span class="avatar" style="width:28px;height:28px;font-size:12px;background:#8c9a96">' +
              esc(u.nick.slice(0, 1)) + '</span><div><b>' + esc(u.nick) + '</b><div class="cell-sub">mock-****' + u.id + "</div></div></div>";
          } },
        { label: "状态", width: "96px", render: function (u) { return A.badge(u.status); } },
        { label: "收藏", width: "72px", render: function (u) { return u.favs; } },
        { label: "投稿", width: "72px", render: function (u) { return u.subs; } },
        { label: "注册时间", width: "110px", render: function (u) { return esc(u.joined); } },
        { label: "最近活跃", width: "110px", render: function (u) { return esc(u.lastActive); } },
        { label: "操作", width: "220px", render: function (u) {
            var html = '<div class="cell-actions"><button class="btn-link" data-detail="' + u.id + '">详情</button>';
            if (u.status === "normal") {
              html += '<button class="btn-link" data-mute="' + u.id + '">禁言</button><button class="btn-link" data-ban="' + u.id + '">封禁</button>';
            } else if (u.status === "muted") {
              html += '<button class="btn-link" data-unmute="' + u.id + '">解除禁言</button><button class="btn-link" data-ban="' + u.id + '">封禁</button>';
            } else {
              html += '<button class="btn-link" data-unban="' + u.id + '">解除封禁</button>';
            }
            return html + "</div>";
          } }
      ];
      document.getElementById("u-slot").innerHTML = rows.length
        ? A.tableHTML(columns, slice, { foot: footText(rows.length, "", state.page, state.size) })
        : A.emptyTable("没有匹配的用户", "可调整筛选条件后再试。");
      A.bindPager(document.getElementById("u-slot"), function (p) { state.page = p; table(); });
      bindRows();
    }

    function bindRows() {
      MM.dom.qsa("[data-detail]", document.getElementById("u-slot")).forEach(function (b) {
        b.addEventListener("click", function () {
          var u = A.db.user(b.getAttribute("data-detail"));
          var logs = A.db.audit().filter(function (l) { return String(l.target).indexOf(u.nick) > -1; });
          A.openDrawer({
            title: "用户详情",
            subtitle: "mock-****" + u.id,
            body: '<ul class="meta-list"><li><span class="label">昵称</span><span class="value">' + esc(u.nick) + "</span></li>" +
              '<li><span class="label">账号状态</span><span class="value">' + A.badge(u.status) + "</span></li>" +
              '<li><span class="label">注册时间</span><span class="value">' + esc(u.joined) + "</span></li>" +
              '<li><span class="label">收藏 / 投稿</span><span class="value">' + u.favs + " / " + u.subs + "</span></li></ul>" +
              '<div class="form-section"><h3>处罚记录</h3>' +
              (logs.length ? '<ul class="meta-list">' + logs.map(function (l) {
                return '<li><span class="label">' + esc(l.time) + '</span><span class="value">' + esc(l.action + " · " + l.detail) + "</span></li>";
              }).join("") + "</ul>" : '<p class="form-foot-note">暂无处罚记录。</p>') +
              "</div>"
          });
          A.attachImageFallback(document);
        });
      });
      MM.dom.qsa("[data-mute]", document.getElementById("u-slot")).forEach(function (b) {
        b.addEventListener("click", function () {
          var u = A.db.user(b.getAttribute("data-mute"));
          A.formModal({
            title: "禁言用户：" + u.nick,
            body: '<div class="field"><label>禁言时长</label><select class="select" data-field="days"><option value="1">1 天</option><option value="7" selected>7 天</option><option value="30">30 天</option></select></div>' +
              '<div class="field" style="margin-top:10px"><label>原因<span class="required">*</span></label><textarea class="textarea" data-field="reason" rows="3" placeholder="不少于 10 字"></textarea></div>',
            okText: "确认禁言",
            validate: function (v) { return v.reason.length < 10 ? "请填写至少 10 个字的原因" : ""; },
            onSubmit: function (v) {
              A.db.patch("users", u.id, { status: "muted", reason: v.reason, until: v.days + " 天" });
              A.db.appendAudit({ action: "禁言", target: u.nick + "（" + u.id + "）", detail: "禁言 " + v.days + " 天，原因：" + v.reason });
              MM.ui.toast("已禁言 " + v.days + " 天");
              table();
            }
          });
        });
      });
      MM.dom.qsa("[data-ban]", document.getElementById("u-slot")).forEach(function (b) {
        b.addEventListener("click", function () {
          var u = A.db.user(b.getAttribute("data-ban"));
          A.confirm({ title: "封禁用户：" + u.nick, desc: "封禁后该用户无法登录、评论与投稿。", reason: true, okText: "确认封禁", onSubmit: function (reason) {
            A.db.patch("users", u.id, { status: "banned", reason: reason });
            A.db.appendAudit({ action: "封禁", target: u.nick + "（" + u.id + "）", detail: "原因：" + reason });
            MM.ui.toast("已封禁");
            table();
          } });
        });
      });
      MM.dom.qsa("[data-unmute]", document.getElementById("u-slot")).forEach(function (b) {
        b.addEventListener("click", function () {
          var u = A.db.user(b.getAttribute("data-unmute"));
          A.confirm({ title: "解除禁言", desc: "解除后用户可恢复评论与投稿。", okText: "解除", kind: "btn-primary", onSubmit: function () {
            A.db.patch("users", u.id, { status: "normal", reason: "" });
            A.db.appendAudit({ action: "解除禁言", target: u.nick, detail: "提前解除" });
            MM.ui.toast("已解除禁言");
            table();
          } });
        });
      });
      MM.dom.qsa("[data-unban]", document.getElementById("u-slot")).forEach(function (b) {
        b.addEventListener("click", function () {
          var u = A.db.user(b.getAttribute("data-unban"));
          A.confirm({ title: "解除封禁", desc: "解除后用户可重新登录。", okText: "解除", kind: "btn-primary", onSubmit: function () {
            A.db.patch("users", u.id, { status: "normal", reason: "" });
            A.db.appendAudit({ action: "解除封禁", target: u.nick, detail: "解除封禁" });
            MM.ui.toast("已解除封禁");
            table();
          } });
        });
      });
    }

    document.getElementById("u-q").addEventListener("input", MM.dom.debounce(function () {
      state.q = this.value.trim(); state.page = 1; table();
    }, 250));
    document.getElementById("u-status").addEventListener("change", function () { state.status = this.value; state.page = 1; table(); });
    document.getElementById("u-reset").addEventListener("click", function () {
      state.q = ""; state.status = ""; state.page = 1;
      document.getElementById("u-q").value = "";
      document.getElementById("u-status").value = "";
      table();
    });
    table();
  }
  A.page("users", renderUsers);

  /* ================= A16 管理员白名单 ================= */
  function renderAdmins() {
    function paint() {
      var admins = A.db.admins().filter(function (a) { return !a.removed; });
      var superCount = admins.filter(function (a) { return a.role === "super"; }).length;
      var columns = [
        { label: "管理员", render: function (a) { return "<b>" + esc(a.nick) + "</b>"; } },
        { label: "openid", render: function (a) { return esc(a.openid); } },
        { label: "角色", width: "130px", render: function (a) { return '<span class="badge ' + (a.role === "super" ? "badge--info" : "badge--ok") + '">' + A.roleText(a.role) + "</span>"; } },
        { label: "添加时间", width: "120px", render: function (a) { return esc(a.since); } },
        { label: "操作", width: "240px", render: function (a) {
            var html = '<div class="cell-actions">';
            if (a.role !== "super") html += '<button class="btn-link" data-super="' + a.id + '">设为超管</button>';
            html += '<button class="btn-link" data-remove="' + a.id + '"' + (a.role === "super" && superCount <= 1 ? " disabled" : "") + ">移除</button></div>";
            return html;
          } }
      ];
      content(pageHead("管理员白名单", "管理员身份按 openid 判定；超级管理员至少保留 1 名。",
        '<button class="btn btn-primary" id="a-add">添加管理员</button>') +
        '<div class="admin-card"><div class="drawer-alert drawer-alert--info">安全提示：添加、移除与设为超管均需二次确认，并写入审计日志。</div>' +
          A.tableHTML(columns, admins, { foot: '<span>当前超级管理员 <b>' + superCount + "</b> 名；删除、封禁等高风险操作需谨慎。</span>" }) +
        "</div>");
      MM.dom.qsa("[data-super]", document).forEach(function (b) {
        b.addEventListener("click", function () {
          var a = A.db.admins().filter(function (x) { return x.id === b.getAttribute("data-super"); })[0];
          A.confirm({ title: "设为超级管理员", desc: "超级管理员可配置白名单与系统参数，请谨慎操作。", okText: "确认", kind: "btn-primary", onSubmit: function () {
            A.db.patch("admins", a.id, { role: "super" });
            A.db.appendAudit({ action: "设为超管", target: a.nick, detail: "角色变更" });
            MM.ui.toast("已设为超级管理员");
            paint();
          } });
        });
      });
      MM.dom.qsa("[data-remove]", document).forEach(function (b) {
        b.addEventListener("click", function () {
          var a = A.db.admins().filter(function (x) { return x.id === b.getAttribute("data-remove"); })[0];
          A.confirm({ title: "移除管理员", desc: "移除后该 openid 将无法进入后台。", reason: true, okText: "移除", onSubmit: function (reason) {
            A.db.patch("admins", a.id, { removed: true });
            A.db.appendAudit({ action: "移除管理员", target: a.nick, detail: "原因：" + reason });
            MM.ui.toast("已移除");
            paint();
          } });
        });
      });
      document.getElementById("a-add").addEventListener("click", function () {
        A.formModal({
          title: "添加管理员",
          desc: "仅支持已关注公众号的 openid。",
          body: '<div class="field"><label>openid<span class="required">*</span></label><input class="input" data-field="openid" placeholder="如 mock-openid-****0002"></div>' +
            '<div class="field" style="margin-top:10px"><label>昵称<span class="required">*</span></label><input class="input" data-field="nick"></div>' +
            '<div class="field" style="margin-top:10px"><label>角色</label><select class="select" data-field="role"><option value="admin">管理员</option><option value="super">超级管理员</option></select></div>',
          okText: "添加",
          validate: function (v) {
            if (!v.openid || v.openid.length < 8) return "请填写有效 openid";
            if (!v.nick) return "请填写昵称";
            if (A.db.admins().some(function (a) { return a.openid === v.openid && !a.removed; })) return "该 openid 已存在";
            return "";
          },
          onSubmit: function (v) {
            A.db.addAdmin({ id: "a-" + Date.now(), nick: v.nick, openid: v.openid, role: v.role, since: A.now().slice(0, 10) });
            A.db.appendAudit({ action: "添加管理员", target: v.nick, detail: v.openid });
            MM.ui.toast("已添加");
            paint();
          }
        });
      });
    }
    paint();
  }
  A.page("admins", renderAdmins);

  /* ================= A17 审计日志 ================= */
  function renderAudit() {
    var state = { action: "", actor: "", target: "", days: "", page: 1, size: 10 };

    function list() {
      return A.db.audit().filter(function (l) {
        if (state.action && l.action !== state.action) return false;
        if (state.actor && l.actor !== state.actor) return false;
        if (state.target && (l.target || "").indexOf(state.target) === -1) return false;
        if (!withinDays(l.time, state.days)) return false;
        return true;
      });
    }

    var actions = {};
    A.db.audit().forEach(function (l) { actions[l.action] = 1; });
    var actors = {};
    A.db.audit().forEach(function (l) { actors[l.actor] = 1; });

    content(pageHead("审计日志", "审核、下架、白名单、禁言等操作留痕，保留 180 天。",
      '<button class="btn btn-secondary" id="l-export">导出 CSV</button>') +
      '<div class="filter-bar">' +
        '<div class="field"><label>操作类型</label><select class="select" id="l-action"><option value="">全部</option>' +
          Object.keys(actions).map(function (a) { return '<option value="' + esc(a) + '">' + esc(a) + "</option>"; }).join("") + "</select></div>" +
        '<div class="field"><label>操作人</label><select class="select" id="l-actor"><option value="">全部</option>' +
          Object.keys(actors).map(function (a) { return '<option value="' + esc(a) + '">' + esc(a) + "</option>"; }).join("") + "</select></div>" +
        '<div class="field field--grow"><label>对象</label><input class="input" id="l-target" placeholder="对象 ID 或名称"></div>' +
        '<div class="field"><label>时间范围</label><select class="select" id="l-days"><option value="">全部</option><option value="7">近 7 天</option><option value="30">近 30 天</option></select></div>' +
        '<div class="filter-bar__actions"><button class="btn btn-secondary" id="l-reset">重置</button></div>' +
      "</div><div id=\"l-slot\"></div>");

    function table() {
      var rows = list();
      var pages = Math.max(1, Math.ceil(rows.length / state.size));
      if (state.page > pages) state.page = pages;
      var slice = rows.slice((state.page - 1) * state.size, state.page * state.size);
      var columns = [
        { label: "时间", width: "150px", render: function (l) { return esc(l.time); } },
        { label: "操作人", width: "120px", render: function (l) { return esc(l.actor); } },
        { label: "角色", width: "100px", render: function (l) { var a = A.db.admins().filter(function (x) { return x.nick === l.actor; })[0]; return a ? A.roleText(a.role) : "—"; } },
        { label: "操作", width: "120px", render: function (l) { return '<span class="badge badge--info">' + esc(l.action) + "</span>"; } },
        { label: "对象", wrap: true, render: function (l) { return esc(l.target); } },
        { label: "详情", wrap: true, render: function (l) { return esc(l.detail); } },
        { label: "IP", width: "110px", render: function (l) { return esc(l.ip || "10.0.0.12"); } }
      ];
      document.getElementById("l-slot").innerHTML = rows.length
        ? A.tableHTML(columns, slice, { foot: footText(rows.length, "", state.page, state.size) })
        : A.emptyTable("没有匹配的日志", "可调整筛选条件，注意仅保留最近 180 天。");
      A.bindPager(document.getElementById("l-slot"), function (p) { state.page = p; table(); });
    }

    document.getElementById("l-action").addEventListener("change", function () { state.action = this.value; state.page = 1; table(); });
    document.getElementById("l-actor").addEventListener("change", function () { state.actor = this.value; state.page = 1; table(); });
    document.getElementById("l-target").addEventListener("input", MM.dom.debounce(function () {
      state.target = this.value.trim(); state.page = 1; table();
    }, 250));
    document.getElementById("l-days").addEventListener("change", function () { state.days = this.value; state.page = 1; table(); });
    document.getElementById("l-reset").addEventListener("click", function () {
      state.action = ""; state.actor = ""; state.target = ""; state.days = ""; state.page = 1;
      document.getElementById("l-action").value = "";
      document.getElementById("l-actor").value = "";
      document.getElementById("l-target").value = "";
      document.getElementById("l-days").value = "";
      table();
    });
    document.getElementById("l-export").addEventListener("click", function () {
      if ((A.session() || {}).role !== "super") { MM.ui.toast("仅超级管理员可导出日志"); return; }
      var rows = list();
      var csv = "时间,操作人,操作,对象,详情,IP\n" + rows.map(function (l) {
        return [l.time, l.actor, l.action, l.target, l.detail, l.ip || "10.0.0.12"].join(",");
      }).join("\n");
      downloadCSV("审计日志_" + A.now().slice(0, 10) + ".csv", csv);
      MM.ui.toast("已导出 " + rows.length + " 条日志");
    });

    table();
  }
  A.page("audit", renderAudit);

  /* ================= A18 系统配置 ================= */
  function renderSettings() {
    function paint() {
      var s = A.db.settings();
      content(pageHead("系统配置", "V1 多数规则固定只读，仅空亚类默认状态可调。", "") +
        '<div class="admin-card">' +
          '<div class="setting-group"><h3>内容规则</h3>' +
            '<div class="setting-row"><div class="setting-row__label">每亚类茶品数<span>PRD 5.2 固定规则，V1 不可修改</span></div><div class="setting-row__value">2 款（共 46 款）</div></div>' +
            '<div class="setting-row"><div class="setting-row__label">图鉴上架门槛<span>少于 4 张不可提交审核</span></div><div class="setting-row__value">4 张（上限 5 张）</div></div>' +
            '<div class="setting-row"><div class="setting-row__label">五维标签<span>上架时必填，标签须审核通过</span></div><div class="setting-row__value">必填</div></div>' +
          "</div>" +
          '<div class="setting-group"><h3>审核时限</h3>' +
            '<div class="setting-row"><div class="setting-row__label">茶品 / 投稿审核<span>工作日计时</span></div><div class="setting-row__value">24 小时</div></div>' +
            '<div class="setting-row"><div class="setting-row__label">举报首次响应<span>自举报提交起</span></div><div class="setting-row__value">48 小时</div></div>' +
          "</div>" +
          '<div class="setting-group"><h3>账号与数据</h3>' +
            '<div class="setting-row"><div class="setting-row__label">注销冷静期<span>期间可撤销注销</span></div><div class="setting-row__value">7 天</div></div>' +
            '<div class="setting-row"><div class="setting-row__label">消息与日志保留<span>超期不可查询</span></div><div class="setting-row__value">180 天</div></div>' +
          "</div>" +
          '<div class="setting-group"><h3>可调项</h3>' +
            '<div class="setting-row"><div class="setting-row__label">空亚类默认状态<span>新建空亚类在前台的展示状态</span></div>' +
              '<div class="setting-row__value"><select class="select" id="set-empty"><option value="building"' + (s.emptySubDefault === "building" ? " selected" : "") + ">内容建设中</option>" +
              '<option value="normal"' + (s.emptySubDefault === "normal" ? " selected" : "") + ">正常展示</option></select></div></div>" +
          "</div>" +
          '<div class="page-head__actions" style="justify-content:flex-end;margin-top:16px">' +
            '<button class="btn btn-secondary" id="set-reset">恢复默认</button><button class="btn btn-primary" id="set-save">保存配置</button></div>' +
        "</div>" +
        '<div class="admin-card"><div class="admin-card__head"><h2>变更记录</h2></div><ul class="meta-list">' +
          A.db.audit().filter(function (l) { return l.action === "系统配置"; }).slice(0, 5).map(function (l) {
            return '<li><span class="label">' + esc(l.time) + "</span><span class=\"value\">" + esc(l.detail) + "</span></li>";
          }).join("") + (A.db.audit().filter(function (l) { return l.action === "系统配置"; }).length ? "" : '<li><span class="label">暂无变更</span><span class="value">当前为初始配置</span></li>') +
        "</ul></div>");
      document.getElementById("set-reset").addEventListener("click", function () {
        document.getElementById("set-empty").value = "building";
        MM.ui.toast("已恢复默认值，点击保存后生效");
      });
      document.getElementById("set-save").addEventListener("click", function () {
        var val = document.getElementById("set-empty").value;
        A.confirm({ title: "保存系统配置", desc: "空亚类默认状态将改为「" + (val === "building" ? "内容建设中" : "正常展示") + "」。", okText: "保存", kind: "btn-primary", onSubmit: function () {
          A.db.saveSettings({ emptySubDefault: val });
          A.db.appendAudit({ action: "系统配置", target: "空亚类默认状态", detail: "设为 " + (val === "building" ? "内容建设中" : "正常展示") });
          MM.ui.toast("配置已保存");
          paint();
        } });
      });
    }
    paint();
  }
  A.page("settings", renderSettings);

  /* ================= A01 后台登录 ================= */
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
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + n + " " + n + '" shape-rendering="crispEdges"><rect width="' + n + '" height="' + n + '" fill="#fff"/>';
    for (var y = 0; y < n; y++) {
      for (var x = 0; x < n; x++) {
        var v = fixed[x + "," + y];
        if (v === undefined) v = rnd() > 0.52 ? 1 : 0;
        if (v) svg += '<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="#1a1815"/>';
      }
    }
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg + "</svg>");
  }

  function renderAdminLogin() {
    var slot = document.getElementById("login-slot");
    var timer = null;
    var seconds = 60;

    function cardHTML() {
      return '<div class="admin-login-card">' +
        '<div class="brand">茗脉</div><h1>管理后台</h1>' +
        '<div class="qr-box" id="a-qr-box"><img id="a-qr" alt="管理员扫码登录二维码">' +
          '<div class="qr-box__mask" id="a-mask" hidden><span>二维码已过期</span><button class="btn btn-secondary btn-sm" id="a-refresh" type="button">刷新二维码</button></div></div>' +
        '<p class="login-note">仅限已授权管理员 · 使用微信扫一扫</p>' +
        '<p class="login-status" id="a-status">二维码 <span id="a-timer">60</span> 秒后失效</p>' +
        '<button class="btn btn-primary btn-block" id="a-super" type="button">模拟扫码登录（超级管理员）</button>' +
        '<button class="btn btn-secondary btn-block" id="a-admin" type="button">以普通管理员登录</button>' +
        '<button class="btn-link" id="a-deny" type="button">模拟非白名单账号扫码</button>' +
        '<div class="admin-login-foot"><span>openid 白名单鉴权</span><span>所有操作写入审计日志</span></div>' +
      "</div>";
    }

    function resetQr() {
      seconds = 60;
      var img = document.getElementById("a-qr");
      if (img) img.src = qrSvg();
      var mask = document.getElementById("a-mask");
      if (mask) mask.hidden = true;
      var status = document.getElementById("a-status");
      if (status) status.innerHTML = '二维码 <span id="a-timer">' + seconds + " 秒后失效</span>";
      if (timer) clearInterval(timer);
      timer = setInterval(function () {
        seconds--;
        var t = document.getElementById("a-timer");
        if (t) t.textContent = seconds;
        if (seconds <= 0) {
          clearInterval(timer);
          var m = document.getElementById("a-mask");
          if (m) m.hidden = false;
        }
      }, 1000);
    }

    function login(role) {
      if (!navigator.onLine) { MM.ui.toast("当前离线，无法完成扫码授权"); return; }
      A.login(role);
      MM.ui.toast(role === "super" ? "已登录（超级管理员 阿茗）" : "已登录（普通管理员 编辑部小林）");
      var from = A.param("from") || "dashboard.html";
      window.location.href = from;
    }

    function deny() {
      if (timer) clearInterval(timer);
      slot.innerHTML = '<div class="admin-login-card"><div class="deny-card" style="max-width:none">' +
        '<div class="code">403</div><h2>无访问权限</h2>' +
        "<p>该微信账号不在管理员白名单内。如需访问，请联系超级管理员添加你的 openid。</p>" +
        '<div class="mt-4"><a class="btn btn-secondary" href="login.html">返回登录</a></div></div></div>';
    }

    slot.innerHTML = cardHTML();
    resetQr();
    document.getElementById("a-refresh").addEventListener("click", resetQr);
    document.getElementById("a-super").addEventListener("click", function () { login("super"); });
    document.getElementById("a-admin").addEventListener("click", function () { login("admin"); });
    document.getElementById("a-deny").addEventListener("click", deny);
    document.getElementById("a-qr-box").addEventListener("click", function (e) {
      if (e.target.id !== "a-refresh" && document.getElementById("a-mask").hidden) {
        MM.ui.toast("原型演示：请点击下方按钮模拟扫码成功");
      }
    });
    if (A.session()) {
      document.getElementById("a-status").textContent = "当前已登录：" + A.session().nick + "，可直接进入工作台";
    }
  }

  if (document.body.getAttribute("data-page") === "login") {
    MM.dom.ready(renderAdminLogin);
  }

  MM.adminPages = MM.adminPages || {};
  MM.adminPages.submissions = { crumb: [{ label: "工作台", href: "dashboard.html" }, { label: "投稿审核", href: "submissions.html" }] };
  MM.adminPages.submission = { crumb: [{ label: "工作台", href: "dashboard.html" }, { label: "投稿审核", href: "submissions.html" }, { label: "审核详情" }] };
  MM.adminPages.comments = { crumb: [{ label: "工作台", href: "dashboard.html" }, { label: "评论审核", href: "comments.html" }] };
  MM.adminPages.tags = { crumb: [{ label: "工作台", href: "dashboard.html" }, { label: "标签库", href: "tags.html" }] };
  MM.adminPages.categories = { crumb: [{ label: "工作台", href: "dashboard.html" }, { label: "分类与亚类", href: "categories.html" }] };
  MM.adminPages.import = { crumb: [{ label: "工作台", href: "dashboard.html" }, { label: "批量导入", href: "import.html" }] };
  MM.adminPages.reports = { crumb: [{ label: "工作台", href: "dashboard.html" }, { label: "投诉处理", href: "reports.html" }] };
  MM.adminPages.report = { crumb: [{ label: "工作台", href: "dashboard.html" }, { label: "投诉处理", href: "reports.html" }, { label: "处理详情" }] };
  MM.adminPages.users = { crumb: [{ label: "工作台", href: "dashboard.html" }, { label: "用户管理", href: "users.html" }] };
  MM.adminPages.admins = { superOnly: true, crumb: [{ label: "工作台", href: "dashboard.html" }, { label: "管理员白名单", href: "admins.html" }] };
  MM.adminPages.audit = { crumb: [{ label: "工作台", href: "dashboard.html" }, { label: "审计日志", href: "audit.html" }] };
  MM.adminPages.settings = { superOnly: true, crumb: [{ label: "工作台", href: "dashboard.html" }, { label: "系统配置", href: "settings.html" }] };
})();
