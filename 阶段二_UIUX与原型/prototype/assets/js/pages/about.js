/* P19 关于与协议（锚点高亮 + 返回顶部） */
(function () {
  function initBackTop() {
    var btn = document.getElementById("back-top");
    if (!btn) return;
    function sync() {
      btn.hidden = window.scrollY < 320;
    }
    window.addEventListener("scroll", sync, { passive: true });
    btn.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    sync();
  }

  MM.dom.ready(function () {
    MM.ui.initChrome("about");
    initBackTop();
    var links = MM.dom.qsa(".about-nav a");
    var sections = links.map(function (a) {
      return document.querySelector(a.getAttribute("href"));
    }).filter(Boolean);
    if (!("IntersectionObserver" in window) || !sections.length) return;
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (a) {
          a.classList.toggle("is-active", a.getAttribute("href") === "#" + entry.target.id);
        });
      });
    }, { rootMargin: "-120px 0px -60% 0px" });
    sections.forEach(function (s) { observer.observe(s); });
  });
})();
