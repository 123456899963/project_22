/* P01 首页 */
(function () {
  function renderCategories() {
    var box = document.getElementById("cat-grid");
    box.innerHTML = MM.categories.map(function (c) {
      var count = MM.config.teasOf(c.id).length;
      return '<a class="cat-card" data-cat="' + c.id + '" href="category.html?type=' + c.id + '">' +
        '<h3 class="cat-card__name">' + c.name + "</h3>" +
        '<p class="cat-card__meta">' + c.subs.length + " 个亚类 · " + count + " 款</p>" +
        '<div class="cat-card__bar"></div></a>';
    }).join("");
  }

  function renderFeatured() {
    var box = document.getElementById("featured");
    var list = MM.config.teasOf().sort(function (a, b) {
      return a.updated < b.updated ? 1 : -1;
    }).slice(0, 8);
    box.innerHTML = list.map(function (t) { return MM.ui.teaCard(t); }).join("");
  }

  function renderQuick() {
    var box = document.getElementById("quick-links");
    var words = ["龙井", "碧螺春", "正山小种", "普洱熟茶"];
    box.innerHTML = words.map(function (w) {
      return '<a class="chip" href="search.html?q=' + encodeURIComponent(w) + '">' + w + "</a>";
    }).join("");
  }

  function renderHeroVisual() {
    var box = document.getElementById("hero-visual");
    var items = [
      { name: "西湖龙井", type: "干茶", cat: "green" },
      { name: "正山小种", type: "汤色", cat: "red" },
      { name: "普洱熟茶", type: "叶底", cat: "dark" }
    ];
    box.innerHTML = items.map(function (it) {
      return '<img src="' + MM.config.imageUrl(it.name, it.type) + '" alt="' + it.name + it.type + '示例" ' +
        'data-fb-name="' + it.name + '" data-fb-type="' + it.type + '" data-fb-cat="' + it.cat + '">';
    }).join("");
  }

  MM.dom.ready(function () {
    MM.ui.initChrome("home");
    renderCategories();
    renderFeatured();
    renderQuick();
    renderHeroVisual();
    MM.ui.attachImageFallback(document);
  });
})();
