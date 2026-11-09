/* P20 草稿 / 审核中投稿预览 */
(function () {
  var STATUS = {
    pending: { text: "待审核", cls: "badge--pending", tip: "审核通过后对外展示" },
    approved: { text: "已通过", cls: "badge--ok", tip: "已通过审核，对外展示中" },
    rejected: { text: "已驳回", cls: "badge--reject", tip: "可修改后重提（最多 2 次）" },
    locked: { text: "已锁定", cls: "badge--reject", tip: "已锁定，不可再重提" },
    draft: { text: "草稿", cls: "badge--draft", tip: "草稿尚未提交审核" }
  };
  var TYPE = { t1: "T1 品鉴长文", t3: "T3 补图", t4: "T4 纠错" };

  function esc(s) { return MM.dom.esc(s); }

  function param(name) {
    var m = new RegExp("[?&]" + name + "=([^&]*)").exec(window.location.search);
    return m ? decodeURIComponent(m[1].replace(/\+/g, " ")) : "";
  }

  function statusOf(s) { return STATUS[s.status] || STATUS.draft; }

  function diffHTML(s, tea) {
    var rows = [
      { label: "采摘时间", old: tea ? tea.pick : "4 月中旬", now: s.body || "4 月中旬～5 月上旬" },
      { label: "等级分档", old: tea && tea.grade.length ? tea.grade.join(" / ") : "特级 / 一级", now: "特级 / 一级 / 二级" },
      { label: "标准号", old: tea ? tea.std.join("；") : "GB/T 19698", now: "GB/T 19698；DB33/T 239" }
    ];
    return '<table class="diff-table"><thead><tr><th>字段</th><th>原值</th><th>新值</th></tr></thead><tbody>' +
      rows.map(function (r) {
        return "<tr><td>" + esc(r.label) + '</td><td class="old">' + esc(r.old) +
          '</td><td class="is-changed"><span class="new">' + esc(r.now) + "</span></td></tr>";
      }).join("") + "</tbody></table>";
  }

  function bodyHTML(s, tea) {
    if (s.type === "t3") {
      return '<div class="preview-images">' + [1, 2, 3].map(function (i) {
        return '<img src="' + MM.config.imageUrl(tea ? tea.name : "茶品", "叶底 " + i) + '" alt="" data-fb-name="' +
          esc(tea ? tea.name : "茶品") + '" data-fb-type="叶底" data-fb-cat="' + (tea ? tea.cat : "green") + '">';
      }).join("") + "</div>" +
      '<p class="caption mt-2">图片授权：已勾选「本人拥有该图片著作权，并授权茗脉用于展示」。</p>';
    }
    if (s.type === "t4") return diffHTML(s, tea);
    var text = s.body && s.body.length > 80
      ? s.body
      : (tea ? "以「" + tea.name + "」为对象的品鉴记录：干茶外形紧结匀整，香气干净；按 1:40 的茶水比、90℃ 水温冲泡，前两泡 30 秒出汤，汤色明亮，入口清甜，第三泡滋味转淡，回甘仍在。叶底完整，色泽均匀，整体表现与页面描述基本一致。以上为本次品鉴记录。" : s.body || "");
    return '<div class="preview-body">' + esc(text).split(/\n+/).map(function (p) {
      return "<p>" + p + "</p>";
    }).join("") + "</div>";
  }

  function renderNotFound(id) {
    document.getElementById("preview-root").innerHTML = MM.ui.emptyHTML({
      title: "内容不可用",
      desc: "该投稿不存在、已被删除，或你没有查看权限。",
      actionText: "返回投稿中心",
      actionHref: "submissions.html"
    });
  }

  MM.dom.ready(function () {
    var id = param("id");
    if (!MM.store.requirePageLogin("preview.html?id=" + encodeURIComponent(id), "查看投稿预览")) return;
    MM.ui.initChrome("submit");

    var s = MM.store.findSubmission(id);
    if (!s) { renderNotFound(id); return; }

    var st = statusOf(s);
    var tea = MM.config.tea(s.teaId);
    var author = s.sign === "anon" ? "匿名用户" : (MM.demoUser ? MM.demoUser.nick : "茶友小茗");
    var root = document.getElementById("preview-root");

    var banner = '<div class="preview-banner">预览模式 · ' + esc(st.tip) +
      ' <span class="badge ' + st.cls + '" style="margin-left:auto">' + st.text + "</span></div>";

    var reject = s.reason ? '<div class="banner banner--warn mt-4"><div><b>驳回理由</b><p class="mt-1">' +
      esc(s.reason) + "</p></div></div>" : "";

    var retry = "";
    if (s.status === "rejected" && s.retryLeft > 0) {
      retry = '<a class="btn btn-primary" href="submit-fix.html?type=' + s.type + "&amp;id=" + encodeURIComponent(s.id) +
        '">修改重提（剩 ' + s.retryLeft + " 次）</a>";
    }

    document.getElementById("page-banner").innerHTML = banner;

    root.innerHTML =
      '<div class="preview-head">' +
        '<p class="detail-hero__crumbs"><a href="index.html">首页</a> / <a href="submissions.html">我的投稿</a> / 预览</p>' +
        '<h1 class="preview-title">' + esc(s.title) + "</h1>" +
        '<div class="detail-meta">' +
          '<span class="badge badge--info">' + TYPE[s.type] + "</span>" +
          '<span class="badge ' + st.cls + '">' + st.text + "</span>" +
          "<span>作者：" + esc(author) + "</span>" +
          "<span>提交于 " + esc(s.createdAt) + "</span>" +
          (s.reviewedAt ? "<span>审核于 " + esc(s.reviewedAt) + "</span>" : "") +
        "</div>" +
        (tea ? '<p class="detail-alias mt-2">关联茶品：<a href="detail.html?id=' + tea.id + '">' + esc(tea.name) + "</a> · " + esc(tea.sub) + "</p>" : "") +
      "</div>" +
      '<div class="mt-4">' + bodyHTML(s, tea) + "</div>" +
      reject +
      '<div class="detail-actions mt-5">' +
        '<a class="btn btn-secondary" href="submissions.html">返回投稿中心</a>' +
        '<button class="btn btn-secondary" id="preview-copy">复制内容</button>' +
        retry +
      "</div>" +
      '<p class="caption mt-4">预览页不产生对外链接、不可被分享，也不会进入搜索与图鉴；审核通过后内容才会展示在前台。</p>';

    var copy = document.getElementById("preview-copy");
    copy.addEventListener("click", function () {
      var text = s.title + "\n\n" + (s.body || "");
      function done() { MM.ui.toast("内容已复制"); }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { MM.ui.toast("复制失败，请手动选择文本"); });
      } else {
        var ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand("copy"); done(); } catch (e) { MM.ui.toast("复制失败，请手动选择文本"); }
        ta.remove();
      }
    });

    MM.ui.attachImageFallback(document);
  });
})();
