/* P18 举报 */
(function () {
  var files = [];
  var TYPE_TEXT = {
    copyright: "版权侵权",
    illegal: "违法违规",
    false: "内容不实",
    ad: "广告导流",
    other: "其他"
  };

  function renderEvidence() {
    document.getElementById("evidence-preview").innerHTML = files.map(function (name, i) {
      return '<div class="upload-preview__item upload-preview__item--file">' +
        '<p class="caption">' + MM.dom.esc(name) + "</p>" +
        '<button class="upload-preview__del" type="button" data-del="' + i + '" aria-label="删除">×</button></div>';
    }).join("");
  }

  function validate() {
    var errs = [];
    var desc = document.getElementById("report-desc").value.trim();
    if (desc.length < 10) errs.push("举报说明至少 10 字");
    if (!document.getElementById("report-truth").checked) errs.push("请确认举报内容真实");
    return errs;
  }

  function submit() {
    var errs = validate();
    var errBox = document.getElementById("report-errors");
    if (errs.length) {
      errBox.innerHTML = '<div class="banner banner--danger">' + errs.map(function (e) {
        return "<div>· " + MM.dom.esc(e) + "</div>";
      }).join("") + "</div>";
      return;
    }
    var objType = MM.dom.param("objType") || "detail";
    var target = MM.dom.param("title") || "该内容";
    var duplicate = MM.store.reports().some(function (r) {
      if (r.objType !== objType || r.target !== target) return false;
      var at = new Date(String(r.createdAt || "").replace(" ", "T"));
      if (isNaN(at.getTime())) return true;
      return Date.now() - at.getTime() < 24 * 60 * 60 * 1000;
    });
    if (duplicate) {
      MM.ui.toast("你已举报过该内容，请等待处理结果");
      return;
    }
    var rtype = document.querySelector('input[name="rtype"]:checked').value;
    MM.store.addReport({
      objType: objType,
      target: target,
      type: rtype,
      typeText: TYPE_TEXT[rtype],
      desc: document.getElementById("report-desc").value.trim(),
      evidence: files
    });
    document.getElementById("report-form").outerHTML = '<div class="submit-success">' +
      '<h2>举报已提交</h2>' +
      '<p>我们将在 48 小时内完成首次响应，处理结果会通过站内消息通知你。</p>' +
      '<span class="badge badge--pending">待处理</span>' +
      '<div class="chip-row">' +
        '<a class="btn btn-primary" href="messages.html">查看站内消息</a>' +
        '<a class="btn btn-secondary" href="index.html">返回首页</a>' +
      "</div></div>";
    MM.ui.toast("举报已提交，感谢反馈");
  }

  MM.dom.ready(function () {
    if (!MM.store.requirePageLogin("report.html" + window.location.search, "提交举报")) return;
    MM.ui.initChrome("report");

    var title = MM.dom.param("title");
    if (title) document.getElementById("report-target").textContent = title;

    var desc = document.getElementById("report-desc");
    desc.addEventListener("input", function () {
      document.getElementById("report-counter").textContent = desc.value.length + "/200";
    });

    document.getElementById("evidence-input").addEventListener("change", function (e) {
      Array.prototype.forEach.call(e.target.files, function (f) {
        if (files.length >= 3) return;
        files.push(f.name);
      });
      e.target.value = "";
      renderEvidence();
    });
    document.getElementById("evidence-preview").addEventListener("click", function (e) {
      var del = e.target.closest("[data-del]");
      if (del) { files.splice(Number(del.getAttribute("data-del")), 1); renderEvidence(); }
    });

    document.getElementById("report-cancel").addEventListener("click", function () {
      if (document.referrer) window.history.back();
      else window.location.href = "index.html";
    });
    document.getElementById("report-submit").addEventListener("click", submit);
  });
})();
