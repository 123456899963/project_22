/* P13 补图（T3）/ 纠错（T4）/ 驳回重提（T1） */
(function () {
  var mode = "t3";
  var editId = "";
  var editSub = null;
  var photos = [];
  var formCard;
  var FIELD_MAP = {
    origin: "产地",
    pick: "采摘时间",
    grade: "等级",
    brew: "冲泡参数",
    desc: "品质描述",
    image: "图鉴图片"
  };

  function teaOptions(selected) {
    return MM.categories.map(function (c) {
      return '<optgroup label="' + c.name + '">' + MM.config.teasOf(c.id)
        .map(function (t) {
          return '<option value="' + t.id + '"' + (t.id === selected ? " selected" : "") + ">" +
            MM.dom.esc(t.name) + "（" + MM.dom.esc(t.sub) + "）</option>";
        }).join("") + "</optgroup>";
    }).join("");
  }

  function originalValue(tea, field) {
    if (!tea) return "请先选择茶品";
    if (field === "brew") return "水温 " + tea.temp + " · 茶水比 " + tea.ratio + " · " + tea.seconds;
    if (field === "image") return "当前图鉴 " + MM.config.imageTypes(tea).length + " 张";
    if (field === "grade") return MM.config.gradeText(tea);
    return tea[field] || "暂无";
  }

  function typeTabs() {
    var items = [];
    if (editSub && editSub.type === "t1") items.push({ v: "t1", label: "品鉴长文（修改重提）" });
    items.push({ v: "t3", label: "补图 T3" });
    items.push({ v: "t4", label: "纠错 T4" });
    document.getElementById("type-tabs").innerHTML = items.map(function (it) {
      return '<button type="button" data-mode="' + it.v + '" class="' + (mode === it.v ? "is-active" : "") + '">' +
        it.label + "</button>";
    }).join("");
  }

  function renderForm() {
    formCard.innerHTML = '<div class="form" id="fix-form">' +
      '<div id="form-errors"></div>' +
      '<div class="field"><label class="field__label" for="tea-select"><span class="req">*</span>关联茶品</label>' +
        '<select class="select" id="tea-select">' +
          '<option value="">请选择茶品（必选）</option>' + teaOptions(editSub ? editSub.teaId : MM.dom.param("tea")) +
        "</select></div>" + (mode === "t3" ? t3Fields() : mode === "t4" ? t4Fields() : t1Fields()) +
      '<div class="field"><label class="field__label">署名方式</label>' +
        '<div class="radio-row">' +
          '<label><input type="radio" name="sign" value="nick" checked> 使用昵称「' + MM.demoUser.nick + '」</label>' +
          '<label><input type="radio" name="sign" value="anon"> 匿名</label>' +
        "</div></div>" +
      '<div class="check-row"><input type="checkbox" id="truth">' +
        '<span>我确认以上信息真实、不含店铺名 / 微信号 / 购买链接，并同意平台在审核范围内使用。</span></div>' +
      '<div class="chip-row"><button class="btn btn-secondary" type="button" id="save-draft">保存草稿</button>' +
        '<button class="btn btn-primary btn-lg" type="button" id="fix-submit">提交审核</button></div>' +
    "</div>";

    bindForm();
  }

  function t3Fields() {
    return '<div class="field"><label class="field__label"><span class="req">*</span>上传图片（1～3 张）</label>' +
      '<label class="upload-box" id="img-zone"><input type="file" id="img-input" accept="image/*" multiple hidden>' +
      '<p><strong>点击选择图片</strong>或用示例图演示</p><p class="caption">jpg / png / webp，单张 ≤5MB</p></label>' +
      '<div class="upload-preview" id="img-preview"></div>' +
      '<button class="btn-link" type="button" id="use-sample">没有图片？用示例图演示</button></div>' +
      '<div class="field"><label class="field__label" for="t3-note">拍摄说明</label>' +
      '<textarea class="textarea" id="t3-note" maxlength="200" placeholder="拍摄时间、地点、光线条件、拍摄的是干茶 / 汤色 / 叶底……"></textarea>' +
      '<span class="counter" id="t3-counter">0/200</span></div>' +
      '<div class="check-row"><input type="checkbox" id="authorize">' +
      '<span><span class="req">*</span>我拥有图片版权，并勾选书面授权：同意茗脉在「用户实拍」相册展示（编辑采纳后生效）。</span></div>';
  }

  function t4Fields() {
    return '<div class="field"><label class="field__label" for="field-select"><span class="req">*</span>需纠错的字段</label>' +
      '<select class="select" id="field-select"><option value="">请选择字段</option>' +
        Object.keys(FIELD_MAP).map(function (k) {
          return '<option value="' + k + '">' + FIELD_MAP[k] + "</option>";
        }).join("") + "</select></div>" +
      '<div class="field"><label class="field__label">当前内容（自动带出）</label>' +
        '<div class="panel panel--soft" id="origin-value">请先选择茶品与字段</div></div>' +
      '<div class="field"><label class="field__label" for="new-value"><span class="req">*</span>修改为</label>' +
        '<textarea class="textarea" id="new-value" maxlength="300" placeholder="请写明修改后的完整内容"></textarea>' +
        '<span class="counter" id="new-counter">0/300</span></div>' +
      '<div class="field"><label class="field__label" for="reason"><span class="req">*</span>修改理由（至少 20 字）</label>' +
        '<textarea class="textarea" id="reason" maxlength="300" placeholder="为什么需要修改？请给出可核查的依据，如国家标准号、产区公开资料、实地核对记录。"></textarea>' +
        '<span class="counter" id="reason-counter">0/300</span></div>' +
      '<div class="field"><label class="field__label" for="source">依据来源</label>' +
        '<input class="input" id="source" placeholder="如 GB/T 18650《地理标志产品 龙井茶》"></div>';
  }

  function t1Fields() {
    return '<div class="field"><label class="field__label"><span class="req">*</span>标题</label>' +
      '<input class="input" id="fix-title" maxlength="60" value="' + MM.dom.esc(editSub ? editSub.title : "") + '"></div>' +
      '<div class="field"><label class="field__label"><span class="req">*</span>正文（至少 300 字）</label>' +
      '<textarea class="textarea" id="fix-body" style="min-height:200px">' + MM.dom.esc(editSub ? editSub.body : "") + "</textarea>" +
      '<span class="counter" id="body-counter"></span></div>' +
      '<div class="field"><label class="field__label">上次驳回理由</label>' +
      '<div class="quote-block">' + MM.dom.esc(editSub ? editSub.reason : "") + "</div></div>";
  }

  function counters() {
    [
      ["t3-note", "t3-counter", 200],
      ["new-value", "new-counter", 300],
      ["reason", "reason-counter", 300],
      ["fix-body", "body-counter", 0]
    ].forEach(function (c) {
      var input = document.getElementById(c[0]);
      var out = document.getElementById(c[1]);
      if (!input || !out) return;
      function update() {
        out.textContent = input.value.length + "/" + (c[2] || "最少 300");
        if (c[2]) out.classList.toggle("is-over", input.value.length > c[2]);
      }
      input.addEventListener("input", update);
      update();
    });
  }

  function renderPhotos() {
    var box = document.getElementById("img-preview");
    if (!box) return;
    box.innerHTML = photos.map(function (p, i) {
      return '<div class="upload-preview__item"><img src="' + p + '" alt="图片 ' + (i + 1) + '">' +
        '<span class="upload-preview__no">' + (i === 0 ? "干茶" : i === 1 ? "汤色" : "叶底") + "</span>" +
        '<button class="upload-preview__del" type="button" data-del="' + i + '" aria-label="删除">×</button></div>';
    }).join("");
  }

  function addFiles(files) {
    Array.prototype.forEach.call(files, function (file) {
      if (photos.length >= 3) return;
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { MM.ui.toast("仅支持 jpg / png / webp"); return; }
      if (file.size > 5 * 1024 * 1024) { MM.ui.toast("单张图片不能超过 5MB"); return; }
      var reader = new FileReader();
      reader.onload = function () { photos.push(reader.result); renderPhotos(); };
      reader.readAsDataURL(file);
    });
  }

  function showErrors(list) {
    document.getElementById("form-errors").innerHTML = '<div class="banner banner--danger">' +
      list.map(function (msg) { return "<div>· " + MM.dom.esc(msg) + "</div>"; }).join("") + "</div>";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function validate() {
    var errors = [];
    var teaId = document.getElementById("tea-select").value;
    if (!teaId) errors.push("请选择关联茶品");
    if (mode === "t3") {
      if (photos.length < 1) errors.push("请至少上传 1 张图片");
      if (!document.getElementById("authorize").checked) errors.push("请勾选书面授权");
    }
    if (mode === "t4") {
      if (!document.getElementById("field-select").value) errors.push("请选择需纠错的字段");
      var nv = document.getElementById("new-value").value.trim();
      if (nv.length < 5) errors.push("请填写修改后的内容（至少 5 字）");
      var reason = document.getElementById("reason").value.trim();
      if (reason.length < 20) errors.push("修改理由至少 20 字，并给出可核查依据");
    }
    if (mode === "t1") {
      var title = document.getElementById("fix-title").value.trim();
      var body = document.getElementById("fix-body").value.trim();
      if (title.length < 5) errors.push("标题至少 5 字");
      if (body.length < 300) errors.push("正文至少 300 字");
    }
    if (!document.getElementById("truth").checked) errors.push("请确认信息真实并同意内容规范");
    return errors;
  }

  function updateOrigin() {
    var box = document.getElementById("origin-value");
    if (!box) return;
    var tea = MM.config.tea(document.getElementById("tea-select").value);
    var field = document.getElementById("field-select").value;
    box.textContent = originalValue(tea, field);
  }

  function success(data) {
    formCard.innerHTML = '<div class="submit-success">' +
      '<h2>已提交，等待审核</h2>' +
      '<p>投稿编号 ' + MM.dom.esc(data.id) + " · 工作日 24 小时内完成审核，结果会发送到站内消息。</p>" +
      '<span class="badge badge--pending">待审核</span>' +
      '<div class="chip-row">' +
        '<a class="btn btn-secondary" href="preview.html?id=' + encodeURIComponent(data.id) + '">查看预览</a>' +
        '<a class="btn btn-primary" href="submissions.html">我的投稿</a>' +
        '<a class="btn btn-ghost" href="index.html">返回首页</a>' +
      "</div></div>";
  }

  function submit() {
    var errors = validate();
    if (errors.length) { showErrors(errors); return; }
    var teaId = document.getElementById("tea-select").value;
    var sign = document.querySelector('input[name="sign"]:checked').value;
    var data = { teaId: teaId, sign: sign };
    if (mode === "t3") {
      data.type = "t3";
      data.title = "补充「" + MM.config.tea(teaId).name + "」实拍图（" + photos.length + " 张）";
      data.body = document.getElementById("t3-note").value.trim() || "已勾选书面授权，图片进入用户实拍相册候选。";
      data.images = photos.length;
    } else if (mode === "t4") {
      data.type = "t4";
      var field = document.getElementById("field-select").value;
      data.title = "纠错：" + MM.config.tea(teaId).name + " · " + FIELD_MAP[field];
      data.body = "修改为：" + document.getElementById("new-value").value.trim() +
        "；理由：" + document.getElementById("reason").value.trim() +
        (document.getElementById("source").value.trim() ? "；来源：" + document.getElementById("source").value.trim() : "");
      data.field = field;
    } else {
      data.type = "t1";
      data.title = document.getElementById("fix-title").value.trim();
      data.body = document.getElementById("fix-body").value.trim();
      data.resubmitOf = editId;
    }
    var saved = MM.store.addSubmission(data);
    if (editSub && editSub.status === "rejected") {
      editSub.retryLeft = Math.max(0, (editSub.retryLeft || 0) - 1);
      MM.store.updateSubmission(editSub.id, { retryLeft: editSub.retryLeft });
    }
    MM.store.removeDraft("fix");
    MM.ui.toast("已提交审核");
    success(saved);
  }

  function bindForm() {
    counters();
    document.getElementById("tea-select").addEventListener("change", updateOrigin);
    var fieldSelect = document.getElementById("field-select");
    if (fieldSelect) fieldSelect.addEventListener("change", updateOrigin);
    var imgInput = document.getElementById("img-input");
    if (imgInput) {
      imgInput.addEventListener("change", function (e) { addFiles(e.target.files); e.target.value = ""; });
      document.getElementById("img-preview").addEventListener("click", function (e) {
        var del = e.target.closest("[data-del]");
        if (del) { photos.splice(Number(del.getAttribute("data-del")), 1); renderPhotos(); }
      });
      document.getElementById("use-sample").addEventListener("click", function () {
        var tea = MM.config.tea(document.getElementById("tea-select").value) || MM.config.teasOf()[0];
        photos = [
          MM.config.imageUrl(tea.name, "干茶"),
          MM.config.imageUrl(tea.name, "汤色"),
          MM.config.imageUrl(tea.name, "叶底")
        ];
        renderPhotos();
        MM.ui.toast("已填入 3 张示例图");
      });
    }
    document.getElementById("save-draft").addEventListener("click", function () {
      MM.store.saveDraft("fix", { mode: mode, teaId: document.getElementById("tea-select").value });
      MM.ui.toast("草稿已保存到本机");
    });
    document.getElementById("fix-submit").addEventListener("click", submit);
  }

  MM.dom.ready(function () {
    formCard = document.getElementById("form-card");
    var pType = MM.dom.param("type");
    editId = MM.dom.param("id") || "";
    if (editId) editSub = MM.store.findSubmission(editId);
    mode = editSub && editSub.type === "t1" ? "t1" : (["t3", "t4"].indexOf(pType) > -1 ? pType : "t1");
    if (!editId && mode === "t1") mode = "t3";

    if (!MM.store.requirePageLogin("submit-fix.html" + window.location.search, "提交投稿")) return;
    MM.ui.initChrome("submit");
    typeTabs();
    renderForm();

    document.getElementById("type-tabs").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-mode]");
      if (!btn) return;
      mode = btn.getAttribute("data-mode");
      typeTabs();
      renderForm();
    });
  });
})();
