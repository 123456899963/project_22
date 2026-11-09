/* P04 搜索结果页 */
(function () {
  var q = "";
  var type = "";

  function hits(tea, keyword) {
    var k = keyword.toLowerCase();
    var fields = [tea.name, tea.alias, tea.py, tea.origin, tea.sub, tea.ferment, tea.desc]
      .concat(tea.aroma, tea.shape, tea.color, tea.soup, tea.grade);
    return fields.join(" ").toLowerCase().indexOf(k) > -1;
  }

  function score(tea, keyword) {
    var k = keyword.toLowerCase();
    if (tea.name.toLowerCase().indexOf(k) === 0) return 3;
    if (tea.name.toLowerCase().indexOf(k) > -1) return 2.5;
    if ((tea.alias || "").toLowerCase().indexOf(k) > -1) return 2;
    if ((tea.py || "").toLowerCase().indexOf(k) > -1) return 1.5;
    return 1;
  }

  function resultCard(tea) {
    var c = MM.config.category(tea.cat);
    var esc = MM.dom.esc;
    var nameHit = MM.dom.highlight(tea.name, q);
    var aliasOnly = q && tea.alias && tea.alias.toLowerCase().indexOf(q.toLowerCase()) > -1 &&
      tea.name.toLowerCase().indexOf(q.toLowerCase()) === -1;
    var grade = tea.grade.length ? tea.grade[0] : "未分档";
    var aromas = tea.aroma.slice(0, 2).map(function (a) {
      return '<span class="chip">' + esc(a) + "</span>";
    }).join("");
    return '<a class="tea-card" data-cat="' + tea.cat + '" href="detail.html?id=' + encodeURIComponent(tea.id) + '">' +
      '<div class="tea-card__media">' +
        '<img src="' + MM.config.imageUrl(tea.name, "干茶") + '" alt="' + esc(tea.name) + ' 干茶图" loading="lazy" ' +
          'data-fb-name="' + esc(tea.name) + '" data-fb-type="干茶" data-fb-cat="' + tea.cat + '">' +
        '<span class="chip chip--cat tea-card__tag">' + esc(c.name) + "</span>" +
      "</div>" +
      '<div class="tea-card__body">' +
        '<h3 class="tea-card__name">' + nameHit + "</h3>" +
        '<p class="tea-card__meta">' + esc(tea.sub) + " · " + esc(grade) +
          (aliasOnly ? " · (别名：" + esc(tea.alias) + ")" : "") + "</p>" +
        '<p class="tea-card__meta">产地：' + MM.dom.highlight(tea.origin, q) + "</p>" +
        '<div class="tea-card__chips">' + aromas + "</div>" +
      "</div></a>";
  }

  function renderFilters() {
    var box = document.getElementById("type-filter");
    var allActive = type === "" ? " chip--active" : "";
    var base = "search.html?q=" + encodeURIComponent(q);
    var html = '<a class="chip chip--btn' + allActive + '" href="' + base + '">全部茶类</a>';
    html += MM.categories.map(function (c) {
      var active = type === c.id ? " chip--active" : "";
      return '<a class="chip chip--btn' + active + '" data-cat="' + c.id + '" href="' +
        base + "&type=" + c.id + '">' + c.name + "</a>";
    }).join("");
    box.innerHTML = html;
  }

  function renderHotWords() {
    var words = ["龙井", "碧螺春", "铁观音", "正山小种", "普洱", "六堡"];
    var chips = words.map(function (w) {
      return '<a class="chip" href="search.html?q=' + encodeURIComponent(w) + '">' + w + "</a>";
    }).join("");
    document.getElementById("results").innerHTML =
      '<div class="submit-card"><p class="body-l">输入茶名、别名、产地或拼音开始搜索。</p>' +
      '<div class="chip-row mt-4">' + chips + "</div></div>";
  }

  function render() {
    var results = document.getElementById("results");
    var empty = document.getElementById("result-empty");
    var summary = document.getElementById("summary");

    if (!q) {
      document.getElementById("summary").textContent = "试试搜索：龙井、碧螺春、正山小种、普洱";
      renderHotWords();
      empty.classList.add("hidden");
      return;
    }

    var list = MM.config.teasOf().filter(function (t) { return hits(t, q); });
    if (type) list = list.filter(function (t) { return t.cat === type; });
    list.sort(function (a, b) {
      var diff = score(b, q) - score(a, q);
      if (diff !== 0) return diff;
      return a.updated < b.updated ? 1 : -1;
    });

    summary.innerHTML = list.length
      ? '找到 <b>' + list.length + "</b> 个与「" + MM.dom.highlight(q, q) + "」相关的茶品"
      : "没有找到与「" + MM.dom.esc(q) + "」相关的茶品";

    if (list.length) {
      empty.classList.add("hidden");
      results.classList.remove("hidden");
      results.innerHTML = list.map(resultCard).join("");
      MM.ui.attachImageFallback(results);
    } else {
      results.classList.add("hidden");
      empty.classList.remove("hidden");
      var rec = MM.config.teasOf().sort(function (a, b) { return a.updated < b.updated ? 1 : -1; }).slice(0, 3);
      empty.innerHTML = MM.ui.emptyHTML({
        title: "未找到「" + q + "」",
        desc: "可能关键词过窄，或该茶品尚未收录。可换用茶类、别名或产地关键词。",
        actionText: "按茶类浏览",
        actionHref: "category.html?type=green"
      }) + '<div class="grid-tea mt-4">' + rec.map(resultCard).join("") + "</div>";
      MM.ui.attachImageFallback(empty);
    }
  }

  MM.dom.ready(function () {
    MM.ui.initChrome("search");
    q = (MM.dom.param("q") || "").trim();
    type = MM.dom.param("type") || "";
    if (MM.categories.every(function (c) { return c.id !== type; })) type = "";
    document.getElementById("search-q").value = q;
    if (q) document.title = "搜索「" + q + "」· 茗脉";
    renderFilters();
    render();
  });
})();
