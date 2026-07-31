/* ==========================================================================
   TheVincis — Collective duet machines
   Two allies, two working machines, one stroke language with the hero:
   · CreativzEdge — a two-jointed drafting arm draws a heart, forever.
   · Blackfyre    — a radar sweep circles a shield; controls light up
                    as the beam passes. Compliance, visibly under watch.
   ========================================================================== */
(() => {
  "use strict";

  const artistSvg = document.querySelector('[data-duet="artist"]');
  const engineerSvg = document.querySelector('[data-duet="engineer"]');
  if (!artistSvg || !engineerSvg) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const NS = "http://www.w3.org/2000/svg";
  const deg = (r) => (r * 180) / Math.PI;
  function el(name, attrs, cls, parent) {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (cls) n.setAttribute("class", cls);
    parent.appendChild(n);
    return n;
  }

  /* ======================================================================
     LEFT — the artist: a drafting arm draws a heart, stroke by stroke
     ====================================================================== */
  const BASE = { x: 84, y: 66 };   // arm mount, top-left
  const L1 = 240, L2 = 230;        // upper arm / forearm
  const HEART = { cx: 300, cy: 258, s: 8.4 }; // parametric heart placement

  function heartPoint(t) {
    // classic parametric heart, y flipped for SVG
    const x = 16 * Math.sin(t) ** 3;
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    return [HEART.cx + HEART.s * x, HEART.cy - HEART.s * y];
  }
  // start/end at the bottom tip (t = π) so the pen lifts where the heart closes
  const SAMPLES = 220;
  const heartPts = Array.from({ length: SAMPLES + 1 }, (_, i) =>
    heartPoint(Math.PI + (i / SAMPLES) * Math.PI * 2)
  );
  const heartD = heartPts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");

  // mount bracket + hatching — the machine is bolted to its page
  el("line", { x1: BASE.x - 34, y1: BASE.y - 14, x2: BASE.x + 34, y2: BASE.y - 14, pathLength: 1 }, "d-main", artistSvg);
  for (let i = 0; i < 6; i++) {
    const hx = BASE.x - 30 + i * 12;
    el("line", { x1: hx, y1: BASE.y - 14, x2: hx + 9, y2: BASE.y - 23, pathLength: 1 }, "d-fine", artistSvg);
  }
  // construction: circle the canvas area, mark its center
  el("circle", { cx: HEART.cx, cy: HEART.cy + 10, r: 158, pathLength: 1, "stroke-dasharray": "2 6" }, "d-fine", artistSvg);
  el("line", { x1: HEART.cx - 6, y1: HEART.cy + 10, x2: HEART.cx + 6, y2: HEART.cy + 10, pathLength: 1 }, "d-fine", artistSvg);
  el("line", { x1: HEART.cx, y1: HEART.cy + 4, x2: HEART.cx, y2: HEART.cy + 16, pathLength: 1 }, "d-fine", artistSvg);
  // palette swatches — the artist keeps her colors close
  [0, 1, 2].forEach((i) =>
    el("rect", { x: 396 + 0, y: 396 - i * 34, width: 34, height: 24, rx: 3, pathLength: 1 }, "d-fine", artistSvg)
  );

  // the ink: revealed behind the pen
  const inkPath = el("path", { d: heartD }, "d-main", artistSvg);
  const inkLen = inkPath.getTotalLength();
  inkPath.style.strokeDasharray = inkLen;
  inkPath.style.strokeDashoffset = inkLen;

  // the arm: two segments + joints + pen
  const upper = el("line", { pathLength: 1 }, "d-main", artistSvg);
  const fore = el("line", { pathLength: 1 }, "d-main", artistSvg);
  el("circle", { cx: BASE.x, cy: BASE.y, r: 8, pathLength: 1 }, "d-main", artistSvg);
  const elbow = el("circle", { r: 5.5, pathLength: 1 }, "d-main", artistSvg);
  const pen = el("circle", { r: 3, pathLength: 1 }, "d-main", artistSvg);

  function poseArm(t) {
    // pen target along the heart; two-link IK, elbow kept outward
    const idx = Math.max(0, Math.min(SAMPLES, Math.floor(t * SAMPLES)));
    const [px, py] = heartPts[idx];
    const dx = px - BASE.x, dy = py - BASE.y;
    const d = Math.max(Math.abs(L1 - L2) + 2, Math.min(L1 + L2 - 2, Math.hypot(dx, dy)));
    const a = Math.atan2(dy, dx) - Math.acos((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d));
    const ex = BASE.x + Math.cos(a) * L1;
    const ey = BASE.y + Math.sin(a) * L1;
    upper.setAttribute("x1", BASE.x); upper.setAttribute("y1", BASE.y);
    upper.setAttribute("x2", ex);     upper.setAttribute("y2", ey);
    fore.setAttribute("x1", ex);      fore.setAttribute("y1", ey);
    fore.setAttribute("x2", px);      fore.setAttribute("y2", py);
    elbow.setAttribute("cx", ex);     elbow.setAttribute("cy", ey);
    pen.setAttribute("cx", px);       pen.setAttribute("cy", py);
    inkPath.style.strokeDashoffset = inkLen * (1 - t);
  }

  /* ======================================================================
     RIGHT — the watchtower: a radar sweep, a shield, controls under watch
     ====================================================================== */
  const R = { x: 280, y: 240 };
  [70, 128, 186].forEach((r, i) =>
    el("circle", { cx: R.x, cy: R.y, r, pathLength: 1, "stroke-dasharray": i === 2 ? "2 6" : "none" }, "d-fine", engineerSvg)
  );
  el("line", { x1: R.x - 196, y1: R.y, x2: R.x + 196, y2: R.y, pathLength: 1 }, "d-fine", engineerSvg);
  el("line", { x1: R.x, y1: R.y - 196, x2: R.x, y2: R.y + 196, pathLength: 1 }, "d-fine", engineerSvg);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    el("line", {
      x1: R.x + Math.cos(a) * 178, y1: R.y + Math.sin(a) * 178,
      x2: R.x + Math.cos(a) * 186, y2: R.y + Math.sin(a) * 186,
      pathLength: 1,
    }, "d-fine", engineerSvg);
  }
  // the keep: shield sealed at the heart of the watch
  el("path", {
    d: `M${R.x} ${R.y - 34} L${R.x + 28} ${R.y - 22} L${R.x + 28} ${R.y + 5} C ${R.x + 28} ${R.y + 23} ${R.x + 16} ${R.y + 34} ${R.x} ${R.y + 40} C ${R.x - 16} ${R.y + 34} ${R.x - 28} ${R.y + 23} ${R.x - 28} ${R.y + 5} L${R.x - 28} ${R.y - 22} Z`,
    pathLength: 1,
  }, "d-main", engineerSvg);
  el("path", { d: `M${R.x - 13} ${R.y + 1} L${R.x - 3} ${R.y + 11} L${R.x + 14} ${R.y - 11}`, pathLength: 1 }, "d-main", engineerSvg);

  // controls on the perimeter — each one a promise being kept
  const BLIPS = [
    { a: -1.1, r: 100 }, { a: -0.35, r: 158 }, { a: 0.45, r: 112 }, { a: 1.25, r: 160 },
    { a: 2.1, r: 104 }, { a: 2.9, r: 150 }, { a: -2.4, r: 152 }, { a: -1.8, r: 96 },
  ].map((b) => {
    const x = R.x + Math.cos(b.a) * b.r;
    const y = R.y + Math.sin(b.a) * b.r;
    const dot = el("circle", { cx: x, cy: y, r: 4, pathLength: 1 }, "d-main", engineerSvg);
    const halo = el("circle", { cx: x, cy: y, r: 4, opacity: 0 }, "d-fine", engineerSvg);
    return { ...b, dot, halo, glow: 0 };
  });

  // the sweep: one bright arm, two fading echoes behind it
  const sweep = el("g", {}, "", engineerSvg);
  el("line", { x1: 0, y1: 0, x2: 186, y2: 0, pathLength: 1 }, "d-main", sweep);
  el("line", { x1: 0, y1: 0, x2: 186, y2: 0, transform: "rotate(-7)", opacity: 0.4, pathLength: 1 }, "d-fine", sweep);
  el("line", { x1: 0, y1: 0, x2: 186, y2: 0, transform: "rotate(-14)", opacity: 0.18, pathLength: 1 }, "d-fine", sweep);
  el("circle", { cx: R.x, cy: R.y, r: 7, pathLength: 1 }, "d-main", engineerSvg);

  const TAU = Math.PI * 2;
  function poseRadar(angle) {
    sweep.setAttribute("transform", `translate(${R.x} ${R.y}) rotate(${deg(angle)})`);
    BLIPS.forEach((b) => {
      // light the control as the beam passes; let it cool down slowly
      let diff = (angle - b.a) % TAU;
      if (diff < 0) diff += TAU;
      if (diff < 0.1) b.glow = 1;
      else b.glow = Math.max(0, b.glow - 0.008);
      b.dot.style.opacity = 0.45 + b.glow * 0.55;
      b.halo.setAttribute("r", 4 + b.glow * 14);
      b.halo.style.opacity = b.glow * 0.5;
    });
  }

  /* ======================================================================
     Motion — one loop for both machines, paused off-screen
     ====================================================================== */
  const DRAW_S = 9;   // seconds for one heart
  const HOLD_S = 1.6; // admire the work
  const FADE_S = 0.9; // then a fresh page
  const CYCLE = DRAW_S + HOLD_S + FADE_S;

  poseArm(reduced ? 1 : 0);
  poseRadar(-0.9);

  if (reduced) return; // both machines rest as finished engravings

  if (window.gsap && window.ScrollTrigger) {
    // the machines' skeletons draw in once, like every diagram on this site
    // (elements with their own dash pattern keep it — the draw trick would erase it)
    const skeleton = [...artistSvg.querySelectorAll("[pathLength]"), ...engineerSvg.querySelectorAll("[pathLength]")]
      .filter((n) => !n.hasAttribute("stroke-dasharray"));
    gsap.set(skeleton, { strokeDasharray: 1, strokeDashoffset: 1 });
    gsap.to(skeleton, {
      strokeDashoffset: 0,
      duration: 1.4,
      ease: "power2.out",
      stagger: 0.015,
      scrollTrigger: { trigger: ".duet", start: "top 75%", toggleActions: "play none none none" },
    });
  }

  let running = true;
  let elapsed = 0;
  let last = performance.now();

  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (running) {
      elapsed += dt;
      const c = elapsed % CYCLE;
      if (c < DRAW_S) {
        const t = c / DRAW_S;
        poseArm(t * t * (3 - 2 * t)); // smoothstep: the hand eases into and out of the stroke
        inkPath.style.opacity = 1;
      } else if (c < DRAW_S + HOLD_S) {
        poseArm(1);
      } else {
        poseArm(1);
        inkPath.style.opacity = 1 - (c - DRAW_S - HOLD_S) / FADE_S; // the page turns
      }
      poseRadar(-0.9 + elapsed * 0.7); // one patrol every ~9s
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  if (window.IntersectionObserver) {
    new IntersectionObserver((e) => (running = e[0].isIntersecting), { threshold: 0 })
      .observe(artistSvg);
  }
})();
