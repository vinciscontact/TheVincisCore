/* ==========================================================================
   TheVincis — Services: the editorial list
   Six numbered rows on the golden 61.8% side; the sticky 38.2% panel shows
   the live mock for whichever row is hovered or focused. Only the active mock
   animates, and only while the section is on screen. Phones skip the panel.
   ========================================================================== */
(() => {
  "use strict";

  const board = document.querySelector(".svc-board");
  if (!board || !window.gsap) return;
  const rows = [...board.querySelectorAll(".svc-row")];
  const visuals = [...board.querySelectorAll(".svc-visual")];
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wide = window.matchMedia("(min-width: 900px)");

  /* ---- Entrance: rows rise in on the golden stagger ---- */
  if (!reduced && window.ScrollTrigger) {
    gsap.from(rows, {
      y: 21, autoAlpha: 0, duration: 0.8, ease: "expo.out", stagger: 0.1,
      scrollTrigger: { trigger: board, start: "top 78%", toggleActions: "play none none none" },
    });
  }

  /* ---- Live mocks (the former services tour's reels) ---- */
  const newReel = () => gsap.timeline({ repeat: -1, paused: true, defaults: { ease: "power3.out" } });
  const reelBuilders = {
    // scene 03: the phone cycles Iyra → TableServe → dashboard
    phone(root) {
      const tl = newReel();
      root.querySelectorAll(".mock-app").forEach((app) => {
        const bits = app.querySelectorAll("header, .mock-app__balance, .mock-app__kpi, li, .mock-app__dish, .mock-app__cart, .mock-app__bars i");
        tl.fromTo(app, { xPercent: 100, autoAlpha: 0 }, { xPercent: 0, autoAlpha: 1, duration: 0.55 })
          .from(bits, { y: 16, autoAlpha: 0, stagger: 0.07, duration: 0.35 }, "-=0.25")
          .to(app, { xPercent: -100, autoAlpha: 0, duration: 0.5, ease: "power3.in" }, "+=2.2");
      });
      return tl;
    },

    // scene 01: orders arrive and get served, then the bookings platform takes over
    saas(root) {
      const tl = newReel();
      root.querySelectorAll(".mock-screen").forEach((screen) => {
        const rows = screen.querySelectorAll(".mock-head, .mock-order, .mock-total");
        const chips = screen.querySelectorAll(".mock-chip:not(.mock-chip--ok)");
        tl.call(() => chips.forEach((c) => { c.classList.remove("is-done"); c.textContent = "Preparing"; }))
          .fromTo(screen, { xPercent: 100, autoAlpha: 0 }, { xPercent: 0, autoAlpha: 1, duration: 0.55 })
          .from(rows, { y: 16, autoAlpha: 0, stagger: 0.08, duration: 0.35 }, "-=0.25");
        chips.forEach((c, k) =>
          tl.call(() => { c.classList.add("is-done"); c.textContent = "Served"; }, null, "+=" + (k ? 0.45 : 0.6))
        );
        tl.to(screen, { xPercent: -100, autoAlpha: 0, duration: 0.5, ease: "power3.in" }, "+=1.6");
      });
      return tl;
    },

    // scene 02: code lines type themselves; each pair births a UI piece
    code(root) {
      const body = root.querySelector(".mock-win__body");
      const lines = root.querySelectorAll(".code-line");
      const pieces = [root.querySelector(".prev-head"), root.querySelector(".prev-btn"), root.querySelector(".prev-bars")];
      const tl = newReel();
      tl.set(lines, { scaleX: 0, transformOrigin: "left center" }).set(pieces, { autoAlpha: 0 });
      pieces.forEach((piece, k) => {
        tl.to([lines[k * 2], lines[k * 2 + 1]], { scaleX: 1, duration: 0.45, stagger: 0.3, ease: "power1.inOut" })
          .fromTo(piece, { scale: 0.7, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.4 }, "-=0.1");
      });
      tl.to(body, { autoAlpha: 0, duration: 0.4, ease: "power2.in" }, "+=2")
        .set(lines, { scaleX: 0 })
        .set(pieces, { autoAlpha: 0 })
        .set(body, { autoAlpha: 1 });
      return tl;
    },

    // scene 04: the site assembles, then the enquiry lands
    web(root) {
      const site = root.querySelector(".mock-site");
      const tl = newReel();
      tl.from(site.querySelector(".site-nav"), { y: -18, autoAlpha: 0, duration: 0.4 })
        .from(site.querySelectorAll(".site-hero > *"), { y: 14, autoAlpha: 0, stagger: 0.12, duration: 0.4 })
        .from(site.querySelectorAll(".site-secs i"), { y: 20, autoAlpha: 0, stagger: 0.15, duration: 0.45 })
        .fromTo(site.querySelector(".mock-toast"), { x: 40, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.45, ease: "back.out(1.6)" }, "+=0.4")
        .to(site, { autoAlpha: 0, duration: 0.4, ease: "power2.in" }, "+=2")
        .set(site, { autoAlpha: 1 });
      return tl;
    },

    // scene 05: KPIs count up, the bars stand
    data(root) {
      const tl = newReel();
      tl.from(root.querySelector(".mock-head"), { y: 12, autoAlpha: 0, duration: 0.35 })
        .from(root.querySelectorAll(".bi-kpi"), { y: 16, autoAlpha: 0, stagger: 0.12, duration: 0.4 }, "-=0.1");
      root.querySelectorAll(".bi-kpi strong").forEach((el) => {
        const v = { n: 0 };
        tl.to(v, {
          n: parseFloat(el.dataset.to),
          duration: 0.9,
          ease: "power2.out",
          onUpdate: () => {
            el.textContent = el.dataset.fmt === "lakh" ? "₹" + v.n.toFixed(1) + "L" : String(Math.round(v.n));
          },
        }, "<0.15");
      });
      tl.fromTo(root.querySelectorAll(".bi-bars i"), { scaleY: 0 }, { scaleY: 1, duration: 0.5, stagger: 0.06 }, "-=0.5")
        .to(root.querySelector(".mock-bi"), { autoAlpha: 0, duration: 0.4, ease: "power2.in" }, "+=2.2")
        .set(root.querySelector(".mock-bi"), { autoAlpha: 1 });
      return tl;
    },

    // scene 06: the result climbs to #1, then the AI cites the brand
    seo(root) {
      const serp = root.querySelector(".mock-serp");
      const ai = root.querySelector(".mock-ai");
      const results = serp.querySelectorAll(".serp-res");
      const tv = serp.querySelector(".serp-res--tv");
      const others = [...results].filter((r) => r !== tv);
      const badge = tv.querySelector("em");
      const rowShift = () => results[1].offsetTop - results[0].offsetTop;
      const tl = newReel();
      tl.set([tv, ...others], { y: 0 })
        .set(badge, { scale: 0, autoAlpha: 0 })
        .fromTo(serp, { xPercent: 100, autoAlpha: 0 }, { xPercent: 0, autoAlpha: 1, duration: 0.55 })
        .from([serp.querySelector(".serp-bar"), ...results], { y: 14, autoAlpha: 0, stagger: 0.09, duration: 0.35 }, "-=0.25")
        .to(tv, { y: () => -2 * rowShift(), duration: 0.55, ease: "power2.inOut" }, "+=0.7")
        .to(others, { y: () => rowShift(), duration: 0.55, ease: "power2.inOut" }, "<")
        .to(badge, { scale: 1, autoAlpha: 1, duration: 0.35, ease: "back.out(1.6)" }, "-=0.1")
        .to(serp, { xPercent: -100, autoAlpha: 0, duration: 0.5, ease: "power3.in" }, "+=1.6")
        .fromTo(ai, { xPercent: 100, autoAlpha: 0 }, { xPercent: 0, autoAlpha: 1, duration: 0.55 })
        .from(ai.querySelector(".ai-q"), { y: 12, autoAlpha: 0, duration: 0.35 }, "-=0.2")
        .from(ai.querySelectorAll(".ai-a > *"), { y: 12, autoAlpha: 0, stagger: 0.14, duration: 0.35 }, "+=0.15")
        .to(ai, { xPercent: -100, autoAlpha: 0, duration: 0.5, ease: "power3.in" }, "+=1.8");
      return tl;
    },
  };

  const POSTER = 0.9; // a legible still: every mock is fully drawn by now
  const reels = visuals.map((v) => {
    const root = v.querySelector("[data-reel]");
    const build = root && reelBuilders[root.dataset.reel];
    const tl = build ? build(root) : null;
    if (tl) tl.pause(POSTER);
    return tl;
  });

  let active = 0;
  let onScreen = false;
  const sync = () => {
    reels.forEach((tl, i) => {
      if (!tl) return;
      if (i === active && onScreen && !reduced && wide.matches) tl.play();
      else tl.pause();
    });
  };
  const activate = (i) => {
    if (i === active) return;
    rows[active].classList.remove("is-active");
    visuals[active].classList.remove("is-active");
    if (reels[active]) reels[active].pause(POSTER);
    active = i;
    rows[i].classList.add("is-active");
    visuals[i].classList.add("is-active");
    sync();
  };
  rows.forEach((row, i) => {
    row.addEventListener("mouseenter", () => activate(i));
    row.addEventListener("focusin", () => activate(i));
  });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; sync(); }, { threshold: 0.15 }).observe(board);
  }
  wide.addEventListener("change", sync);
})();
