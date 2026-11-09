/* P16 账号设置 */
(function () {
  var COLORS = ["#B34A33", "#3E7C76", "#5B3A2C", "#6F9B4E", "#D9A93B", "#1A1815"];
  var currentColor = MM.demoUser.color;
  var modal;

  function renderAvatar() {
    var user = MM.store.session();
    var nick = document.getElementById("nick").value || user.nick;
    var av = document.getElementById("edit-avatar");
    av.textContent = nick.slice(0, 1);
    av.style.background = currentColor;
  }

  function renderColors() {
    document.getElementById("color-row").innerHTML = COLORS.map(function (c) {
      return '<button type="button" class="color-dot' + (c === currentColor ? " is-active" : "") +
        '" data-color="' + c + '" style="background:' + c + '" aria-label="选择头像底色 ' + c + '"></button>';
    }).join("");
  }

  function renderStatus() {
    var status = MM.store.accountStatus();
    var text = document.getElementById("status-text");
    var actions = document.getElementById("danger-actions");
    if (status.state === "cooling") {
      text.textContent = "注销申请中（至 " + status.until + "）";
      actions.innerHTML = '<button class="btn btn-secondary" id="cancel-delete" type="button">撤销注销申请</button>';
      document.getElementById("cancel-delete").addEventListener("click", function () {
        MM.store.setAccountStatus({ state: "normal", until: null });
        renderStatus();
        MM.ui.toast("已撤销注销，账号恢复正常");
      });
    } else {
      text.textContent = "正常";
      actions.innerHTML = '<button class="btn btn-danger" id="start-delete" type="button">申请注销账号</button>';
      document.getElementById("start-delete").addEventListener("click", function () {
        document.getElementById("delete-ack").checked = false;
        document.getElementById("delete-confirm").disabled = true;
        modal.hidden = false;
      });
    }
  }

  function saveProfile() {
    var nick = document.getElementById("nick").value.trim();
    var err = document.getElementById("nick-error");
    if (nick.length < 2 || nick.length > 12) {
      err.textContent = "昵称需为 2～12 个字符";
      document.getElementById("nick").focus();
      return;
    }
    err.textContent = "";
    var user = MM.store.session();
    user.nick = nick;
    user.color = currentColor;
    user.signature = document.getElementById("signature").value.trim();
    user.notify = document.getElementById("notify").checked;
    MM.store.write(MM.config.KEYS.session, user);
    MM.ui.refreshHeaderUser();
    renderAvatar();
    MM.ui.toast("资料已保存");
  }

  function daysLater(n) {
    var d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }

  MM.dom.ready(function () {
    modal = document.getElementById("delete-modal");
    if (!MM.store.requirePageLogin("settings.html", "账号设置")) return;
    MM.ui.initChrome("settings");
    var user = MM.store.session();

    document.getElementById("nick").value = user.nick;
    document.getElementById("signature").value = user.signature || "";
    document.getElementById("notify").checked = user.notify !== false;
    var sigCounter = document.getElementById("signature-counter");
    function updateSigCounter() { sigCounter.textContent = document.getElementById("signature").value.length + "/30"; }
    document.getElementById("signature").addEventListener("input", updateSigCounter);
    updateSigCounter();
    currentColor = user.color || MM.demoUser.color;
    renderColors();
    renderAvatar();
    renderStatus();
    document.getElementById("openid-text").textContent = "mock-openid-****" + (user.openid || "").slice(-4);
    document.getElementById("joined-text").textContent = MM.demoUser.joined;

    document.getElementById("nick").addEventListener("input", renderAvatar);
    document.getElementById("color-row").addEventListener("click", function (e) {
      var dot = e.target.closest("[data-color]");
      if (!dot) return;
      currentColor = dot.getAttribute("data-color");
      renderColors();
      renderAvatar();
    });
    document.getElementById("save-profile").addEventListener("click", saveProfile);
    document.getElementById("logout").addEventListener("click", function () {
      MM.store.logout();
      window.location.href = "index.html";
    });

    document.getElementById("delete-ack").addEventListener("change", function (e) {
      document.getElementById("delete-confirm").disabled = !e.target.checked;
    });
    document.getElementById("delete-cancel").addEventListener("click", function () { modal.hidden = true; });
    modal.addEventListener("click", function (e) { if (e.target === modal) modal.hidden = true; });
    document.getElementById("delete-confirm").addEventListener("click", function () {
      MM.store.setAccountStatus({ state: "cooling", until: daysLater(7) });
      modal.hidden = true;
      renderStatus();
      MM.ui.toast("已进入 7 天冷静期，可随时撤销");
    });
  });
})();
