/* P09 我的收藏 */
(function () {
  var group = "want";
  var listBox, emptyBox;

  function entries() {
    var all = MM.store.favEntries();
    return group === "all" ? all : all.filter(function (f) { return f.group === group; });
  }

  function renderTabs() {
    var all = MM.store.favEntries();
    var counts = {
      want: all.filter(function (f) { return f.group === "want"; }).length,
      drunk: all.filter(function (f) { return f.group === "drunk"; }).length,
      all: all.length
    };
    document.getElementById("fav-total").textContent = "共 " + all.length + " / 500 条";
    MM.dom.qsa("#fav-tabs button").forEach(function (btn) {
      var g = btn.getAttribute("data-group");
      btn.classList.toggle("is-active", g === group);
      btn.querySelector(".tab-count").textContent = counts[g];
    });
  }

  function render() {
    renderTabs();
    var rows = entries();
    if (!rows.length) {
      listBox.innerHTML = "";
      emptyBox.classList.remove("hidden");
      emptyBox.innerHTML = MM.ui.emptyHTML({
        title: group === "drunk" ? "「已喝」分组还是空的" : "还没有收藏",
        desc: group === "drunk" ? "在「想喝」里喝过之后，可以移动到「已喝」。" : "在茶品详情页点击「收藏」，默认进入「想喝」。",
        actionText: "去逛茶类",
        actionHref: "category.html?type=green"
      });
      return;
    }
    emptyBox.classList.add("hidden");
    listBox.innerHTML = rows.map(function (f) {
      var t = MM.config.tea(f.id);
      if (!t) return "";
      var cat = MM.config.category(t.cat);
      var other = f.group === "want"
        ? '<button class="btn btn-secondary btn-sm" type="button" data-move="' + t.id + '" data-to="drunk">移到已喝</button>'
        : '<button class="btn btn-secondary btn-sm" type="button" data-move="' + t.id + '" data-to="want">移回想喝</button>';
      return '<div class="list-row" data-cat="' + t.cat + '">' +
        '<img class="thumb" src="' + MM.dom.esc(MM.config.imageUrl(t.name, "干茶")) + '" alt="" data-fb-name="' +
          MM.dom.esc(t.name) + '" data-fb-type="干茶" data-fb-cat="' + t.cat + '">' +
        '<div class="list-row__main">' +
          '<a class="list-row__title" href="detail.html?id=' + t.id + '">' + MM.dom.esc(t.name) + "</a>" +
          '<div class="list-row__desc">' + cat.name + " · " + MM.dom.esc(t.sub) + " · " +
            MM.dom.esc(MM.config.gradeText(t)) + (t.year ? " · " + t.year + " 年" : "") + "</div>" +
          '<div class="list-row__desc">收藏于 ' + MM.dom.esc(f.time) + "</div>" +
        "</div>" +
        '<span class="chip">' + (f.group === "want" ? "想喝" : "已喝") + "</span>" +
        '<div class="list-row__actions">' + other +
          '<button class="btn-link" type="button" data-remove="' + t.id + '">移除</button></div>' +
      "</div>";
    }).join("");
    MM.ui.attachImageFallback(listBox);
  }

  MM.dom.ready(function () {
    listBox = document.getElementById("fav-list");
    emptyBox = document.getElementById("fav-empty");
    if (!MM.store.requirePageLogin("favorites.html", "查看收藏")) return;
    MM.ui.initChrome("favorites");

    document.getElementById("fav-tabs").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-group]");
      if (!btn) return;
      group = btn.getAttribute("data-group");
      render();
    });

    listBox.addEventListener("click", function (e) {
      var move = e.target.closest("[data-move]");
      var rm = e.target.closest("[data-remove]");
      if (move) {
        MM.store.moveFav(move.getAttribute("data-move"), move.getAttribute("data-to"));
        MM.ui.toast("已移动分组");
        render();
      } else if (rm) {
        var teaId = rm.getAttribute("data-remove");
        var tea = MM.config.tea(teaId);
        MM.ui.modal({
          title: "取消收藏？",
          desc: "「" + (tea ? tea.name : "该茶品") + "」将从收藏中移除，可随时重新收藏。",
          actions: [
            { label: "保留", kind: "btn-secondary" },
            { label: "确认取消", kind: "btn-danger", onClick: function () {
                MM.store.removeFav(teaId);
                MM.ui.toast("已取消收藏");
                render();
              } }
          ]
        });
      }
    });

    render();
  });
})();
