/* P05 识茶自查（拍照 + 五维特征） */
(function () {
  var DIMS = [
    { key: "shape", label: "干茶形态", values: ["条索", "扁平", "卷曲", "颗粒", "针形", "片状", "饼状", "束形", "螺形"] },
    { key: "color", label: "色泽", values: ["翠绿", "黄绿", "墨绿", "白毫显露", "银白", "青褐", "乌褐", "红褐", "黑褐"] },
    { key: "soup", label: "汤色", values: ["浅黄绿", "黄绿", "金黄", "橙黄", "橙红", "深红", "酒红"] },
    { key: "ferment", label: "发酵度", values: ["不发酵", "微发酵", "轻发酵", "半发酵", "全发酵", "后发酵"] },
    { key: "aroma", label: "香气", values: ["豆香", "栗香", "花香", "果香", "蜜香", "松烟香", "陈香", "枣香", "毫香", "清香", "焦糖香", "药香"] }
  ];
  var selected = {};
  var photo = null;
  var groupsBox, barCount, barDims, goBtn, countLabel;

  function countValue(key, value) {
    return MM.config.teasOf().filter(function (t) {
      var v = t[key];
      return Array.isArray(v) ? v.indexOf(value) > -1 : v === value;
    }).length;
  }

  function totalSelected() {
    return DIMS.reduce(function (n, d) { return n + (selected[d.key] || []).length; }, 0);
  }

  function renderGroups() {
    groupsBox.innerHTML = DIMS.map(function (d) {
      return '<div class="dim-group">' +
        '<div class="dim-group__label">' + d.label + '</div>' +
        '<div class="chip-row">' + d.values.map(function (v) {
          var on = (selected[d.key] || []).indexOf(v) > -1;
          return '<button type="button" class="chip chip--btn' + (on ? " chip--active" : "") +
            '" data-dim="' + d.key + '" data-value="' + MM.dom.esc(v) + '" aria-pressed="' + on + '">' +
            MM.dom.esc(v) + '<span class="dim-count">' + countValue(d.key, v) + "</span></button>";
        }).join("") + "</div></div>";
    }).join("");
  }

  function updateBar() {
    var n = totalSelected();
    countLabel.textContent = "已选 " + n + " 项";
    goBtn.disabled = false;
    if (n === 0) {
      barCount.textContent = "未选择特征（将展示全部茶品）";
      barDims.textContent = "";
    } else {
      var parts = DIMS.filter(function (d) { return (selected[d.key] || []).length; }).map(function (d) {
        return d.label + " " + selected[d.key].join("/");
      });
      barCount.textContent = "已选 " + n + " 项特征";
      barDims.textContent = parts.join(" · ");
    }
  }

  function toggle(key, value) {
    selected[key] = selected[key] || [];
    var idx = selected[key].indexOf(value);
    if (idx > -1) selected[key].splice(idx, 1); else selected[key].push(value);
    renderGroups();
    updateBar();
  }

  function setPhoto(file) {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      MM.ui.toast("仅支持 jpg / png / webp 图片");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      MM.ui.toast("图片超过 5MB，请压缩后再试");
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      photo = reader.result;
      document.getElementById("upload-zone").classList.add("hidden");
      document.getElementById("photo-preview").innerHTML =
        '<div class="upload-preview__item" style="width:180px">' +
          '<img src="' + photo + '" alt="待辨识照片预览">' +
        "</div>";
      document.getElementById("remove-photo").classList.remove("hidden");
      MM.ui.toast("照片已在本机预览（未上传）");
    };
    reader.readAsDataURL(file);
  }

  function removePhoto() {
    photo = null;
    document.getElementById("photo-input").value = "";
    document.getElementById("photo-preview").innerHTML = "";
    document.getElementById("remove-photo").classList.add("hidden");
    document.getElementById("upload-zone").classList.remove("hidden");
  }

  function submit() {
    if (MM.ui.isOffline && MM.ui.isOffline()) {
      MM.ui.toast("离线状态下无法进行自查，请联网后重试");
      return;
    }
    var qs = DIMS.map(function (d) {
      var list = selected[d.key] || [];
      return list.length ? d.key + "=" + encodeURIComponent(list.join(",")) : "";
    }).filter(Boolean).join("&");
    window.location.href = "selfcheck-result.html" + (qs ? "?" + qs : "");
  }

  MM.dom.ready(function () {
    groupsBox = document.getElementById("dim-groups");
    barCount = document.getElementById("bar-count");
    barDims = document.getElementById("bar-dims");
    goBtn = document.getElementById("go-btn");
    countLabel = document.getElementById("selected-count");

    MM.ui.initChrome("selfcheck");
    DIMS.forEach(function (d) { selected[d.key] = []; });
    renderGroups();
    updateBar();

    groupsBox.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-dim]");
      if (btn) toggle(btn.getAttribute("data-dim"), btn.getAttribute("data-value"));
    });

    document.getElementById("photo-input").addEventListener("change", function (e) {
      setPhoto(e.target.files[0]);
    });
    document.getElementById("remove-photo").addEventListener("click", removePhoto);
    document.getElementById("reset-btn").addEventListener("click", function () {
      DIMS.forEach(function (d) { selected[d.key] = []; });
      renderGroups();
      updateBar();
    });
    goBtn.addEventListener("click", submit);

    var drawer = document.querySelector(".selfcheck-bar");
    window.addEventListener("scroll", function () {
      if (drawer) drawer.classList.toggle("is-stuck", window.scrollY > 400);
    }, { passive: true });
  });
})();
