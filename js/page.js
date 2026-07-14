/* ==========================================================================
   TheVincis — subpage motion (light)
   Shared by product/service pages: smooth scroll, nav behavior, reveals.
   ========================================================================== */

gsap.registerPlugin(ScrollTrigger);
gsap.defaults({ ease: "power3.out", duration: 0.8 });

const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---- Smooth scroll ---- */
let lenis = null;
if (!prefersReduced) {
  lenis = new Lenis({ lerp: 0.1 });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

/* ---- On-page anchors (cross-page links pass through) ---- */
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener("click", (e) => {
    const target = document.querySelector(a.hash);
    if (!target) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(target, { offset: -72, duration: 1.2 });
    else target.scrollIntoView();
    closeMobileMenu();
  });
});

/* ---- Mobile menu ---- */
const navToggle = document.querySelector(".nav__toggle");
const mobileMenu = document.querySelector(".mobile-menu");
function closeMobileMenu() {
  mobileMenu.classList.remove("is-open");
  mobileMenu.setAttribute("aria-hidden", "true");
  navToggle.setAttribute("aria-expanded", "false");
  if (lenis) lenis.start();
}
navToggle.addEventListener("click", () => {
  const open = mobileMenu.classList.toggle("is-open");
  mobileMenu.setAttribute("aria-hidden", String(!open));
  navToggle.setAttribute("aria-expanded", String(open));
  if (lenis) open ? lenis.stop() : lenis.start();
});

/* ---- Nav: hide down / reveal up + legibility strip ---- */
const nav = document.querySelector(".nav");
ScrollTrigger.create({
  start: "top top",
  end: "max",
  onUpdate: (self) => {
    nav.classList.toggle("nav--scrolled", self.scroll() > 80);
    if (prefersReduced) return;
    if (self.direction === 1 && self.scroll() > 400) nav.classList.add("nav--hidden");
    else nav.classList.remove("nav--hidden");
  },
});

/* ---- Cursor (desktop) ---- */
if (!prefersReduced && window.matchMedia("(hover: hover) and (min-width: 800px)").matches) {
  const cursor = document.querySelector(".cursor");
  const xTo = gsap.quickTo(cursor, "x", { duration: 0.35, ease: "power3" });
  const yTo = gsap.quickTo(cursor, "y", { duration: 0.35, ease: "power3" });
  window.addEventListener("mousemove", (e) => {
    gsap.set(cursor, { autoAlpha: 1 });
    xTo(e.clientX);
    yTo(e.clientY);
  });
  document.querySelectorAll("a, button, summary").forEach((el) => {
    el.addEventListener("mouseenter", () => gsap.to(cursor, { scale: 3, opacity: 0.35, duration: 0.3 }));
    el.addEventListener("mouseleave", () => gsap.to(cursor, { scale: 1, opacity: 1, duration: 0.3 }));
  });
}

/* Pins are created in mixed order across modules; re-measure everything
   once the page (fonts, images) has fully loaded so pin spacers cascade
   correctly in document order. */
window.addEventListener("load", () => ScrollTrigger.refresh());

/* ---- Interactive structures (progressive enhancement) ----
   The semantic lists/tables stay in the HTML for crawlers and
   reduced-motion users; here they transform into playable pieces. ---- */
if (!prefersReduced) {
  /* On small screens all entrances are vertical — horizontal offsets
     transiently widen the mobile layout viewport and drag the page sideways. */
  const isSmall = window.matchMedia("(max-width: 899px)").matches;

  /* --- Card-throw stack: every UL .howlist becomes a throwable deck --- */
  document.querySelectorAll("ul.howlist").forEach((ul) => {
    const items = [...ul.querySelectorAll("li")];
    const stack = document.createElement("div");
    stack.className = "stack";
    stack.innerHTML =
      '<div class="stack__deck"></div>' +
      '<div class="stack__meta"><span class="stack__count">1 / ' + items.length + '</span>' +
      '<span class="stack__hint">tap or flick the card →</span></div>';
    const deck = stack.querySelector(".stack__deck");
    items.forEach((li, i) => {
      const card = document.createElement("article");
      card.className = "stackcard";
      card.innerHTML = '<span class="stackcard__num">0' + (i + 1) + "</span><div>" + li.innerHTML + "</div>";
      deck.appendChild(card);
    });
    ul.replaceWith(stack);

    const cards = [...deck.children];
    const n = cards.length;
    const count = stack.querySelector(".stack__count");
    const hint = stack.querySelector(".stack__hint");
    const slotProps = (i) => ({
      y: i * 13,
      x: 0,
      scale: 1 - i * 0.05,
      rotation: (i % 2 ? -1 : 1) * i * 1.7,
      zIndex: n - i,
      autoAlpha: i < 4 ? 1 : 0,
    });
    const updateCount = (c) => (count.textContent = c + " / " + n);
    document.fonts.ready.then(() => {
      deck.style.height = Math.max(...cards.map((c) => c.offsetHeight)) + 60 + "px";
      ScrollTrigger.refresh();
    });

    /* Desktop: the section pins and scrolling deals the deck (reversible).
       Small screens: a fixed, fully-visible card list — nothing movable. */
    const mmDeck = gsap.matchMedia();
    mmDeck.add("(min-width: 900px)", () => {
      hint.textContent = "keep scrolling — the deck deals itself";
      cards.forEach((c, i) => gsap.set(c, slotProps(i)));
      updateCount(1);
      const section = stack.closest(".psection") || stack;
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: "+=" + (n - 1) * 55 + "%",
          pin: true,
          scrub: 1,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          refreshPriority: 1, // refresh after the scene pin above it, so its start includes that pin's spacer
          onUpdate: (self) => updateCount(1 + Math.min(n - 1, Math.floor(self.progress * (n - 1) + 0.02))),
        },
        defaults: { ease: "none" },
      });
      for (let i = 0; i < n - 1; i++) {
        const dir = i % 2 ? -1 : 1;
        tl.to(cards[i], {
          x: () => dir * (deck.offsetWidth * 0.85 + 120),
          rotation: dir * 26,
          autoAlpha: 0,
          duration: 1,
          ease: "power1.in",
        }, i);
        for (let j = i + 1; j < n; j++) {
          const k = j - i - 1;
          tl.to(cards[j], {
            y: k * 13,
            scale: 1 - k * 0.05,
            rotation: (k % 2 ? -1 : 1) * k * 1.7,
            autoAlpha: k < 4 ? 1 : 0,
            duration: 1,
          }, i);
        }
      }
      return () => {};
    });
    mmDeck.add("(max-width: 899px)", () => {
      stack.classList.add("stack--static");
      gsap.set(cards, { clearProps: "all" });
      cards.forEach((c) => {
        gsap.from(c, {
          y: 36,
          autoAlpha: 0,
          duration: 0.7,
          ease: "power3.out",
          scrollTrigger: { trigger: c, start: "top 92%" },
        });
      });
      return () => stack.classList.remove("stack--static");
    });
  });

  /* --- Versus battle: 3-column tables marked data-versus fight it out --- */
  document.querySelectorAll("table[data-versus]").forEach((table) => {
    const winner = table.dataset.versus; // "left" | "right" | "neutral"
    const ths = table.querySelectorAll("thead th");
    const rows = [...table.querySelectorAll("tbody tr")];
    const v = document.createElement("div");
    v.className = "versus";
    v.innerHTML =
      '<div class="versus__head">' +
      '<div class="versus__fighter">' + ths[1].innerHTML + (winner === "left" ? '<span class="versus__crown">🏆</span>' : "") + "</div>" +
      '<div class="versus__badge">VS</div>' +
      '<div class="versus__fighter">' + ths[2].innerHTML + (winner === "right" ? '<span class="versus__crown">🏆</span>' : "") + "</div>" +
      "</div>" +
      '<div class="versus__rounds"></div>' +
      (winner !== "neutral"
        ? '<div class="versus__score"><span class="versus__num" data-side="left">0</span><i>rounds won</i><span class="versus__num" data-side="right">0</span></div>'
        : "");
    const roundsBox = v.querySelector(".versus__rounds");
    rows.forEach((tr) => {
      const tds = tr.querySelectorAll("td");
      // a row can override the table's default winner (data-win="left|right|none")
      const rowWin = tr.dataset.win !== undefined ? tr.dataset.win : winner !== "neutral" ? winner : "none";
      const round = document.createElement("div");
      round.className = "versus__round";
      round.dataset.win = rowWin;
      round.innerHTML =
        '<div class="versus__cell' + (rowWin === "left" ? " is-win" : "") + '">' + tds[1].innerHTML + "</div>" +
        '<span class="versus__label">' + tds[0].innerHTML + "</span>" +
        '<div class="versus__cell' + (rowWin === "right" ? " is-win" : "") + '">' + tds[2].innerHTML + "</div>";
      roundsBox.appendChild(round);
    });
    (table.closest(".tblwrap") || table).replaceWith(v);

    gsap.from(v.querySelector(".versus__head"), {
      y: 30, autoAlpha: 0, duration: 0.7,
      scrollTrigger: { trigger: v, start: "top 84%" },
    });
    const badge = v.querySelector(".versus__badge");
    gsap.from(badge, { scale: 0, rotation: -180, duration: 0.7, ease: "back.out(1.8)", scrollTrigger: { trigger: v, start: "top 84%" } });
    const scoreEls = {
      left: v.querySelector('.versus__num[data-side="left"]'),
      right: v.querySelector('.versus__num[data-side="right"]'),
    };
    const tally = { left: 0, right: 0 };
    v.querySelectorAll(".versus__round").forEach((r) => {
      const tlr = gsap.timeline({ scrollTrigger: { trigger: r, start: "top 90%" } });
      tlr.from(r.children[0], { x: isSmall ? 0 : -54, y: isSmall ? 26 : 0, autoAlpha: 0, duration: 0.45, ease: "power2.out" })
        .from(r.children[1], { scale: 0.5, autoAlpha: 0, duration: 0.3, ease: "back.out(2)" }, "<0.1")
        .from(r.children[2], { x: isSmall ? 0 : 54, y: isSmall ? 26 : 0, autoAlpha: 0, duration: 0.45, ease: "power2.out" }, "<");
      const side = r.dataset.win;
      const winCell = r.querySelector(".is-win");
      const scoreEl = scoreEls[side];
      if (winCell && scoreEl) {
        tally[side]++;
        const target = tally[side];
        tlr.fromTo(winCell, { boxShadow: "0 0 0 rgba(197,160,40,0)" }, { boxShadow: "0 12px 28px rgba(197,160,40,0.28)", duration: 0.35 })
          .to({}, {
            duration: 0.01,
            onComplete: () => (scoreEl.textContent = target),
            onReverseComplete: () => (scoreEl.textContent = target - 1),
          });
      }
    });
    const crown = v.querySelector(".versus__crown");
    if (crown) {
      const lastRound = roundsBox.lastElementChild;
      gsap.from(crown, { scale: 0, rotation: -35, autoAlpha: 0, duration: 0.6, ease: "back.out(2.4)", scrollTrigger: { trigger: lastRound, start: "bottom 82%" } });
    }
  });

  /* --- Journey path: every OL .howlist becomes a milestone trail,
         with a sticky blueprint artwork panel that redraws per step --- */
  const ART = {
    call: '<rect class="d-main" pathLength="1" x="55" y="40" width="90" height="56" rx="12"/><path class="d-main" pathLength="1" d="M75 96 L75 112 L92 96"/><circle class="d-fine" pathLength="1" cx="85" cy="68" r="3"/><circle class="d-fine" pathLength="1" cx="100" cy="68" r="3"/><circle class="d-fine" pathLength="1" cx="115" cy="68" r="3"/>',
    scope: '<rect class="d-main" pathLength="1" x="65" y="30" width="70" height="90" rx="8"/><line class="d-fine" pathLength="1" x1="78" y1="52" x2="122" y2="52"/><line class="d-fine" pathLength="1" x1="78" y1="66" x2="122" y2="66"/><line class="d-fine" pathLength="1" x1="78" y1="80" x2="110" y2="80"/><circle class="d-main" pathLength="1" cx="120" cy="102" r="9"/><path class="d-fine" pathLength="1" d="M116 102 l3 3 l6 -7"/>',
    design: '<rect class="d-main" pathLength="1" x="45" y="35" width="110" height="80" rx="8"/><line class="d-main" pathLength="1" x1="45" y1="52" x2="155" y2="52"/><path class="d-main" pathLength="1" d="M100 98 C 89 89 85.5 84 85.5 79.5 C 85.5 75 89 72 93 72 C 95.8 72 98.6 73.6 100 76.2 C 101.4 73.6 104.2 72 107 72 C 111 72 114.5 75 114.5 79.5 C 114.5 84 111 89 100 98 Z"/>',
    build: '<path class="d-main" pathLength="1" d="M75 45 L50 75 L75 105"/><path class="d-main" pathLength="1" d="M125 45 L150 75 L125 105"/><line class="d-main" pathLength="1" x1="108" y1="42" x2="92" y2="108"/>',
    launch: '<path class="d-main" pathLength="1" d="M100 30 C 112 42 118 60 118 78 L 100 92 L 82 78 C 82 60 88 42 100 30 Z"/><circle class="d-fine" pathLength="1" cx="100" cy="60" r="7"/><path class="d-fine" pathLength="1" d="M82 78 L70 96 L84 92 M118 78 L130 96 L116 92"/><path class="d-fine" pathLength="1" d="M94 96 C 94 106 100 114 100 120 C 100 114 106 106 106 96"/>',
    audit: '<line class="d-fine" pathLength="1" x1="55" y1="45" x2="145" y2="45"/><line class="d-fine" pathLength="1" x1="55" y1="60" x2="145" y2="60"/><line class="d-fine" pathLength="1" x1="55" y1="75" x2="120" y2="75"/><circle class="d-main" pathLength="1" cx="95" cy="72" r="24"/><line class="d-main" pathLength="1" x1="113" y1="90" x2="138" y2="115"/>',
    connect: '<path class="d-main" pathLength="1" d="M45 50 H80 C 96 50 96 72 112 72 H155"/><path class="d-main" pathLength="1" d="M45 95 H80 C 96 95 96 73 112 73"/><circle class="d-fine" pathLength="1" cx="118" cy="72" r="6"/>',
    model: '<path class="d-main" pathLength="1" d="M100 35 L140 55 L140 95 L100 115 L60 95 L60 55 Z"/><path class="d-fine" pathLength="1" d="M60 55 L100 75 L140 55 M100 75 L100 115"/>',
    chart: '<path class="d-main" pathLength="1" d="M55 40 V110 H150"/><path class="d-main" pathLength="1" d="M65 95 L88 78 L108 86 L138 52"/><circle class="d-fine" pathLength="1" cx="138" cy="52" r="5"/>',
    train: '<path class="d-main" pathLength="1" d="M100 45 L150 65 L100 85 L50 65 Z"/><path class="d-fine" pathLength="1" d="M75 75 V95 C 75 102 125 102 125 95 V75"/><line class="d-fine" pathLength="1" x1="150" y1="65" x2="150" y2="92"/><circle class="d-fine" pathLength="1" cx="150" cy="96" r="3"/>',
    content: '<path class="d-main" pathLength="1" d="M60 110 L66 92 L120 38 L134 52 L80 106 Z"/><line class="d-fine" pathLength="1" x1="66" y1="92" x2="80" y2="106"/><line class="d-fine" pathLength="1" x1="95" y1="118" x2="145" y2="118"/>',
    authority: '<rect class="d-main" pathLength="1" x="55" y="60" width="46" height="28" rx="14"/><rect class="d-main" pathLength="1" x="99" y="60" width="46" height="28" rx="14"/><line class="d-fine" pathLength="1" x1="88" y1="74" x2="112" y2="74"/>',
    measure: '<path class="d-main" pathLength="1" d="M55 100 A 45 45 0 0 1 145 100"/><line class="d-main" pathLength="1" x1="100" y1="100" x2="125" y2="72"/><circle class="d-main" pathLength="1" cx="100" cy="100" r="5"/><line class="d-fine" pathLength="1" x1="60" y1="86" x2="68" y2="90"/><line class="d-fine" pathLength="1" x1="100" y1="55" x2="100" y2="63"/><line class="d-fine" pathLength="1" x1="140" y1="86" x2="132" y2="90"/>',
    scan: '<rect class="d-main" pathLength="1" x="60" y="40" width="28" height="28" rx="4"/><rect class="d-main" pathLength="1" x="112" y="40" width="28" height="28" rx="4"/><rect class="d-main" pathLength="1" x="60" y="92" width="28" height="28" rx="4"/><rect class="d-fine" pathLength="1" x="112" y="92" width="12" height="12"/><rect class="d-fine" pathLength="1" x="128" y="106" width="12" height="12"/><rect class="d-fine" pathLength="1" x="68" y="48" width="12" height="12"/>',
    menu: '<rect class="d-main" pathLength="1" x="78" y="30" width="44" height="90" rx="10"/><line class="d-fine" pathLength="1" x1="88" y1="52" x2="112" y2="52"/><line class="d-fine" pathLength="1" x1="88" y1="66" x2="112" y2="66"/><line class="d-fine" pathLength="1" x1="88" y1="80" x2="106" y2="80"/><line class="d-main" pathLength="1" x1="93" y1="108" x2="107" y2="108"/>',
    order: '<path class="d-main" pathLength="1" d="M65 40 H135 V110 L123 102 L111 110 L100 102 L89 110 L77 102 L65 110 Z"/><line class="d-fine" pathLength="1" x1="78" y1="58" x2="122" y2="58"/><line class="d-fine" pathLength="1" x1="78" y1="72" x2="122" y2="72"/>',
    serve: '<path class="d-main" pathLength="1" d="M60 95 C 60 70 80 55 100 55 C 120 55 140 70 140 95 Z"/><line class="d-main" pathLength="1" x1="50" y1="103" x2="150" y2="103"/><circle class="d-fine" pathLength="1" cx="100" cy="48" r="4"/>',
    pay: '<circle class="d-main" pathLength="1" cx="80" cy="75" r="28"/><path class="d-fine" pathLength="1" d="M70 64 H90 M70 72 H90 M72 64 C 84 64 84 74 74 86 L 90 86"/><path class="d-main" pathLength="1" d="M120 60 L150 75 L120 90 M118 75 H146"/>',
    notify: '<path class="d-main" pathLength="1" d="M100 40 C 82 40 76 55 76 70 C 76 85 70 92 65 96 H135 C 130 92 124 85 124 70 C 124 55 118 40 100 40 Z"/><path class="d-fine" pathLength="1" d="M92 104 C 94 110 106 110 108 104"/><circle class="d-fine" pathLength="1" cx="100" cy="34" r="3"/>',
    log: '<rect class="d-main" pathLength="1" x="60" y="32" width="80" height="88" rx="8"/><path class="d-fine" pathLength="1" d="M72 55 l5 5 l9 -10"/><line class="d-fine" pathLength="1" x1="94" y1="55" x2="126" y2="55"/><path class="d-fine" pathLength="1" d="M72 78 l5 5 l9 -10"/><line class="d-fine" pathLength="1" x1="94" y1="78" x2="126" y2="78"/><path class="d-fine" pathLength="1" d="M72 101 l5 5 l9 -10"/><line class="d-fine" pathLength="1" x1="94" y1="101" x2="118" y2="101"/>',
    family: '<circle class="d-main" pathLength="1" cx="82" cy="58" r="12"/><path class="d-main" pathLength="1" d="M60 105 C 60 88 72 78 82 78 C 92 78 104 88 104 105"/><circle class="d-main" pathLength="1" cx="122" cy="64" r="9"/><path class="d-main" pathLength="1" d="M106 105 C 106 92 114 84 122 84 C 130 84 138 92 138 105"/>',
  };

  document.querySelectorAll("ol.howlist").forEach((ol) => {
    const items = [...ol.querySelectorAll("li")];
    const keys = (ol.dataset.art || "").split(",").map((k) => k.trim()).filter(Boolean);
    const hasArt = keys.length === items.length && keys.every((k) => ART[k]);
    const j = document.createElement("div");
    j.className = "journey" + (hasArt ? " journey--art" : "");
    const stepsBox = document.createElement("div");
    stepsBox.className = "journey__steps";
    items.forEach((li, i) => {
      const step = document.createElement("div");
      step.className = "journey__step";
      const curve = i % 2
        ? "M45 16 C 45 42, 76 46, 76 60 C 76 82, 45 82, 45 104"
        : "M45 16 C 45 42, 14 46, 14 60 C 14 82, 45 82, 45 104";
      step.innerHTML =
        '<div class="journey__rail">' +
        '<span class="journey__node">' + (i + 1) + "</span>" +
        (i < items.length - 1
          ? '<svg viewBox="0 0 90 104" preserveAspectRatio="none"><path pathLength="1" d="' + curve + '"/></svg>'
          : "") +
        "</div>" +
        '<article class="journey__card">' + li.innerHTML + "</article>";
      stepsBox.appendChild(step);
    });
    j.appendChild(stepsBox);

    let artSvgs = [];
    let artNum = null;
    if (hasArt) {
      const aside = document.createElement("aside");
      aside.className = "journey__art";
      aside.setAttribute("aria-hidden", "true");
      aside.innerHTML =
        '<div class="journey__artstage">' +
        keys.map((k) => '<svg viewBox="0 0 200 150" xmlns="http://www.w3.org/2000/svg">' + ART[k] + "</svg>").join("") +
        '<span class="journey__artnum">01</span></div>';
      j.appendChild(aside);
      artSvgs = [...aside.querySelectorAll("svg")];
      artNum = aside.querySelector(".journey__artnum");
      gsap.set(artSvgs, { autoAlpha: 0 });
    }
    ol.replaceWith(j);

    let active = -1;
    const setActive = (i) => {
      if (!hasArt || i === active) return;
      const prev = active;
      active = i;
      if (prev > -1) gsap.to(artSvgs[prev], { autoAlpha: 0, scale: 0.94, duration: 0.3, overwrite: true });
      gsap.to(artSvgs[i], { autoAlpha: 1, scale: 1, duration: 0.4, overwrite: true });
      gsap.fromTo(artSvgs[i].querySelectorAll("[pathLength]"),
        { strokeDashoffset: 1 },
        { strokeDashoffset: 0, duration: 1, ease: "power2.out", stagger: 0.08, overwrite: true });
      artNum.textContent = "0" + (i + 1);
      gsap.fromTo(artNum, { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.4, overwrite: true });
    };

    stepsBox.querySelectorAll(".journey__step").forEach((step, i) => {
      const path = step.querySelector("path");
      gsap.from(step.querySelector(".journey__node"), {
        scale: 0, duration: 0.55, ease: "back.out(2.4)",
        scrollTrigger: { trigger: step, start: "top 82%" },
      });
      gsap.from(step.querySelector(".journey__card"), {
        x: isSmall ? 0 : i % 2 ? 64 : -64,
        y: isSmall ? 36 : 0,
        autoAlpha: 0, duration: 0.7, ease: "power3.out",
        scrollTrigger: { trigger: step, start: "top 82%" },
      });
      if (path) {
        gsap.fromTo(path, { strokeDashoffset: 1 }, {
          strokeDashoffset: 0, ease: "none",
          scrollTrigger: { trigger: step, start: "top 62%", end: "bottom 52%", scrub: true },
        });
      }
      if (hasArt) {
        ScrollTrigger.create({
          trigger: step,
          start: "top 58%",
          end: "bottom 58%",
          onToggle: (self) => self.isActive && setActive(i),
        });
      }
    });
    if (hasArt) setActive(0);
  });
}

/* ---- Cinematic set-piece scenes (one per service page) ---- */
if (!prefersReduced) {
  const mmScenes = gsap.matchMedia();
  mmScenes.add({ isDesktop: "(min-width: 900px)", isMobile: "(max-width: 899px)" }, (ctx) => {
    const { isDesktop } = ctx.conditions;
    const sceneTrigger = (scene, length) =>
      isDesktop
        ? { trigger: scene, start: "top top", end: "+=" + length, pin: scene.querySelector(".scene__pin"), scrub: 1, anticipatePin: 1, invalidateOnRefresh: true, refreshPriority: 2 }
        : { trigger: scene, start: "top 70%", toggleActions: "play none none none" };

    /* --- Scene: code types, a website becomes (web development) --- */
    const codeScene = document.querySelector(".scene--code");
    if (codeScene) {
      const lines = codeScene.querySelectorAll(".cl");
      const m = {
        nav: codeScene.querySelector(".mini__nav"),
        title: codeScene.querySelector(".mini__title"),
        em: codeScene.querySelector(".mini__title em"),
        btn: codeScene.querySelector(".mini__btn"),
        cards: codeScene.querySelectorAll(".mini__cards div"),
        live: codeScene.querySelector(".mini__live"),
        box: codeScene.querySelector(".mini"),
      };
      gsap.set([m.nav, m.btn, m.live], { autoAlpha: 0, y: 18 });
      gsap.set(m.title, { autoAlpha: 0, y: 24 });
      gsap.set(m.cards, { autoAlpha: 0, y: 22 });
      gsap.set(m.em, { color: "#1a1a1a" });
      const tl = gsap.timeline({ scrollTrigger: sceneTrigger(codeScene, "170%"), defaults: { ease: "none" } });
      const type = (i) => tl.to(lines[i], { width: "100%", duration: 0.55, ease: "steps(24)" });
      type(0); tl.to(m.nav, { autoAlpha: 1, y: 0, duration: 0.3, ease: "power2.out" }, "<0.35");
      type(1); tl.to(m.title, { autoAlpha: 1, y: 0, duration: 0.35, ease: "power2.out" }, "<0.35");
      type(2); tl.to(m.em, { color: "#c5a028", duration: 0.3 }, "<0.3");
      type(3); tl.to(m.btn, { autoAlpha: 1, y: 0, duration: 0.4, ease: "back.out(1.7)" }, "<0.3");
      type(4); tl.to(m.cards, { autoAlpha: 1, y: 0, stagger: 0.08, duration: 0.3, ease: "power2.out" }, "<0.3");
      type(5); tl.to(m.live, { autoAlpha: 1, y: 0, duration: 0.3, ease: "back.out(2)" }, "<0.4");
      tl.to(m.box, { boxShadow: "0 30px 70px rgba(197,160,40,0.35)", duration: 0.4 }, "<");
    }

    /* --- Scene: the living dashboard (data analytics) --- */
    const dashScene = document.querySelector(".scene--dash");
    if (dashScene) {
      const kpis = dashScene.querySelectorAll(".dash__kpi b");
      const line = dashScene.querySelector(".dash__line");
      const area = dashScene.querySelector(".dash__area");
      const dots = dashScene.querySelectorAll(".dash__dot");
      const bars = dashScene.querySelectorAll(".dash__track i");
      gsap.set(area, { autoAlpha: 0 });
      gsap.set(dots, { scale: 0, transformOrigin: "center" });
      gsap.set(bars, { scaleX: 0, transformOrigin: "left center" });
      const tl = gsap.timeline({ scrollTrigger: sceneTrigger(dashScene, "150%"), defaults: { ease: "none" } });
      kpis.forEach((el, i) => {
        const target = parseFloat(el.dataset.count);
        const prefix = el.dataset.prefix || "";
        const suffix = el.dataset.suffix || "";
        const proxy = { v: 0 };
        tl.to(proxy, {
          v: target,
          duration: 0.7,
          onUpdate: () => (el.textContent = prefix + Math.round(proxy.v).toLocaleString("en-IN") + suffix),
        }, i * 0.12);
      });
      tl.fromTo(line, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1 }, 0.35);
      tl.to(dots, { scale: 1, stagger: 0.07, duration: 0.25, ease: "back.out(2)" }, 0.55);
      tl.to(area, { autoAlpha: 1, duration: 0.4 }, 1.15);
      tl.to(bars, { scaleX: 1, stagger: 0.12, duration: 0.5, ease: "power2.out" }, 1.2);
    }

    /* --- Scene: the search theater (SEO · AEO · GEO) --- */
    const serpScene = document.querySelector(".scene--serp");
    if (serpScene) {
      const q = serpScene.querySelector(".serpbox__q");
      const results = gsap.utils.toArray(serpScene.querySelectorAll(".serp-r"));
      const you = serpScene.querySelector(".serp-r--you");
      const others = results.filter((r) => r !== you);
      const chat = serpScene.querySelector(".aichat");
      const bubbles = serpScene.querySelectorAll(".aichat__bubble");
      const cite = serpScene.querySelector(".aichat__cite");
      const src = serpScene.querySelector(".aichat__src");
      const query = "qr ordering system for restaurants india";
      const row = () => you.offsetHeight + 10; // slot height incl. gap
      gsap.set(results, { autoAlpha: 0, y: 24 });
      gsap.set(chat, { autoAlpha: 0, x: 60 });
      gsap.set(bubbles, { autoAlpha: 0, y: 20 });
      gsap.set(src, { autoAlpha: 0, scale: 0.8 });
      gsap.set(serpScene.querySelectorAll(".serp-pos s"), { autoAlpha: 0 });
      const typing = { p: 0 };
      const tl = gsap.timeline({ scrollTrigger: sceneTrigger(serpScene, "190%"), defaults: { ease: "none" } });
      tl.to(typing, {
        p: 1,
        duration: 0.7,
        onUpdate: () => (q.textContent = query.slice(0, Math.round(typing.p * query.length))),
      });
      tl.to(results, { autoAlpha: 1, y: 0, stagger: 0.12, duration: 0.35, ease: "power2.out" }, ">0.1");
      // the climb: your result rises two slots, the others shift down one
      tl.to(you, { y: () => -2 * row(), duration: 0.7, ease: "power2.inOut" }, "+=0.3");
      tl.to(others, { y: () => row(), duration: 0.7, ease: "power2.inOut" }, "<");
      tl.to(serpScene.querySelectorAll(".serp-pos u"), { autoAlpha: 0, duration: 0.25 }, "<0.4");
      tl.to(serpScene.querySelectorAll(".serp-pos s"), { autoAlpha: 1, duration: 0.25 }, "<");
      tl.to(you, { boxShadow: "0 16px 36px rgba(197,160,40,0.35)", duration: 0.3 }, "<");
      // act two: the AI answer cites the brand
      tl.to(chat, { autoAlpha: 1, x: 0, duration: 0.5, ease: "power2.out" }, "+=0.3");
      tl.to(bubbles[0], { autoAlpha: 1, y: 0, duration: 0.3, ease: "power2.out" }, "<0.2");
      tl.to(bubbles[1], { autoAlpha: 1, y: 0, duration: 0.35, ease: "power2.out" }, ">0.15");
      tl.to(cite, { backgroundSize: "100% 2px", duration: 0.35 }, ">");
      tl.to(src, { autoAlpha: 1, scale: 1, duration: 0.3, ease: "back.out(2)" }, ">0.1");
    }
  });
}

/* ---- Reveals ---- */
if (!prefersReduced) {
  gsap.utils.toArray(".reveal, .section-title, .psection__answer, .howlist li, .ptbl__cta").forEach((el) => {
    gsap.from(el, {
      y: 36,
      autoAlpha: 0,
      duration: 0.9,
      scrollTrigger: { trigger: el, start: "top 88%", toggleActions: "play none none none" },
    });
  });
  gsap.set(".feat", { autoAlpha: 0, y: 44 });
  ScrollTrigger.batch(".feat", {
    start: "top 90%",
    onEnter: (batch) => gsap.to(batch, { autoAlpha: 1, y: 0, stagger: 0.1, duration: 0.8, overwrite: true }),
  });
  gsap.from(".phero__visual .phone", {
    y: 60,
    rotation: 4,
    autoAlpha: 0,
    duration: 1.1,
    delay: 0.2,
  });
  gsap.fromTo(".phero__doodle [pathLength]",
    { strokeDashoffset: 1 },
    { strokeDashoffset: 0, duration: 1.6, ease: "power2.out", stagger: 0.09, delay: 0.3 }
  );
  gsap.from(".phero__copy > *", { y: 32, autoAlpha: 0, stagger: 0.09, duration: 0.8 });
}
