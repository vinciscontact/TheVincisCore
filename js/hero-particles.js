/* ==========================================================================
   TheVincis — Hero particle constellation (Three.js)
   Gold dust drifting behind the headline; repelled gently by the cursor.
   Desktop + motion-allowed only; the SVG ornament remains the fallback.
   ========================================================================== */

import * as THREE from "three";

const host = document.querySelector(".hero__canvas");
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const desktop = window.matchMedia("(min-width: 900px)").matches;

if (host && !reduced && desktop) {
  try {
    init();
  } catch (e) {
    /* WebGL unavailable — page stays fully usable without the canvas */
  }
}

function init() {
  const hero = document.querySelector(".hero");

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(hero.clientWidth, hero.clientHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, hero.clientWidth / hero.clientHeight, 0.1, 200);
  camera.position.set(0, 0, 60);

  // World-units visible at z=0 (for spreading points and mapping the mouse)
  const worldH = 2 * Math.tan(THREE.MathUtils.degToRad(25)) * 60;
  let worldW = worldH * (hero.clientWidth / hero.clientHeight);

  /* ---- Points: golden-spiral cluster on the right + fine dust everywhere ---- */
  const COUNT = 1200;
  const GOLDEN = Math.PI * (3 - Math.sqrt(5));
  const positions = new Float32Array(COUNT * 3);
  const base = new Float32Array(COUNT * 3); // resting positions
  const phase = new Float32Array(COUNT);
  const amp = new Float32Array(COUNT);

  for (let i = 0; i < COUNT; i++) {
    let x, y, z;
    if (i < COUNT * 0.55) {
      // phyllotaxis spiral, echoing the golden-ratio ornament
      const k = i + 4;
      const r = 0.62 * Math.sqrt(k);
      x = Math.cos(k * GOLDEN) * r + worldW * 0.22;
      y = Math.sin(k * GOLDEN) * r;
      z = (Math.random() - 0.5) * 8;
    } else {
      // sparse ambient dust across the whole hero
      x = (Math.random() - 0.5) * worldW * 1.1;
      y = (Math.random() - 0.5) * worldH * 1.1;
      z = (Math.random() - 0.5) * 12;
    }
    base[i * 3] = x;
    base[i * 3 + 1] = y;
    base[i * 3 + 2] = z;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    phase[i] = Math.random() * Math.PI * 2;
    amp[i] = 0.25 + Math.random() * 0.55;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xb08e1e,
    size: 0.22,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  const group = new THREE.Group();
  group.add(points);
  scene.add(group);

  /* ---- Cursor repulsion (world-space, smoothed) ---- */
  const mouse = new THREE.Vector2(9999, 9999);
  const target = new THREE.Vector2(9999, 9999);
  hero.addEventListener("mousemove", (e) => {
    const r = hero.getBoundingClientRect();
    target.x = ((e.clientX - r.left) / r.width - 0.5) * worldW;
    target.y = -((e.clientY - r.top) / r.height - 0.5) * worldH;
  });
  hero.addEventListener("mouseleave", () => target.set(9999, 9999));

  /* ---- Scroll: constellation drifts up + rotates slightly (if GSAP present) ---- */
  let heroVisible = true;
  if (window.gsap && window.ScrollTrigger) {
    gsap.to(group.rotation, {
      z: 0.22,
      ease: "none",
      scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: 1 },
    });
    gsap.to(group.position, {
      y: worldH * 0.25,
      ease: "none",
      scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: 1 },
    });
    ScrollTrigger.create({
      trigger: hero,
      start: "top bottom",
      end: "bottom top",
      onToggle: (self) => (heroVisible = self.isActive),
    });
    gsap.from(renderer.domElement, { autoAlpha: 0, duration: 1.6, delay: 0.5, ease: "power2.out" });
  }

  /* ---- One render loop; skips work while the hero is off-screen ---- */
  const clock = new THREE.Clock();
  const REPULSE_R = 8;
  renderer.setAnimationLoop(() => {
    if (!heroVisible) return;
    const t = clock.getElapsedTime();
    mouse.lerp(target, 0.08);

    const pos = geometry.attributes.position.array;
    for (let i = 0; i < COUNT; i++) {
      const ix = i * 3;
      // idle drift around the resting position
      let x = base[ix] + Math.sin(t * 0.3 + phase[i]) * amp[i];
      let y = base[ix + 1] + Math.cos(t * 0.24 + phase[i] * 1.3) * amp[i];
      // gentle push away from the cursor
      const dx = x - mouse.x;
      const dy = y - mouse.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < REPULSE_R * REPULSE_R) {
        const d = Math.sqrt(d2) || 0.001;
        const f = (1 - d / REPULSE_R) * 2.2;
        x += (dx / d) * f;
        y += (dy / d) * f;
      }
      pos[ix] = x;
      pos[ix + 1] = y;
    }
    geometry.attributes.position.needsUpdate = true;
    renderer.render(scene, camera);
  });

  /* ---- Resize ---- */
  addEventListener("resize", () => {
    const w = hero.clientWidth;
    const h = hero.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    worldW = worldH * (w / h);
  });
}
