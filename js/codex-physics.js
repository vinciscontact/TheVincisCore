/* ==========================================================================
   TheVincis — Codex physics
   The notebook is alive: ink drips from the pen as the scroll draws it,
   a plumb bob swings from the spine as a real pendulum (drag it), and a
   wax "V" seal stamps the alliance once both pages are inked.
   No engine — one pendulum ODE + a particle pool. Steps only on screen.
   ========================================================================== */
(() => {
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const svg = document.querySelector(".codex svg");
  if (prefersReduced || !svg || !window.gsap || !window.ScrollTrigger) return;
  // reduced motion / missing pieces → codex stays a finished static drawing

  const clamp = gsap.utils.clamp;

  /* --- run switch: physics steps only while the codex is on screen --- */
  let active = false;
  ScrollTrigger.create({
    trigger: ".codex",
    start: "top bottom",
    end: "bottom top",
    onToggle: (self) => (active = self.isActive),
  });

  /* ============ Living ink: droplets fall from the moving pen ============ */
  const NS = "http://www.w3.org/2000/svg";
  const inkLayer = document.createElementNS(NS, "g");
  inkLayer.setAttribute("class", "codex__ink");
  inkLayer.setAttribute("aria-hidden", "true");
  svg.appendChild(inkLayer);

  const drops = Array.from({ length: 26 }, () => {
    const el = document.createElementNS(NS, "circle");
    el.setAttribute("r", "0");
    inkLayer.appendChild(el);
    return { el, live: false, x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 1, r: 1 };
  });
  function spawn(x, y, vx, vy) {
    const d = drops.find((d) => !d.live);
    if (!d) return;
    Object.assign(d, { live: true, x, y, vx, vy, age: 0, life: 0.55 + Math.random() * 0.4, r: 1.2 + Math.random() * 1.4 });
  }

  // the pens: flourish (artist) + fort & moat (engineer). Ink follows their tips.
  const pens = [...svg.querySelectorAll(".cdx-main-l, .cdx-main-r")].map((el) => ({
    el,
    len: el.getTotalLength(),
    last: 0,
    cool: 0,
  }));
  const quillTip = pens[0] ? pens[0].el.getPointAtLength(0) : { x: 196, y: 392 }; // the nib rests here
  let quillTimer = 3;

  /* ============ The plumb line: a real pendulum off the spine ============ */
  const arm = svg.querySelector(".codex__plumb-arm");
  const hit = svg.querySelector(".codex__plumb-hit");
  const PX = 600, PY = 64; // pivot in SVG units
  const G_L = 4.4;   // g/L → slow, stately ~3s period
  const DAMP = 0.35; // light damping — swings linger
  let theta = 0, omega = 0;
  let dragging = false, dragPrev = 0, dragPrevT = 0, dragVel = 0;
  let nudgeTimer = 2; // idle heartbeat so it never quite sleeps

  const toSvg = (e) => new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
  const pointerTheta = (e) => {
    const p = toSvg(e);
    return clamp(-1.25, 1.25, Math.atan2(p.x - PX, p.y - PY)); // angle from vertical, y-down
  };

  hit.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    try { hit.setPointerCapture(e.pointerId); } catch (_) { /* keep dragging anyway */ }
    dragging = true;
    dragPrev = theta = pointerTheta(e);
    dragPrevT = performance.now();
    dragVel = omega = 0;
  });
  hit.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const now = performance.now();
    const t = pointerTheta(e);
    const dt = Math.max(now - dragPrevT, 1) / 1000;
    dragVel = clamp(-6, 6, (t - dragPrev) / dt);
    theta = t;
    dragPrev = t;
    dragPrevT = now;
  });
  const release = () => {
    if (!dragging) return;
    dragging = false;
    omega = dragVel; // the toss inherits your hand's speed
  };
  hit.addEventListener("pointerup", release);
  hit.addEventListener("pointercancel", release);

  /* ============ The wax seal: stamped the moment both pages finish inking
     (main.js dispatches "codex:drawn" when the drawing timeline completes) ============ */
  const seal = svg.querySelector(".codex__seal");
  gsap.set(seal, { svgOrigin: "600 458", autoAlpha: 0, scale: 1.6 });
  document.addEventListener("codex:drawn", () => {
    gsap.fromTo(seal,
      { scale: 2.1, autoAlpha: 0, rotation: -8 },
      {
        scale: 1, autoAlpha: 1, rotation: 0, duration: 0.55, ease: "back.out(2.5)", overwrite: true,
        onComplete: () => { // impact: wax spatters
          for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2;
            spawn(600 + Math.cos(a) * 22, 458 + Math.sin(a) * 20, Math.cos(a) * 70, Math.sin(a) * 55 - 30);
          }
          omega += 0.22; // the thud sways the plumb — everything is one object
        },
      });
  }, { once: true });

  /* ============ Integrate ============ */
  let lastScroll = window.scrollY;
  gsap.ticker.add((_t, dtMs) => {
    if (!active) { lastScroll = window.scrollY; return; }
    const dt = Math.min(dtMs / 1000, 0.05); // clamp catch-up after tab switches

    /* pendulum: θ'' = -(g/L)·sinθ − c·θ', kicked by scroll inertia */
    const sv = window.scrollY - lastScroll;
    lastScroll = window.scrollY;
    if (!dragging) {
      omega += (-G_L * Math.sin(theta) - DAMP * omega) * dt + clamp(-0.9, 0.9, sv * 0.004);
      theta += omega * dt;
      // idle heartbeat: a faint push now and then so the bob never fully sleeps
      if (Math.abs(theta) < 0.02 && Math.abs(omega) < 0.03) {
        nudgeTimer -= dt;
        if (nudgeTimer <= 0) {
          omega += (Math.random() < 0.5 ? -1 : 1) * (0.06 + Math.random() * 0.06);
          nudgeTimer = 3 + Math.random() * 4;
        }
      }
    }
    arm.setAttribute("transform", `rotate(${(theta * 180 / Math.PI).toFixed(3)} ${PX} ${PY})`);

    /* pens: while a stroke is being drawn by the scrub, its tip sheds ink */
    for (const pen of pens) {
      pen.cool -= dt;
      const off = parseFloat(getComputedStyle(pen.el).strokeDashoffset) || 0;
      const p = clamp(0, 1, 1 - off);
      if (p > 0.01 && p < 0.995 && Math.abs(p - pen.last) > 0.001 && pen.cool <= 0) {
        const pt = pen.el.getPointAtLength(p * pen.len);
        spawn(pt.x, pt.y, (Math.random() - 0.5) * 26, 8 + Math.random() * 22);
        pen.cool = 0.05;
      }
      pen.last = p;
    }

    /* the resting quill keeps dripping — the page is never quite dry */
    if (pens[0] && pens[0].last >= 0.995) {
      quillTimer -= dt;
      if (quillTimer <= 0) {
        spawn(quillTip.x + (Math.random() - 0.5) * 4, quillTip.y + 2, (Math.random() - 0.5) * 8, 4);
        quillTimer = 2.5 + Math.random() * 3.5;
      }
    }

    /* droplets: gravity, fade, recycle */
    for (const d of drops) {
      if (!d.live) continue;
      d.age += dt;
      d.vy += 620 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      const k = 1 - d.age / d.life;
      if (k <= 0 || d.y > 508) {
        d.live = false;
        d.el.setAttribute("r", "0");
        continue;
      }
      d.el.setAttribute("cx", d.x.toFixed(1));
      d.el.setAttribute("cy", d.y.toFixed(1));
      d.el.setAttribute("r", (d.r * (0.6 + 0.4 * k)).toFixed(2));
      d.el.setAttribute("opacity", (0.85 * k).toFixed(3));
    }
  });
})();
