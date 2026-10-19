/* ==========================================================================
   TheVincis — About page (dark cinematic)
   · the opening statement rises in line by line;
   · the portrait unveils from the bottom, shown exactly as taken;
   · each belief brightens from dim to full as it crosses the middle of
     the screen, then dims again as it leaves;
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

  /* ---- Beliefs: brightest at the centre of the screen ---- */
  gsap.utils.toArray(".belief").forEach((b) => {
    const line = b.querySelector(".belief__line");
    const sub = b.querySelector(".belief__sub");
    gsap.timeline({
      scrollTrigger: { trigger: b, start: "top 85%", end: "bottom 15%", scrub: 0.6 },
    })
      .fromTo(line, { opacity: 0.16, x: -21 }, { opacity: 1, x: 0, ease: "none", duration: 1 })
      .fromTo(sub, { opacity: 0 }, { opacity: 1, ease: "none", duration: 0.6 }, "<0.3")
      .to([line, sub], { opacity: 0.16, ease: "none", duration: 1 }, "+=0.6");
  });

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
