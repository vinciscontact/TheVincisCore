/* ==========================================================================
   TheVincis — Hero helix
   The source film is served as a still sequence and scrubbed by scroll, so the
   helix turns exactly as fast as the visitor moves. Two sets are shipped: a
   1600px sequence for desktop, a 750px one for phones — the phone never pays
   for pixels it cannot show.

   Regenerating the frames from "Hero section/hero sec 2.mp4" (200 @ 24fps,
   1280x720). The counts below must match the file counts these produce.

   The overlay is not optional: the source carries a static inpainted patch at
   x1135-1185 y575-622 that sits ~15 luma levels below its surroundings on every
   frame. Behind a moving helix it reads as a fixed dark rectangle, so a
   feathered swatch of the local background colour is composited over it first.
   Drop the overlay only if the source is ever re-exported clean.

     ffmpeg -i "Hero section/hero sec 2.mp4" -loop 1 -i "Hero section/watermark-patch.png" \
       -filter_complex "[0:v][1:v]overlay=1100:539:shortest=1,select='not(mod(n,2))',scale=1280:-2[out]" \
       -map "[out]" -fps_mode passthrough \
       -c:v libwebp -quality 72 -compression_level 6 images/hero-seq/desktop/%04d.webp

     ffmpeg -i "Hero section/hero sec 2.mp4" -loop 1 -i "Hero section/watermark-patch.png" \
       -filter_complex "[0:v][1:v]overlay=1100:539:shortest=1,select='not(mod(n,3))',scale=750:-2[out]" \
       -map "[out]" -fps_mode passthrough \
       -c:v libwebp -quality 66 -compression_level 6 images/hero-seq/mobile/%04d.webp
   ========================================================================== */

(() => {
  const hero = document.querySelector(".hero");
  const canvas = hero && hero.querySelector(".hero__frames");
  if (!hero || !canvas) return;
  if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") return;

  // The film's own background, sampled from its frame edges — every frame of the
  // source measures exactly this, so the letterbox is seamless at any aspect.
  const FILM_BG = "#0d0d0d";

  // anchorY: 0.5 centres the frame, lower values ride it higher in the canvas
  const SETS = {
    desktop: { dir: "images/hero-seq/desktop/", count: 100, zoom: 1, anchorY: 0.5 },
    // the phone crops nothing — zoom 1 fits the helix to the full width, tips
    // intact, and the high anchor parks it above the copy instead of behind it
    mobile: { dir: "images/hero-seq/mobile/", count: 67, zoom: 1, anchorY: 0.06 },
  };

  const mqMobile = matchMedia("(max-width: 900px)");
  const mqReduced = matchMedia("(prefers-reduced-motion: reduce)");

  const ctx = canvas.getContext("2d", { alpha: false });
  const nav = document.querySelector(".nav");
  const content = hero.querySelector(".hero__content");
  const hint = hero.querySelector(".hero__scrollhint");

  let set = null;
  let setKey = null;
  let frames = [];
  let trigger = null;
  let wanted = 0;
  let painted = -1; // -1 means "whatever is on screen is a stand-in, repaint when the real frame lands"
  let token = 0; // invalidates in-flight loads when the breakpoint changes

  const frameSrc = (s, i) => s.dir + String(i + 1).padStart(4, "0") + ".webp";

  /* ---------- painting ---------- */

  function layout() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width * dpr));
    const h = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width === w && canvas.height === h) return;
    canvas.width = w;
    canvas.height = h;
    painted = -1;
  }

  function paint(img) {
    const cw = canvas.width;
    const ch = canvas.height;
    ctx.fillStyle = FILM_BG;
    ctx.fillRect(0, 0, cw, ch);
    // contain, never cover — the helix reads as one composition and the film's
    // own black makes the letterbox invisible at any aspect ratio
    const s = Math.min(cw / img.naturalWidth, ch / img.naturalHeight) * set.zoom;
    const w = img.naturalWidth * s;
    const h = img.naturalHeight * s;
    ctx.drawImage(img, (cw - w) / 2, (ch - h) * set.anchorY, w, h);
  }

  function nearest(i) {
    for (let d = 0; d < frames.length; d++) {
      const before = frames[i - d];
      const after = frames[i + d];
      if (before && before.img) return before.img;
      if (after && after.img) return after.img;
    }
    return null;
  }

  function flush() {
    const exact = frames[wanted];
    if (exact && exact.img) {
      if (painted !== wanted) {
        paint(exact.img);
        painted = wanted;
      }
      return;
    }
    const stand = nearest(wanted);
    if (stand) {
      paint(stand);
      painted = -1;
    }
  }

  function show(progress) {
    wanted = Math.round(gsap.utils.clamp(0, 1, progress) * (set.count - 1));
    flush();
  }

  /* ---------- loading ---------- */

  function loadSet() {
    const mine = ++token;
    frames = Array.from({ length: set.count }, () => ({ img: null }));
    painted = -1;

    // Reduced motion never scrubs, so it never needs the sequence — one frame
    // is the whole hero, and nobody pays for 124 stills they will not see.
    const only = mqReduced.matches ? [Math.round((set.count - 1) * 0.42)] : null;
    const total = only ? only.length : set.count;

    let next = 0;
    const step = () => {
      if (mine !== token || next >= total) return;
      const i = only ? only[next++] : next++;
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        if (mine !== token) return;
        frames[i].img = img;
        if (painted !== wanted) flush();
        step();
      };
      img.onerror = () => {
        if (mine === token) step();
      };
      img.src = frameSrc(set, i);
    };
    // in order, six at a time: frame one lands first, the rest fill in behind it
    for (let k = 0; k < Math.min(6, total); k++) step();
  }

  function chooseSet() {
    const key = mqMobile.matches ? "mobile" : "desktop";
    if (key === setKey) return false;
    setKey = key;
    set = SETS[key];
    return true;
  }

  /* ---------- scroll ---------- */

  const syncNav = (on) => nav && nav.classList.toggle("nav--over-hero", !!on);

  function build() {
    if (trigger) {
      trigger.kill(true);
      trigger = null;
    }
    gsap.set([content, hint].filter(Boolean), { clearProps: "opacity,transform" });

    if (mqReduced.matches) {
      // no pin, no scrub — one still frame and the hero behaves like any other section
      layout();
      show(0.42);
      syncNav(true);
      return;
    }

    trigger = ScrollTrigger.create({
      trigger: hero,
      start: "top top",
      end: () => "+=" + Math.round(innerHeight * (mqMobile.matches ? 1.6 : 2)),
      pin: true,
      pinSpacing: true,
      anticipatePin: 1,
      scrub: true,
      invalidateOnRefresh: true,
      refreshPriority: 1, // first section on the page, so it measures first
      onRefresh: (self) => {
        layout();
        flush();
        syncNav(self.isActive);
      },
      onToggle: (self) => syncNav(self.isActive),
      onUpdate: (self) => {
        const p = self.progress;
        show(p);
        // the copy holds while the helix turns, then clears so it finishes alone
        const out = gsap.utils.clamp(0, 1, (p - 0.68) / 0.24);
        if (content) gsap.set(content, { opacity: 1 - out, y: -48 * out });
        // the scroll prompt has done its job the moment you scroll
        if (hint) gsap.set(hint, { opacity: gsap.utils.clamp(0, 1, 1 - p / 0.12) });
      },
    });

    layout();
    flush();
    syncNav(trigger.isActive);
  }

  /* ---------- boot ---------- */

  chooseSet();
  loadSet();
  build();

  let resizeTimer = 0;
  let lastW = innerWidth;
  let lastH = innerHeight;
  addEventListener("resize", () => {
    const dw = Math.abs(innerWidth - lastW);
    const dh = Math.abs(innerHeight - lastH);
    // a phone's collapsing URL bar is not a resize — rebuilding on it causes a visible jump
    if (dw === 0 && dh < 120 && mqMobile.matches) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      lastW = innerWidth;
      lastH = innerHeight;
      if (chooseSet()) loadSet();
      layout();
      flush();
      ScrollTrigger.refresh();
    }, 150);
  });

  // switching the OS preference mid-visit changes how much of the sequence we need
  mqReduced.addEventListener("change", () => {
    loadSet();
    build();
  });
})();
