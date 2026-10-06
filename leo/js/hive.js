// The Hive — Leo's home. Every client is a family of hexagon cells around the
// TheVincis queen cell; honey in a cell is money that has come in.
//
// Layout runs on axial hex coordinates (q, r). Cells are HTML buttons placed in
// a preserve-3d stage, so the comb can tilt, cells can lift toward the viewer,
// and everything stays keyboard- and screen-reader-friendly.
import { $, $$, esc, money, fmtDate, todayISO, toast, STATUS_LABEL, effectiveStatus } from "./ui.js";
import { openClientModal, openProjectModal } from "./views.js";
import { downloadPdf } from "./pdf.js";

const SQ3 = Math.sqrt(3);
const SIZE = 60;                       // layout radius of one cell (px, world units)
const ORIGIN = { q: 0, r: 0 };
const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const BEE = "../images/brand/bee-128.webp";
const TILT = 24;                       // resting tilt of the comb in 3D mode (deg)
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- Hex maths ----------
const key = (h) => `${h.q},${h.r}`;
const dist = (a, b) => (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
function ring(c, rad) {
  if (rad === 0) return [{ ...c }];
  const out = [];
  let h = { q: c.q + DIRS[4][0] * rad, r: c.r + DIRS[4][1] * rad };
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < rad; j++) {
      out.push(h);
      h = { q: h.q + DIRS[i][0], r: h.r + DIRS[i][1] };
    }
  }
  return out;
}
const disc = (c, rad) => Array.from({ length: rad + 1 }, (_, k) => ring(c, k)).flat();
const toPx = (h) => ({ x: SIZE * SQ3 * (h.q + h.r / 2), y: SIZE * 1.5 * h.r });

// ---------- Layout ----------
// Each client claims a disc of cells: the client in the middle, its projects,
// quotes and invoices in the rings around it, spare ring slots left as empty
// "family" cells. Discs are placed by spiralling out from the queen, so the
// comb stays compact and families touch. One ring of "grow" cells edges it all.
function layout(clients, projects, docs) {
  const occupied = new Map();
  const cells = [];
  const put = (h, cell) => {
    Object.assign(cell, h, toPx(h));
    occupied.set(key(h), cell);
    cells.push(cell);
  };
  put(ORIGIN, { type: "queen", id: "queen" });

  const candidates = disc(ORIGIN, 40);
  const families = [];
  for (const client of clients) {
    const members = [
      ...projects.filter((p) => p.client_id === client.id).map((p) => ({ type: "project", id: p.id, project: p, client })),
      ...docs.filter((d) => d.client_id === client.id && d.kind === "quote").map((d) => ({ type: "quote", id: d.id, doc: d, client })),
      ...docs.filter((d) => d.client_id === client.id && d.kind === "invoice").map((d) => ({ type: "invoice", id: d.id, doc: d, client })),
    ];
    let R = 1;
    while (1 + 3 * R * (R + 1) < members.length + 2) R++;   // room for every member plus one spare
    const center = candidates.find((h) => dist(h, ORIGIN) >= R + 1 && disc(h, R).every((x) => !occupied.has(key(x))));
    const fam = { client, center, R };
    put(center, { type: "client", id: client.id, client, fam });
    const slots = disc(center, R).slice(1);
    members.forEach((m, i) => put(slots[i], { ...m, fam }));
    slots.slice(members.length).forEach((h, i) => put(h, { type: "family", id: `fam-${client.id}-${i}`, client, fam }));
    families.push(fam);
  }

  const grow = new Map();
  for (const cell of [...cells]) {
    for (const [dq, dr] of DIRS) {
      const h = { q: cell.q + dq, r: cell.r + dr };
      if (!occupied.has(key(h)) && !grow.has(key(h))) grow.set(key(h), h);
    }
  }
  for (const h of grow.values()) {
    const cell = { type: "grow", id: `grow-${key(h)}`, nearQueen: dist(h, ORIGIN) === 1 };
    Object.assign(cell, h, toPx(h));
    cells.push(cell);
  }
  return { cells, families };
}

// ---------- Money → honey ----------
function enrich(cells, docs, projects) {
  const today = todayISO();
  const invoices = docs.filter((d) => d.kind === "invoice");
  for (const c of cells) {
    if (c.type === "client") {
      const mine = invoices.filter((d) => d.client_id === c.id);
      const paid = sum(mine.filter((d) => d.status === "paid"));
      const waiting = sum(mine.filter((d) => d.status === "unpaid"));
      c.paid = paid; c.waiting = waiting;
      c.honey = paid + waiting ? paid / (paid + waiting) : 0;
      c.overdue = mine.some((d) => d.status === "unpaid" && d.due_date && d.due_date < today);
      c.count = projects.filter((p) => p.client_id === c.id).length;
    } else if (c.type === "project") {
      const paid = sum(invoices.filter((d) => d.project_id === c.id && d.status === "paid"));
      const value = Number(c.project.value) || 0;
      c.paid = paid;
      c.honey = value ? Math.min(1, paid / value) : paid ? 1 : 0;
      c.sealed = ["delivered", "closed"].includes(c.project.status);
    } else if (c.type === "invoice") {
      c.state = effectiveStatus(c.doc);
      c.honey = c.state === "paid" ? 1 : 0.28;
    } else if (c.type === "quote") {
      c.state = c.doc.status;
      c.honey = c.state === "accepted" ? 0.62 : 0;
    }
  }
}
const sum = (arr) => arr.reduce((s, d) => s + Number(d.total || 0), 0);
const short = (n) => {
  n = Number(n) || 0;
  if (n >= 1e7) return "₹" + +(n / 1e7).toFixed(1) + "Cr";
  if (n >= 1e5) return "₹" + +(n / 1e5).toFixed(1) + "L";
  if (n >= 1e3) return "₹" + +(n / 1e3).toFixed(n % 1000 ? 1 : 0) + "k";
  return "₹" + n;
};
const docNo = (n) => String(n || "").replace(/^.*-(\d+)$/, "#$1");

// ---------- Cell markup ----------
function cellHTML(c, i) {
  let cls = `cell cell--${c.type}`, tag = "", title = "", sub = "", label = "";
  switch (c.type) {
    case "queen":
      title = "TheVincis"; tag = "Queen";
      label = "TheVincis, the queen cell. Open hive summary";
      break;
    case "client":
      tag = "Family"; title = c.client.name;
      sub = c.waiting ? `${short(c.waiting)} filling` : c.paid ? `${short(c.paid)} in` : `${c.count} project${c.count === 1 ? "" : "s"}`;
      if (c.overdue) cls += " is-overdue";
      label = `Client ${c.client.name}. ${money(c.paid)} paid, ${money(c.waiting)} waiting`;
      break;
    case "project":
      tag = STATUS_LABEL[c.project.status]; title = c.project.title; sub = short(c.project.value);
      if (c.sealed) cls += " is-sealed";
      label = `Project ${c.project.title} for ${c.client.name}, ${STATUS_LABEL[c.project.status]}, ${Math.round(c.honey * 100)}% paid`;
      break;
    case "quote":
      tag = "Quote"; title = docNo(c.doc.number); sub = short(c.doc.total);
      cls += ` is-${c.state}`;
      label = `Quotation ${c.doc.number}, ${money(c.doc.total)}, ${STATUS_LABEL[c.state]}`;
      break;
    case "invoice":
      tag = "Invoice"; title = docNo(c.doc.number); sub = short(c.doc.total);
      cls += ` is-${c.state}`;
      label = `Invoice ${c.doc.number}, ${money(c.doc.total)}, ${STATUS_LABEL[c.state]}`;
      break;
    case "family":
      title = "+"; label = `Add to the ${c.client.name} family`;
      break;
    case "grow":
      title = "+"; sub = c.nearQueen ? "New family" : "";
      if (c.nearQueen) cls += " is-near";
      label = "Start a new client family";
      break;
  }
  const honey = c.honey ? `<span class="cell__honey" style="--h:${c.honey.toFixed(3)}"></span>` : "";
  const queen = c.type === "queen" ? `<img class="cell__bee" src="${BEE}" alt="">` : "";
  return `
    <button class="${cls}" data-i="${i}" style="--x:${c.x.toFixed(1)}px;--y:${c.y.toFixed(1)}px" aria-label="${esc(label)}">
      <span class="cell__rim"><span class="cell__core">
        ${honey}
        <span class="cell__label">
          ${queen}
          ${tag ? `<small>${esc(tag)}</small>` : ""}
          <b>${esc(title)}</b>
          ${sub ? `<em>${esc(sub)}</em>` : ""}
        </span>
      </span></span>
    </button>`;
}

// ---------- Copy (playful, premium) ----------
function greeting() {
  const h = new Date().getHours();
  return h < 5 ? "Burning the midnight wax." : h < 12 ? "Good morning, keeper." : h < 17 ? "The hive is humming." : "Good evening, keeper.";
}
function leoLine(stats) {
  if (!stats.families) return "An empty hive. Tap the glowing cell beside the queen to welcome your first family.";
  if (stats.overdueCount) return `${stats.overdueCount} cell${stats.overdueCount === 1 ? " is" : "s are"} past due. Leo's buzzing about ${stats.overdueCount === 1 ? "it" : "them"}.`;
  if (stats.waitingCount) return `${stats.waitingCount} cell${stats.waitingCount === 1 ? "" : "s"} waiting for honey. Sweet things take time.`;
  return "Every cell is full. A very sweet hive.";
}

// ======================================================================
// View
// ======================================================================
export async function hive(el, params, ctx) {
  const { sb } = ctx;
  let data = await load(sb);
  const view = { px: 0, py: 0, z: 1, tx: REDUCED ? 0 : TILT, ty: 0, mode3d: !REDUCED };
  let model, selected = null, dragged = false;

  el.innerHTML = `
    <header class="page-head hive-head">
      <div>
        <p class="eyebrow">The hive</p>
        <h1>${greeting()}</h1>
        <p class="muted" id="leo-line"></p>
      </div>
      <div class="actions">
        <div class="segmented" role="group" aria-label="View">
          <button class="chip ${view.mode3d ? "is-on" : ""}" data-mode="3d">3D</button>
          <button class="chip ${view.mode3d ? "" : "is-on"}" data-mode="flat">Flat</button>
        </div>
      </div>
    </header>
    <section class="honey-stats" id="stats"></section>
    <div class="hive-wrap">
    <div class="hive" id="hive" tabindex="-1">
      <div class="hive__stage" id="stage"></div>
      <img class="hive__leo" id="leo" src="${BEE}" alt="" aria-hidden="true">
      <div class="hive__tools">
        <button class="icon-btn" data-zoom="1" aria-label="Zoom in">＋</button>
        <button class="icon-btn" data-zoom="-1" aria-label="Zoom out">－</button>
        <button class="icon-btn" data-fit aria-label="Fit the whole hive">⤢</button>
      </div>
      <ul class="hive__legend" aria-hidden="true">
        <li><i class="lg lg--honey"></i>Honey: paid</li>
        <li><i class="lg lg--filling"></i>Filling: waiting</li>
        <li><i class="lg lg--wax"></i>Sealed: delivered</li>
        <li><i class="lg lg--due"></i>Past due</li>
      </ul>
    </div>
    <aside class="hive__panel" id="panel" aria-live="polite"></aside>
    </div>`;

  const hiveEl = $("#hive", el), stage = $("#stage", el), panel = $("#panel", el), leo = $("#leo", el);

  // ---------- Render ----------
  function render() {
    model = layout(data.clients, data.projects, data.docs);
    enrich(model.cells, data.docs, data.projects);
    stage.innerHTML =
      model.cells.map(cellHTML).join("") +
      model.families.map((f) => {
        const top = toPx({ q: f.center.q, r: f.center.r - f.R });
        const c = toPx(f.center);
        return `<span class="hive__tag" style="--x:${((c.x + top.x) / 2).toFixed(1)}px;--y:${(top.y - SIZE - 14).toFixed(1)}px">${esc(f.client.name)}</span>`;
      }).join("");
    renderStats();
  }

  function renderStats() {
    const month = todayISO().slice(0, 7);
    const inv = data.docs.filter((d) => d.kind === "invoice");
    const unpaid = inv.filter((d) => d.status === "unpaid");
    const overdue = unpaid.filter((d) => effectiveStatus(d) === "overdue");
    const paidMonth = inv.filter((d) => d.status === "paid" && (d.paid_on || "").startsWith(month));
    const openQ = data.docs.filter((d) => d.kind === "quote" && ["draft", "sent"].includes(d.status));
    $("#stats", el).innerHTML = `
      <a class="hstat" href="#/invoices?status=paid"><i></i><b>${money(sum(paidMonth))}</b><span>honey this month</span></a>
      <a class="hstat" href="#/invoices?status=unpaid"><i class="is-filling"></i><b>${money(sum(unpaid))}</b><span>still filling</span></a>
      <a class="hstat ${overdue.length ? "is-alert" : ""}" href="#/invoices?status=overdue"><i class="is-due"></i><b>${overdue.length}</b><span>past due</span></a>
      <a class="hstat" href="#/quotes"><i class="is-quote"></i><b>${openQ.length}</b><span>quotes out</span></a>`;
    $("#leo-line", el).textContent = leoLine({
      families: data.clients.length, overdueCount: overdue.length, waitingCount: unpaid.length,
    });
  }

  // ---------- Camera ----------
  function apply(glide = false) {
    stage.classList.toggle("is-gliding", glide);
    const w = hiveEl.clientWidth, h = hiveEl.clientHeight;
    stage.style.transform =
      `translate(${w / 2}px, ${h / 2}px) rotateX(${view.tx}deg) rotateY(${view.ty}deg) scale(${view.z}) translate(${view.px}px, ${view.py}px)`;
  }
  function fit(glide = false) {
    const real = model.cells.filter((c) => c.type !== "grow");
    const xs = real.map((c) => c.x), ys = real.map((c) => c.y);
    const minX = Math.min(...xs) - SIZE * 1.2, maxX = Math.max(...xs) + SIZE * 1.2;
    const minY = Math.min(...ys) - SIZE * 1.4, maxY = Math.max(...ys) + SIZE * 1.4;
    const w = hiveEl.clientWidth, h = hiveEl.clientHeight;
    // Phones keep cells readable and let you drag to explore; wide screens show the whole comb.
    view.z = clamp(Math.min(w / (maxX - minX), (h * 1.1) / (maxY - minY)), w < 600 ? 0.66 : 0.35, 1.15);
    view.px = -(minX + maxX) / 2;
    view.py = -(minY + maxY) / 2;
    apply(glide);
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const cosT = () => Math.cos((view.tx * Math.PI) / 180) || 1;

  function zoomBy(factor, cx, cy) {
    const rect = hiveEl.getBoundingClientRect();
    const mx = (cx ?? rect.left + rect.width / 2) - rect.left - rect.width / 2;
    const my = ((cy ?? rect.top + rect.height / 2) - rect.top - rect.height / 2) / cosT();
    const wx = mx / view.z - view.px, wy = my / view.z - view.py;
    view.z = clamp(view.z * factor, 0.3, 2.4);
    view.px = mx / view.z - wx;
    view.py = my / view.z - wy;
    apply();
  }

  // ---------- Pan, pinch, wheel, parallax ----------
  const pointers = new Map();
  let start = null;
  hiveEl.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".hive__panel, .hive__tools")) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    start = { x: e.clientX, y: e.clientY, px: view.px, py: view.py, z: view.z, d: pinchDist() };
    dragged = false;
  });
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
  function pinchDist() {
    const p = [...pointers.values()];
    return p.length < 2 ? 0 : Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
  }
  function onMove(e) {
    if (pointers.has(e.pointerId)) {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2 && start.d) {
        view.z = clamp(start.z * (pinchDist() / start.d), 0.3, 2.4);
        dragged = true;
        apply();
        return;
      }
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (!dragged && Math.hypot(dx, dy) < 5) return;
      dragged = true;
      hiveEl.classList.add("is-dragging");
      view.px = start.px + dx / view.z;
      view.py = start.py + dy / (view.z * cosT());
      apply();
    } else if (view.mode3d && !REDUCED && e.pointerType === "mouse" && hiveEl.matches(":hover")) {
      const r = hiveEl.getBoundingClientRect();
      view.ty = ((e.clientX - r.left) / r.width - 0.5) * 7;
      view.tx = TILT - ((e.clientY - r.top) / r.height - 0.5) * 7;
      apply();
    }
  }
  function onUp(e) {
    pointers.delete(e.pointerId);
    if (!pointers.size) hiveEl.classList.remove("is-dragging");
    if (pointers.size === 1) {
      const [p] = pointers.values();
      start = { x: p.x, y: p.y, px: view.px, py: view.py, z: view.z, d: 0 };
    }
  }
  hiveEl.addEventListener("wheel", (e) => {
    e.preventDefault();
    zoomBy(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY);
  }, { passive: false });

  $$("[data-zoom]", el).forEach((b) => b.addEventListener("click", () => zoomBy(b.dataset.zoom > 0 ? 1.25 : 0.8)));
  $("[data-fit]", el).addEventListener("click", () => { closePanel(); fit(true); });
  $$("[data-mode]", el).forEach((b) => b.addEventListener("click", () => {
    view.mode3d = b.dataset.mode === "3d";
    view.tx = view.mode3d ? TILT : 0;
    view.ty = 0;
    hiveEl.classList.toggle("is-flat", !view.mode3d);
    $$("[data-mode]", el).forEach((x) => x.classList.toggle("is-on", x === b));
    apply(true);
  }));
  hiveEl.classList.toggle("is-flat", !view.mode3d);

  // ---------- Leo the bee ----------
  let leoTimer = null;
  function flyTo(cellEl, then) {
    if (!cellEl) return;
    const hr = hiveEl.getBoundingClientRect(), cr = cellEl.getBoundingClientRect();
    const x = cr.left - hr.left + cr.width * 0.62, y = cr.top - hr.top + cr.height * 0.08;
    const fromX = parseFloat(leo.style.left) || 0;
    leo.classList.toggle("is-left", x < fromX);
    leo.style.left = `${x}px`;
    leo.style.top = `${y}px`;
    if (then) setTimeout(then, REDUCED ? 0 : 1100);
  }
  function wander() {
    clearTimeout(leoTimer);
    if (REDUCED) return;
    leoTimer = setTimeout(() => {
      if (!document.body.contains(hiveEl)) return;
      if (!selected) {
        const real = $$(".cell:not(.cell--grow):not(.cell--family)", stage);
        flyTo(real[Math.floor(Math.random() * real.length)]);
      }
      wander();
    }, 6500 + Math.random() * 4000);
  }
  function celebrate(cellEl) {
    flyTo(cellEl, () => {
      leo.classList.add("is-happy");
      setTimeout(() => leo.classList.remove("is-happy"), 1200);
      const hr = hiveEl.getBoundingClientRect(), cr = cellEl.getBoundingClientRect();
      for (let i = 0; i < 14; i++) {
        const s = document.createElement("i");
        s.className = "spark";
        const a = (Math.PI * 2 * i) / 14 + Math.random() * 0.4;
        const d = 50 + Math.random() * 70;
        s.style.cssText = `left:${cr.left - hr.left + cr.width / 2}px;top:${cr.top - hr.top + cr.height / 2}px;--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d - 30}px;--r:${Math.random() * 360}deg`;
        hiveEl.appendChild(s);
        setTimeout(() => s.remove(), 1300);
      }
    });
  }

  // ---------- Cells → panel ----------
  stage.addEventListener("click", (e) => {
    const btn = e.target.closest(".cell");
    if (!btn || (dragged && e.detail !== 0)) return;   // detail 0 = keyboard
    open(model.cells[btn.dataset.i], btn);
  });

  function focusOn(c) {
    const panelW = window.innerWidth > 820 ? 380 : 0;
    view.z = Math.max(view.z, 1.05);
    // Keep the cell clear of the panel: left of it on desktop, above the sheet on phones.
    view.px = -c.x - panelW / 2 / view.z;
    view.py = -c.y - (window.innerWidth > 820 ? 0 : hiveEl.clientHeight * 0.22 / view.z);
    apply(true);
  }

  function open(c, btn) {
    selected = c;
    $$(".cell.is-selected", stage).forEach((x) => x.classList.remove("is-selected"));
    btn?.classList.add("is-selected");
    focusOn(c);
    if (btn) setTimeout(() => flyTo(btn), REDUCED ? 0 : 450);
    panel.innerHTML = `<button class="icon-btn hive__close" aria-label="Close">✕</button>${panelHTML(c)}`;
    hiveEl.classList.add("has-panel");
    $(".hive__close", panel).addEventListener("click", closePanel);
    bindPanel(c, btn);
  }
  function closePanel() {
    selected = null;
    hiveEl.classList.remove("has-panel");
    $$(".cell.is-selected", stage).forEach((x) => x.classList.remove("is-selected"));
  }
  document.addEventListener("keydown", function esc_(e) {
    if (!document.body.contains(hiveEl)) return document.removeEventListener("keydown", esc_);
    if (e.key === "Escape" && selected) closePanel();
  });

  function panelHTML(c) {
    const head = (tag, title, extra = "") => `<p class="hp__tag">${tag}</p><h2 class="hp__title">${esc(title)}</h2>${extra}`;
    const row = (k, v) => (v || v === 0 ? `<div><dt>${k}</dt><dd>${v}</dd></div>` : "");
    const meter = (h) => `<div class="hp__meter" style="--h:${h}"><span></span></div><p class="hp__pct">${Math.round(h * 100)}% honey</p>`;
    const q = (p) => new URLSearchParams(p).toString();
    switch (c.type) {
      case "queen": {
        const inv = data.docs.filter((d) => d.kind === "invoice");
        return head("Queen cell", "TheVincis") + `
          <dl class="hp__list">
            ${row("Families", data.clients.length)}
            ${row("Projects", data.projects.length)}
            ${row("Honey collected", money(sum(inv.filter((d) => d.status === "paid"))))}
            ${row("Still filling", money(sum(inv.filter((d) => d.status === "unpaid"))))}
          </dl>
          <div class="hp__actions">
            <a class="btn btn--gold" href="#/doc/new/quote">New quotation</a>
            <a class="btn btn--ghost" href="#/settings">Settings</a>
          </div>`;
      }
      case "client": {
        const k = c.client;
        return head("Family", k.name, k.company && k.company !== k.name ? `<p class="muted">${esc(k.company)}</p>` : "") + `
          ${meter(c.honey)}
          <dl class="hp__list">
            ${row("Paid", money(c.paid))}
            ${row("Waiting", c.waiting ? money(c.waiting) : "")}
            ${row("Projects", c.count)}
            ${row("Phone", esc(k.phone))}
            ${row("City", esc([k.city, k.state].filter(Boolean).join(", ")))}
          </dl>
          <div class="hp__actions">
            <button class="btn btn--gold" data-act="new-project">New project</button>
            <a class="btn btn--ghost" href="#/doc/new/quote?${q({ client: k.id })}">New quotation</a>
            <a class="btn btn--ghost" href="#/doc/new/invoice?${q({ client: k.id })}">New invoice</a>
            <button class="btn btn--ghost" data-act="edit-client">Edit details</button>
            <a class="btn btn--plain" href="#/clients/${k.id}">Open family page ›</a>
          </div>`;
      }
      case "project": {
        const p = c.project;
        return head(`${esc(c.client.name)} · project`, p.title) + `
          ${meter(c.honey)}
          <dl class="hp__list">
            ${row("Value", money(p.value))}
            ${row("Paid", money(c.paid))}
            ${row("Type", esc(p.type))}
            ${row("Due", p.due_date ? fmtDate(p.due_date) : "")}
          </dl>
          <p class="hp__label">Stage</p>
          <div class="segmented hp__stages" role="group" aria-label="Project stage">
            ${["lead", "quoted", "active", "delivered", "closed"].map((s) => `<button class="chip ${p.status === s ? "is-on" : ""}" data-stage="${s}">${STATUS_LABEL[s]}</button>`).join("")}
          </div>
          <div class="hp__actions">
            <a class="btn btn--gold" href="#/doc/new/invoice?${q({ client: c.client.id, project: p.id })}">New invoice</a>
            <a class="btn btn--ghost" href="#/doc/new/quote?${q({ client: c.client.id, project: p.id })}">New quotation</a>
            <button class="btn btn--ghost" data-act="edit-project">Edit project</button>
          </div>`;
      }
      case "quote":
      case "invoice": {
        const d = c.doc, isInv = c.type === "invoice";
        return head(`${esc(c.client.name)} · ${isInv ? "invoice" : "quotation"}`, d.number, `<p class="hp__state">${STATUS_LABEL[c.state]}</p>`) + `
          <p class="hp__amount">${money(d.total)}</p>
          <dl class="hp__list">
            ${row(isInv ? "Issued" : "Date", fmtDate(d.issue_date))}
            ${row(isInv ? "Due by" : "Valid until", d.due_date ? fmtDate(d.due_date) : "")}
            ${isInv && d.paid_on ? row("Paid on", fmtDate(d.paid_on)) : ""}
          </dl>
          <div class="hp__actions">
            ${isInv && d.status === "unpaid" ? `<button class="btn btn--gold" data-act="paid">Mark paid</button>` : ""}
            ${isInv && d.status === "paid" ? `<button class="btn btn--ghost" data-act="unpaid">Mark unpaid</button>` : ""}
            <a class="btn ${isInv && d.status === "unpaid" ? "btn--ghost" : "btn--gold"}" href="#/doc/${d.id}">Open ${isInv ? "invoice" : "quotation"}</a>
            <button class="btn btn--ghost" data-act="pdf">Download PDF</button>
          </div>`;
      }
      case "family": {
        const k = c.client;
        return head("Empty cell", `Grow the ${k.name} family`) + `
          <p class="muted">Fill this cell with something new for ${esc(k.name)}.</p>
          <div class="hp__actions">
            <button class="btn btn--gold" data-act="new-project">New project</button>
            <a class="btn btn--ghost" href="#/doc/new/quote?${q({ client: k.id })}">New quotation</a>
            <a class="btn btn--ghost" href="#/doc/new/invoice?${q({ client: k.id })}">New invoice</a>
          </div>`;
      }
      case "grow":
        return head("Empty cell", "Start a new family") + `
          <p class="muted">Every client gets their own corner of the hive. Their projects, quotes and invoices grow around them.</p>
          <div class="hp__actions"><button class="btn btn--gold" data-act="new-client">Add a client</button></div>`;
    }
    return "";
  }

  function bindPanel(c, btn) {
    const act = (name, fn) => $(`[data-act="${name}"]`, panel)?.addEventListener("click", fn);
    act("new-client", () => openClientModal(sb, null, async (client) => {
      await refresh(client.id, true);
      toast(`Welcome to the hive, ${client.name}`);
    }));
    act("edit-client", () => openClientModal(sb, c.client, () => refresh(c.id)));
    act("new-project", () => openProjectModal(sb, null, () => refresh(c.client.id), c.client.id));
    act("edit-project", () => openProjectModal(sb, c.project, () => refresh(c.id)));
    act("paid", () => setPaid(c, true));
    act("unpaid", () => setPaid(c, false));
    act("pdf", async (e) => {
      const b = e.currentTarget;
      b.disabled = true;
      try {
        const { data: full, error } = await sb.from("documents").select("*").eq("id", c.id).single();
        if (error) throw error;
        await downloadPdf(full, ctx.settings);
      } catch (err) {
        toast(err.message || "PDF failed", "err");
      } finally {
        b.disabled = false;
      }
    });
    $$("[data-stage]", panel).forEach((b) => b.addEventListener("click", async () => {
      const { error } = await sb.from("projects").update({ status: b.dataset.stage }).eq("id", c.id);
      if (error) return toast(error.message, "err");
      toast(b.dataset.stage === "delivered" ? "Delivered. That cell is sealed with wax." : `Moved to ${STATUS_LABEL[b.dataset.stage]}`);
      await refresh(c.id);
    }));
  }

  async function setPaid(c, paid) {
    const { error } = await sb.from("documents")
      .update({ status: paid ? "paid" : "unpaid", paid_on: paid ? todayISO() : null }).eq("id", c.id);
    if (error) return toast(error.message, "err");
    await refresh(c.id);
    if (paid) {
      toast(`Sweet. ${money(c.doc.total)} just landed in the hive.`);
      celebrate($(`.cell[data-i="${model.cells.findIndex((x) => x.id === c.id)}"]`, stage));
    } else {
      toast("Marked unpaid");
    }
  }

  // Reload data, keep the camera, reopen the same cell if it still exists.
  async function refresh(focusId, cheer = false) {
    data = await load(sb);
    render();
    apply();
    const i = model.cells.findIndex((x) => x.id === focusId);
    if (i >= 0) {
      const btn = $(`.cell[data-i="${i}"]`, stage);
      open(model.cells[i], btn);
      if (cheer) celebrate(btn);
    } else {
      closePanel();
    }
  }

  // ---------- Go ----------
  render();
  fit();
  requestAnimationFrame(() => {
    const queenBtn = $(".cell--queen", stage);
    flyTo(queenBtn);
    wander();
  });
  const ro = new ResizeObserver(() => apply());
  ro.observe(hiveEl);
  window.addEventListener("hashchange", function cleanup() {
    clearTimeout(leoTimer);
    ro.disconnect();
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    window.removeEventListener("hashchange", cleanup);
  });
}

async function load(sb) {
  const [c, p, d] = await Promise.all([
    sb.from("clients").select("*").order("created_at"),
    sb.from("projects").select("*").order("created_at"),
    sb.from("documents").select("id,kind,number,status,total,client_id,project_id,issue_date,due_date,paid_on,bill_to").order("issue_date"),
  ]);
  const err = c.error || p.error || d.error;
  if (err) throw err;
  return { clients: c.data, projects: p.data, docs: d.data };
}
