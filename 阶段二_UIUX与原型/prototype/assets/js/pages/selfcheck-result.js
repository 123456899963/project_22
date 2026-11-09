/* P06 识茶自查结果 */
(function () {
  var DIMS = [
    { key: "shape", label: "干茶形态" },
    { key: "color", label: "色泽" },
    { key: "soup", label: "汤色" },
    { key: "ferment", label: "发酵度" },
    { key: "aroma", label: "香气" }
  ];
  var selected = {};
  var grid, emptyBox, summary, matchCount, conditionBar;

  function readParams() {
    DIMS.forEach(function (d) {
      var raw = MM.dom.param(d.key);
      selected[d.key] = raw ? raw.split(",").filter(Boolean) : [];
    });
  }

  function totalSelected() {
    return DIMS.reduce(function (n, d) { return n + selected[d.key].length; }, 0);
  }

  function matchOf(tea) {
    var hits = [];
    for (var i = 0; i < DIMS.length; i++) {
      var d = DIMS[i];
      var want = selected[d.key];
      if (!want.length) continue;
      var val = tea[d.key];
      var has = Array.isArray(val) ? val.some(function (v) { return want.indexOf(v) > -1; })
        : want.indexOf(val) > -1;
      if (!has) return null;
      hits.push(d.label + "：" + (Array.isArray(val)
        ? val.filter(function (v) { return want.indexOf(v) > -1; }).join("/")
        : val));
    }
    return hits;
  }

  function results() {
    return MM.config.teasOf().map(function (t) {
      var hits = matchOf(t);
      return hits ? { tea: t, hits: hits, score: hits.length } : null;
    }).filter(Boolean).sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return a.tea.updated < b.tea.updated ? 1 : -1;
    });
  }

  function updateUrl() {
    var updates = {};
    DIMS.forEach(function (d) { updates[d.key] = selected[d.key].join(","); });
    MM.dom.setParams(updates);
  }

  function renderConditions() {
    var items = [];
    DIMS.forEach(function (d) {
      selected[d.key].forEach(function (v) {
        items.push({ key: d.key, label: d.label, value: v });
      });
    });
    if (!items.length) {
      conditionBar.innerHTML = '<span class="caption">未设置任何特征条件</span>';
      return;
    }
    conditionBar.innerHTML = items.map(function (it) {
      return '<button type="button" class="chip chip--active chip--close" data-remove="' + it.key +
        '" data-value="' + MM.dom.esc(it.value) + '" aria-label="移除条件 ' + it.label + " " + it.value +
        '">' + it.label + "：" + MM.dom.esc(it.value) + "<span>×</span></button>";
    }).join("") + '<button class="btn-link" id="clear-conditions" type="button">清空条件</button>';
  }

  function render() {
    var n = totalSelected();
    var list = results();
    summary.textContent = n === 0
      ? "未选择任何特征，等同「不限」，当前展示全部 " + list.length + " 款茶品。"
      : "已按 " + n + " 项特征条件检索，命中 " + list.length + " 款茶品（同维度多选视为「或」）。";
    matchCount.textContent = n === 0 ? "全部 " + list.length + " 款" : "命中 " + list.length + " 款";
    renderConditions();

    if (list.length === 0) {
      grid.innerHTML = "";
      grid.classList.add("hidden");
      emptyBox.classList.remove("hidden");
      emptyBox.innerHTML = MM.ui.emptyHTML({
        title: "没有同时满足全部条件的茶品",
        desc: "自查条件过于严格。可以移除 1～2 个条件再试，或把结果反馈给编辑。",
        actionText: "清空条件，重新自查",
        actionHref: "selfcheck.html"
      }) + '<a class="btn-link mt-3" href="submit-fix.html?type=t4">仍然找不到？反馈这组特征</a>';
      return;
    }

    emptyBox.classList.add("hidden");
    grid.classList.remove("hidden");
    grid.innerHTML = list.map(function (item) {
      var note = n === 0
        ? "未设置条件，默认全部展示"
        : "命中 " + item.score + "/" + n + " 维：" + MM.dom.esc(item.hits.join("；"));
      return '<div class="result-item">' + MM.ui.teaCard(item.tea) +
        '<p class="match-note">' + note + "</p></div>";
    }).join("");
    MM.ui.attachImageFallback(grid);
  }

  MM.dom.ready(function () {
    grid = document.getElementById("result-grid");
    emptyBox = document.getElementById("result-empty");
    summary = document.getElementById("result-summary");
    matchCount = document.getElementById("match-count");
    conditionBar = document.getElementById("condition-bar");

    MM.ui.initChrome("selfcheck");
    readParams();
    render();

    document.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-remove]");
      if (btn) {
        var key = btn.getAttribute("data-remove");
        var value = btn.getAttribute("data-value");
        selected[key] = selected[key].filter(function (v) { return v !== value; });
        updateUrl();
        render();
      }
      if (e.target.closest("#clear-conditions")) {
        DIMS.forEach(function (d) { selected[d.key] = []; });
        updateUrl();
        render();
      }
    });
  });
})();
