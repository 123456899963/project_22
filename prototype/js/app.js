// 茶·图鉴 原型交互脚本
// 说明：原型用 localStorage 模拟登录、收藏、笔记与分享，后续替换为后端接口。

const KEY_USER = "tea_user";
const KEY_FAVS = "tea_favs";
const KEY_NOTES = "tea_notes";
const KEY_TITLE = "tea_list_title";
const KEY_SHARE = "tea_share";

const $ = function (sel, root) { return (root || document).querySelector(sel); };
const $$ = function (sel, root) { return Array.from((root || document).querySelectorAll(sel)); };

/* ---------- 本地存储 ---------- */
function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    return fallback;
  }
}
function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
function getUser() { return read(KEY_USER, null); }
function getFavItems() {
  return read(KEY_FAVS, []).map(function (item) {
    return typeof item === "string" ? { id: item, at: "" } : item;
  });
}
function getFavIds() { return getFavItems().map(function (item) { return item.id; }); }
function getNotes() { return read(KEY_NOTES, {}); }
function isFav(id) { return getFavIds().indexOf(id) > -1; }

/* ---------- 提示与弹层 ---------- */
let toastTimer = null;
function toast(message) {
  const box = $("#toast");
  if (!box) return;
  box.textContent = message;
  box.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { box.classList.remove("show"); }, 2000);
}

function showModal(html) {
  const mask = $("#mask");
  $("#modal").innerHTML = html;
  mask.classList.add("show");
  document.body.style.overflow = "hidden";
}
function closeModal() {
  $("#mask").classList.remove("show");
  $("#modal").innerHTML = "";
  document.body.style.overflow = "";
}

/* ---------- 登录 ---------- */
let authMode = "login";
let pendingAction = null;

function loginHTML() {
  const isRegister = authMode === "register";
  return `
    <h3>${isRegister ? "注册账号" : "登录"}</h3>
    <p class="hint">${isRegister ? "注册后即可收藏、写笔记与分享清单" : "登录后即可收藏、写笔记与分享清单"}</p>
    <form id="loginForm">
      <div class="field">
        <label for="authName">用户名</label>
        <input id="authName" name="name" autocomplete="username" placeholder="3-20 位字母、数字或下划线">
      </div>
      <div class="field">
        <label for="authPass">密码</label>
        <input id="authPass" name="pass" type="password" autocomplete="current-password" placeholder="至少 6 位">
      </div>
      ${isRegister ? `<div class="field"><label for="authPass2">确认密码</label><input id="authPass2" name="pass2" type="password"></div>` : ""}
      <p class="field-error" id="authErr" style="color:var(--danger);font-size:12px;min-height:18px;margin:0 0 8px"></p>
      <div class="modal-foot">
        <button type="button" class="btn btn-ghost btn-sm" data-close>取消</button>
        <button type="submit" class="btn btn-primary btn-sm">${isRegister ? "注册并登录" : "登录"}</button>
      </div>
    </form>
    <button class="switch" id="switchAuth" type="button" style="margin-top:12px">
      ${isRegister ? "已有账号？去登录" : "没有账号？去注册"}
    </button>
  `;
}

function openLogin(callback) {
  pendingAction = callback || null;
  authMode = "login";
  showModal(loginHTML());
  const input = $("#authName");
  if (input) input.focus();
}

function requireLogin(callback) {
  if (getUser()) { callback && callback(); } else { openLogin(callback); }
}

function updateAuthButton() {
  const btn = $("#navAuth");
  if (!btn) return;
  const user = getUser();
  let out = $("#navLogout");
  if (user) {
    btn.textContent = user.name;
    btn.onclick = function () { location.href = "profile.html"; };
    if (!out && btn.parentElement) {
      out = document.createElement("button");
      out.id = "navLogout";
      out.type = "button";
      out.className = "nav-logout";
      out.textContent = "退出";
      btn.parentElement.insertBefore(out, btn);
    }
    if (out) out.onclick = logoutUser;
  } else {
    btn.textContent = "登录";
    btn.onclick = function () { openLogin(); };
    if (out) out.remove();
  }
}

function logoutUser() {
  if (!confirm("确定退出登录吗？")) return;
  localStorage.removeItem(KEY_USER);
  updateAuthButton();
  toast("已退出登录");
  if (document.body.dataset.page === "profile") renderProfile();
  if (document.body.dataset.page === "favorites") renderFavorites();
  if (document.body.dataset.page === "share") renderShare();
}

function handleLoginSubmit(form) {
  const nameInput = form.querySelector("#authName");
  const passInput = form.querySelector("#authPass");
  const pass2Input = form.querySelector("#authPass2");
  const name = nameInput.value.trim();
  const pass = passInput.value;
  const err = $("#authErr");
  if (!/^[A-Za-z0-9_]{3,20}$/.test(name)) {
    err.textContent = "用户名需为 3-20 位字母、数字或下划线";
    return;
  }
  if (pass.length < 6) {
    err.textContent = "密码至少 6 位";
    return;
  }
  if (authMode === "register" && pass2Input.value !== pass) {
    err.textContent = "两次输入的密码不一致";
    return;
  }
  write(KEY_USER, { name: name, since: new Date().toISOString().slice(0, 10) });
  closeModal();
  updateAuthButton();
  if (document.body.dataset.page === "profile") renderProfile();
  if (document.body.dataset.page === "favorites") renderFavorites();
  if (document.body.dataset.page === "share") renderShare();
  toast(authMode === "register" ? "注册成功，已登录" : "登录成功");
  const action = pendingAction;
  pendingAction = null;
  if (action) action();
}

/* ---------- 收藏 ---------- */
function toggleFav(id) {
  requireLogin(function () {
    const items = getFavItems();
    const index = items.findIndex(function (item) { return item.id === id; });
    if (index > -1) {
      items.splice(index, 1);
      toast("已取消收藏");
    } else {
      items.push({ id: id, at: new Date().toISOString().slice(0, 10) });
      toast("已加入我的收藏");
    }
    write(KEY_FAVS, items);
    refreshFavButtons();
    if (document.body.dataset.page === "favorites") renderFavorites();
  });
}

function refreshFavButtons() {
  $$("[data-fav]").forEach(function (btn) {
    const id = btn.getAttribute("data-fav");
    const on = isFav(id);
    btn.classList.toggle("on", on);
    btn.textContent = on ? "已收藏" : "收藏";
  });
}

/* ---------- 卡片 ---------- */
function cardHTML(tea) {
  const cat = categoryInfo(tea.category);
  const on = isFav(tea.id);
  return `
    <article class="tea-card">
      <a class="tea-media" href="detail.html?id=${tea.id}" aria-label="查看 ${tea.name}">
        <img src="${tea.image}" alt="${tea.name} 干茶" loading="lazy">
        <span class="tea-badge" style="color:${cat.color}"><i style="background:${cat.color}"></i>${tea.category}</span>
      </a>
      <div class="tea-body">
        <a href="detail.html?id=${tea.id}"><h3 class="tea-name">${tea.name}</h3></a>
        <p class="tea-origin">${tea.origin} · ${tea.season}</p>
        <div class="chips">
          <span class="chip">${tea.temp}</span>
          <span class="chip">${tea.amount}</span>
          <span class="chip">${tea.time}</span>
        </div>
        <div class="tea-foot">
          <span class="more">${tea.favorites} 人收藏</span>
          <button class="fav ${on ? "on" : ""}" data-fav="${tea.id}" type="button">${on ? "已收藏" : "收藏"}</button>
        </div>
      </div>
    </article>
  `;
}

function emptyHTML(title, desc, actionHref, actionText) {
  return `
    <div class="empty">
      <div class="icon" aria-hidden="true">○</div>
      <h3>${title}</h3>
      <p>${desc}</p>
      ${actionHref ? `<a class="btn btn-primary btn-sm" href="${actionHref}">${actionText}</a>` : ""}
    </div>
  `;
}

/* ---------- 首页 ---------- */
let randomTeaId = null;

function renderHome() {
  const catGrid = $("#catGrid");
  if (catGrid) {
    catGrid.innerHTML = CATEGORIES.map(function (cat) {
      const count = TEAS.filter(function (t) { return t.category === cat.name; }).length;
      return `
        <a class="cat-card" href="list.html?category=${encodeURIComponent(cat.name)}">
          <i style="background:${cat.color}"></i>
          <strong>${cat.name}</strong>
          <span>${count} 款收录</span>
        </a>
      `;
    }).join("");
  }

  const strip = $("#heroStrip");
  if (strip) {
    strip.innerHTML = CATEGORIES.map(function (cat) {
      return `<span><i style="background:${cat.color}"></i>${cat.name}</span>`;
    }).join("");
  }

  const hotList = $("#hotList");
  if (hotList) {
    const hot = TEAS.slice().filter(function (t) { return t.status !== "off"; }).sort(function (a, b) { return b.favorites - a.favorites; }).slice(0, 8);
    hotList.innerHTML = hot.map(cardHTML).join("");
  }

  renderFeature();
}

function renderFeature() {
  const box = $("#featureCard");
  if (!box) return;
  if (!randomTeaId) {
    const pool = TEAS.filter(function (t) { return t.status !== "off"; });
    randomTeaId = pool[Math.floor(Math.random() * pool.length)].id;
  }
  const tea = getTea(randomTeaId);
  box.innerHTML = `
    <a class="tea-media" href="detail.html?id=${tea.id}">
      <img src="${tea.image}" alt="${tea.name} 干茶">
    </a>
    <div class="feature-info">
      <span class="tea-badge" style="position:static;align-self:flex-start;color:${categoryInfo(tea.category).color}">
        <i style="background:${categoryInfo(tea.category).color}"></i>${tea.category}
      </span>
      <h3>${tea.name}</h3>
      <p>${tea.origin} · ${tea.season} · ${tea.fermentation}</p>
      <p>${tea.aroma}，${tea.taste}。</p>
      <div class="actions">
        <a class="btn btn-primary btn-sm" href="detail.html?id=${tea.id}">查看图鉴</a>
        <button class="btn btn-ghost btn-sm" id="reroll" type="button">换一批</button>
      </div>
    </div>
  `;
  $("#reroll").onclick = function () {
    const pool = TEAS.filter(function (t) { return t.status !== "off"; });
    let next = randomTeaId;
    while (next === randomTeaId && pool.length > 1) {
      next = pool[Math.floor(Math.random() * pool.length)].id;
    }
    randomTeaId = next;
    renderFeature();
  };
}

/* ---------- 列表页 ---------- */
function renderList() {
  const params = new URLSearchParams(location.search);
  const q = (params.get("q") || "").trim();
  const sort = params.get("sort") || "latest";
  const page = Math.max(1, parseInt(params.get("page") || "1", 10) || 1);
  const pageSize = 12;

  // 同维度多选：URL 用逗号分隔，如 category=绿茶,白茶
  function readMulti(key) {
    return (params.get(key) || "").split(",").filter(Boolean);
  }
  const cats = readMulti("category");
  const originsSel = readMulti("origin");
  const seasonsSel = readMulti("season");

  // 筛选选项来自数据本身
  const origins = ["全部"].concat(Array.from(new Set(TEAS.map(function (t) { return t.origin; }))));
  const seasons = ["全部"].concat(Array.from(new Set(TEAS.map(function (t) { return t.season; }))));

  function makeChip(label, value, key, selected) {
    const p = new URLSearchParams(location.search);
    if (value === "全部") {
      p.delete(key);
    } else {
      const values = selected.slice();
      const index = values.indexOf(value);
      if (index >= 0) values.splice(index, 1); else values.push(value);
      if (values.length) p.set(key, values.join(",")); else p.delete(key);
    }
    p.delete("page");
    const on = value === "全部" ? selected.length === 0 : selected.indexOf(value) !== -1;
    return `<a class="fchip ${on ? "on" : ""}" href="list.html?${p.toString()}">${label}</a>`;
  }

  const filters = $("#filters");
  if (filters) {
    filters.innerHTML = `
      <div class="filter-group"><span class="filter-label">茶类</span>
        ${["全部"].concat(CATEGORIES.map(function (c) { return c.name; })).map(function (v) { return makeChip(v, v, "category", cats); }).join("")}
      </div>
      <div class="filter-group"><span class="filter-label">产地</span>
        ${origins.map(function (v) { return makeChip(v, v, "origin", originsSel); }).join("")}
      </div>
      <div class="filter-group"><span class="filter-label">季节</span>
        ${seasons.map(function (v) { return makeChip(v, v, "season", seasonsSel); }).join("")}
      </div>
    `;
  }

  let list = TEAS.filter(function (t) {
    if (t.status === "off") return false;
    if (cats.length && cats.indexOf(t.category) === -1) return false;
    if (originsSel.length && originsSel.indexOf(t.origin) === -1) return false;
    if (seasonsSel.length && seasonsSel.indexOf(t.season) === -1) return false;
    if (q && (t.name + t.origin).indexOf(q) === -1) return false;
    return true;
  });
  list = list.slice().sort(function (a, b) {
    return sort === "hot" ? b.favorites - a.favorites : TEAS.indexOf(a) - TEAS.indexOf(b);
  });

  const total = list.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pages);
  const slice = list.slice((current - 1) * pageSize, current * pageSize);

  const grid = $("#teaGrid");
  if (grid) {
    grid.innerHTML = slice.length ? slice.map(cardHTML).join("") :
      emptyHTML("没有符合条件的茶", "试试减少筛选条件，或看看这几款热门茶。", "index.html", "回首页看看");
  }

  const bar = $("#resultBar");
  if (bar) {
    const sortBase = new URLSearchParams(location.search);
    sortBase.delete("page");
    const latest = new URLSearchParams(sortBase); latest.set("sort", "latest");
    const hot = new URLSearchParams(sortBase); hot.set("sort", "hot");
    bar.innerHTML = `
      <span>共 ${total} 款${q ? "，关键词“" + q + "”" : ""}</span>
      <span class="sort">
        <a class="fchip ${sort === "latest" ? "on" : ""}" href="list.html?${latest.toString()}">最新</a>
        <a class="fchip ${sort === "hot" ? "on" : ""}" href="list.html?${hot.toString()}">收藏最多</a>
      </span>
    `;
  }

  const pager = $("#pagination");
  if (pager) {
    if (pages <= 1) {
      pager.innerHTML = "";
    } else {
      const base = new URLSearchParams(location.search);
      let html = "";
      for (let i = 1; i <= pages; i++) {
        base.set("page", String(i));
        html += `<a class="page-btn ${i === current ? "on" : ""}" href="list.html?${base.toString()}">${i}</a>`;
      }
      pager.innerHTML = html;
    }
  }

  const title = $("#listTitle");
  if (title) title.textContent = cats.length === 1 ? cats[0] : cats.length ? "筛选结果" : "全部茶品";
}

/* ---------- 详情页 ---------- */
function renderDetail() {
  const id = new URLSearchParams(location.search).get("id");
  let tea = id ? getTea(id) : null;
  if (tea && tea.status === "off") tea = null;
  const box = $("#detailBox");
  if (!box) return;

  if (!tea) {
    const recs = TEAS.filter(function (t) { return t.status !== "off"; }).slice(0, 3);
    box.innerHTML = `
      <div style="grid-column:1/-1">
        ${emptyHTML("该茶品已下架或不存在", "链接可能已失效，可以看看这些茶。", "list.html", "回列表")}
        <div class="card-grid" style="margin-top:24px">${recs.map(cardHTML).join("")}</div>
      </div>
    `;
    return;
  }

  const cat = categoryInfo(tea.category);
  const on = isFav(tea.id);
  const official = tea.official || {};
  const tipBlocks = [
    { t: "历史典故", d: official.history },
    { t: "适合人群", d: official.suitable },
    { t: "冲泡误区", d: official.pitfall },
    { t: "品鉴笔记", d: official.note }
  ].filter(function (block) { return block.d; });
  box.innerHTML = `
    <div class="detail-media">
      <img src="${tea.image}" alt="${tea.name} 干茶">
    </div>
    <div class="detail-info">
      <nav class="breadcrumb">
        <a href="index.html">首页</a><span>/</span>
        <a href="list.html?category=${encodeURIComponent(tea.category)}">${tea.category}</a><span>/</span>
        <span>${tea.name}</span>
      </nav>
      <h1>${tea.name}</h1>
      <p class="lead">${tea.origin} · ${tea.season} · ${tea.price}</p>
      <div class="meta-tags">
        <span class="chip" style="color:${cat.color};background:${cat.soft}">${tea.category}</span>
        <span class="tag">${tea.fermentation}</span>
        <span class="tag">${tea.season}</span>
        <span class="tag">${tea.price}</span>
      </div>

      <h2 class="subhead">感官描述</h2>
      <div class="senses">
        <div class="sense"><b>外形</b>${tea.shape}</div>
        <div class="sense"><b>汤色</b>${tea.liquor}</div>
        <div class="sense"><b>香气</b>${tea.aroma}</div>
        <div class="sense"><b>滋味</b>${tea.taste}</div>
      </div>

      <h2 class="subhead">冲泡参数</h2>
      <div class="params">
        <div class="param"><strong>${tea.temp}</strong><span>水温</span></div>
        <div class="param"><strong>${tea.amount}</strong><span>投茶量</span></div>
        <div class="param"><strong>${tea.time}</strong><span>浸泡时间</span></div>
      </div>

      ${tipBlocks.length ? `
      <h2 class="subhead">小贴士</h2>
      <div class="tips">
        ${tipBlocks.map(function (tip) {
          return `<div class="tip"><b>${tip.t}</b><p>${tip.d}</p></div>`;
        }).join("")}
      </div>` : ""}

      <div class="actions">
        <button class="btn btn-primary fav ${on ? "on" : ""}" data-fav="${tea.id}" type="button">${on ? "已收藏" : "收藏"}</button>
        <button class="btn btn-ghost" id="writeNote" type="button">写笔记</button>
        <button class="btn btn-ghost" id="shareBtn" type="button">分享</button>
      </div>
      <p style="font-size:12px;color:var(--ink-2);margin-top:10px">${tea.favorites} 人已收藏</p>
    </div>
  `;

  $("#writeNote").onclick = function () {
    requireLogin(function () {
      location.href = "favorites.html?note=" + tea.id;
    });
  };
  $("#shareBtn").onclick = function () {
    requireLogin(function () {
      location.href = "favorites.html?share=1";
    });
  };
}

/* ---------- 收藏页 ---------- */
function openNoteModal(teaId) {
  const tea = getTea(teaId);
  if (!tea) return;
  const notes = getNotes();
  showModal(`
    <h3>品鉴笔记</h3>
    <p class="hint">${tea.name} · 仅自己可见</p>
    <form id="noteForm" data-tea="${tea.id}">
      <div class="field">
        <label for="noteText">笔记内容</label>
        <textarea id="noteText" name="text" maxlength="2000" placeholder="记录外形、香气、滋味或当时的场景">${notes[tea.id] || ""}</textarea>
      </div>
      <p class="hint" id="noteCount">${(notes[tea.id] || "").length} / 2000</p>
      <div class="modal-foot">
        <button type="button" class="btn btn-ghost btn-sm" data-close>取消</button>
        <button type="submit" class="btn btn-primary btn-sm">保存</button>
      </div>
    </form>
  `);
  $("#noteText").oninput = function () {
    $("#noteCount").textContent = this.value.length + " / 2000";
  };
}

function openShareModal() {
  const share = read(KEY_SHARE, null);
  if (share) {
    showModal(`
      <h3>分享我的收藏</h3>
      <p class="hint">链接永久有效，直到你撤销。</p>
      <div class="share-box"><span id="shareUrl">${share.url}</span></div>
      <div class="modal-foot" style="justify-content:space-between">
        <button class="btn btn-ghost btn-sm" id="revokeShare" type="button">撤销分享</button>
        <button class="btn btn-primary btn-sm" id="copyShare" type="button">复制链接</button>
      </div>
    `);
    $("#copyShare").onclick = function () {
      const url = $("#shareUrl").textContent;
      if (navigator.clipboard) navigator.clipboard.writeText(url).catch(function () {});
      toast("链接已复制");
    };
    $("#revokeShare").onclick = function () {
      if (!confirm("撤销后原链接将失效，确定吗？")) return;
      localStorage.removeItem(KEY_SHARE);
      closeModal();
      toast("分享已撤销");
    };
    return;
  }

  const ids = getFavIds();
  if (!ids.length) { toast("先收藏几款茶再分享"); return; }
  const code = Math.random().toString(36).slice(2, 8);
  const url = location.href.replace(/favorites\.html.*/, "share.html?code=" + code);
  const data = { code: code, title: read(KEY_TITLE, "我的收藏"), ids: ids, owner: (getUser() || {}).name || "茶友", url: url };
  write(KEY_SHARE, data);
  showModal(`
    <h3>分享我的收藏</h3>
    <p class="hint">链接永久有效，直到你撤销。</p>
    <div class="share-box"><span id="shareUrl">${url}</span></div>
    <div class="modal-foot" style="justify-content:space-between">
      <button class="btn btn-ghost btn-sm" id="revokeShare" type="button">撤销分享</button>
      <button class="btn btn-primary btn-sm" id="copyShare" type="button">复制链接</button>
    </div>
  `);
  $("#copyShare").onclick = function () {
    if (navigator.clipboard) navigator.clipboard.writeText(url).catch(function () {});
    toast("链接已复制");
  };
  $("#revokeShare").onclick = function () {
    if (!confirm("撤销后原链接将失效，确定吗？")) return;
    localStorage.removeItem(KEY_SHARE);
    closeModal();
    toast("分享已撤销");
  };
}

function renderFavorites() {
  const user = getUser();
  const box = $("#favBox");
  if (!box) return;

  if (!user) {
    box.innerHTML = emptyHTML("登录后查看我的收藏", "收藏、笔记和分享都与账号关联。", "", "");
    return;
  }

  const ids = getFavIds();
  const titleInput = $("#listTitle");
  if (titleInput) titleInput.value = read(KEY_TITLE, "我的收藏");

  if (!ids.length) {
    const hot = TEAS.filter(function (t) { return t.status !== "off"; }).sort(function (a, b) { return b.favorites - a.favorites; }).slice(0, 3);
    box.innerHTML = emptyHTML("还没有收藏的茶", "去图鉴里挑几款感兴趣的茶吧。", "list.html", "去逛逛") +
      '<div class="card-grid" style="margin-top:24px">' + hot.map(cardHTML).join("") + "</div>";
    const count = $("#favCount");
    if (count) count.textContent = "0 款";
    return;
  }

  const favs = getFavItems().map(function (item) {
    const tea = getTea(item.id);
    return tea ? { tea: tea, at: item.at } : null;
  }).filter(Boolean);
  const notes = getNotes();
  const count = $("#favCount");
  if (count) count.textContent = favs.length + " 款";

  box.innerHTML = `
    <div class="fav-list">
      ${favs.map(function (fav) {
        const tea = fav.tea;
        const note = notes[tea.id];
        const at = fav.at ? `<span> · 收藏于 ${fav.at}</span>` : "";
        if (tea.status === "off") {
          return `
          <article class="fav-row off">
            <img src="${tea.image}" alt="${tea.name}" loading="lazy" style="filter:grayscale(1);opacity:.55">
            <div>
              <h3>${tea.name}</h3>
              <p>该茶品暂不可用${at}</p>
              <p class="note">已下架，仍保留在你的收藏中</p>
            </div>
            <div class="row-actions">
              <button class="btn btn-ghost btn-sm" data-remove="${tea.id}" type="button">移除</button>
            </div>
          </article>
        `;
        }
        return `
          <article class="fav-row">
            <a href="detail.html?id=${tea.id}"><img src="${tea.image}" alt="${tea.name}" loading="lazy"></a>
            <div>
              <a href="detail.html?id=${tea.id}"><h3>${tea.name}</h3></a>
              <p>${tea.origin} · ${tea.category} · ${tea.season}${at}</p>
              <p class="note">${note ? "笔记：" + note.slice(0, 40) + (note.length > 40 ? "…" : "") : "还没有笔记"}</p>
            </div>
            <div class="row-actions">
              <button class="btn btn-ghost btn-sm" data-note="${tea.id}" type="button">${note ? "编辑笔记" : "写笔记"}</button>
              <button class="btn btn-ghost btn-sm" data-remove="${tea.id}" type="button">移除</button>
            </div>
          </article>
        `;
      }).join("")}
    </div>
    <div id="favGrid" class="card-grid" style="margin-top:24px"></div>
  `;
}

/* ---------- 分享只读页 ---------- */
function renderShare() {
  const box = $("#shareBox");
  if (!box) return;
  const code = new URLSearchParams(location.search).get("code");
  const share = read(KEY_SHARE, null);
  if (!share || share.code !== code) {
    box.innerHTML = `
      ${emptyHTML("这个分享链接已失效", "可能已被所有者撤销，看看公开推荐吧。", "index.html", "回首页")}
      <div class="card-grid" style="margin-top:24px">
        ${TEAS.slice().sort(function (a, b) { return b.favorites - a.favorites; }).slice(0, 3).map(cardHTML).join("")}
      </div>
    `;
    const bar = $("#shareBar");
    if (bar) bar.style.display = "none";
    return;
  }
  const teas = share.ids.map(getTea).filter(Boolean);
  const logged = !!getUser();
  const collect = $("#collectAll");
  const hint = $("#shareHint");
  if (collect) collect.style.display = logged ? "" : "none";
  if (hint) hint.style.display = logged ? "none" : "";
  $("#shareTitle").textContent = share.title;
  $("#shareMeta").textContent = share.owner + " 分享 · 共 " + teas.length + " 款";
  box.innerHTML = teas.map(cardHTML).join("");
  $("#collectAll").onclick = function () {
    requireLogin(function () {
      const items = getFavItems();
      const at = new Date().toISOString().slice(0, 10);
      let added = 0;
      teas.forEach(function (tea) {
        if (items.every(function (item) { return item.id !== tea.id; })) {
          items.push({ id: tea.id, at: at });
          added++;
        }
      });
      write(KEY_FAVS, items);
      refreshFavButtons();
      toast(added ? "已收藏 " + added + " 款茶" : "这些茶已在你的收藏中");
    });
  };
}

/* ---------- 个人中心 ---------- */
function renderProfile() {
  const box = $("#profileBox");
  if (!box) return;
  const user = getUser();
  if (!user) {
    openLogin(function () { location.reload(); });
    return;
  }
  const favCount = getFavIds().length;
  const noteCount = Object.keys(getNotes()).length;
  box.innerHTML = `
    <div class="profile-card">
      <div class="avatar">${user.name.slice(0, 1).toUpperCase()}</div>
      <div>
        <h2>${user.name}</h2>
        <p>注册于 ${user.since || "—"} · 普通用户</p>
        <div class="profile-stats">
          <div><b>${favCount}</b><span>收藏茶品</span></div>
          <div><b>${noteCount}</b><span>品鉴笔记</span></div>
        </div>
      </div>
      <div class="actions" style="margin-top:0">
        <button class="btn btn-ghost btn-sm" id="changePass" type="button">修改密码</button>
        <button class="btn btn-ghost btn-sm" id="logoutBtn" type="button">退出登录</button>
      </div>
    </div>
    <div class="profile-grid">
      <a href="favorites.html"><span>我的收藏与清单</span><span>→</span></a>
      <a href="list.html"><span>继续浏览图鉴</span><span>→</span></a>
      <a href="admin-login.html"><span>管理员入口</span><span>→</span></a>
    </div>
  `;
  $("#changePass").onclick = openPassModal;
  $("#logoutBtn").onclick = function () {
    if (!confirm("确定退出登录吗？")) return;
    localStorage.removeItem(KEY_USER);
    toast("已退出登录");
    setTimeout(function () { location.href = "index.html"; }, 600);
  };
}

function openPassModal() {
  showModal(`
    <h3>修改密码</h3>
    <p class="hint">原型演示：保存后仅提示成功，不写入真实账号。</p>
    <form id="passForm">
      <div class="field">
        <label for="newPass">新密码</label>
        <input id="newPass" type="password" placeholder="至少 6 位">
      </div>
      <div class="field">
        <label for="newPass2">确认新密码</label>
        <input id="newPass2" type="password">
      </div>
      <p class="form-error" id="passErr"></p>
      <div class="modal-foot">
        <button type="button" class="btn btn-ghost btn-sm" data-close>取消</button>
        <button type="submit" class="btn btn-primary btn-sm">保存</button>
      </div>
    </form>
  `);
}

/* ---------- 管理后台 ---------- */
const KEY_ADMIN_TEAS = "tea_admin_teas";
const KEY_ADMIN = "tea_admin_session";

function hasAdmin() { return !!read(KEY_ADMIN, null); }

function getAdminTeas() {
  const saved = read(KEY_ADMIN_TEAS, null);
  if (saved) {
    return saved.map(function (item) {
      const base = TEAS.find(function (t) { return t.id === item.id; });
      return Object.assign({}, base || {}, item, {
        official: item.official || (base && base.official) || {}
      });
    });
  }
  const list = TEAS.map(function (tea) {
    return Object.assign({}, tea, { status: "on", updated: tea.updated || "2026-10-20" });
  });
  write(KEY_ADMIN_TEAS, list);
  return list;
}

function saveAdminTeas(list) { write(KEY_ADMIN_TEAS, list); }

// 把后台改动同步到前台 Mock 数据，保证原型演示前后一致。
function applyAdminOverrides() {
  const saved = read(KEY_ADMIN_TEAS, null);
  if (!saved) return;
  saved.forEach(function (item) {
    const target = TEAS.find(function (tea) { return tea.id === item.id; });
    if (target) {
      Object.keys(item).forEach(function (key) { target[key] = item[key]; });
    } else if (item.status !== "off") {
      TEAS.push(item);
    }
  });
}

function renderAdmin() {
  if (!hasAdmin()) { location.href = "admin-login.html"; return; }
  const params = new URLSearchParams(location.search);
  const q = (params.get("q") || "").trim();
  const category = params.get("category") || "全部";
  const search = $("#adminSearch");
  const select = $("#adminCategory");

  if (search) {
    search.querySelector("input").value = q;
    search.onsubmit = function (e) {
      e.preventDefault();
      const p = new URLSearchParams(location.search);
      const kw = this.querySelector("input").value.trim();
      if (kw) p.set("q", kw); else p.delete("q");
      location.href = "admin.html?" + p.toString();
    };
  }
  if (select) {
    select.innerHTML = ["全部"].concat(CATEGORIES.map(function (c) { return c.name; }))
      .map(function (v) { return `<option value="${v}">${v === "全部" ? "全部茶类" : v}</option>`; }).join("");
    select.value = category;
    select.onchange = function () {
      const p = new URLSearchParams(location.search);
      if (this.value === "全部") p.delete("category"); else p.set("category", this.value);
      location.href = "admin.html?" + p.toString();
    };
  }

  const list = getAdminTeas().filter(function (tea) {
    if (category !== "全部" && tea.category !== category) return false;
    if (q && (tea.name + tea.origin).indexOf(q) === -1) return false;
    return true;
  });

  const count = $("#adminCount");
  if (count) count.textContent = "共 " + list.length + " 款";

  const body = $("#adminTable");
  if (!body) return;
  if (!list.length) {
    body.innerHTML = `<tr><td colspan="7"><div class="empty" style="border:0;padding:40px 16px">
      <h3>没有符合条件的茶品</h3><p>换个关键词，或新增一款茶。</p>
      <a class="btn btn-primary btn-sm" href="admin-edit.html">新增茶品</a></div></td></tr>`;
    return;
  }
  body.innerHTML = list.map(function (tea) {
    const off = tea.status === "off";
    return `
      <tr>
        <td><div class="admin-name"><img class="admin-thumb" src="${tea.image}" alt="${tea.name}"><span>${tea.name}</span></div></td>
        <td>${tea.category}</td>
        <td>${tea.origin}</td>
        <td><span class="status ${off ? "off" : "on"}">${off ? "已下架" : "已上架"}</span></td>
        <td>${tea.favorites || 0}</td>
        <td>${tea.updated || "—"}</td>
        <td><div class="admin-actions">
          <a class="btn btn-ghost btn-sm" href="admin-edit.html?id=${tea.id}">编辑</a>
          <button class="btn btn-ghost btn-sm" data-toggle="${tea.id}" type="button">${off ? "上架" : "下架"}</button>
        </div></td>
      </tr>
    `;
  }).join("");

  const logout = $("#adminLogout");
  if (logout) {
    logout.onclick = function (e) {
      e.preventDefault();
      localStorage.removeItem(KEY_ADMIN);
      location.href = "admin-login.html";
    };
  }
}

function renderAdminEdit() {
  if (!hasAdmin()) { location.href = "admin-login.html"; return; }
  const form = $("#teaForm");
  if (!form) return;
  const id = new URLSearchParams(location.search).get("id");
  const teas = getAdminTeas();
  const tea = id ? teas.find(function (t) { return t.id === id; }) : null;

  const catSelect = $("#fCategory");
  catSelect.innerHTML = CATEGORIES.map(function (c) {
    return `<option value="${c.name}">${c.name}</option>`;
  }).join("");
  const seasonSelect = $("#fSeason");
  const seasons = Array.from(new Set(TEAS.map(function (t) { return t.season; })));
  seasonSelect.innerHTML = seasons.map(function (s) {
    return `<option value="${s}">${s}</option>`;
  }).join("");

  function updatePreview() {
    const name = $("#fName").value.trim() || "新茶品";
    const category = catSelect.value;
    $("#fPreview").src = teaImage(name, category);
  }
  $("#fName").oninput = updatePreview;
  catSelect.onchange = updatePreview;

  if (tea) {
    $("#formTitle").textContent = "编辑茶品";
    $("#formCrumb").textContent = "编辑茶品";
    $("#fName").value = tea.name;
    catSelect.value = tea.category;
    $("#fOrigin").value = tea.origin;
    seasonSelect.value = tea.season;
    if (!seasonSelect.value) {
      seasonSelect.innerHTML += `<option value="${tea.season}">${tea.season}</option>`;
      seasonSelect.value = tea.season;
    }
    $("#fFerment").value = tea.fermentation;
    $("#fPrice").value = tea.price;
    $("#fShape").value = tea.shape;
    $("#fLiquor").value = tea.liquor;
    $("#fAroma").value = tea.aroma;
    $("#fTaste").value = tea.taste;
    $("#fTemp").value = tea.temp;
    $("#fAmount").value = tea.amount;
    $("#fTime").value = tea.time;
    $("#fStatus").value = tea.status === "off" ? "off" : "on";
    const official = tea.official || {};
    $("#fHistory").value = official.history || "";
    $("#fSuitable").value = official.suitable || "";
    $("#fPitfall").value = official.pitfall || "";
    $("#fNote").value = official.note || "";
    $("#fPreview").src = tea.image;
  } else {
    updatePreview();
  }

  form.onsubmit = function (e) {
    e.preventDefault();
    const err = $("#formErr");
    err.textContent = "";
    const name = $("#fName").value.trim();
    if (name.length < 2 || name.length > 30) {
      err.textContent = "名称需为 2-30 个字";
      $("#fName").focus();
      return;
    }
    const required = [
      ["#fOrigin", "请填写产地"],
      ["#fFerment", "请填写发酵程度"],
      ["#fPrice", "请填写价格区间"],
      ["#fShape", "请填写外形"],
      ["#fLiquor", "请填写汤色"],
      ["#fAroma", "请填写香气"],
      ["#fTaste", "请填写滋味"],
      ["#fTemp", "请填写水温"],
      ["#fAmount", "请填写投茶量"],
      ["#fTime", "请填写浸泡时间"]
    ];
    for (let i = 0; i < required.length; i++) {
      if (!$(required[i][0]).value.trim()) {
        err.textContent = required[i][1];
        $(required[i][0]).focus();
        return;
      }
    }

    const data = {
      id: tea ? tea.id : "tea-" + Date.now().toString(36),
      name: name,
      category: catSelect.value,
      origin: $("#fOrigin").value.trim(),
      season: seasonSelect.value,
      fermentation: $("#fFerment").value.trim(),
      price: $("#fPrice").value.trim(),
      shape: $("#fShape").value.trim(),
      liquor: $("#fLiquor").value.trim(),
      aroma: $("#fAroma").value.trim(),
      taste: $("#fTaste").value.trim(),
      temp: $("#fTemp").value.trim(),
      amount: $("#fAmount").value.trim(),
      time: $("#fTime").value.trim(),
      favorites: tea ? tea.favorites || 0 : 0,
      status: $("#fStatus").value,
      updated: new Date().toISOString().slice(0, 10),
      image: teaImage(name, catSelect.value),
      official: {
        history: $("#fHistory").value.trim(),
        suitable: $("#fSuitable").value.trim(),
        pitfall: $("#fPitfall").value.trim(),
        note: $("#fNote").value.trim()
      }
    };

    if (tea) {
      const index = teas.findIndex(function (t) { return t.id === tea.id; });
      teas[index] = data;
    } else {
      teas.unshift(data);
    }
    saveAdminTeas(teas);
    location.href = "admin.html";
  };
}

/* ---------- 搜索建议 ---------- */
function bindSearch() {
  $$("[data-search]").forEach(function (form) {
    const input = $("input", form);
    const suggest = $(".suggest", form);
    const clear = $(".clear", form);
    if (!input || !suggest) return;

    function update() {
      form.classList.toggle("has-value", input.value.length > 0);
      if (!input.value.trim()) { suggest.classList.remove("show"); suggest.innerHTML = ""; return; }
      const kw = input.value.trim();
      const hits = TEAS.filter(function (t) {
        return t.name.indexOf(kw) > -1 || t.origin.indexOf(kw) > -1;
      }).slice(0, 6);
      if (!hits.length) { suggest.classList.remove("show"); return; }
      suggest.innerHTML = hits.map(function (t) {
        return `<button type="button" data-suggest="${t.name}"><span>${t.name}</span><small>${t.origin}</small></button>`;
      }).join("");
      suggest.classList.add("show");
    }

    input.oninput = update;
    input.onfocus = update;
    clear.onclick = function () { input.value = ""; update(); input.focus(); };
    form.onsubmit = function (e) {
      e.preventDefault();
      const kw = input.value.trim();
      location.href = "list.html" + (kw ? "?q=" + encodeURIComponent(kw) : "");
    };
  });
}

/* ---------- 事件委托 ---------- */
document.addEventListener("click", function (e) {
  const close = e.target.closest("[data-close]");
  if (close) { closeModal(); return; }
  if (e.target.id === "mask") { closeModal(); return; }

  const fav = e.target.closest("[data-fav]");
  if (fav) { toggleFav(fav.getAttribute("data-fav")); return; }

  const suggest = e.target.closest("[data-suggest]");
  if (suggest) { location.href = "list.html?q=" + encodeURIComponent(suggest.getAttribute("data-suggest")); return; }

  const note = e.target.closest("[data-note]");
  if (note) { requireLogin(function () { openNoteModal(note.getAttribute("data-note")); }); return; }

  const remove = e.target.closest("[data-remove]");
  if (remove) {
    const id = remove.getAttribute("data-remove");
    if (!confirm("确定从收藏中移除这款茶吗？")) return;
    const items = getFavItems().filter(function (item) { return item.id !== id; });
    write(KEY_FAVS, items);
    renderFavorites();
    toast("已移除");
    return;
  }

  const toggle = e.target.closest("[data-toggle]");
  if (toggle) {
    const id = toggle.getAttribute("data-toggle");
    const list = getAdminTeas();
    const tea = list.find(function (t) { return t.id === id; });
    if (!tea) return;
    const next = tea.status === "off" ? "on" : "off";
    if (!confirm(next === "off" ? "确定下架《" + tea.name + "》吗？" : "确定上架《" + tea.name + "》吗？")) return;
    tea.status = next;
    tea.updated = new Date().toISOString().slice(0, 10);
    saveAdminTeas(list);
    renderAdmin();
    toast(next === "off" ? "已下架" : "已上架");
    return;
  }

  if (e.target.id === "switchAuth") {
    authMode = authMode === "login" ? "register" : "login";
    showModal(loginHTML());
    return;
  }
});

document.addEventListener("submit", function (e) {
  if (e.target.id === "loginForm") {
    e.preventDefault();
    handleLoginSubmit(e.target);
    return;
  }
  if (e.target.id === "noteForm") {
    e.preventDefault();
    const teaId = e.target.getAttribute("data-tea");
    const text = e.target.querySelector("#noteText").value.trim();
    const notes = getNotes();
    if (text) notes[teaId] = text; else delete notes[teaId];
    write(KEY_NOTES, notes);
    closeModal();
    renderFavorites();
    toast("笔记已保存");
    return;
  }
  if (e.target.id === "adminLoginForm") {
    e.preventDefault();
    const name = $("#adminName").value.trim();
    const pass = $("#adminPass").value;
    const err = $("#adminErr");
    if (name === "admin" && pass === "admin123") {
      write(KEY_ADMIN, { name: "admin", loginAt: new Date().toISOString() });
      location.href = "admin.html";
    } else {
      err.textContent = "账号或密码错误";
    }
    return;
  }
  if (e.target.id === "passForm") {
    e.preventDefault();
    const pass = $("#newPass").value;
    const pass2 = $("#newPass2").value;
    const err = $("#passErr");
    if (pass.length < 6) { err.textContent = "新密码至少 6 位"; return; }
    if (pass !== pass2) { err.textContent = "两次输入的密码不一致"; return; }
    closeModal();
    toast("密码已修改（原型演示）");
  }
});

document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") closeModal();
});

/* ---------- 初始化 ---------- */
function init() {
  document.body.insertAdjacentHTML("beforeend",
    '<div class="modal-mask" id="mask"><div class="modal" id="modal"></div></div>' +
    '<div class="toast" id="toast"></div>'
  );

  applyAdminOverrides();
  updateAuthButton();
  bindSearch();

  const page = document.body.dataset.page;
  if (page === "home") renderHome();
  if (page === "list") renderList();
  if (page === "detail") renderDetail();
  if (page === "profile") renderProfile();
  if (page === "admin") renderAdmin();
  if (page === "admin-edit") renderAdminEdit();
  if (page === "favorites") {
    const params = new URLSearchParams(location.search);
    if (!getUser()) openLogin(function () { location.reload(); });
    renderFavorites();
    const titleInput = $("#listTitle");
    if (titleInput) {
      titleInput.onchange = function () {
        const value = this.value.trim() || "我的收藏";
        this.value = value;
        write(KEY_TITLE, value);
        toast("清单标题已保存");
      };
    }
    $("#shareOpen").onclick = function () { requireLogin(openShareModal); };
    if (params.get("note")) requireLogin(function () { openNoteModal(params.get("note")); });
    if (params.get("share")) requireLogin(openShareModal);
  }
  if (page === "share") renderShare();

  refreshFavButtons();
}

document.addEventListener("DOMContentLoaded", init);
