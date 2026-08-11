/* ==========================================================================
   TheVincis — Motion system
   GSAP 3 + ScrollTrigger + SplitText + Lenis
   ========================================================================== */

gsap.registerPlugin(ScrollTrigger, SplitText);
gsap.defaults({ ease: "power3.out", duration: 0.8 });

const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ============ Smooth scroll (Lenis) ============ */
let lenis = null;
if (!prefersReduced) {
  lenis = new Lenis({ lerp: 0.1 });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

/* ============ Anchor navigation ============ */
function scrollToTarget(hash) {
  const target = document.querySelector(hash);
  if (!target) return;
  if (lenis) lenis.scrollTo(target, { offset: -72, duration: 1.2 });
  else target.scrollIntoView({ behavior: "auto" });
}
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener("click", (e) => {
    e.preventDefault();
    scrollToTarget(a.hash);
    closeMobileMenu();
  });
});

/* ============ Mobile menu ============ */
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
  if (open && !prefersReduced) {
    gsap.from(".mobile-menu a", { y: 30, autoAlpha: 0, stagger: 0.06, duration: 0.5, clearProps: "all" });
  }
});

/* ============ Nav: hide down / reveal up + legibility strip once scrolled ============ */
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

/* ============ Custom cursor (desktop, motion allowed) ============ */
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

/* ============ Golden thread: the cursor weaves silk across the hero ============ */
(() => {
  if (prefersReduced) return;
  if (!window.matchMedia("(hover: hover) and (pointer: fine) and (min-width: 900px)").matches) return;
  const hero = document.querySelector(".hero");
  if (!hero) return;

  const canvas = document.createElement("canvas");
  canvas.className = "hero__thread";
  canvas.setAttribute("aria-hidden", "true");
  hero.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(devicePixelRatio, 2);
  const size = () => {
    const r = hero.getBoundingClientRect();
    canvas.width = r.width * dpr;
    canvas.height = r.height * dpr;
    canvas.style.width = r.width + "px";
    canvas.style.height = r.height + "px";
  };
  size();
  addEventListener("resize", size);

  const pts = [];
  const mouse = { x: null, y: null };
  const pen = { x: null, y: null }; // lags behind the cursor — that lag is the silk
  const LIFE = 950; // ms before a woven segment fades away

  hero.addEventListener("mousemove", (e) => {
    const r = hero.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
    if (pen.x === null) {
      pen.x = mouse.x;
      pen.y = mouse.y;
    }
  });
  hero.addEventListener("mouseleave", () => (mouse.x = null));

  gsap.ticker.add(() => {
    if (mouse.x !== null && pen.x !== null) {
      pen.x += (mouse.x - pen.x) * 0.22;
      pen.y += (mouse.y - pen.y) * 0.22;
      const last = pts[pts.length - 1];
      if (!last || Math.hypot(pen.x - last.x, pen.y - last.y) > 3) {
        pts.push({ x: pen.x, y: pen.y, t: performance.now() });
      }
    }
    const now = performance.now();
    while (pts.length && now - pts[0].t > LIFE) pts.shift();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (pts.length < 3) return;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (let i = 1; i < pts.length - 1; i++) {
      const age = (now - pts[i].t) / LIFE;
      const alpha = (1 - age) * 0.6;
      ctx.strokeStyle = "rgba(197,160,40," + alpha.toFixed(3) + ")";
      ctx.lineWidth = 1.6 * (1 - age * 0.55);
      ctx.shadowColor = "rgba(212,175,55," + (alpha * 0.8).toFixed(3) + ")";
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo((pts[i - 1].x + pts[i].x) / 2, (pts[i - 1].y + pts[i].y) / 2);
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, (pts[i].x + pts[i + 1].x) / 2, (pts[i].y + pts[i + 1].y) / 2);
      ctx.stroke();
    }
    ctx.restore();
  });
})();

/* ============ Preloader → Hero intro ============ */
const preloader = document.querySelector(".preloader");
const counter = document.querySelector(".preloader__count");

function heroIntro() {
  // The hero arrives whole — no cascade, the preloader lift is the reveal
  gsap.set("#heroTitle", { visibility: "visible" });
}

function initPage() {
  if (prefersReduced) {
    // Reduced motion: show everything, no intro, no scroll effects
    gsap.set(preloader, { display: "none" });
    gsap.set(".split-target, .reveal", { clearProps: "all", visibility: "visible", autoAlpha: 1 });
    document.querySelectorAll("[data-count]").forEach((el) => {
      el.textContent = el.dataset.count + (el.dataset.suffix || "");
    });
    return;
  }

  const load = gsap.timeline();
  const count = { v: 0 };
  load
    .from(".preloader__logo", { y: 40, autoAlpha: 0, duration: 0.5 })
    .to(count, {
      v: 100,
      duration: 0.7,
      ease: "power2.inOut",
      onUpdate: () => (counter.textContent = Math.round(count.v)),
    }, "<")
    .to(".preloader__inner", { y: -30, autoAlpha: 0, duration: 0.4, ease: "power2.in" }, "+=0.05")
    .to(preloader, {
      yPercent: -100,
      duration: 0.9,
      ease: "power4.inOut",
      onComplete: () => {
        gsap.set(preloader, { display: "none" });
        ScrollTrigger.refresh();
      },
    }, "-=0.1")
    .add(heroIntro, "-=0.45");

  buildScrollAnimations();
}

/* ============ Scroll-driven animations (created in page order) ============ */
function buildScrollAnimations() {
  const mm = gsap.matchMedia();

  mm.add(
    { isDesktop: "(min-width: 900px)", isMobile: "(max-width: 899px)" },
    (ctx) => {
      const { isDesktop } = ctx.conditions;

      /* --- Golden aurora: light drifts like morning sun across silk --- */
      const auroras = gsap.utils.toArray(".hero__aurora span");
      auroras.forEach((blob, i) => {
        gsap.to(blob, {
          xPercent: (i % 2 ? -1 : 1) * (10 + i * 4),
          yPercent: (i % 2 ? 1 : -1) * (12 + i * 3),
          scale: 1.12,
          duration: 14 + i * 5,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
        });
      });
      gsap.to(".hero__aurora", {
        yPercent: 18,
        ease: "none",
        scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 1 },
      });

      /* --- Hero ornament slow parallax drift --- */
      gsap.to(".hero__ornament", {
        yPercent: 24,
        rotation: 12,
        ease: "none",
        scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 1 },
      });

      /* --- Marquee: infinite + scroll-velocity nudge --- */
      const marqueeTween = gsap.to(".marquee__inner", { xPercent: -50, ease: "none", duration: 22, repeat: -1 });
      ScrollTrigger.create({
        trigger: ".marquee",
        start: "top bottom",
        end: "bottom top",
        onUpdate: (self) => {
          const v = gsap.utils.clamp(-4, 4, self.getVelocity() / 250);
          gsap.to(marqueeTween, { timeScale: 1 + Math.abs(v), duration: 0.4, overwrite: true });
        },
      });

      /* --- Manifesto sketch: scroll-scrubbed reveal — the construction draws
             with your scroll and un-draws when you scroll back.
             Order mirrors how a draughtsman would work:
             frame → subdivisions → diagonals → spiral → heart → caption. --- */
      const sketchTl = gsap.timeline({
        defaults: { ease: "none" }, // linear strokes so drawing speed maps 1:1 to scroll
        scrollTrigger: { trigger: ".manifesto-section", start: "top 80%", end: "bottom 65%", scrub: 1 },
      });
      sketchTl
        .fromTo(".sketch__frame rect", { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.3 })
        .fromTo(".sketch__frame line", { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.5, stagger: 0.18 }, "-=0.4")
        .fromTo(".sketch__diagonals line", { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.7, stagger: 0.25 }, "-=0.2")
        .fromTo(".sketch__spiral", { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 2.6 }, "-=0.3")
        .fromTo(".sketch__heart", { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.7 })
        .from(".manifesto__sketch-note", { autoAlpha: 0, y: 12, duration: 0.8 }, "-=0.2");

      /* --- Manifesto: words light up as you read --- */
      const manifestoSplit = SplitText.create(".manifesto", { type: "words" });
      gsap.set(manifestoSplit.words, { opacity: 0.12 });
      gsap.to(manifestoSplit.words, {
        opacity: 1,
        ease: "none",
        stagger: 0.04,
        scrollTrigger: { trigger: ".manifesto", start: "top 72%", end: "bottom 45%", scrub: true },
      });

      /* --- Labels, paragraphs and section titles land already visible;
             the set pieces carry the motion --- */
      gsap.set("[data-reveal='lines']", { visibility: "visible" });

      /* --- Services: the picture show. The stage pins while the six services
             play like film scenes — each cuts in, holds a beat, and cuts away —
             with BUJJI narrating every hook from the corner of the frame.
             Mobile & reduced motion: the reel unrolls as a vertical list. --- */
      const svcStage = document.querySelector(".svc-stage");
      if (svcStage) {
        const scenes = gsap.utils.toArray(".svc-scene");
        const progNum = document.querySelector(".svc-progress__num");
        const progBar = document.querySelector(".svc-progress__bar i");
        const bubble = svcStage.querySelector(".tour-bubble");
        const bubbleText = bubble ? bubble.querySelector("span") : null;
        const hooks = scenes.map((sc) => {
          const h = sc.querySelector(".svc-card__hook");
          return sc.dataset.hook || (h ? h.textContent : "");
        });

        if (isDesktop) {
          let activeIdx = -1;
          const speak = (i) => {
            if (i === activeIdx || !bubbleText) return;
            activeIdx = i;
            bubbleText.textContent = hooks[i];
            bubble.classList.remove("pop");
            void bubble.offsetWidth; // restart the pop animation
            bubble.classList.add("pop");
          };

          const cuts = gsap.timeline({
            scrollTrigger: {
              trigger: ".svc-cinema",
              start: "top 15%",
              end: () => "+=" + Math.round(scenes.length * window.innerHeight * 0.55),
              scrub: 1,
              pin: true,
              anticipatePin: 1,
              invalidateOnRefresh: true,
              snap: { snapTo: "labelsDirectional", duration: { min: 0.15, max: 0.5 }, ease: "power1.inOut", delay: 0.1 },
              onUpdate: (self) => {
                if (progBar) progBar.style.transform = "scaleX(" + self.progress + ")";
                // which scene is on screen: the last cut whose entrance has begun
                let i = 0;
                sceneStarts.forEach((t, n) => {
                  if (t <= cuts.time() + 0.001) i = n;
                });
                if (progNum) progNum.textContent = String(Math.min(6, i + 1)).padStart(2, "0");
                speak(i);
              },
            },
          });

          const sceneStarts = []; // where each cut's entrance begins on the timeline
          scenes.forEach((sc, i) => {
            const copy = sc.querySelectorAll(".svc-card__num, .label, h3, .svc-card__hook, .svc-card__desc, .svc-card__ctas");
            const strokes = sc.querySelectorAll("[pathLength]");
            sceneStarts.push(cuts.duration());
            if (i) cuts.fromTo(sc, { autoAlpha: 0, yPercent: 5 }, { autoAlpha: 1, yPercent: 0, duration: 0.3, ease: "power2.out" });
            else gsap.set(sc, { autoAlpha: 1 });
            if (strokes.length) {
              cuts.fromTo(
                strokes,
                { strokeDashoffset: 1 },
                { strokeDashoffset: 0, duration: 0.45, stagger: 0.04, ease: "none" },
                i ? "<0.08" : 0
              );
            }
            cuts.fromTo(
              copy,
              { y: 30, autoAlpha: 0 },
              { y: 0, autoAlpha: 1, duration: 0.3, stagger: 0.05, ease: "power2.out" },
              i ? "<" : 0.05
            );
            cuts.addLabel("scene" + i); // the frame is fully lit — snap settles here
            cuts.to({}, { duration: 0.5 }); // hold: let the scene play
            if (i < scenes.length - 1) cuts.to(sc, { autoAlpha: 0, yPercent: -5, duration: 0.28, ease: "power2.in" });
          });
        } else {
          // the reel unrolls: each scene draws and cascades as it arrives
          scenes.forEach((sc) => {
            const strokes = sc.querySelectorAll("[pathLength]");
            if (strokes.length) {
              gsap.fromTo(
                strokes,
                { strokeDashoffset: 1 },
                {
                  strokeDashoffset: 0,
                  duration: 1.2,
                  ease: "power2.out",
                  stagger: 0.06,
                  scrollTrigger: { trigger: sc, start: "top 75%", toggleActions: "play none none none" },
                }
              );
            }
            gsap.from(sc.querySelectorAll(":scope > *:not(.svc-scene__art)"), {
              y: 32,
              autoAlpha: 0,
              stagger: 0.07,
              duration: 0.7,
              scrollTrigger: { trigger: sc, start: "top 80%", toggleActions: "play none none none" },
            });
          });
        }

        /* every exhibit is a live mock now. Each builds its own looping reel,
           and all of them play only while the cinema is anywhere on screen. */
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

        const reels = [];
        document.querySelectorAll(".svc-scene [data-reel]").forEach((root) => {
          const build = reelBuilders[root.dataset.reel];
          if (build) reels.push(build(root));
        });
        if (reels.length) {
          ScrollTrigger.create({
            trigger: ".svc-cinema",
            start: "top bottom",
            end: "bottom top",
            onToggle: (self) => reels.forEach((r) => r.paused(!self.isActive)),
          });
        }
      }

      /* the tour's hand-off: the end-cap button opens the real BUJJI */
      const askBujji = document.getElementById("askBujji");
      if (askBujji && !askBujji.dataset.bound) {
        askBujji.dataset.bound = "1"; // matchMedia re-runs this block on resize
        askBujji.addEventListener("click", () => {
          const launcher = document.querySelector(".vinci__launcher");
          if (launcher) launcher.click();
        });
      }

      /* --- Collective duet: the two machines animate themselves
             (js/collective-machines.js) — only the panels cascade in here --- */
      gsap.from(".duet__panel", {
        y: 48,
        autoAlpha: 0,
        stagger: 0.15,
        duration: 0.9,
        scrollTrigger: { trigger: ".duet", start: "top 80%", toggleActions: "play none none none" },
      });

      /* --- Collective: ally card content cascades in --- */
      gsap.utils.toArray(".ally").forEach((card) => {
        gsap.from(card.querySelectorAll(".ally__content > *"), {
          y: 32,
          autoAlpha: 0,
          stagger: 0.07,
          duration: 0.7,
          scrollTrigger: { trigger: card, start: "top 80%", toggleActions: "play none none none" },
        });
      });

      /* --- Portfolio Blade: pinned product story (desktop only) --- */
      if (isDesktop) {
        const bladeTl = gsap.timeline({
          scrollTrigger: {
            trigger: ".blade",
            start: "top top",
            end: "+=120%",
            scrub: 1,
            pin: ".blade__pin",
            anticipatePin: 1,
          },
        });
        bladeTl
          .from(".phone", {
            yPercent: 40,
            rotationY: 38,
            rotationX: 10,
            rotation: 3,
            scale: 0.9,
            transformPerspective: 950,
            ease: "none",
          })
          .from(".blade__qr", { yPercent: 120, rotationY: -35, transformPerspective: 950, autoAlpha: 0, ease: "none" }, "<0.25")
          .from(".phone__item", { x: 40, autoAlpha: 0, stagger: 0.12, ease: "none" }, "<0.15")
          .from(".phone__cart", { yPercent: 140, ease: "none" }, "-=0.2");
      } else {
        gsap.from(".blade__visual", {
          y: 60,
          autoAlpha: 0,
          duration: 1,
          scrollTrigger: { trigger: ".blade__visual", start: "top 85%", toggleActions: "play none none reverse" },
        });
      }
      gsap.from(".blade__desc, .blade__features li, .blade .btn--gold", {
        y: 32,
        autoAlpha: 0,
        stagger: 0.08,
        duration: 0.8,
        scrollTrigger: { trigger: ".blade__copy", start: "top 70%", toggleActions: "play none none reverse" },
      });

      /* --- Stats & ally numbers: count up --- */
      document.querySelectorAll("[data-count]").forEach((el) => {
        const target = parseFloat(el.dataset.count);
        const suffix = el.dataset.suffix || "";
        const obj = { v: 0 };
        gsap.to(obj, {
          v: target,
          duration: 1.6,
          ease: "power2.out",
          onUpdate: () => (el.textContent = Math.round(obj.v) + suffix),
          scrollTrigger: { trigger: el, start: "top 85%", toggleActions: "play none none none" },
        });
      });

      /* --- Founder: frame clip reveal + inner image parallax --- */
      gsap.from(".founder__frame", {
        clipPath: "inset(0% 0% 100% 0%)",
        duration: 1.2,
        ease: "power4.inOut",
        scrollTrigger: { trigger: ".founder__media", start: "top 78%", toggleActions: "play none none reverse" },
      });
      gsap.fromTo(
        ".founder__frame img",
        { yPercent: -8, scale: 1.12 },
        {
          yPercent: 8,
          scale: 1.12,
          ease: "none",
          scrollTrigger: { trigger: ".founder__media", start: "top bottom", end: "bottom top", scrub: true },
        }
      );
      gsap.from(".founder__plate", {
        y: 40,
        autoAlpha: 0,
        duration: 0.8,
        delay: 0.4,
        scrollTrigger: { trigger: ".founder__media", start: "top 78%", toggleActions: "play none none reverse" },
      });
      gsap.from(".founder__bio p", {
        y: 36,
        autoAlpha: 0,
        stagger: 0.12,
        duration: 0.8,
        scrollTrigger: { trigger: ".founder__bio", start: "top 82%", toggleActions: "play none none reverse" },
      });

      /* --- FAQ items --- */
      gsap.set(".faq__item", { autoAlpha: 0, y: 40 });
      ScrollTrigger.batch(".faq__item", {
        start: "top 90%",
        onEnter: (batch) => gsap.to(batch, { autoAlpha: 1, y: 0, stagger: 0.1, duration: 0.8, overwrite: true }),
      });

      /* --- Contact --- */
      gsap.from(".contact__sub, .contact__email", {
        y: 32,
        autoAlpha: 0,
        stagger: 0.12,
        duration: 0.8,
        scrollTrigger: { trigger: ".contact__copy", start: "top 75%", toggleActions: "play none none reverse" },
      });
      gsap.from(".contact__form", {
        y: 64,
        autoAlpha: 0,
        duration: 1,
        scrollTrigger: { trigger: ".contact__form", start: "top 85%", toggleActions: "play none none reverse" },
      });

    }
  );
}

/* ============ FAQ accordion (animated open/close) ============ */
document.querySelectorAll(".faq__item").forEach((item) => {
  const summary = item.querySelector("summary");
  const answer = item.querySelector(".faq__answer");

  summary.addEventListener("click", (e) => {
    if (prefersReduced) return; // native <details> behavior
    e.preventDefault();
    if (item.open) {
      gsap.to(answer, {
        height: 0,
        autoAlpha: 0,
        duration: 0.35,
        ease: "power2.inOut",
        onComplete: () => {
          item.open = false;
          gsap.set(answer, { clearProps: "all" });
          ScrollTrigger.refresh();
        },
      });
    } else {
      item.open = true;
      gsap.fromTo(
        answer,
        { height: 0, autoAlpha: 0 },
        {
          height: "auto",
          autoAlpha: 1,
          duration: 0.45,
          ease: "power2.out",
          onComplete: () => {
            gsap.set(answer, { clearProps: "height" });
            ScrollTrigger.refresh();
          },
        }
      );
    }
  });
});

/* ============ Consultation form → prefilled email ============ */
document.getElementById("consultForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const f = e.target;
  const note = document.getElementById("formNote");
  if (!f.name.value.trim() || !f.contact.value.trim() || !f.service.value) {
    note.textContent = "Please fill in your name, contact and the service you need.";
    return;
  }
  const subject = encodeURIComponent(`Free consultation — ${f.service.value} (${f.name.value})`);
  const body = encodeURIComponent(
    `Name: ${f.name.value}\nContact: ${f.contact.value}\nService: ${f.service.value}\n\nProblem:\n${f.message.value || "-"}`
  );
  window.location.href = `mailto:vincis.contact@gmail.com?subject=${subject}&body=${body}`;
  note.textContent = "Opening your email app… We reply within one working day.";
});

/* ============ Boot: wait for fonts before splitting text — but never let a
   slow font CDN hold the whole page hostage. 2.5s and we go. ============ */
let booted = false;
function bootOnce() {
  if (booted) return;
  booted = true;
  initPage();
}
document.fonts.ready.then(bootOnce);
setTimeout(bootOnce, 2500);
