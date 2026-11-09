/* P11 我的投稿列表 */
(function () {
  var filter = "all";
  var listBox, emptyBox;

  var STATUS = {
    pending: { text: "待审核", cls: "badge--pending" },
    approved: { text: "已通过", cls: "badge--ok" },
    rejected: { text: "已驳回", cls: "badge--reject" },
    locked: { text: "已锁定", cls: "badge--reject" },
    draft: { text: "草稿", cls: "badge--draft" }
  };
  var TYPE = { t1: "品鉴长文", t3: "补图", t4: "纠错" };

  function badge(status) {
    var s = STATUS[status] || STATUS.draft;
    return '<span class="badge ' + s.cls + '">' + s.text + "</span>";
  }

  function renderTabs() {
    var all = MM.store.mySubmissions();
    MM.dom.qsa("#sub-tabs button").forEach(function (btn) {
      var st = btn.getAttribute("data-status");
      var n = st === "all" ? all.length : all.filter(function (s) { return s.status === st; }).length;
      btn.querySelector(".tab-count").textContent = n;
      btn.classList.toggle("is-active", st === filter);
    });
  }

  function render() {
    renderTabs();
    var list = MM.store.mySubmissions().filter(function (s) {
      return filter === "all" || s.status === filter;
    });
    if (!list.length) {
      listBox.innerHTML = "";
      emptyBox.classList.remove("hidden");
      emptyBox.innerHTML = MM.ui.emptyHTML({
        title: "这里还没有投稿",
        desc: "可以写一篇品鉴长文，或为已有条目补图、纠错。",
        actionText: "写第一篇品鉴",
        actionHref: "submit.html?type=t1"
      });
      return;
    }
    emptyBox.classList.add("hidden");
    listBox.innerHTML = list.map(function (s) {
      var tea = MM.config.tea(s.teaId);
      var actions = '<a class="btn btn-secondary btn-sm" href="preview.html?id=' + encodeURIComponent(s.id) + '">预览</a>';
      if (s.status === "draft") {
        actions = '<a class="btn btn-primary btn-sm" href="submit.html?type=t1">继续编辑</a>' +
          '<button class="btn btn-ghost btn-sm" type="button" data-del="' + encodeURIComponent(s.id) + '">删除草稿</button>';
      }
      if (s.status === "rejected" && s.retryLeft > 0) {
        actions += '<a class="btn btn-primary btn-sm" href="submit-fix.html?type=t1&id=' + encodeURIComponent(s.id) +
          '">修改重提（剩 ' + s.retryLeft + ' 次）</a>';
      }
      if (s.status === "locked") {
        actions = '<span class="caption">已锁定，不可重提</span>';
      }
      var href = s.status === "draft"
        ? "submit.html?type=t1"
        : "preview.html?id=" + encodeURIComponent(s.id);
      return '<div class="list-row list-row--top">' +
        '<span class="msg-type">' + (TYPE[s.type] || "投稿") + "</span>" +
        '<div class="list-row__main">' +
          '<a class="list-row__title" href="' + href + '">' +
            MM.dom.esc(s.title) + badge(s.status) + "</a>" +
          '<div class="list-row__desc">关联茶品：' + (tea ? MM.dom.esc(tea.name) : "未关联") +
            (s.status === "draft" ? " · 草稿保存于 " + MM.dom.esc(s.createdAt || "未知时间")
              : " · 提交于 " + MM.dom.esc(s.createdAt)) +
            (s.reviewedAt ? " · 审核于 " + MM.dom.esc(s.reviewedAt) : "") + "</div>" +
          (s.reason ? '<details class="reject-reason"><summary>查看驳回理由</summary><p>' +
            MM.dom.esc(s.reason) + "</p></details>" : "") +
        "</div>" +
        '<div class="list-row__actions">' + actions + "</div>" +
      "</div>";
    }).join("");
  }

  MM.dom.ready(function () {
    listBox = document.getElementById("sub-list");
    emptyBox = document.getElementById("sub-empty");
    if (!MM.store.requirePageLogin("submissions.html", "查看投稿")) return;
    MM.ui.initChrome("submit");
    render();

    document.getElementById("sub-tabs").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-status]");
      if (!btn) return;
      filter = btn.getAttribute("data-status");
      render();
    });

    listBox.addEventListener("click", function (e) {
      var del = e.target.closest("[data-del]");
      if (!del) return;
      var id = decodeURIComponent(del.getAttribute("data-del"));
      if (!window.confirm("删除这份草稿？删除后不可恢复。")) return;
      MM.store.removeSubmission(id);
      MM.ui.toast("草稿已删除");
      render();
    });
  });
})();
