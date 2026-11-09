/* P10 浏览历史 */
(function () {
  var listBox, emptyBox, modal;

  function render() {
    var entries = MM.store.history();
    document.getElementById("history-count").textContent = "共 " + entries.length + " / 50 条";
    if (!entries.length) {
      listBox.innerHTML = "";
      emptyBox.classList.remove("hidden");
      emptyBox.innerHTML = MM.ui.emptyHTML({
        title: "还没有浏览记录",
        desc: "打开任意茶品详情后，会自动记录在这里。",
        actionText: "去逛茶类",
        actionHref: "category.html?type=green"
      });
      return;
    }
    emptyBox.classList.add("hidden");
    listBox.innerHTML = entries.map(function (entry) {
      var t = MM.config.tea(entry.id);
      if (!t) return "";
      var cat = MM.config.category(t.cat);
      return '<div class="list-row" data-cat="' + t.cat + '">' +
        '<img class="thumb" src="' + MM.dom.esc(MM.config.imageUrl(t.name, "干茶")) + '" alt="" data-fb-name="' +
          MM.dom.esc(t.name) + '" data-fb-type="干茶" data-fb-cat="' + t.cat + '">' +
        '<div class="list-row__main">' +
          '<a class="list-row__title" href="detail.html?id=' + t.id + '">' + MM.dom.esc(t.name) + "</a>" +
          '<div class="list-row__desc">' + cat.name + " · " + MM.dom.esc(t.sub) + " · " +
            MM.dom.esc(MM.config.gradeText(t)) + "</div>" +
        "</div>" +
        '<span class="list-row__time">' + MM.dom.esc(MM.store.whenText(entry.at)) + "</span>" +
      "</div>";
    }).join("");
    MM.ui.attachImageFallback(listBox);
  }

  MM.dom.ready(function () {
    listBox = document.getElementById("history-list");
    emptyBox = document.getElementById("history-empty");
    modal = document.getElementById("clear-modal");
    if (!MM.store.requirePageLogin("history.html", "查看浏览历史")) return;
    MM.ui.initChrome("history");
    render();

    document.getElementById("clear-btn").addEventListener("click", function () {
      if (!MM.store.history().length) { MM.ui.toast("浏览历史已经是空的"); return; }
      modal.hidden = false;
    });
    document.getElementById("clear-cancel").addEventListener("click", function () { modal.hidden = true; });
    modal.addEventListener("click", function (e) { if (e.target === modal) modal.hidden = true; });
    document.getElementById("clear-confirm").addEventListener("click", function () {
      MM.store.clearHistory();
      modal.hidden = true;
      render();
      MM.ui.toast("浏览历史已清空");
    });
  });
})();
