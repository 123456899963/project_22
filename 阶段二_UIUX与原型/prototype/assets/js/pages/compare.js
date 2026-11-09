/* P08 茶品对比 */
(function () {
  var slotsBox, tableBox, hintBox, footBox, modal, listBox, searchInput;
  var ROWS = [
    { label: "茶类 / 亚类", get: function (t) { return MM.config.category(t.cat).name + " · " + t.sub; } },
    { label: "产地", get: function (t) { return t.origin; } },
    { label: "生产年份", get: function (t) { return MM.config.yearLabel(t) || "暂无"; } },
    { label: "等级", get: function (t) { return MM.config.gradeText(t); } },
    { label: "采摘季节", get: function (t) { return MM.config.seasonsOf(t).join("/") || "暂无"; } },
    { label: "发酵度", get: function (t) { return t.ferment; } },
    { label: "香气", get: function (t) { return t.aroma.join("、"); } },
    { label: "汤色", get: function (t) { return t.soup.join("、"); } },
    { label: "干茶形态", get: function (t) { return t.shape.join("、"); } },
    { label: "水温", get: function (t) { return t.temp; } },
    { label: "茶水比", get: function (t) { return t.ratio; } },
    { label: "器皿", get: function (t) { return t.vessel; } },
    { label: "出汤时间", get: function (t) { return t.seconds; } },
    { label: "可冲泡次数", get: function (t) { return t.times + " 次"; } },
    { label: "标准号", get: function (t) { return t.std.join("；") || "暂无"; } },
    { label: "最后更新", get: function (t) { return t.updated; } }
  ];

  function teas() {
    return MM.store.compare().map(function (id) { return MM.config.tea(id); }).filter(Boolean);
  }

  function renderSlots() {
    var list = teas();
    var html = "";
    for (var i = 0; i < 3; i++) {
      var t = list[i];
      if (t) {
        html += '<div class="compare-slot is-filled">' +
          '<div class="compare-slot__head">' +
            '<a class="gallery-card__name" href="detail.html?id=' + t.id + '">' + MM.dom.esc(t.name) + "</a>" +
            '<button class="btn-link" type="button" data-remove="' + t.id + '">移除</button>' +
          "</div>" +
          '<img class="thumb" src="' + MM.dom.esc(MM.config.imageUrl(t.name, "干茶")) + '" alt="" data-fb-name="' +
            MM.dom.esc(t.name) + '" data-fb-type="干茶" data-fb-cat="' + t.cat + '">' +
          '<span class="caption">' + MM.dom.esc(t.sub) + " · " + MM.dom.esc(MM.config.gradeText(t)) +
            (t.year ? " · " + t.year + " 年" : "") + "</span>" +
        "</div>";
      } else {
        html += '<div class="compare-slot">' +
          '<div class="compare-slot__head"><span class="caption">对比位 ' + (i + 1) + "</span></div>" +
          '<button class="btn btn-secondary btn-sm" type="button" data-add>+ 添加茶品</button>' +
          '<span class="caption">可选 ' + MM.config.teasOf().length + " 款已收录茶品</span>" +
        "</div>";
      }
    }
    slotsBox.innerHTML = html;
    MM.ui.attachImageFallback(slotsBox);
  }

  function renderTable() {
    var list = teas();
    if (list.length < 2) {
      tableBox.innerHTML = "";
      if (list.length === 0) {
        hintBox.innerHTML = MM.ui.emptyHTML({
          title: "还没有添加茶品",
          desc: "从茶类列表或详情页加入对比，最多 3 款。",
          actionText: "去选茶",
          actionHref: "category.html?type=green"
        });
      } else {
        hintBox.innerHTML = '<div class="banner banner--info">已选 1 款茶，至少再添加 1 款才能生成对比表。对比上限为 3 款。</div>';
      }
      footBox.innerHTML = list.length ? '<button class="btn-link" id="clear-compare" type="button">清空对比</button>' : "";
      bindClear();
      return;
    }
    hintBox.innerHTML = "";
    var head = '<tr><th>对比项</th>' + list.map(function (t) {
      return "<th>" + MM.dom.esc(t.name) + "</th>";
    }).join("") + "</tr>";
    var body = ROWS.map(function (row) {
      var values = list.map(function (t) { return String(row.get(t)); });
      var allSame = values.every(function (v) { return v === values[0]; });
      return "<tr><th>" + row.label + "</th>" + values.map(function (v) {
        return '<td class="' + (allSame ? "" : "is-diff") + '">' + MM.dom.esc(v) + "</td>";
      }).join("") + "</tr>";
    }).join("");
    tableBox.innerHTML = '<table class="compare-table"><thead>' + head + "</thead><tbody>" + body + "</tbody></table>" +
      '<p class="caption mt-3">带左侧竖线的单元格表示该行存在差异。</p>';
    footBox.innerHTML = '<button class="btn-link" id="clear-compare" type="button">清空对比</button>';
    bindClear();
  }

  function bindClear() {
    var btn = document.getElementById("clear-compare");
    if (btn) btn.addEventListener("click", function () {
      MM.store.clearCompare();
      render();
      MM.ui.toast("已清空对比清单");
    });
  }

  function render() {
    renderSlots();
    renderTable();
  }

  function renderAddList(keyword) {
    var kw = (keyword || "").trim().toLowerCase();
    var chosen = MM.store.compare();
    var list = MM.config.teasOf().filter(function (t) {
      if (chosen.indexOf(t.id) > -1) return false;
      if (!kw) return true;
      return (t.name + t.alias + t.py + t.origin + t.sub).toLowerCase().indexOf(kw) > -1;
    }).slice(0, 12);
    document.getElementById("modal-count").textContent = chosen.length;
    listBox.innerHTML = list.map(function (t) {
      return '<div class="list-row">' +
        '<img class="thumb thumb--sm" src="' + MM.dom.esc(MM.config.imageUrl(t.name, "干茶")) + '" alt="" data-fb-name="' +
          MM.dom.esc(t.name) + '" data-fb-type="干茶" data-fb-cat="' + t.cat + '">' +
        '<div class="list-row__main"><span class="list-row__title">' + MM.dom.esc(t.name) + "</span>" +
          '<div class="list-row__desc">' + MM.dom.esc(t.sub) + " · " + MM.dom.esc(MM.config.gradeText(t)) + "</div></div>" +
        '<button class="btn btn-secondary btn-sm" type="button" data-pick="' + t.id + '">添加</button></div>';
    }).join("") || '<p class="comment-empty">没有匹配的茶品</p>';
    MM.ui.attachImageFallback(listBox);
  }

  function openModal() {
    if (MM.store.compare().length >= 3) {
      MM.ui.toast("最多对比 3 款，请先移除一款");
      return;
    }
    modal.hidden = false;
    searchInput.value = "";
    renderAddList("");
    setTimeout(function () { searchInput.focus(); }, 50);
  }

  function closeModal() {
    modal.hidden = true;
  }

  function pick(id) {
    var res = MM.store.addCompare(id);
    if (!res.ok) { MM.ui.toast(res.reason); return; }
    var tea = MM.config.tea(id);
    MM.ui.toast(res.added ? "已添加「" + tea.name + "」" : "该茶品已在对比中");
    closeModal();
    render();
  }

  MM.dom.ready(function () {
    slotsBox = document.getElementById("compare-slots");
    tableBox = document.getElementById("compare-table");
    hintBox = document.getElementById("compare-hint");
    footBox = document.getElementById("compare-foot");
    modal = document.getElementById("add-modal");
    listBox = document.getElementById("add-list");
    searchInput = document.getElementById("add-search");

    if (!MM.store.requirePageLogin("compare.html", "使用茶品对比")) return;
    MM.ui.initChrome("compare");

    render();
    document.getElementById("add-btn").addEventListener("click", openModal);
    document.getElementById("add-close").addEventListener("click", closeModal);
    modal.addEventListener("click", function (e) { if (e.target === modal) closeModal(); });
    searchInput.addEventListener("input", MM.dom.debounce(function () {
      renderAddList(searchInput.value);
    }, 200));
    listBox.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-pick]");
      if (btn) pick(btn.getAttribute("data-pick"));
    });
    slotsBox.addEventListener("click", function (e) {
      var rm = e.target.closest("[data-remove]");
      if (rm) {
        MM.store.removeCompare(rm.getAttribute("data-remove"));
        render();
      }
      if (e.target.closest("[data-add]")) openModal();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !modal.hidden) closeModal();
    });
  });
})();
