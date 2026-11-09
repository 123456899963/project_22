/* P07 图鉴浏览 */
(function () {
  var TYPES = ["干茶", "汤色", "叶底"];
  var state = { tab: "official", cat: "", type: "", visible: 12 };
  var wall, emptyBox, moreBox, summary, lightbox, lightboxImg, lightboxMeta;

  function readParams() {
    state.tab = MM.dom.param("tab") === "user" ? "user" : "official";
    var cat = MM.dom.param("cat");
    state.cat = MM.categories.some(function (c) { return c.id === cat; }) ? cat : "";
    state.type = TYPES.indexOf(MM.dom.param("type")) > -1 ? MM.dom.param("type") : "";
  }

  function items() {
    var list = [];
    if (state.tab === "official") {
      MM.config.teasOf().forEach(function (tea) {
        if (state.cat && tea.cat !== state.cat) return;
        TYPES.forEach(function (type) {
          if (state.type && type !== state.type) return;
          list.push({
            key: tea.id + "-" + type,
            tea: tea,
            type: type,
            img: MM.config.imageUrl(tea.name, type),
            user: "",
            source: "编辑自拍",
            copyright: "© 茗脉"
          });
        });
      });
      list.sort(function (a, b) { return a.tea.updated < b.tea.updated ? 1 : -1; });
    } else {
      (MM.userGallery || []).forEach(function (ug) {
        var tea = MM.config.tea(ug.teaId);
        if (!tea) return;
        if (state.cat && tea.cat !== state.cat) return;
        if (state.type && ug.type !== state.type) return;
        list.push({
          key: ug.id,
          tea: tea,
          type: ug.type,
          img: MM.config.imageUrl(tea.name + " 用户实拍", ug.type),
          user: ug.user,
          source: "用户书面授权",
          copyright: "© " + ug.user,
          time: ug.time
        });
      });
    }
    return list;
  }

  function renderTabs() {
    var base = "gallery.html?";
    document.getElementById("official-count").textContent = MM.config.teasOf().length * TYPES.length;
    document.getElementById("user-count").textContent = (MM.userGallery || []).length;
    MM.dom.qsa("#gallery-tabs a").forEach(function (a) {
      var tab = a.getAttribute("data-tab");
      a.classList.toggle("is-active", tab === state.tab);
      a.href = tab === "official" ? "gallery.html" : "gallery.html?tab=user";
    });
  }

  function renderCats() {
    var box = document.getElementById("gallery-cats");
    var all = '<a class="cat-bar__pill' + (state.cat === "" ? " is-active" : "") + '" href="gallery.html?tab=' +
      state.tab + '">全部茶类</a>';
    box.innerHTML = all + MM.categories.map(function (c) {
      var params = "tab=" + state.tab + "&cat=" + c.id;
      var active = state.cat === c.id ? " is-active" : "";
      return '<a class="cat-bar__pill' + active + '" data-cat="' + c.id + '" href="gallery.html?' + params + '">' +
        c.name + "</a>";
    }).join("");
    box.setAttribute("data-cat", state.cat || "green");
  }

  function renderTypes() {
    var box = document.getElementById("gallery-types");
    var opts = [""].concat(TYPES);
    box.innerHTML = opts.map(function (t) {
      var on = state.type === t ? " chip--active" : "";
      return '<button type="button" class="chip chip--btn' + on + '" data-type="' + t + '">' +
        (t || "全部类型") + "</button>";
    }).join("");
  }

  function render() {
    var list = items();
    var shown = list.slice(0, state.visible);
    var typeLabel = state.type || "全部类型";
    summary.textContent = (state.tab === "official" ? "官方图鉴" : "用户实拍") +
      " · " + (state.cat ? MM.config.category(state.cat).name : "全部茶类") +
      " · " + typeLabel + " · 共 " + list.length + " 张";

    wall.innerHTML = shown.map(function (item) {
      return '<article class="gallery-card">' +
        '<button class="gallery-card__media" type="button" data-open="' + MM.dom.esc(item.key) + '" aria-label="查看大图">' +
          '<img src="' + MM.dom.esc(item.img) + '" alt="' + MM.dom.esc(item.tea.name + " " + item.type) +
            '" data-fb-name="' + MM.dom.esc(item.tea.name) + '" data-fb-type="' + MM.dom.esc(item.type) +
            '" data-fb-cat="' + item.tea.cat + '" loading="lazy">' +
          '<span class="chip gallery-card__type">' + MM.dom.esc(item.type) + "</span>" +
        "</button>" +
        '<div class="gallery-card__body">' +
          '<a class="gallery-card__name" href="detail.html?id=' + item.tea.id + '">' + MM.dom.esc(item.tea.name) + "</a>" +
          '<span class="gallery-card__meta">' + MM.dom.esc(item.tea.sub) + " · " + MM.dom.esc(item.type) +
            (item.user ? " · " + MM.dom.esc(item.user) : "") + "</span>" +
          '<span class="gallery-card__foot"><span class="gallery-card__meta">' + MM.dom.esc(item.source) + "</span>" +
            '<button class="btn-link" type="button" data-report="' + MM.dom.esc(item.key) + '">举报</button></span>' +
        "</div>" +
      "</article>";
    }).join("");
    MM.ui.attachImageFallback(wall);

    emptyBox.classList.add("hidden");
    if (!list.length) {
      wall.classList.add("hidden");
      emptyBox.classList.remove("hidden");
      emptyBox.innerHTML = MM.ui.emptyHTML({
        title: "该条件下暂无图鉴",
        desc: "可以切换茶类或图片类型，也可以为这款茶补充实拍图。",
        actionText: "查看全部图鉴",
        actionHref: "gallery.html?tab=" + state.tab
      });
    } else {
      wall.classList.remove("hidden");
    }

    if (list.length > shown.length) {
      moreBox.innerHTML = '<button class="btn btn-secondary" id="gallery-load">加载更多（剩余 ' +
        (list.length - shown.length) + " 张）</button>";
      document.getElementById("gallery-load").addEventListener("click", function () {
        state.visible += 12;
        render();
      });
    } else {
      moreBox.innerHTML = list.length ? '<p class="caption">已加载全部</p>' : "";
    }

    document.getElementById("user-note").hidden = state.tab !== "user";
    document.getElementById("gallery-tabs").setAttribute("data-cat", state.cat || "green");
  }

  function openLightbox(item) {
    lightboxImg.src = item.img;
    lightboxImg.setAttribute("data-fb-name", item.tea.name);
    lightboxImg.setAttribute("data-fb-type", item.type);
    lightboxImg.setAttribute("data-fb-cat", item.tea.cat);
    lightboxImg.alt = item.tea.name + " " + item.type;
    lightboxMeta.innerHTML = MM.dom.esc(item.tea.name + " · " + item.type) +
      " · 来源：" + MM.dom.esc(item.source) + " · 版权：" + MM.dom.esc(item.copyright) +
      ' · <a class="btn-link" href="report.html?objType=gallery&amp;title=' +
      encodeURIComponent(item.tea.name + " " + item.type) + '">举报这张图</a>';
    lightbox.hidden = false;
    document.body.classList.add("no-scroll");
    MM.ui.attachImageFallback(lightbox);
  }

  function closeLightbox() {
    lightbox.hidden = true;
    document.body.classList.remove("no-scroll");
  }

  function openReport(item) {
    MM.ui.requireLogin("举报图片", function () {
      window.location.href = "report.html?objType=gallery&title=" +
        encodeURIComponent(item.tea.name + " " + item.type);
    });
  }

  MM.dom.ready(function () {
    wall = document.getElementById("gallery-wall");
    emptyBox = document.getElementById("gallery-empty");
    moreBox = document.getElementById("gallery-more");
    summary = document.getElementById("gallery-summary");
    lightbox = document.getElementById("lightbox");
    lightboxImg = document.getElementById("lightbox-img");
    lightboxMeta = document.getElementById("lightbox-meta");

    MM.ui.initChrome("gallery");
    readParams();
    renderTabs();
    renderCats();
    renderTypes();
    render();

    document.getElementById("gallery-types").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-type]");
      if (!btn) return;
      state.type = btn.getAttribute("data-type");
      state.visible = 12;
      renderTypes();
      render();
    });

    wall.addEventListener("click", function (e) {
      var openBtn = e.target.closest("[data-open]");
      var reportBtn = e.target.closest("[data-report]");
      if (openBtn) {
        var item = items().filter(function (x) { return x.key === openBtn.getAttribute("data-open"); })[0];
        if (item) openLightbox(item);
      } else if (reportBtn) {
        var item2 = items().filter(function (x) { return x.key === reportBtn.getAttribute("data-report"); })[0];
        if (item2) openReport(item2);
      }
    });

    document.getElementById("lightbox-close").addEventListener("click", closeLightbox);
    lightbox.addEventListener("click", function (e) {
      if (e.target === lightbox) closeLightbox();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !lightbox.hidden) closeLightbox();
    });
  });
})();
