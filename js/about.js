/* ==========================================================================
   TheVincis — About page (dark cinematic)
   · the opening statement rises in line by line;
   · the portrait unveils from the bottom, shown exactly as taken;
   · "What we believe" pins and plays its beliefs one at a time;
   · a gold rail draws down beside the process steps as you read them.
   Reduced motion: everything is shown at full strength, nothing moves.
   ========================================================================== */
(() => {
  "use strict";

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- Hero: Vanta WAVES, a slow liquid-gold surface behind the statement.
         Skipped for reduced motion and data saver; the CSS gold glow stays. ---- */
  const vantaEl = document.querySelector(".ab-hero__vanta");
  const conn = navigator.connection || {};
  if (vantaEl && window.VANTA && window.THREE && !reducedMotion && !conn.saveData) {
    try {
      const fx = window.VANTA.WAVES({
        el: vantaEl,
        THREE: window.THREE,
        mouseControls: true,
        touchControls: true,
        gyroControls: false,
        minHeight: 200,
        minWidth: 200,
        scale: 1,
        scaleMobile: 1,
        color: 0x2a1e05,       // deep bronze base; the lights pull gold out of the crests
        shininess: 48,
        waveHeight: 16,
        waveSpeed: 0.55,
        zoom: 0.9,
      });
      vantaEl.classList.add("is-on");
      // pause the WebGL loop while the hero is off screen; free it on leave
      const io = new IntersectionObserver(([e]) => {
        if (!fx || !fx.renderer) return;
        if (e.isIntersecting) { if (fx.__paused) { fx.__paused = false; fx.resize(); fx.animationLoop && fx.animationLoop(); } }
        else fx.__paused = true;
      });
      io.observe(vantaEl);
      const origLoop = fx.animationLoop && fx.animationLoop.bind(fx);
      if (origLoop) {
        fx.animationLoop = function () { if (fx.__paused) return; return origLoop(); };
      }
      window.addEventListener("pagehide", () => fx.destroy(), { once: true });
    } catch (err) {
      /* WebGL unavailable: the static glow is the fallback */
    }
  }

  if (!window.gsap || !window.ScrollTrigger) return;
  if (reducedMotion) return;
  gsap.registerPlugin(ScrollTrigger);

  /* ---- Opening statement ---- */
  gsap.from(".ab-hero .ab-line", { yPercent: 60, autoAlpha: 0, duration: 1.3, ease: "expo.out", stagger: 0.13, delay: 0.15 });
  gsap.from(".ab-hero__lede, .ab-hero .ab-label", { y: 21, autoAlpha: 0, duration: 1, ease: "expo.out", delay: 0.55 });

  /* ---- Portrait: unveil ---- */
  const portrait = document.querySelector(".ab-portrait");
  if (portrait) {
    gsap.from(portrait, {
      clipPath: "inset(100% 0% 0% 0% round 21px)", duration: 1.6, ease: "expo.inOut",
      scrollTrigger: { trigger: portrait, start: "top 80%", toggleActions: "play none none none" },
    });
    gsap.from(".ab-story__copy > *", {
      y: 21, autoAlpha: 0, duration: 0.9, ease: "expo.out", stagger: 0.08,
      scrollTrigger: { trigger: ".ab-story__copy", start: "top 75%", toggleActions: "play none none none" },
    });
  }

  /* ---- Beliefs: a pinned stage, one belief at a time ----
     The section pins for (n − 1) screens; each step lifts the current belief
     away and raises the next, the counter ticks and the gold bar fills. */
  const beliefSec = document.querySelector(".ab-beliefs");
  const beliefs = gsap.utils.toArray(".belief");
  if (beliefSec && beliefs.length > 1) {
    beliefSec.classList.add("is-pinned");
    const count = beliefSec.querySelector(".beliefs__count b");
    const bar = beliefSec.querySelector(".beliefs__bar i");
    const n = beliefs.length;
    const parts = (el) => [el.querySelector(".belief__num"), el.querySelector(".belief__line"), el.querySelector(".belief__sub")];

    gsap.set(beliefs.slice(1), { autoAlpha: 1 });
    beliefs.slice(1).forEach((el) => gsap.set(parts(el), { autoAlpha: 0, y: 55 }));

    const tl = gsap.timeline({
      defaults: { ease: "power2.inOut" },
      scrollTrigger: {
        trigger: beliefSec,
        pin: ".beliefs-pin",
        start: "top top",
        end: () => "+=" + window.innerHeight * (n - 1) * 0.9,
        scrub: 0.8,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          const i = Math.min(n - 1, Math.round(self.progress * (n - 1)));
          const label = String(i + 1).padStart(2, "0");
          if (count && count.textContent !== label) count.textContent = label;
        },
      },
    });
    for (let i = 0; i < n - 1; i++) {
      const [numA, lineA, subA] = parts(beliefs[i]);
      const [numB, lineB, subB] = parts(beliefs[i + 1]);
      tl.to(numA, { autoAlpha: 0, y: -55, scale: 0.92, duration: 0.5 }, i)
        .to([lineA, subA], { autoAlpha: 0, y: -34, duration: 0.45, stagger: 0.05 }, i)
        .to(numB, { autoAlpha: 1, y: 0, scale: 1, duration: 0.55 }, i + 0.35)
        .to(lineB, { autoAlpha: 1, y: 0, duration: 0.55 }, i + 0.42)
        .to(subB, { autoAlpha: 1, y: 0, duration: 0.5 }, i + 0.5);
    }
    if (bar) tl.fromTo(bar, { scaleX: 1 / n }, { scaleX: 1, ease: "none", duration: n - 1 + 0.05 }, 0);
  }

  /* ---- Process: the rail draws as the steps scroll by ---- */
  const rail = document.querySelector(".steps__rail i");
  if (rail) {
    gsap.fromTo(rail, { scaleY: 0 }, {
      scaleY: 1, ease: "none",
      scrollTrigger: { trigger: ".steps", start: "top 70%", end: "bottom 60%", scrub: 0.5 },
    });
    gsap.utils.toArray(".step").forEach((st) => {
      gsap.from(st, {
        x: 21, autoAlpha: 0, duration: 0.8, ease: "expo.out",
        scrollTrigger: { trigger: st, start: "top 82%", toggleActions: "play none none none" },
      });
    });
  }

  gsap.from(".ab-cta__title, .ab-cta__actions", {
    y: 34, autoAlpha: 0, duration: 1, ease: "expo.out", stagger: 0.12,
    scrollTrigger: { trigger: ".ab-cta", start: "top 75%", toggleActions: "play none none none" },
  });
})();
