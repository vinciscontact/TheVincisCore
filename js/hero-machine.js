/* ==========================================================================
   TheVincis — Hero machine
   A da Vinci gear train in fine gold lines: three meshing gears and a
   crank-driven piston, turning slowly. "Not show-off websites — working
   systems." The hero visual is a system that works.
   Replaces the old Three.js particle field (no dependency, ~0 cost).
   ========================================================================== */
(() => {
  "use strict";

  const host = document.querySelector(".hero__ornament");
  if (!host) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const NS = "http://www.w3.org/2000/svg";
  const deg = (r) => (r * 180) / Math.PI;

  /* ---- Gear train definition (module m shared so teeth mesh) ---- */
  const M = 9; // gear module: pitch radius = M * teeth / 2
  const A = { t: 28, x: 360, y: 470 }; // driver
  const B = { t: 16 };                 // idler
  const C = { t: 10 };                 // fast pinion
  A.r = (M * A.t) / 2;
  B.r = (M * B.t) / 2;
  C.r = (M * C.t) / 2;

  const aAB = -0.9076; // ≈ -52°: B sits up-right of A
  B.x = A.x + (A.r + B.r) * Math.cos(aAB);
  B.y = A.y + (A.r + B.r) * Math.sin(aAB);
  const aBC = -0.1745; // ≈ -10°: C trails off to the right
  C.x = B.x + (B.r + C.r) * Math.cos(aBC);
  C.y = B.y + (B.r + C.r) * Math.sin(aBC);

  /* ---- Crank & piston (on the driver gear) ----
     Stroke = 2×CRANK_R must fit inside the rails, or rod and piston part ways. */
  const CRANK_R = 55;   // crank pin radius on gear A
  const ROD_L = 250;    // connecting rod length
  const GUIDE_X = A.x;  // piston slides on a vertical line through A

  /* ---- SVG scaffolding ---- */
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 800 800");
  svg.setAttribute("fill", "none");

  function el(name, attrs, cls, parent) {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (cls) n.setAttribute("class", cls);
    (parent || svg).appendChild(n);
    return n;
  }

  /* Gear silhouette: trapezoid teeth around the pitch circle.
     Tooth center sits at 0.25×pitch in local coords — meshing math relies on it. */
  function gearPath(g) {
    const ra = g.r + M * 0.8;  // tip radius
    const rf = g.r - M * 0.9;  // root radius
    const p = (Math.PI * 2) / g.t;
    const pts = [];
    for (let i = 0; i < g.t; i++) {
      const a = i * p;
      pts.push([rf, a], [ra, a + p * 0.16], [ra, a + p * 0.34], [rf, a + p * 0.5]);
    }
    return (
      pts
        .map(([r, a], i) => (i ? "L" : "M") + (r * Math.cos(a)).toFixed(1) + " " + (r * Math.sin(a)).toFixed(1))
        .join(" ") + " Z"
    );
  }

  function buildGear(g, spokes) {
    const grp = el("g", {}, "machine__gear");
    el("path", { d: gearPath(g), pathLength: 1 }, "d-main", grp);
    el("circle", { cx: 0, cy: 0, r: g.r, pathLength: 1, "stroke-dasharray": "2 5", "stroke-width": 0.6 }, "d-fine", grp);
    el("circle", { cx: 0, cy: 0, r: Math.max(9, g.r * 0.12), pathLength: 1 }, "d-main", grp);
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * Math.PI * 2;
      el("line", {
        x1: Math.cos(a) * g.r * 0.16, y1: Math.sin(a) * g.r * 0.16,
        x2: Math.cos(a) * (g.r - M * 1.6), y2: Math.sin(a) * (g.r - M * 1.6),
        pathLength: 1,
      }, "d-fine", grp);
    }
    // center cross ticks — the draughtsman marks his centers
    el("line", { x1: -5, y1: 0, x2: 5, y2: 0, pathLength: 1 }, "d-fine", grp);
    el("line", { x1: 0, y1: -5, x2: 0, y2: 5, pathLength: 1 }, "d-fine", grp);
    return grp;
  }

  /* ---- Construction layer: center lines between the gears ---- */
  el("line", { x1: A.x, y1: A.y, x2: B.x, y2: B.y, pathLength: 1, "stroke-dasharray": "1 6" }, "d-fine");
  el("line", { x1: B.x, y1: B.y, x2: C.x, y2: C.y, pathLength: 1, "stroke-dasharray": "1 6" }, "d-fine");

  /* ---- Piston guide: two rails + hatched mount at the top ---- */
  const RAIL_TOP = 118, RAIL_BOT = 296, RAIL_W = 13;
  el("line", { x1: GUIDE_X - RAIL_W, y1: RAIL_TOP, x2: GUIDE_X - RAIL_W, y2: RAIL_BOT, pathLength: 1 }, "d-fine");
  el("line", { x1: GUIDE_X + RAIL_W, y1: RAIL_TOP, x2: GUIDE_X + RAIL_W, y2: RAIL_BOT, pathLength: 1 }, "d-fine");
  el("line", { x1: GUIDE_X - 34, y1: RAIL_TOP, x2: GUIDE_X + 34, y2: RAIL_TOP, pathLength: 1 }, "d-main");
  for (let i = 0; i < 6; i++) {
    const hx = GUIDE_X - 30 + i * 12;
    el("line", { x1: hx, y1: RAIL_TOP, x2: hx + 9, y2: RAIL_TOP - 9, pathLength: 1 }, "d-fine");
  }

  /* ---- Gears ---- */
  const gearA = buildGear(A, 5);
  const gearB = buildGear(B, 4);
  const gearC = buildGear(C, 3);

  /* ---- Linkage: crank pin → rod → piston block ---- */
  const rod = el("line", { pathLength: 1 }, "d-main");
  const pin = el("circle", { r: 5, pathLength: 1 }, "d-main");
  const piston = el("g", {}, "machine__piston");
  el("rect", { x: -RAIL_W + 2.5, y: -17, width: (RAIL_W - 2.5) * 2, height: 34, rx: 3, pathLength: 1 }, "d-main", piston);
  el("circle", { cx: 0, cy: 0, r: 4.5, pathLength: 1 }, "d-fine", piston);
  svg.appendChild(piston);

  host.appendChild(svg);

  /* ---- Pose the mechanism for a given crank angle ----
     Mesh condition for external gears whose tooth centers sit at 0.25×pitch:
     a driver tooth on the center line faces a follower gap on the other side —
     R₂ = -(z₁/z₂)·R₁ + (1 + z₁/z₂)·φ + π − π/z₂, with φ the center-line angle. */
  function pose(rotA) {
    const rotB = -(A.t / B.t) * rotA + (1 + A.t / B.t) * aAB + Math.PI - Math.PI / B.t;
    const rotC = -(B.t / C.t) * rotB + (1 + B.t / C.t) * aBC + Math.PI - Math.PI / C.t;
    gearA.setAttribute("transform", `translate(${A.x} ${A.y}) rotate(${deg(rotA)})`);
    gearB.setAttribute("transform", `translate(${B.x} ${B.y}) rotate(${deg(rotB)})`);
    gearC.setAttribute("transform", `translate(${C.x} ${C.y}) rotate(${deg(rotC)})`);

    const px = A.x + Math.cos(rotA) * CRANK_R;
    const py = A.y + Math.sin(rotA) * CRANK_R;
    const sy = py - Math.sqrt(ROD_L * ROD_L - (px - GUIDE_X) ** 2);
    pin.setAttribute("cx", px);
    pin.setAttribute("cy", py);
    rod.setAttribute("x1", px);
    rod.setAttribute("y1", py);
    rod.setAttribute("x2", GUIDE_X);
    rod.setAttribute("y2", sy);
    piston.setAttribute("transform", `translate(${GUIDE_X} ${sy})`); // rod and piston share one point — always
  }

  let angle = -0.6;
  pose(angle);
  if (reduced) return; // a still engraving for reduced-motion users

  /* ---- Motion: slow and hypnotic; scroll gives the flywheel a nudge ---- */
  const BASE = 0.16; // rad/s on the driver — one turn ≈ 40s
  let boost = 1;

  if (window.gsap && window.ScrollTrigger) {
    ScrollTrigger.create({
      trigger: ".hero",
      start: "top top",
      end: "bottom top",
      onUpdate: (self) => {
        boost = Math.min(6, 1 + Math.abs(self.getVelocity()) / 500);
      },
    });

    // The machine draws itself once, like every other diagram on this site
    // (elements with their own dash pattern keep it — the draw trick would erase it)
    const drawn = [...svg.querySelectorAll("[pathLength]")].filter((n) => !n.hasAttribute("stroke-dasharray"));
    gsap.set(drawn, { strokeDasharray: 1, strokeDashoffset: 1 });
    gsap.to(drawn, {
      strokeDashoffset: 0,
      duration: 1.6,
      ease: "power2.out",
      stagger: 0.02,
      delay: 1.4,
    });
  }

  let last = performance.now();
  let running = true;

  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    boost += (1 - boost) * 0.04; // nudges decay back to the idle rhythm
    angle += BASE * boost * dt;
    if (running) pose(angle);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // Skip the math while the hero is off-screen
  if (window.IntersectionObserver) {
    new IntersectionObserver((e) => (running = e[0].isIntersecting), { threshold: 0 })
      .observe(host);
  }
})();
