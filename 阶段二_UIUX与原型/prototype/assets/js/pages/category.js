/* P02 茶类列表页 · 8 维筛选 */
(function () {
  var FILTERS = [
    { key: "region", label: "产区" },
    { key: "ferment", label: "发酵度" },
    { key: "aroma", label: "香气" },
    { key: "season", label: "采摘季节" },
    { key: "grade", label: "等级" },
    { key: "year", label: "年份" }
  ];
  var GRADE_ORDER = { "特级": 0, "一级": 1, "二级": 2, "未分档": 3 };

  var state = {
    type: "green",
    sub: "",
    sort: "default",
    expanded: false,
    visible: MM.config.PAGE_SIZE,
    filters: { region: [], ferment: [], aroma: [], season: [], grade: [], year: [] }
  };

  var root, grid, emptyBox, countBox, loadBox, titleEl, introEl, enEl, sortEl;
  var filterRows, drawerBody, chipsBar;

  function readParams() {
    var type = MM.dom.param("type") || "green";
    state.type = MM.categories.some(function (c) { return c.id === type; }) ? type : "green";
    var cat = MM.config.category(state.type);
    var sub = MM.dom.param("sub");
    state.sub = cat.subs.indexOf(sub) > -1 ? sub : "";
    var sort = MM.dom.param("sort");
    state.sort = ["pinyin", "grade"].indexOf(sort) > -1 ? sort : "default";
    FILTERS.forEach(function (f) {
      var raw = MM.dom.param(f.key);
      state.filters[f.key] = raw ? raw.split(",").filter(Boolean) : [];
    });
  }

  function catTeas() {
    return MM.config.teasOf(state.type);
  }

  function optionsOf(key) {
    var list = catTeas();
    var values = [];
    list.forEach(function (t) {
      var v;
      if (key === "region") v = [MM.config.regionOf(t)];
      else if (key === "season") v = MM.config.seasonsOf(t);
      else if (key === "grade") v = t.grade.length ? t.grade : ["未分档"];
      else if (key === "year") v = t.year ? [String(t.year)] : [];
      else v = Array.isArray(t[key]) ? t[key] : [t[key]];
      v.forEach(function (item) { if (item && values.indexOf(item) === -1) values.push(item); });
    });
    if (key === "region") {
      values.sort(function (a, b) { return MM.config.PROVINCES.indexOf(a) - MM.config.PROVINCES.indexOf(b); });
    }
    if (key === "season") {
      var order = ["明前", "雨前", "春茶", "夏茶", "秋茶", "全年"];
      values.sort(function (a, b) { return order.indexOf(a) - order.indexOf(b); });
    }
    if (key === "year") values.sort(function (a, b) { return Number(b) - Number(a); });
    if (key === "grade") {
      values.sort(function (a, b) { return (GRADE_ORDER[a] || 0) - (GRADE_ORDER[b] || 0); });
    }
    return values;
  }

  function renderFilterRows() {
    var html = FILTERS.map(function (f, i) {
      var vals = optionsOf(f.key);
      if (vals.length === 0) return "";
      var chips = vals.map(function (v) {
        var on = state.filters[f.key].indexOf(v) > -1 ? " chip--active" : "";
        return '<button type="button" class="chip chip--btn' + on + '" data-filter-key="' + f.key +
          '" data-filter-value="' + MM.dom.esc(v) + '">' + MM.dom.esc(v) + "</button>";
      }).join("");
      return '<div class="filter-row' + (i > 1 && !state.expanded ? " is-folded" : "") + '">' +
        '<div class="filter-row__label">' + f.label + "</div>" +
        '<div class="filter-row__chips">' + chips + "</div></div>";
    }).join("");
    filterRows.innerHTML = html;
    document.getElementById("filter-toggle").textContent = state.expanded ? "收起" : "展开更多";
    document.getElementById("filter-toggle").style.visibility =
      FILTERS.filter(function (f) { return optionsOf(f.key).length > 0; }).length > 2 ? "visible" : "hidden";

    drawerBody.innerHTML = FILTERS.map(function (f) {
      var vals = optionsOf(f.key);
      if (!vals.length) return "";
      return '<div class="filter-row"><div class="filter-row__label">' + f.label + "</div>" +
        '<div class="filter-row__chips">' + vals.map(function (v) {
          var on = state.filters[f.key].indexOf(v) > -1 ? " chip--active" : "";
          return '<button type="button" class="chip chip--btn' + on + '" data-filter-key="' + f.key +
            '" data-filter-value="' + MM.dom.esc(v) + '">' + MM.dom.esc(v) + "</button>";
        }).join("") + "</div></div>";
    }).join("");
  }

  function renderChipsBar() {
    var items = [];
    FILTERS.forEach(function (f) {
      state.filters[f.key].forEach(function (v) {
        items.push({ key: f.key, label: f.label, value: v });
      });
    });
    if (items.length === 0) {
      chipsBar.classList.add("hidden");
      chipsBar.innerHTML = "";
      return;
    }
    chipsBar.classList.remove("hidden");
    chipsBar.innerHTML = '<span class="filter-chips__count">已选 ' + items.length + " 项</span>" +
      items.map(function (it) {
        return '<button type="button" class="chip chip--active chip--close" aria-label="移除筛选：' +
          it.label + " " + it.value + '" data-remove-key="' + it.key + '" data-remove-value="' +
          MM.dom.esc(it.value) + '">' + it.label + "：" + MM.dom.esc(it.value) + "<span>×</span></button>";
      }).join("") +
      '<button type="button" class="btn-link filter-chips__clear" id="clear-filters" aria-label="清空全部筛选">清空全部</button>';
  }

  function setFilters() {
    var updates = {};
    FILTERS.forEach(function (f) {
      updates[f.key] = state.filters[f.key].join(",");
    });
    MM.dom.setParams(updates);
  }

  function matches(tea) {
    var f = state.filters;
    if (f.region.length && f.region.indexOf(MM.config.regionOf(tea)) === -1) return false;
    if (f.ferment.length && f.ferment.indexOf(tea.ferment) === -1) return false;
    if (f.aroma.length && !tea.aroma.some(function (a) { return f.aroma.indexOf(a) > -1; })) return false;
    if (f.season.length && !MM.config.seasonsOf(tea).some(function (s) { return f.season.indexOf(s) > -1; })) return false;
    if (f.grade.length) {
      var g = tea.grade.length ? tea.grade : ["未分档"];
      if (!g.some(function (x) { return f.grade.indexOf(x) > -1; })) return false;
    }
    if (f.year.length && f.year.indexOf(String(tea.year || "")) === -1) return false;
    return true;
  }

  function filteredList() {
    var list = state.sub ? MM.config.subTeas(state.type, state.sub) : catTeas();
    list = list.filter(matches);
    if (state.sort === "pinyin") {
      list = list.slice().sort(function (a, b) { return a.py.localeCompare(b.py); });
    } else if (state.sort === "grade") {
      list = list.slice().sort(function (a, b) {
        var ga = a.grade.length ? GRADE_ORDER[a.grade[0]] : GRADE_ORDER["未分档"];
        var gb = b.grade.length ? GRADE_ORDER[b.grade[0]] : GRADE_ORDER["未分档"];
        return ga - gb;
      });
    } else {
      list = list.slice().sort(function (a, b) { return a.updated < b.updated ? 1 : -1; });
    }
    return list;
  }

  function anyFilter() {
    return FILTERS.some(function (f) { return state.filters[f.key].length > 0; });
  }

  function recommends() {
    return catTeas().filter(function (t) {
      return !state.sub || t.sub !== state.sub;
    }).slice(0, 3);
  }

  function render() {
    var list = filteredList();
    var shown = list.slice(0, state.visible);
    countBox.textContent = "共 " + list.length + " 款 · 已显示 " + shown.length;
    grid.innerHTML = shown.map(function (t) { return MM.ui.teaCard(t); }).join("");
    MM.ui.attachImageFallback(grid);

    emptyBox.classList.add("hidden");
    grid.classList.remove("hidden");

    if (list.length === 0) {
      grid.classList.add("hidden");
      emptyBox.classList.remove("hidden");
      if (state.sub && MM.config.isBuilding(state.type, state.sub) && !anyFilter()) {
        emptyBox.innerHTML = MM.ui.emptyHTML({
          title: "该亚类内容建设中",
          desc: "「" + state.sub + "」暂时没有已上架茶品，可先浏览同类其他亚类。",
          actionText: "浏览同茶类其他亚类"
        });
        emptyBox.querySelector("[data-empty-action]").addEventListener("click", function () {
          state.sub = "";
          state.visible = MM.config.PAGE_SIZE;
          MM.dom.setParams({ sub: "" });
          renderSubBar();
          render();
        });
      } else {
        var rec = recommends();
        emptyBox.innerHTML = MM.ui.emptyHTML({
          title: "没有符合条件的茶品",
          desc: "当前筛选组合暂无结果，可清除筛选条件，或看看这些茶品。",
          actionText: "清除筛选"
        }) + (rec.length ? '<div class="grid-tea mt-4">' +
          rec.map(function (t) { return MM.ui.teaCard(t); }).join("") + "</div>" : "");
        MM.ui.attachImageFallback(emptyBox);
        emptyBox.querySelector("[data-empty-action]").addEventListener("click", function () {
          clearAllFilters();
        });
      }
    }

    if (list.length > shown.length) {
      loadBox.innerHTML = '<button class="btn btn-secondary" id="load-more-btn">加载更多（剩余 ' +
        (list.length - shown.length) + " 款）</button>";
      document.getElementById("load-more-btn").addEventListener("click", function () {
        state.visible += MM.config.PAGE_SIZE;
        render();
      });
    } else {
      loadBox.innerHTML = list.length ? '<p class="caption">已加载全部</p>' : "";
    }
  }

  function clearAllFilters() {
    FILTERS.forEach(function (f) { state.filters[f.key] = []; });
    state.visible = MM.config.PAGE_SIZE;
    setFilters();
    renderFilterRows();
    renderChipsBar();
    render();
  }

  function applyCategory() {
    var cat = MM.config.category(state.type);
    root.setAttribute("data-cat", cat.id);
    titleEl.textContent = cat.name;
    introEl.textContent = cat.intro;
    enEl.textContent = cat.en || "";
    document.title = cat.name + " · 茶类浏览 · 茗脉";
  }

  function renderBreadcrumb() {
    document.getElementById("crumb-sub").textContent = state.sub || "全部";
  }

  function renderCatBar() {
    var cat = MM.config.category(state.type);
    var qs = "";
    document.getElementById("cat-bar").innerHTML = MM.categories.map(function (c) {
      var active = c.id === cat.id ? " is-active" : "";
      return '<a class="cat-bar__pill' + active + '" data-cat="' + c.id + '" href="category.html?type=' + c.id + qs + '">' +
        c.name + "</a>";
    }).join("");
    document.getElementById("cat-bar").setAttribute("data-cat", cat.id);
  }

  function renderSubBar() {
    var cat = MM.config.category(state.type);
    var allActive = state.sub === "" ? " is-active" : "";
    var html = '<a class="sub-bar__item' + allActive + '" href="category.html?type=' + cat.id + '">全部<small>' +
      MM.config.teasOf(cat.id).length + "</small></a>";
    html += cat.subs.map(function (sub) {
      var n = MM.config.subCount(cat.id, sub);
      var active = state.sub === sub ? " is-active" : "";
      var emptyClass = n === 0 ? " is-empty" : "";
      var suffix = n === 0 ? "<small>建设中</small>" : "<small>" + n + "</small>";
      return '<a class="sub-bar__item' + active + emptyClass + '" href="category.html?type=' + cat.id +
        "&sub=" + encodeURIComponent(sub) + '">' + MM.dom.esc(sub) + suffix + "</a>";
    }).join("");
    document.getElementById("sub-bar").innerHTML = html;
  }

  function toggleFilter(btn) {
    var key = btn.getAttribute("data-filter-key");
    var value = btn.getAttribute("data-filter-value");
    var list = state.filters[key];
    var idx = list.indexOf(value);
    if (idx > -1) list.splice(idx, 1); else list.push(value);
    state.visible = MM.config.PAGE_SIZE;
    setFilters();
    renderFilterRows();
    renderChipsBar();
    render();
  }

  function openDrawer(open) {
    var drawer = document.getElementById("filter-drawer");
    drawer.classList.toggle("is-open", open);
    drawer.setAttribute("aria-hidden", open ? "false" : "true");
    document.body.classList.toggle("no-scroll", open);
  }

  MM.dom.ready(function () {
    root = document.getElementById("page-root");
    grid = document.getElementById("tea-grid");
    emptyBox = document.getElementById("list-empty");
    countBox = document.getElementById("result-count");
    loadBox = document.getElementById("load-more");
    titleEl = document.getElementById("cat-title");
    introEl = document.getElementById("cat-intro");
    enEl = document.getElementById("cat-en");
    sortEl = document.getElementById("sort");
    filterRows = document.getElementById("filter-rows");
    drawerBody = document.getElementById("filter-drawer-body");
    chipsBar = document.getElementById("filter-chips");

    MM.ui.initChrome("category");
    readParams();
    applyCategory();
    renderBreadcrumb();
    renderCatBar();
    renderSubBar();
    renderFilterRows();
    renderChipsBar();
    sortEl.value = state.sort;
    render();

    document.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-filter-key]");
      if (btn) { toggleFilter(btn); return; }
      var rm = e.target.closest("[data-remove-key]");
      if (rm) {
        var key = rm.getAttribute("data-remove-key");
        var value = rm.getAttribute("data-remove-value");
        state.filters[key] = state.filters[key].filter(function (v) { return v !== value; });
        state.visible = MM.config.PAGE_SIZE;
        setFilters();
        renderFilterRows();
        renderChipsBar();
        render();
      }
      if (e.target.closest("#clear-filters")) clearAllFilters();
    });

    document.getElementById("filter-toggle").addEventListener("click", function () {
      state.expanded = !state.expanded;
      renderFilterRows();
    });

    sortEl.addEventListener("change", function () {
      state.sort = sortEl.value;
      state.visible = MM.config.PAGE_SIZE;
      MM.dom.setParams({ sort: state.sort === "default" ? "" : state.sort });
      render();
    });

    document.getElementById("filter-mobile-btn").addEventListener("click", function () { openDrawer(true); });
    MM.dom.qsa("[data-drawer-close]").forEach(function (el) {
      el.addEventListener("click", function () { openDrawer(false); });
    });
    document.getElementById("drawer-reset").addEventListener("click", function () {
      clearAllFilters();
      renderFilterRows();
      renderChipsBar();
      render();
    });
    document.getElementById("drawer-apply").addEventListener("click", function () {
      openDrawer(false);
      render();
    });
  });
})();
