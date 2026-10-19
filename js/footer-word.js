/* ==========================================================================
   TheVincis — the footer wordmark
   A giant outlined "TheVincis" across the footer:
   · a gold spotlight follows the pointer and reveals the real logo colours
     ("The" in ink, "Vincis" in gold) on a second, masked layer;
   · letters near the pointer rise and stretch toward it on springs, so a
     sweep across the word rolls through it like a wave and settles back;
   · a click or tap sends a ripple out from that point;
   · left alone, the spotlight drifts slowly across on its own.
   Transforms only (no layout work per frame); the loop runs only while the
   word is on screen and something is still moving. Reduced motion keeps
   the spotlight and drops the springs, ripple and drift.
   ========================================================================== */
(() => {
  "use strict";

  const root = document.querySelector("[data-wordmark]");
  if (!root) return;

  const TEXT = "TheVincis";
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // two identical layers: an outlined base and a coloured, spotlight-masked top
  const layer = (cls) => {
    const el = document.createElement("span");
    el.className = "wordmark__layer " + cls;
    el.setAttribute("aria-hidden", "true");
    [...TEXT].forEach((ch, i) => {
      const s = document.createElement("span");
      s.className = "wordmark__ch" + (i >= 3 ? " is-v" : "");
      s.textContent = ch;
      el.appendChild(s);
    });
    root.appendChild(el);
    return [...el.children];
  };
  const base = layer("wordmark__base");
  const top = layer("wordmark__top");
  const topLayer = top[0].parentElement;   // spotlight + letter positions are measured on this box
  const N = TEXT.length;

  /* ---- Fit the word to the footer's width ---- */
  let centers = [];
  let width = 0;
  const fit = () => {
    root.style.fontSize = "100px";
    const natural = (base[N - 1].getBoundingClientRect().right - base[0].getBoundingClientRect().left) || 1;
    width = root.clientWidth;
    root.style.fontSize = Math.min(360, (width * 0.96 * 100) / natural) + "px";
    const r = topLayer.getBoundingClientRect();
    centers = base.map((el) => {
      const b = el.getBoundingClientRect();
      return b.left + b.width / 2 - r.left;
    });
  };
  fit();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  window.addEventListener("resize", () => { fit(); wake(); });

  /* ---- State ---- */
  const pos = new Float32Array(N);   // current lift, 0..~1.3 (springs overshoot)
  const vel = new Float32Array(N);
  const ripples = [];                // { x, at } pending impulses
  let px = -9999, py = 0, inside = false, visible = false;
  let spotX = 0, spotY = 0, spotR = 0;
  let raf = 0, last = 0, idleT = 0;

  const setSpot = (x, y, r) => {
    spotX += (x - spotX) * 0.18;
    spotY += (y - spotY) * 0.18;
    spotR += (r - spotR) * 0.12;
    root.style.setProperty("--mx", spotX.toFixed(1) + "px");
    root.style.setProperty("--my", spotY.toFixed(1) + "px");
    root.style.setProperty("--r", spotR.toFixed(1) + "px");
  };

  const frame = (now) => {
    raf = 0;
    const dt = Math.min(48, now - (last || now));
    last = now;
    const h = topLayer.clientHeight;
    const reach = Math.max(120, width * 0.17);   // how far the pull is felt

    // spotlight: follow the pointer, or drift on its own when left alone
    if (inside) {
      setSpot(px, py, Math.max(140, width * 0.16));
    } else if (!reduced) {
      idleT += dt / 1000;
      const sx = width * (0.5 + 0.42 * Math.sin(idleT * 0.32));
      setSpot(sx, h * (0.55 + 0.1 * Math.sin(idleT * 0.7)), Math.max(110, width * 0.11));
    } else {
      setSpot(spotX, spotY, 0);
    }

    let moving = inside || (!reduced && visible);
    if (!reduced) {
      // ripples arrive letter by letter, outward from the click
      for (let k = ripples.length - 1; k >= 0; k--) {
        const rp = ripples[k];
        let done = true;
        for (let i = 0; i < N; i++) {
          if (rp.hit[i]) continue;
          if (now >= rp.at + Math.abs(centers[i] - rp.x) * 0.9) { vel[i] += 0.55; rp.hit[i] = 1; }
          else done = false;
        }
        if (done) ripples.splice(k, 1);
      }
      for (let i = 0; i < N; i++) {
        const d = Math.abs(px - centers[i]);
        const target = inside ? Math.pow(Math.max(0, 1 - d / reach), 2) : 0;
        vel[i] += (target - pos[i]) * 0.14;   // spring toward the target
        vel[i] *= 0.8;                        // damping: one soft overshoot
        pos[i] += vel[i];
        if (Math.abs(vel[i]) > 0.0005 || Math.abs(pos[i] - target) > 0.0005) moving = true;
        const lean = inside ? Math.max(-1, Math.min(1, (px - centers[i]) / reach)) * pos[i] * 7 : 0;
        const t = `translateY(${(-pos[i] * 0.16).toFixed(4)}em) scaleY(${(1 + pos[i] * 0.16).toFixed(4)}) rotate(${lean.toFixed(2)}deg)`;
        base[i].style.transform = t;
        top[i].style.transform = t;
      }
      if (ripples.length) moving = true;
    }
    if (visible && moving) raf = requestAnimationFrame(frame);
  };
  const wake = () => { if (!raf && visible) { last = 0; raf = requestAnimationFrame(frame); } };

  /* ---- Input ---- */
  const local = (e) => {
    const r = topLayer.getBoundingClientRect();
    px = e.clientX - r.left;
    py = e.clientY - r.top;
  };
  root.addEventListener("pointermove", (e) => { local(e); inside = true; wake(); });
  root.addEventListener("pointerenter", (e) => {
    local(e);
    if (!inside) { spotX = px; spotY = py; }
    inside = true;
    wake();
  });
  root.addEventListener("pointerleave", () => { inside = false; px = -9999; wake(); });
  root.addEventListener("pointerdown", (e) => {
    local(e);
    if (!reduced) ripples.push({ x: px, at: performance.now(), hit: new Uint8Array(N) });
    wake();
  });

  /* ---- Run only while on screen ---- */
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) { fit(); wake(); }
    }).observe(root);
  } else {
    visible = true;
    wake();
  }
})();
