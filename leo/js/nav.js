// The bloom — Leo's navigation. Tapping the queen (the floating queen-bee button
// or the queen cell in the hive) opens sections and quick actions as hexagon
// cells around her. Also home to Find, the search across the whole hive.
import { $, $$, esc, money, toast } from "./ui.js";
import { openClientModal, hexatar } from "./views.js";

const BEE = "../images/brand/bee-128.webp";
const SQ3 = Math.sqrt(3);

// SF Symbols–style line icons (24px grid, inherit currentColor)
const ICON_PATHS = {
  hive: '<path d="M12 2.8 19.8 7.3v9.4L12 21.2 4.2 16.7V7.3z"/><path d="M12 8.6 15 10.3v3.4L12 15.4 9 13.7v-3.4z"/>',
  clients: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="17" cy="9" r="2.5"/><path d="M16.5 14.1c2.9.3 5 2.4 5 5.4"/>',
  projects: '<path d="M3 7.5A2 2 0 0 1 5 5.5h4l2 2h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  quotes: '<path d="M6.5 3h7.5l4.5 4.5V20a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v4.5h4.5M8.5 12.5h7M8.5 16.5h7"/>',
  invoices: '<path d="M5.5 3h13v18l-2.6-1.8-2.6 1.8-2.3-1.8-2.3 1.8-2.6-1.8L5.5 21z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  services: '<rect x="4" y="4" width="7" height="7" rx="1.8"/><rect x="13" y="4" width="7" height="7" rx="1.8"/><rect x="4" y="13" width="7" height="7" rx="1.8"/><rect x="13" y="13" width="7" height="7" rx="1.8"/>',
  settings: '<path d="M4 6.5h9M17 6.5h3M4 12h3M11 12h9M4 17.5h11M19 17.5h1"/><circle cx="15" cy="6.5" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="17.5" r="2"/>',
  signout: '<path d="M14.5 4H18a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3.5M10 8l-4 4 4 4M6 12h10"/>',
  search: '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5.5 5.5"/>',
  newQuote: '<path d="M6.5 3h7.5l4.5 4.5V20a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M12 10.5v6M9 13.5h6"/>',
  newInvoice: '<path d="M5.5 3h13v18l-2.6-1.8-2.6 1.8-2.3-1.8-2.3 1.8-2.6-1.8L5.5 21z"/><path d="M12 8v7M8.5 11.5h7"/>',
  newClient: '<circle cx="10" cy="8" r="3.5"/><path d="M3.5 20c0-3.6 2.9-6 6.5-6 1.3 0 2.5.3 3.5.9M18 14v6M15 17h6"/>',
};
export const icon = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name]}</svg>`;

// Ring 1 = the six main sections, clockwise from top-left.
// Ring 2 = six corners: quick create on top and right, utilities below and left.
const ITEMS = [
  { q: 0, r: -1, kind: "section", label: "Hive", icon: "hive", href: "#/" },
  { q: 1, r: -1, kind: "section", label: "Clients", icon: "clients", href: "#/clients" },
  { q: 1, r: 0, kind: "section", label: "Projects", icon: "projects", href: "#/projects" },
  { q: 0, r: 1, kind: "section", label: "Quotes", icon: "quotes", href: "#/quotes" },
  { q: -1, r: 1, kind: "section", label: "Invoices", icon: "invoices", href: "#/invoices" },
  { q: -1, r: 0, kind: "section", label: "Services", icon: "services", href: "#/services" },
  { q: 0, r: -2, kind: "quick", label: "New quote", icon: "newQuote", href: "#/doc/new/quote" },
  { q: 2, r: -2, kind: "quick", label: "New invoice", icon: "newInvoice", href: "#/doc/new/invoice" },
  { q: 2, r: 0, kind: "quick", label: "New client", icon: "newClient", act: "client" },
  { q: 0, r: 2, kind: "util", label: "Find", icon: "search", act: "search" },
  { q: -2, r: 2, kind: "util", label: "Settings", icon: "settings", href: "#/settings" },
  { q: -2, r: 0, kind: "util", label: "Sign out", icon: "signout", act: "signout" },
];

// Which bloom section the current hash belongs to.
export function sectionOf(hash) {
  if (!hash || hash === "#/" || hash === "#") return "#/";
  if (hash.startsWith("#/doc")) return /invoice/.test(hash) ? "#/invoices" : "#/quotes";
  return "#/" + hash.split("/")[1].split("?")[0];
}

let openBloomEl = null;

export function openBloom(ctx, trigger) {
  if (openBloomEl) return;
  const size = innerWidth < 520 ? 40 : 50;              // cell radius
  const current = sectionOf(location.hash.split("?")[0]);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const el = document.createElement("div");
  el.className = "bloom";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-label", "Leo menu");
  el.style.setProperty("--cell", `${size}px`);
  el.innerHTML = `
    <div class="bloom__veil"></div>
    <div class="bloom__flower">
      ${ITEMS.map((it, i) => {
        const x = size * SQ3 * (it.q + it.r / 2), y = size * 1.5 * it.r;
        const ring = Math.max(Math.abs(it.q), Math.abs(it.r), Math.abs(it.q + it.r));
        const attrs = `class="bcell bcell--${it.kind}${it.href === current ? " is-current" : ""}" style="--x:${x.toFixed(1)}px;--y:${y.toFixed(1)}px;--d:${ring * 55 + i * 12}ms" data-i="${i}"`;
        const inner = `<span class="bcell__hex">${icon(it.icon)}<span>${it.label}</span></span>`;
        return it.href
          ? `<a ${attrs} href="${it.href}"${it.href === current ? ' aria-current="page"' : ""}>${inner}</a>`
          : `<button ${attrs} type="button">${inner}</button>`;
      }).join("")}
      <button class="bloom__queen" type="button" aria-label="Close menu"><span class="bq__rim"><span class="bq__core"><img src="${BEE}" alt=""></span></span></button>
    </div>`;
  // In full screen only the full-screen element is drawn, so the bloom opens inside it.
  (document.fullscreenElement || document.body).appendChild(el);
  openBloomEl = el;
  document.body.classList.add("bloom-open");

  // The queen flies from wherever she was tapped to the centre of the bloom.
  const r = trigger?.getBoundingClientRect();
  if (r && !reduced) {
    el.style.setProperty("--fx", `${r.left + r.width / 2 - innerWidth / 2}px`);
    el.style.setProperty("--fy", `${r.top + r.height / 2 - innerHeight / 2}px`);
  }
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("is-open")));

  const close = (then) => {
    if (!openBloomEl) return;
    openBloomEl = null;
    el.classList.remove("is-open");
    document.body.classList.remove("bloom-open");
    document.removeEventListener("keydown", onKey, true);
    setTimeout(() => { el.remove(); then?.(); if (!then) trigger?.focus?.(); }, reduced ? 0 : 260);
  };

  el.addEventListener("click", (e) => {
    if (e.target.closest(".bloom__queen") || e.target.classList.contains("bloom__veil") || e.target === el) return close();
    const cell = e.target.closest(".bcell");
    if (!cell) return;
    const it = ITEMS[cell.dataset.i];
    if (it.href) {
      e.preventDefault();
      close(() => { if (location.hash !== it.href) location.hash = it.href; });
    } else if (it.act === "client") {
      close(() => openClientModal(ctx.sb, null, (c) => { location.hash = `#/clients/${c.id}`; toast(`Welcome to the hive, ${c.name}`); }));
    } else if (it.act === "search") {
      close(() => openSearch(ctx));
    } else if (it.act === "signout") {
      close(() => ctx.sb.auth.signOut());
    }
  });

  // Keep focus inside the bloom; Escape closes it.
  function onKey(e) {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (e.key !== "Tab") return;
    const focusables = $$("a, button", el);
    const i = focusables.indexOf(document.activeElement);
    const next = e.shiftKey ? (i <= 0 ? focusables.length - 1 : i - 1) : (i === focusables.length - 1 ? 0 : i + 1);
    e.preventDefault();
    focusables[next].focus();
  }
  document.addEventListener("keydown", onKey, true);
  setTimeout(() => ($(".bcell.is-current", el) || $(".bcell", el)).focus({ preventScroll: true }), reduced ? 0 : 120);
}

// ======================================================================
// Find — one search box across clients, projects, quotes and invoices
// ======================================================================
export async function openSearch(ctx) {
  const dlg = document.createElement("dialog");
  dlg.className = "modal find";
  dlg.innerHTML = `
    <div class="find__bar">
      <input type="search" class="search find__input" placeholder="Search clients, projects, quotes, invoices" aria-label="Search the hive" autocomplete="off">
      <button class="btn btn--plain" data-close type="button">Cancel</button>
    </div>
    <div class="find__results" role="listbox" aria-label="Results"><p class="muted find__hint">Gathering the hive…</p></div>`;
  document.body.appendChild(dlg);
  const close = () => { dlg.close(); dlg.remove(); };
  $("[data-close]", dlg).addEventListener("click", close);
  dlg.addEventListener("cancel", (e) => { e.preventDefault(); close(); });
  dlg.addEventListener("click", (e) => { if (e.target === dlg) close(); });
  dlg.showModal();
  const input = $(".find__input", dlg), box = $(".find__results", dlg);
  input.focus();

  const [c, p, d] = await Promise.all([
    ctx.sb.from("clients").select("id,name,company,city,phone,email"),
    ctx.sb.from("projects").select("id,title,type,status,value,client_id"),
    ctx.sb.from("documents").select("id,kind,number,status,total,bill_to"),
  ]);
  const clients = c.data || [], projects = p.data || [], docs = d.data || [];
  const clientName = (id) => clients.find((x) => x.id === id)?.name || "";
  const index = [
    ...clients.map((x) => ({ group: "Families", href: `#/clients/${x.id}`, title: x.name, sub: [x.company !== x.name && x.company, x.city].filter(Boolean).join(" · "), mark: hexatar(x.name), text: [x.name, x.company, x.city, x.phone, x.email].join(" ") })),
    ...projects.map((x) => ({ group: "Projects", href: `#/clients/${x.client_id}`, title: x.title, sub: `${clientName(x.client_id)} · ${money(x.value)}`, mark: `<span class="find__ic">${icon("projects")}</span>`, text: [x.title, x.type, clientName(x.client_id)].join(" ") })),
    ...docs.map((x) => ({ group: x.kind === "quote" ? "Quotations" : "Invoices", href: `#/doc/${x.id}`, title: x.number, sub: `${x.bill_to?.name || ""} · ${money(x.total)} · ${x.status}`, mark: `<span class="find__ic">${icon(x.kind === "quote" ? "quotes" : "invoices")}</span>`, text: [x.number, x.bill_to?.name, x.bill_to?.company, x.total].join(" ") })),
  ];

  let hits = [], active = 0;
  function draw() {
    const q = input.value.trim().toLowerCase();
    hits = q ? index.filter((x) => x.text.toLowerCase().includes(q)).slice(0, 30) : [];
    active = 0;
    if (!q) { box.innerHTML = `<p class="muted find__hint">Type a name, project, or a number like 2026-004.</p>`; return; }
    if (!hits.length) { box.innerHTML = `<p class="muted find__hint">Nothing in the hive matches “${esc(input.value)}”.</p>`; return; }
    let last = "";
    box.innerHTML = hits.map((h, i) => {
      const head = h.group !== last ? `<p class="find__group">${h.group}</p>` : "";
      last = h.group;
      return `${head}<a class="find__hit${i === 0 ? " is-active" : ""}" role="option" href="${h.href}" data-i="${i}">${h.mark}<span><b>${esc(h.title)}</b><small>${esc(h.sub)}</small></span></a>`;
    }).join("");
  }
  input.addEventListener("input", draw);
  input.addEventListener("keydown", (e) => {
    if (!hits.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      active = (active + (e.key === "ArrowDown" ? 1 : hits.length - 1)) % hits.length;
      $$(".find__hit", box).forEach((a, i) => a.classList.toggle("is-active", i === active));
      $(".find__hit.is-active", box)?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      e.preventDefault();
      location.hash = hits[active].href;
      close();
    }
  });
  box.addEventListener("click", (e) => { if (e.target.closest(".find__hit")) close(); });
  draw();
}
