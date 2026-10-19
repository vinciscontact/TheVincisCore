/* ==========================================================================
   TheVincis — Work chapters
   Each chapter's video is a link to the live site. Its silent preview loop
   loads and plays only while the chapter is on screen; reduced-motion and
   data-saver visitors keep the still poster.
   ========================================================================== */
(() => {
  "use strict";

  const chapters = document.querySelectorAll(".chapter");
  if (!chapters.length) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const conn = navigator.connection || {};
  const lightData = conn.saveData || /(^|-)2g$/.test(conn.effectiveType || "");

  /* ---- Previews: lazy-load and play while visible ---- */
  if (!reduced && !lightData && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach(({ target: video, isIntersecting }) => {
          if (isIntersecting) {
            if (!video.src) video.src = video.dataset.src;
            video.play().catch(() => {});
          } else if (!video.paused) {
            video.pause();
          }
        });
      },
      { threshold: 0.35 }
    );
    document.querySelectorAll(".chapter__video").forEach((v) => io.observe(v));
  }

  /* ---- Entrance: frame rises from its side, the title block follows ---- */
  if (!reduced && window.gsap && window.ScrollTrigger) {
    chapters.forEach((ch) => {
      const fromSide = ch.classList.contains("chapter--flip") ? 34 : -34;
      gsap.from(ch.querySelector(".chapter__frame"), {
        x: fromSide, y: 34, autoAlpha: 0, duration: 1.1, ease: "expo.out",
        scrollTrigger: { trigger: ch, start: "top 78%", toggleActions: "play none none none" },
      });
      gsap.from(ch.querySelectorAll(".chapter__story > *"), {
        y: 21, autoAlpha: 0, duration: 0.9, ease: "expo.out", stagger: 0.1,
        scrollTrigger: { trigger: ch, start: "top 72%", toggleActions: "play none none none" },
      });
    });
  }
})();
