/* ==========================================================================
   TheVincis — Work chapters
   · Silent preview loops play only while a chapter is on screen, and only on
     larger screens with a fine pointer. Phones, reduced-motion and
     data-saver visitors get the still poster and the pulsing play button.
   · The play button / "Watch the walkthrough" open the full video in a
     native <dialog>; closing it unloads the video so it stops downloading.
   ========================================================================== */
(() => {
  "use strict";

  const chapters = document.querySelectorAll(".chapter");
  if (!chapters.length) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const conn = navigator.connection || {};
  const lightData = conn.saveData || /(^|-)2g$/.test(conn.effectiveType || "");
  const bigScreen = window.matchMedia("(min-width: 900px) and (pointer: fine)").matches;

  /* ---- Previews: lazy-load and play while visible ---- */
  if (!reduced && !lightData && bigScreen && "IntersectionObserver" in window) {
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

  /* ---- Full walkthrough player ---- */
  const dialog = document.getElementById("reel");
  if (dialog) {
    const player = dialog.querySelector(".reel__video");
    const title = dialog.querySelector(".reel__title");
    let opener = null;
    // main.js keeps a global `lenis`; pause smooth scroll behind the dialog.
    const smooth = () => (typeof lenis !== "undefined" ? lenis : null);

    const open = (btn) => {
      opener = btn;
      title.textContent = btn.dataset.title + " — website walkthrough";
      player.poster = btn.dataset.poster;
      player.src = btn.dataset.reel;
      dialog.showModal();
      smooth()?.stop();
      player.play().catch(() => {});
    };
    const close = () => {
      player.pause();
      player.removeAttribute("src");
      player.load();
      if (dialog.open) dialog.close();
      smooth()?.start();
      opener?.focus({ preventScroll: true });
    };

    document.querySelectorAll("[data-reel]").forEach((btn) => btn.addEventListener("click", () => open(btn)));
    dialog.querySelector(".reel__close").addEventListener("click", close);
    dialog.addEventListener("click", (e) => { if (e.target === dialog) close(); });
    dialog.addEventListener("cancel", (e) => { e.preventDefault(); close(); });
  }

  /* ---- Entrance: frame rises, story lines follow (golden-ratio stagger) ---- */
  if (!reduced && window.gsap && window.ScrollTrigger) {
    chapters.forEach((ch) => {
      const fromSide = ch.classList.contains("chapter--flip") ? 34 : -34;
      gsap.from(ch.querySelector(".chapter__frame"), {
        x: fromSide, y: 34, autoAlpha: 0, duration: 1.1, ease: "expo.out",
        scrollTrigger: { trigger: ch, start: "top 78%", toggleActions: "play none none none" },
      });
      gsap.from(ch.querySelectorAll(".chapter__story > *"), {
        y: 21, autoAlpha: 0, duration: 0.8, ease: "expo.out", stagger: 0.0618 * 1.618,
        scrollTrigger: { trigger: ch, start: "top 72%", toggleActions: "play none none none" },
      });
    });
  }
})();
