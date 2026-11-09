/* P03 茶品详情页（含图鉴、锚点、评论） */
(function () {
  var tea, cat, gallery = [], gIndex = 0, showAllComments = false;

  function esc(s) { return MM.dom.esc(s); }

  function render404() {
    document.getElementById("detail-hero").remove();
    document.getElementById("anchor-nav").remove();
    document.getElementById("detail-sections").innerHTML = MM.ui.emptyHTML({
      title: "未找到这款茶",
      desc: "茶品可能已下架，或链接参数不正确。",
      actionText: "返回茶类浏览",
      actionHref: "category.html?type=green"
    });
    MM.ui.toast("未找到对应的茶品");
  }

  function renderHead() {
    var box = document.getElementById("detail-head");
    var gradeText = tea.grade.length ? tea.grade.join(" / ") : "未分档";
    var offlineNote = MM.config.isLiveTea(tea) ? "" :
      '<div class="banner banner--warn" style="margin-bottom:16px">该茶品当前为「已下架」状态，仅保留历史内容，不参与列表与筛选。</div>';
    box.innerHTML =
      offlineNote +
      '<p class="detail-hero__crumbs"><a href="index.html">首页</a> / ' +
        '<a href="category.html?type=' + cat.id + '">' + cat.name + "</a> / " + esc(tea.sub) + "</p>" +
      '<h1 class="detail-title">' + esc(tea.name) + "</h1>" +
      (tea.alias ? '<p class="detail-alias">别名：' + esc(tea.alias) + "</p>" : "") +
      '<div class="detail-meta">' +
        '<span class="chip chip--cat">' + cat.name + "</span>" +
        '<span class="chip">' + esc(tea.sub) + "</span>" +
        '<span class="chip">' + esc(gradeText) + "</span>" +
        '<span class="chip">' + esc(tea.ferment) + "</span>" +
        (tea.year ? '<span class="chip">' + esc(MM.config.yearLabel(tea)) + "</span>" : "") +
      "</div>" +
      '<div class="detail-actions">' +
        '<button class="btn btn-secondary" id="fav-btn" aria-pressed="false">收藏</button>' +
        '<button class="btn btn-secondary" id="compare-btn">加入对比</button>' +
        '<a class="btn btn-primary" href="submit.html?type=t1&amp;tea=' + encodeURIComponent(tea.id) + '">写品鉴长文</a>' +
      "</div>" +
      '<div class="detail-aside mt-4">' +
        '<h4>快速信息</h4>' +
        '<ul class="aside-list">' +
          '<li><span class="label">产地</span><span class="value">' + esc(tea.origin) + "</span></li>" +
          '<li><span class="label">等级</span><span class="value">' + esc(gradeText) + "</span></li>" +
          (tea.year ? '<li><span class="label">生产年份</span><span class="value">' + esc(MM.config.yearLabel(tea)) + "</span></li>" : "") +
          '<li><span class="label">标准号</span><span class="value">' + esc(tea.std.join("；")) + "</span></li>" +
          '<li><span class="label">采摘</span><span class="value">' + esc(tea.pick) + "</span></li>" +
          '<li><span class="label">更新</span><span class="value">' + esc(tea.updated) + "</span></li>" +
        "</ul>" +
      "</div>" +
      '<button class="btn-link mt-2" id="report-btn">举报该条目</button>';

    document.getElementById("fav-btn").addEventListener("click", toggleFav);
    document.getElementById("compare-btn").addEventListener("click", function () {
      MM.ui.requireLogin("使用对比", function () {
        var res = MM.store.addCompare(tea.id);
        if (!res.ok) { MM.ui.toast(res.reason + "，请先移除一款"); return; }
        MM.ui.toast(res.added
          ? "已加入对比清单（" + MM.store.compare().length + "/3）"
          : "该茶品已在对比清单中");
      });
    });
    document.getElementById("report-btn").addEventListener("click", function () {
      report("该条目");
    });
    updateFav();
  }

  function renderGallery() {
    var wrap = document.getElementById("gallery-wrap");
    wrap.innerHTML =
      '<div class="gallery" id="gallery-anchor">' +
        '<div class="gallery__frame">' +
          '<img id="gallery-img" alt="" data-fb-name="' + esc(tea.name) + '" data-fb-type="干茶" data-fb-cat="' + tea.cat + '">' +
          '<span class="gallery__count" id="gallery-count"></span>' +
          '<button class="gallery__nav gallery__nav--prev" data-gallery="prev" aria-label="上一张">‹</button>' +
          '<button class="gallery__nav gallery__nav--next" data-gallery="next" aria-label="下一张">›</button>' +
        "</div>" +
        '<div class="gallery__caption" id="gallery-caption"></div>' +
        '<div class="gallery__dots" id="gallery-dots"></div>' +
      "</div>";

    var dots = gallery.map(function (g, i) {
      return '<button class="gallery__dot" data-dot="' + i + '" aria-label="第 ' + (i + 1) + ' 张"></button>';
    }).join("");
    document.getElementById("gallery-dots").innerHTML = dots;

    document.getElementById("gallery-wrap").addEventListener("click", function (e) {
      var arrow = e.target.closest("[data-gallery]");
      var dot = e.target.closest("[data-dot]");
      if (arrow) {
        var step = arrow.getAttribute("data-gallery") === "next" ? 1 : -1;
        updateGallery((gIndex + step + gallery.length) % gallery.length);
        return;
      }
      if (dot) { updateGallery(Number(dot.getAttribute("data-dot"))); return; }
      if (e.target.id === "gallery-img") openLightbox();
    });

    updateGallery(0);
    MM.ui.attachImageFallback(wrap);
  }

  function updateGallery(i) {
    gIndex = i;
    var g = gallery[i];
    var img = document.getElementById("gallery-img");
    img.dataset.fbDone = "";
    img.setAttribute("data-fb-type", g.type);
    img.src = g.src;
    img.alt = tea.name + " " + g.type + "图";
    document.getElementById("gallery-count").textContent = (i + 1) + " / " + gallery.length;
    document.getElementById("gallery-caption").textContent =
      g.type + " · 来源：" + g.source + " · 版权：" + g.copyright;
    MM.dom.qsa("[data-dot]").forEach(function (d, idx) {
      d.classList.toggle("is-active", idx === i);
    });
  }

  function openLightbox() {
    var g = gallery[gIndex];
    var box = document.getElementById("lightbox");
    var img = document.getElementById("lightbox-img");
    document.getElementById("lightbox-meta").innerHTML =
      esc(tea.name) + " · " + esc(g.type) + " · 来源：" + esc(g.source) +
      '<button class="btn-link" id="report-image">举报该图</button>';
    img.src = g.src;
    img.alt = tea.name + " " + g.type + " 大图";
    box.hidden = false;
  }

  function closeLightbox() {
    document.getElementById("lightbox").hidden = true;
  }

  function renderNav() {
    var links = [
      { id: "gallery-anchor", text: "图鉴" },
      { id: "sec-intro", text: "简介" },
      { id: "sec-quality", text: "品质特征" },
      { id: "sec-brew", text: "冲泡参数" },
      { id: "sec-origin", text: "产地与来源" },
      { id: "sec-comments", text: "评论" }
    ];
    document.getElementById("anchor-inner").innerHTML = links.map(function (l, i) {
      return '<a href="#' + l.id + '" class="' + (i === 0 ? "is-active" : "") + '">' + l.text + "</a>";
    }).join("");
    document.getElementById("anchor-inner").addEventListener("click", function (e) {
      var a = e.target.closest("a");
      if (!a) return;
      e.preventDefault();
      var target = document.getElementById(a.getAttribute("href").slice(1));
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      MM.dom.qsa("#anchor-inner a").forEach(function (l) { l.classList.remove("is-active"); });
      a.classList.add("is-active");
    });
  }

  function chips(list) {
    return list.map(function (x) { return '<span class="chip">' + esc(x) + "</span>"; }).join("");
  }

  function renderSections() {
    var body = document.getElementById("detail-sections");
    var gradeText = tea.grade.length ? tea.grade.join(" / ") : "未分档";
    body.innerHTML =
      '<section class="info-block" id="sec-intro">' +
        '<h2 class="info-title">简介</h2>' +
        '<p class="body-l">' + esc(tea.desc) + "</p>" +
        '<div class="chip-row mt-4">' +
          '<span class="chip chip--cat">' + cat.name + "</span>" +
          chips([tea.sub, tea.ferment, "香气：" + tea.aroma.join("、")]) +
        "</div>" +
      "</section>" +

      '<section class="info-block" id="sec-quality">' +
        '<h2 class="info-title">品质特征</h2>' +
        (tea.grade.length
          ? '<div class="level-tabs" id="level-tabs">' + tea.grade.map(function (g, i) {
              return '<button data-level="' + esc(g) + '" class="' + (i === 0 ? "is-active" : "") + '">' + esc(g) + "</button>";
            }).join("") + "</div>"
          : '<p class="body-s muted">该茶品未分档，不参与等级筛选。</p>') +
        '<div id="level-panel"></div>' +
      "</section>" +

      '<section class="info-block" id="sec-brew">' +
        '<h2 class="info-title">冲泡参数</h2>' +
        '<div class="kv">' +
          '<dt>水温</dt><dd>' + esc(tea.temp) + "</dd>" +
          '<dt>茶水比</dt><dd>' + esc(tea.ratio) + "</dd>" +
          '<dt>器皿</dt><dd>' + esc(tea.vessel) + "</dd>" +
          '<dt>出汤时间</dt><dd>' + esc(tea.seconds) + "</dd>" +
          '<dt>可冲泡次数</dt><dd>' + esc(tea.times) + " 次</dd>" +
        "</div>" +
      "</section>" +

      '<section class="info-block" id="sec-origin">' +
        '<h2 class="info-title">产地与来源</h2>' +
        '<div class="kv">' +
          '<dt>集中产地</dt><dd>' + esc(tea.origin) + "</dd>" +
          '<dt>等级</dt><dd>' + esc(gradeText) + "</dd>" +
          (tea.year ? '<dt>生产年份</dt><dd>' + esc(MM.config.yearLabel(tea)) + "</dd>" : "") +
          '<dt>标准号</dt><dd>' + esc(tea.std.join("；")) + "</dd>" +
          '<dt>采摘时间</dt><dd>' + esc(tea.pick) + "</dd>" +
          '<dt>资料来源</dt><dd>国家标准文本、产区公开资料、编辑实地核校</dd>' +
          '<dt>最后更新</dt><dd>' + esc(tea.updated) + "</dd>" +
        "</div>" +
        '<p class="caption mt-2">不同产区的风味描述可能存在差异，页面以并列方式呈现，不合并为单一结论。</p>' +
      "</section>" +

      '<section class="info-block" id="sec-comments">' +
        '<h2 class="info-title">品鉴与评论 <span class="caption" id="comment-total"></span></h2>' +
        '<div id="comment-composer"></div>' +
        '<div class="comment-list" id="comment-list"></div>' +
        '<div class="load-more" id="comment-more"></div>' +
      "</section>";

    renderLevelPanel(tea.grade.length ? tea.grade[0] : "未分档");
    var tabs = document.getElementById("level-tabs");
    if (tabs) {
      tabs.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-level]");
        if (!btn) return;
        MM.dom.qsa("[data-level]", tabs).forEach(function (b) { b.classList.remove("is-active"); });
        btn.classList.add("is-active");
        renderLevelPanel(btn.getAttribute("data-level"));
      });
    }
    renderComposer();
    renderComments();
  }

  function renderLevelPanel(level) {
    var panel = document.getElementById("level-panel");
    panel.innerHTML =
      '<div class="kv">' +
        '<dt>干茶形态</dt><dd>' + chips(tea.shape) + "</dd>" +
        '<dt>色泽</dt><dd>' + chips(tea.color) + "</dd>" +
        '<dt>汤色</dt><dd>' + chips(tea.soup) + "</dd>" +
        '<dt>发酵度</dt><dd><span class="chip">' + esc(tea.ferment) + "</span></dd>" +
        '<dt>香气</dt><dd>' + chips(tea.aroma) + "</dd>" +
      "</div>" +
      '<p class="caption mt-2">当前查看：' + esc(level) + "。等级为同页分档，具体差异以实物审评为准。</p>";
  }

  function renderComposer() {
    document.getElementById("comment-composer").innerHTML =
      '<div class="submit-card">' +
        '<div class="field">' +
          '<label class="field__label" for="comment-input">写评论</label>' +
          '<textarea class="textarea" id="comment-input" maxlength="320" placeholder="分享你的品鉴感受，禁止店铺名、微信号与购买链接。"></textarea>' +
          '<span class="counter" id="comment-counter">0 / 300</span>' +
        "</div>" +
        '<div class="split mt-4">' +
          '<span class="caption">发布后进入待审核，审核通过后对他人展示。</span>' +
          '<button class="btn btn-primary" id="comment-submit">发布评论</button>' +
        "</div>" +
      "</div>";

    var input = document.getElementById("comment-input");
    var counter = document.getElementById("comment-counter");
    input.addEventListener("input", function () {
      var len = input.value.length;
      counter.textContent = len + " / 300";
      counter.classList.toggle("is-over", len > 300);
    });

    document.getElementById("comment-submit").addEventListener("click", function () {
      var text = input.value.trim();
      if (!text) { MM.ui.toast("请先写一点内容"); input.focus(); return; }
      if (text.length > 300) { MM.ui.toast("评论最多 300 字"); input.focus(); return; }
      if (MM.ui.isOffline()) { MM.ui.toast("离线状态下无法发布评论，请联网后重试"); return; }
      MM.ui.requireLogin("发布评论", function () {
        MM.store.addUserComment(tea.id, text);
        input.value = "";
        counter.textContent = "0 / 300";
        showAllComments = true;
        renderComments();
        MM.ui.toast("评论已提交，审核通过后对他人展示");
      });
    });
  }

  function renderComments() {
    var all = MM.config.allComments(tea.id).filter(function (c) {
      return c.status === "published" || (c.mine && c.status === "pending");
    }).sort(function (a, b) { return a.time < b.time ? 1 : -1; });

    document.getElementById("comment-total").textContent = "（" + all.length + " 条）";
    var list = document.getElementById("comment-list");
    var more = document.getElementById("comment-more");

    if (all.length === 0) {
      list.innerHTML = MM.ui.emptyHTML({
        title: "还没有评论",
        desc: "登录后可发布第一条品鉴短评，评论通过审核后展示。"
      });
      more.innerHTML = "";
      return;
    }

    var shown = showAllComments ? all : all.slice(0, 3);
    list.innerHTML = shown.map(function (c) {
      var liked = MM.store.isLiked(c.id);
      var count = c.likeCount + (liked ? 1 : 0);
      return '<article class="comment" data-cid="' + c.id + '">' +
        '<span class="avatar" style="background:' + cat.color + '">' + esc(c.user.slice(0, 1)) + "</span>" +
        '<div class="comment__body">' +
          '<div class="comment__head">' +
            '<span class="comment__name">' + esc(c.user) + "</span>" +
            '<span class="comment__time">' + esc(c.time) + "</span>" +
            (c.mine && c.status === "pending" ? MM.ui.statusBadge("pending") : "") +
          "</div>" +
          '<p class="comment__text">' + esc(c.content) + "</p>" +
          '<div class="comment__actions">' +
            '<button class="like-btn' + (liked ? " is-on" : "") + '" data-like="' + c.id +
              '" aria-pressed="' + (liked ? "true" : "false") + '">赞 ' + count + "</button>" +
          "</div>" +
        "</div></article>";
    }).join("");

    if (all.length > 3) {
      more.innerHTML = '<button class="btn-link" id="comment-toggle">' +
        (showAllComments ? "收起评论" : "查看全部 " + all.length + " 条") + "</button>";
      document.getElementById("comment-toggle").addEventListener("click", function () {
        showAllComments = !showAllComments;
        renderComments();
      });
    } else {
      more.innerHTML = "";
    }
  }

  function updateFav() {
    var btn = document.getElementById("fav-btn");
    if (!btn) return;
    var on = MM.store.isFav(tea.id);
    btn.textContent = on ? "已收藏" : "收藏";
    btn.classList.toggle("btn-primary", on);
    btn.classList.toggle("btn-secondary", !on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  }

  function toggleFav() {
    if (MM.store.isLoggedIn()) {
      var on = MM.store.toggleFav(tea.id);
      updateFav();
      MM.ui.toast(on ? "已收藏，可在「想喝」中查看" : "已取消收藏");
      return;
    }
    MM.ui.requireLogin("收藏", function () {
      MM.store.addFav(tea.id, "want");
      updateFav();
      MM.ui.toast("已收藏，可在「想喝」中查看");
    });
  }

  function report(target) {
    MM.ui.requireLogin("举报", function () {
      window.location.href = "report.html?objType=" +
        (target === "该图片" ? "gallery" : "detail") + "&title=" +
        encodeURIComponent(tea.name + " · " + target);
    });
  }

  function stepLightbox(step) {
    if (document.getElementById("lightbox").hidden) return;
    updateGallery((gIndex + step + gallery.length) % gallery.length);
    openLightbox();
  }

  function bindLightbox() {
    document.getElementById("lightbox-close").addEventListener("click", closeLightbox);
    document.getElementById("lightbox-prev").addEventListener("click", function () { stepLightbox(-1); });
    document.getElementById("lightbox-next").addEventListener("click", function () { stepLightbox(1); });
    document.getElementById("lightbox").addEventListener("click", function (e) {
      if (e.target.id === "lightbox") closeLightbox();
    });
    document.getElementById("lightbox-meta").addEventListener("click", function (e) {
      if (e.target.closest("#report-image")) report("该图片");
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") stepLightbox(-1);
      if (e.key === "ArrowRight") stepLightbox(1);
    });
  }

  function observeAnchors() {
    if (!("IntersectionObserver" in window)) return;
    var links = MM.dom.qsa("#anchor-inner a");
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        links.forEach(function (l) {
          l.classList.toggle("is-active", l.getAttribute("href") === "#" + en.target.id);
        });
      });
    }, { rootMargin: "-140px 0px -60% 0px", threshold: 0 });
    ["gallery-anchor", "sec-intro", "sec-quality", "sec-brew", "sec-origin", "sec-comments"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) io.observe(el);
    });
  }

  MM.dom.ready(function () {
    MM.ui.initChrome("category");
    tea = MM.config.tea(MM.dom.param("id"));
    if (!tea) { render404(); return; }
    cat = MM.config.category(tea.cat);
    document.body.setAttribute("data-cat", cat.id);
    document.title = tea.name + " · 茗脉";
    MM.store.pushHistory(tea.id);

    gallery = MM.config.imageTypes(tea).map(function (type) {
      return {
        type: type,
        src: MM.config.imageUrl(tea.name, type),
        source: "编辑自拍",
        copyright: "© 茗脉"
      };
    });

    renderHead();
    renderGallery();
    renderNav();
    renderSections();
    bindLightbox();
    observeAnchors();
    MM.ui.attachImageFallback(document);

    if (MM.ui.isOffline()) {
      var submit = document.getElementById("comment-submit");
      if (submit) submit.disabled = true;
    }

    document.getElementById("comment-list").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-like]");
      if (!btn) return;
      var cid = btn.getAttribute("data-like");
      MM.ui.requireLogin("点赞", function () {
        MM.store.toggleLike(cid);
        renderComments();
      });
    });
  });
})();
