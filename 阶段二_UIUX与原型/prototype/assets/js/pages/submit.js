/* P12 投稿页（T1 品鉴长文） */
(function () {
  var root;
  var form;
  var presetTea = "";
  var draftKey = "t1";

  function teaOptions() {
    return MM.categories.map(function (c) {
      return '<optgroup label="' + c.name + '">' + MM.config.teasOf(c.id).map(function (t) {
        return '<option value="' + t.id + '"' + (t.id === presetTea ? " selected" : "") + ">" +
          MM.dom.esc(t.name) + "（" + MM.dom.esc(t.sub) + "）</option>";
      }).join("") + "</optgroup>";
    }).join("");
  }

  function renderForm() {
    root.innerHTML =
      '<div class="submit-card">' +
        '<div class="submit-head">' +
          '<div class="chip-row"><span class="chip chip--cat" data-cat="green">T1</span><span class="chip">品鉴长文</span></div>' +
          '<span class="caption">当日投稿限额 3 条</span>' +
        "</div>" +
        '<form class="form mt-4" id="submit-form" novalidate>' +
          '<div class="field" data-field="tea">' +
            '<label class="field__label" for="f-tea"><span class="req">*</span>关联茶品</label>' +
            '<select class="select" id="f-tea"><option value="">请选择茶品</option>' + teaOptions() + "</select>" +
            '<span class="field__hint" id="tea-lock-hint">投稿必须绑定一款已收录茶品，便于审核与归档。</span>' +
            '<button class="btn-link hidden" type="button" id="tea-change">更换关联茶品</button>' +
          "</div>" +

          '<div class="field" data-field="title">' +
            '<label class="field__label" for="f-title"><span class="req">*</span>标题</label>' +
            '<input class="input" id="f-title" type="text" maxlength="60" placeholder="用一句话概括这篇品鉴">' +
            '<span class="counter" id="title-counter">0 / 60</span>' +
            '<span class="field__hint">5～60 字。</span>' +
          "</div>" +

          '<div class="field" data-field="body">' +
            '<label class="field__label" for="f-body"><span class="req">*</span>正文</label>' +
            '<textarea class="textarea" id="f-body" rows="12" maxlength="5000" placeholder="可以从干茶、汤色、香气、滋味、叶底与冲泡过程写起。"></textarea>' +
            '<span class="counter" id="body-counter">0 / 300 字起</span>' +
            '<span class="field__hint">至少 300 字；图片投稿请使用后续批次的 T3 补图入口。</span>' +
          "</div>" +

          '<div class="field" data-field="sign">' +
            '<span class="field__label">署名方式</span>' +
            '<div class="radio-row">' +
              '<label><input type="radio" name="sign" value="nick" checked> 使用昵称</label>' +
              '<label><input type="radio" name="sign" value="anon"> 匿名发布</label>' +
            "</div>" +
          "</div>" +

          '<div class="field" data-field="auth">' +
            '<label class="check-row"><input type="checkbox" id="f-auth">' +
              "<span>我确认内容为原创或已获授权，并同意茗脉在标注来源后展示、编辑与归档。</span></label>" +
          "</div>" +

          '<div class="split">' +
            '<span class="caption" id="form-status"></span>' +
            '<div class="chip-row">' +
              '<button class="btn btn-secondary" type="button" id="save-draft">保存草稿</button>' +
              '<button class="btn btn-primary" type="submit" id="submit-btn">提交审核</button>' +
            "</div>" +
          "</div>" +
        "</form>" +
      "</div>";

    form = document.getElementById("submit-form");
    bindForm();
    restoreDraft();
    if (document.getElementById("f-tea").value) lockTea(true);
    if (MM.ui.isOffline()) {
      document.getElementById("submit-btn").disabled = true;
      document.getElementById("form-status").textContent = "当前离线，无法提交审核";
    }
  }

  /* 关联茶品选中后锁定，可点「更换」解锁 */
  function lockTea(lock) {
    var select = document.getElementById("f-tea");
    var hint = document.getElementById("tea-lock-hint");
    var change = document.getElementById("tea-change");
    select.disabled = lock;
    change.classList.toggle("hidden", !lock);
    if (lock) {
      var tea = MM.config.tea(select.value);
      hint.textContent = "已锁定关联茶品：" + (tea ? tea.name : "所选茶品") + "。如需更换请点「更换关联茶品」。";
    } else {
      hint.textContent = "投稿必须绑定一款已收录茶品，便于审核与归档。";
    }
  }

  function bindForm() {
    var title = document.getElementById("f-title");
    var body = document.getElementById("f-body");
    var titleCounter = document.getElementById("title-counter");
    var bodyCounter = document.getElementById("body-counter");

    title.addEventListener("input", function () {
      titleCounter.textContent = title.value.length + " / 60";
      titleCounter.classList.toggle("is-over", title.value.length > 60);
      clearError("title");
    });

    body.addEventListener("input", function () {
      var len = body.value.length;
      bodyCounter.textContent = len >= 300 ? len + " 字 · 已达标" : len + " / 300 字起";
      bodyCounter.classList.toggle("is-over", len > 0 && len < 300);
      clearError("body");
    });

    document.getElementById("f-tea").addEventListener("change", function () {
      clearError("tea");
      if (this.value) lockTea(true);
    });
    document.getElementById("tea-change").addEventListener("click", function () {
      lockTea(false);
      document.getElementById("f-tea").focus();
    });
    document.getElementById("f-auth").addEventListener("change", function () { clearError("auth"); });

    document.getElementById("save-draft").addEventListener("click", saveDraft);
    form.addEventListener("submit", onSubmit);
  }

  function collect() {
    return {
      tea: document.getElementById("f-tea").value,
      title: document.getElementById("f-title").value.trim(),
      body: document.getElementById("f-body").value.trim(),
      sign: form.querySelector('input[name="sign"]:checked').value,
      auth: document.getElementById("f-auth").checked
    };
  }

  function showError(name, msg) {
    var field = form.querySelector('[data-field="' + name + '"]');
    if (!field) return;
    field.classList.add("has-error");
    var err = field.querySelector(".field__error");
    if (!err) {
      err = document.createElement("span");
      err.className = "field__error";
      field.appendChild(err);
    }
    err.textContent = msg;
  }

  function clearError(name) {
    var field = form.querySelector('[data-field="' + name + '"]');
    if (!field) return;
    field.classList.remove("has-error");
    var err = field.querySelector(".field__error");
    if (err) err.textContent = "";
  }

  function clearErrors() {
    ["tea", "title", "body", "auth"].forEach(clearError);
  }

  function findInvalid(data) {
    if (!data.tea) return { name: "tea", msg: "请选择关联茶品", el: "f-tea" };
    if (data.title.length < 5) return { name: "title", msg: "标题至少 5 个字", el: "f-title" };
    if (data.title.length > 60) return { name: "title", msg: "标题最多 60 个字", el: "f-title" };
    if (data.body.length < 300) return { name: "body", msg: "正文至少 300 字（当前 " + data.body.length + " 字）", el: "f-body" };
    if (!data.auth) return { name: "auth", msg: "请勾选原创与授权声明", el: "f-auth" };
    return null;
  }

  function onSubmit(e) {
    e.preventDefault();
    if (MM.ui.isOffline()) { MM.ui.toast("离线状态下无法提交，请联网后重试"); return; }

    clearErrors();
    var data = collect();
    var invalid = findInvalid(data);
    if (invalid) {
      showError(invalid.name, invalid.msg);
      var el = document.getElementById(invalid.el);
      if (el) { el.focus(); el.scrollIntoView({ behavior: "smooth", block: "center" }); }
      MM.ui.toast(invalid.msg);
      return;
    }

    MM.ui.requireLogin("投稿", function () {
      var tea = MM.config.tea(data.tea);
      var sub = MM.store.addSubmission({
        teaId: data.tea,
        teaName: tea ? tea.name : "",
        title: data.title,
        body: data.body,
        sign: data.sign,
        words: data.body.length
      });
      MM.store.removeDraft(draftKey);
      renderSuccess(sub);
    });
  }

  function saveDraft() {
    var data = collect();
    if (!data.tea && !data.title && !data.body) {
      MM.ui.toast("先写一点内容再保存草稿");
      return;
    }
    MM.store.saveDraft(draftKey, {
      tea: data.tea,
      title: document.getElementById("f-title").value,
      body: document.getElementById("f-body").value,
      sign: data.sign,
      savedAt: new Date().toISOString().slice(0, 16).replace("T", " ")
    });
    MM.ui.toast("草稿已保存，下次打开可继续编辑");
  }

  function restoreDraft() {
    var draft = MM.store.getDraft(draftKey);
    if (!draft) return;
    if (draft.tea) document.getElementById("f-tea").value = draft.tea;
    document.getElementById("f-title").value = draft.title || "";
    document.getElementById("f-body").value = draft.body || "";
    if (draft.sign) {
      var radio = form.querySelector('input[name="sign"][value="' + draft.sign + '"]');
      if (radio) radio.checked = true;
    }
    document.getElementById("title-counter").textContent = document.getElementById("f-title").value.length + " / 60";
    var len = document.getElementById("f-body").value.length;
    document.getElementById("body-counter").textContent = len >= 300 ? len + " 字 · 已达标" : len + " / 300 字起";
    document.getElementById("form-status").textContent = "已恢复草稿（保存于 " + (draft.savedAt || "未知时间") + "）";
    MM.ui.toast("已恢复上次保存的草稿");
  }

  function renderSuccess(sub) {
    root.innerHTML =
      '<div class="submit-card submit-success">' +
        '<span class="badge badge--pending">待审核</span>' +
        "<h2>投稿已提交</h2>" +
        '<p>《' + MM.dom.esc(sub.title) + "》已关联「" + MM.dom.esc(sub.teaName) + "」，共 " +
          sub.words + " 字，署名方式为" + (sub.sign === "anon" ? "匿名" : "昵称") + "。</p>" +
        '<p>管理员将在工作日 24 小时内完成审核，结果会通过站内消息通知。驳回时会附上理由，可修改后重提，最多 2 次。</p>' +
        '<div class="chip-row mt-4">' +
          '<a class="btn btn-secondary" href="detail.html?id=' + encodeURIComponent(sub.teaId) + '">返回茶品详情</a>' +
          '<a class="btn btn-primary" href="submit.html?type=t1">再写一篇</a>' +
        "</div>" +
      "</div>";
    window.scrollTo({ top: 0, behavior: "smooth" });
    MM.ui.toast("投稿已进入待审核队列");
  }

  MM.dom.ready(function () {
    MM.ui.initChrome("submit");
    root = document.getElementById("submit-root");
    var preset = MM.dom.param("tea");
    presetTea = preset && MM.config.tea(preset) ? preset : "";
    renderForm();
  });
})();
