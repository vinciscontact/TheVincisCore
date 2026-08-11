/* ==========================================================================
   Flappy BUJJI — the hidden arcade.
   Found by: 5 quick clicks on the nav logo, or 3 clicks on the tour narrator.
   Gold blueprint pillars on cream; BUJJI's real face flies the gaps.
   ========================================================================== */

(() => {
  "use strict";

  const css = getComputedStyle(document.documentElement);
  const C = {
    bg: "#f9f9f9",
    gold: (css.getPropertyValue("--gold") || "#c5a028").trim(),
    goldFine: (css.getPropertyValue("--gold-fine") || "#d4af37").trim(),
    goldDeep: (css.getPropertyValue("--gold-deep") || "#745b00").trim(),
    ink: (css.getPropertyValue("--ink") || "#1a1a1a").trim(),
    line: (css.getPropertyValue("--line") || "#e5e5e5").trim(),
  };
  const BEST_KEY = "bujji-flap-best";
  const OFFER_KEY = "bujji-flap-offer";
  const OFFER_AT = 10; // gates to clear for the reward
  const offerUnlocked = () => localStorage.getItem(OFFER_KEY) === "1";

  const face = new Image();
  face.src = "images/bujji-face.jpg";

  /* ---------- overlay DOM (created once, on first launch) ---------- */
  let overlay = null, canvas = null, ctx = null, card = null, hint = null;

  function buildOverlay() {
    overlay = document.createElement("div");
    overlay.className = "flap";
    overlay.innerHTML =
      '<div class="flap__frame">' +
      '  <canvas class="flap__canvas"></canvas>' +
      '  <p class="flap__hint">Tap · click · space — keep BUJJI flying</p>' +
      '  <div class="flap__card" hidden>' +
      '    <p class="label">Flight report</p>' +
      '    <h3 class="flap__headline"></h3>' +
      '    <p class="flap__quip"></p>' +
      '    <div class="flap__offer" hidden>' +
      '      <span>Reward unlocked</span>' +
      "      <b>BUJJI10</b>" +
      "      <p>10% off your first project — mention this code when you book.</p>" +
      "    </div>" +
      '    <div class="flap__ctas">' +
      '      <button type="button" class="btn btn--gold" data-flap-retry>Fly again</button>' +
      '      <a class="btn btn--ghost" href="#contact" data-flap-cta>Book a Consultation</a>' +
      "    </div>" +
      "  </div>" +
      '  <button type="button" class="flap__close" aria-label="Close the game">×</button>' +
      "</div>";
    document.body.appendChild(overlay);
    canvas = overlay.querySelector(".flap__canvas");
    ctx = canvas.getContext("2d");
    card = overlay.querySelector(".flap__card");
    hint = overlay.querySelector(".flap__hint");

    overlay.querySelector(".flap__close").addEventListener("click", closeGame);
    overlay.querySelector("[data-flap-retry]").addEventListener("click", (e) => {
      e.stopPropagation();
      startRound();
    });
    overlay.querySelector("[data-flap-cta]").addEventListener("click", closeGame);
    overlay.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".flap__card, .flap__close")) return;
      flap();
    });
  }

  /* ---------- game state ---------- */
  const G = {
    open: false,
    running: false,
    raf: 0,
    last: 0,
    w: 0,
    h: 0,
    dpr: 1,
    bird: { x: 0, y: 0, vy: 0, r: 26 },
    pipes: [], // {x, gapY, gapH, passed}
    score: 0,
    groundShift: 0,
    idleT: 0,
    flashT: 0, // seconds left on the "reward unlocked" banner
  };
  const GRAVITY = 2400;
  const FLAP_V = -430; // short arcs — the corridor forgives small taps, not leaps
  const PIPE_W = 74;
  const PIPE_SPACING = 320;
  const SPEED = 190;

  function resize() {
    const frame = overlay.querySelector(".flap__frame");
    G.dpr = Math.min(2, window.devicePixelRatio || 1);
    G.w = frame.clientWidth;
    G.h = frame.clientHeight;
    canvas.width = G.w * G.dpr;
    canvas.height = G.h * G.dpr;
    canvas.style.width = G.w + "px";
    canvas.style.height = G.h + "px";
    ctx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
  }

  function startRound() {
    card.hidden = true;
    hint.hidden = false;
    G.bird.x = Math.max(90, G.w * 0.28);
    G.bird.y = G.h * 0.45;
    G.bird.vy = 0;
    G.pipes = [];
    G.score = 0;
    G.running = false; // waits for the first flap
    G.idleT = 0;
    G.flashT = 0;
  }

  function firstPipeX() {
    return G.w + 80;
  }

  function spawnPipe(x) {
    const gapH = Math.max(170, G.h * 0.3);
    const margin = 70;
    const gapY = margin + Math.random() * (G.h - gapH - margin * 2 - 40);
    G.pipes.push({ x, gapY, gapH, passed: false });
  }

  function flap() {
    if (!G.open || !card.hidden) return;
    if (!G.running) {
      G.running = true;
      hint.hidden = true;
      spawnPipe(firstPipeX());
    }
    G.bird.vy = FLAP_V;
  }

  function gameOver() {
    G.running = false;
    const best = Math.max(G.score, +(localStorage.getItem(BEST_KEY) || 0));
    localStorage.setItem(BEST_KEY, String(best));
    if (G.score >= OFFER_AT) localStorage.setItem(OFFER_KEY, "1");
    overlay.querySelector(".flap__headline").textContent =
      G.score >= OFFER_AT
        ? G.score + " gates — reward earned."
        : G.score === 0
        ? "Grounded on take-off."
        : "You cleared " + G.score + (G.score === 1 ? " gate." : " gates.");
    overlay.querySelector(".flap__quip").textContent =
      (G.score >= 15
        ? "BUJJI is impressed — and BUJJI is a robot."
        : G.score >= OFFER_AT
        ? "Cleared with style. The code below is yours."
        : G.score >= 5
        ? "Respectable flying. " + (OFFER_AT - G.score) + " more and the reward is yours."
        : "Deadlines are dodged with practice. So are pillars.") +
      " Best: " + best + ".";
    overlay.querySelector(".flap__offer").hidden = !offerUnlocked();
    updateStripLine();
    card.hidden = false;
  }

  /* ---------- drawing ---------- */
  function drawPillar(x, y, w, h, capAtBottom) {
    ctx.strokeStyle = C.goldFine;
    ctx.fillStyle = "rgba(212, 175, 55, 0.06)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.fill();
    ctx.stroke();
    // fine hatch: the draughtsman's shading
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.strokeStyle = "rgba(212, 175, 55, 0.28)";
    ctx.lineWidth = 1;
    for (let i = -h; i < w; i += 14) {
      ctx.beginPath();
      ctx.moveTo(x + i, y + h);
      ctx.lineTo(x + i + h, y);
      ctx.stroke();
    }
    ctx.restore();
    // cap plate at the gap edge
    const capY = capAtBottom ? y : y + h - 12;
    ctx.fillStyle = C.bg;
    ctx.strokeStyle = C.gold;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(x - 6, capY, w + 12, 12);
    ctx.fill();
    ctx.stroke();
  }

  function drawBird(t) {
    const b = G.bird;
    const bob = G.running ? 0 : Math.sin(t / 320) * 7;
    const y = b.y + bob;
    const tilt = G.running ? Math.max(-0.45, Math.min(0.7, b.vy / 900)) : 0;
    ctx.save();
    ctx.translate(b.x, y);
    ctx.rotate(tilt);
    // thrust
    ctx.strokeStyle = C.goldFine;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    const flame = 10 + Math.random() * 8;
    ctx.beginPath();
    ctx.moveTo(-b.r - 2, 6);
    ctx.lineTo(-b.r - 2 - flame, 6);
    ctx.stroke();
    // face in a gold ring
    ctx.beginPath();
    ctx.arc(0, 0, b.r, 0, Math.PI * 2);
    ctx.save();
    ctx.clip();
    if (face.complete && face.naturalWidth) {
      ctx.drawImage(face, -b.r, -b.r, b.r * 2, b.r * 2);
    } else {
      ctx.fillStyle = "#fff";
      ctx.fillRect(-b.r, -b.r, b.r * 2, b.r * 2);
    }
    ctx.restore();
    ctx.strokeStyle = C.gold;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }

  function draw(t) {
    ctx.clearRect(0, 0, G.w, G.h);
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, G.w, G.h);

    // drafting grid
    ctx.strokeStyle = "rgba(26, 26, 26, 0.035)";
    ctx.lineWidth = 1;
    for (let gx = 0; gx < G.w; gx += 48) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, G.h); ctx.stroke();
    }
    for (let gy = 0; gy < G.h; gy += 48) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(G.w, gy); ctx.stroke();
    }

    // pillars
    G.pipes.forEach((p) => {
      drawPillar(p.x, 0, PIPE_W, p.gapY, false);
      drawPillar(p.x, p.gapY + p.gapH, PIPE_W, G.h - 30 - (p.gapY + p.gapH), true);
    });

    // the dotted flight floor
    ctx.strokeStyle = "rgba(197, 160, 40, 0.5)";
    ctx.lineWidth = 2;
    ctx.setLineDash([2, 8]);
    ctx.lineDashOffset = -G.groundShift;
    ctx.beginPath();
    ctx.moveTo(0, G.h - 30);
    ctx.lineTo(G.w, G.h - 30);
    ctx.stroke();
    ctx.setLineDash([]);

    drawBird(t);

    // score
    ctx.fillStyle = C.ink;
    ctx.font = "600 44px Fraunces, Georgia, serif";
    ctx.textAlign = "center";
    ctx.fillText(String(G.score), G.w / 2, 64);

    // the reward moment
    if (G.flashT > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, G.flashT / 0.4);
      ctx.fillStyle = C.goldDeep;
      ctx.font = "600 13px system-ui, sans-serif";
      ctx.fillText("R E W A R D   U N L O C K E D", G.w / 2, G.h * 0.3);
      ctx.font = "600 34px Fraunces, Georgia, serif";
      ctx.fillStyle = C.gold;
      ctx.fillText("BUJJI10 — 10% off", G.w / 2, G.h * 0.3 + 38);
      ctx.restore();
    }
  }

  function step(t) {
    if (!G.open) return;
    const dt = Math.min(0.033, (t - G.last) / 1000 || 0.016);
    G.last = t;

    if (G.flashT > 0) G.flashT -= dt;
    if (G.running) {
      const b = G.bird;
      b.vy += GRAVITY * dt;
      b.y += b.vy * dt;
      G.groundShift += SPEED * dt;

      G.pipes.forEach((p) => (p.x -= SPEED * dt));
      if (G.pipes.length && G.pipes[0].x + PIPE_W < -20) G.pipes.shift();
      if (!G.pipes.length || G.pipes[G.pipes.length - 1].x < G.w - PIPE_SPACING) {
        spawnPipe(G.pipes.length ? G.pipes[G.pipes.length - 1].x + PIPE_SPACING : firstPipeX());
      }

      // scoring + collision
      for (const p of G.pipes) {
        if (!p.passed && p.x + PIPE_W < b.x - b.r) {
          p.passed = true;
          G.score += 1;
          if (G.score === OFFER_AT) G.flashT = 2.6; // the reward moment
        }
        const hr = b.r - 6; // hitbox smaller than the face — grazes feel fair
        const inX = b.x + hr > p.x && b.x - hr < p.x + PIPE_W;
        const inGap = b.y - hr > p.gapY && b.y + hr < p.gapY + p.gapH;
        if (inX && !inGap) { gameOver(); break; }
      }
      if (b.y - b.r < 0) { b.y = b.r; b.vy = 0; } // ceiling clamps, only the floor kills
      if (b.y + b.r > G.h - 30) gameOver();
    }

    draw(t);
    G.raf = requestAnimationFrame(step);
  }

  /* ---------- open / close ---------- */
  function openGame() {
    if (!overlay) buildOverlay();
    if (G.open) return;
    G.open = true;
    overlay.classList.add("is-open");
    document.documentElement.style.overflow = "hidden";
    resize();
    startRound();
    G.last = 0;
    G.raf = requestAnimationFrame(step);
  }

  function closeGame() {
    G.open = false;
    G.running = false;
    cancelAnimationFrame(G.raf);
    overlay.classList.remove("is-open");
    document.documentElement.style.overflow = "";
  }

  window.addEventListener("resize", () => { if (G.open) resize(); });
  window.addEventListener("keydown", (e) => {
    if (!G.open) return;
    if (e.code === "Escape") closeGame();
    if (e.code === "Space" || e.code === "ArrowUp") { e.preventDefault(); flap(); }
  });

  /* ---------- the secret knocks ---------- */
  function secretKnock(el, clicksNeeded, windowMs) {
    if (!el) return;
    let count = 0, timer = 0;
    el.addEventListener("click", () => {
      count += 1;
      clearTimeout(timer);
      if (count >= clicksNeeded) { count = 0; openGame(); return; }
      timer = setTimeout(() => (count = 0), windowMs);
    });
  }

  /* ---------- the open door: the arcade strip ---------- */
  function updateStripLine() {
    const line = document.querySelector("[data-game-offer-line]");
    if (line && offerUnlocked()) {
      line.innerHTML = "Code <em>BUJJI10</em> is yours — 10% off your first project. Fly for glory anyway.";
    }
  }

  const playBtn = document.getElementById("playBujji");
  if (playBtn) playBtn.addEventListener("click", openGame);
  updateStripLine();

  /* the secret knocks stay for the curious */
  secretKnock(document.querySelector(".nav__logo"), 5, 1800);
  secretKnock(document.querySelector(".tour-guide"), 3, 1500);

  if (location.search.indexOf("flapdebug") !== -1) window.__flapState = G; // test hook, inert in normal use
})();
