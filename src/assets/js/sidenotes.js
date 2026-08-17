// Align each footnote in the right margin with the line that references it.
// Progressive enhancement: if this script doesn't run, notes simply stack
// at the top of the margin, which is still perfectly readable.
(function () {
  const WIDE = window.matchMedia("(min-width: 60rem)");

  function layout() {
    const post = document.querySelector(".post");
    const list = document.querySelector(".footnotes-list");
    if (!post || !list) return;

    if (!WIDE.matches) {
      list.querySelectorAll(".footnote-item").forEach((li) => {
        li.style.position = "";
        li.style.top = "";
      });
      list.style.position = "";
      list.style.height = "";
      return;
    }

    list.style.position = "relative";
    const postTop = post.getBoundingClientRect().top + window.scrollY;
    let lastBottom = 0;

    list.querySelectorAll(".footnote-item").forEach((li) => {
      const id = li.getAttribute("id");
      const ref = document.querySelector('a[href="#' + id + '"]');
      if (!ref) return;
      const refTop = ref.getBoundingClientRect().top + window.scrollY - postTop;
      const top = Math.max(refTop, lastBottom);
      li.style.position = "absolute";
      li.style.top = top + "px";
      li.style.left = "0";
      li.style.right = "0";
      lastBottom = top + li.offsetHeight + 12;
    });
    list.style.height = lastBottom + "px";
  }

  function debounce(fn, ms) {
    let t;
    return function () { clearTimeout(t); t = setTimeout(fn, ms); };
  }

  function init() {
    layout();
    window.addEventListener("resize", debounce(layout, 150));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
    window.addEventListener("load", layout);
  }

  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
