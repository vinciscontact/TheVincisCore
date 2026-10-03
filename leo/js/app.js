// Leo — boot, authentication (password + TOTP), idle sign-out, shell and router.
import { SUPABASE_URL, SUPABASE_KEY, IDLE_MINUTES } from "./config.js";
import { $, $$, esc, toast } from "./ui.js";
import * as views from "./views.js";
import { docEditor } from "./doc.js";

const app = $("#app");
const BEE = "../images/brand/bee-128.webp";
let sb = null;
const ctx = { sb: null, settings: null, go: (hash) => (location.hash = hash) };

// ---------- Boot ----------
if (!SUPABASE_URL || !SUPABASE_KEY) {
  renderAuthCard(`
    <h1>Leo isn't connected yet</h1>
    <p class="muted">Add the Supabase project URL and publishable key to <code>leo/js/config.js</code>, then reload.</p>`);
} else {
  sb = ctx.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: "leo-auth" },
  });
  sb.auth.onAuthStateChange((event) => { if (event === "SIGNED_OUT") gate(); });
  gate();
}

async function gate() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return renderLogin();
  const { data: aal, error } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) return renderLogin(error.message);
  if (aal.currentLevel === "aal2") return startApp();
  if (aal.nextLevel === "aal2") return renderMfaVerify();
  return renderMfaEnroll();
}

// ---------- Auth screens ----------
function renderAuthCard(inner) {
  app.className = "auth";
  app.innerHTML = `
    <main class="auth__card">
      <img class="auth__bee" src="${BEE}" alt="" width="128" height="118">
      <p class="auth__word">Leo</p>
      ${inner}
    </main>`;
}

function renderLogin(message = "") {
  renderAuthCard(`
    <form class="auth__form" id="login" autocomplete="on">
      <label class="field"><span class="field__label">Email</span>
        <input name="email" type="email" autocomplete="username" required></label>
      <label class="field"><span class="field__label">Password</span>
        <input name="password" type="password" autocomplete="current-password" required></label>
      <p class="auth__error" role="alert">${esc(message)}</p>
      <button class="btn btn--gold btn--block" type="submit">Enter</button>
    </form>`);
  $("#login").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target, btn = $("button", f);
    btn.disabled = true;
    const { error } = await sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value });
    btn.disabled = false;
    if (error) {
      // Deliberately vague: don't reveal whether the email exists.
      $(".auth__error", f).textContent = error.status === 429 ? "Too many attempts. Wait a few minutes." : "Those details didn't work.";
      f.password.value = "";
      return;
    }
    gate();
  });
}

function codeForm(button) {
  return `
    <form class="auth__form" id="code">
      <label class="field"><span class="field__label">6-digit code from your authenticator app</span>
        <input name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code" required class="code-input"></label>
      <p class="auth__error" role="alert"></p>
      <button class="btn btn--gold btn--block" type="submit">${button}</button>
      <button class="btn btn--ghost btn--block" type="button" id="signout">Use a different account</button>
    </form>`;
}

function bindCode(factorId) {
  $("#signout").addEventListener("click", () => sb.auth.signOut());
  const f = $("#code");
  f.code.focus();
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("button[type=submit]", f);
    btn.disabled = true;
    const { error } = await sb.auth.mfa.challengeAndVerify({ factorId, code: f.code.value.trim() });
    btn.disabled = false;
    if (error) {
      $(".auth__error", f).textContent = "That code didn't match. Codes refresh every 30 seconds.";
      f.code.value = "";
      return;
    }
    gate();
  });
}

async function renderMfaVerify() {
  const { data } = await sb.auth.mfa.listFactors();
  const factor = data?.totp?.[0];
  if (!factor) return renderMfaEnroll();
  renderAuthCard(`<p class="muted">Two-step check</p>${codeForm("Verify")}`);
  bindCode(factor.id);
}

async function renderMfaEnroll() {
  // Clear any half-finished enrolment before starting a new one.
  const { data: list } = await sb.auth.mfa.listFactors();
  for (const f of list?.all || []) {
    if (f.status === "unverified") await sb.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: "Leo" });
  if (error) return renderLogin(error.message);
  renderAuthCard(`
    <h1>Secure Leo</h1>
    <p class="muted">Scan this with Google Authenticator, Microsoft Authenticator or 1Password. You'll need a code from it every time you sign in.</p>
    <img class="auth__qr" src="${data.totp.qr_code}" alt="Authenticator QR code">
    <details class="auth__secret"><summary>Can't scan? Enter this key</summary><code>${esc(data.totp.secret)}</code></details>
    ${codeForm("Turn on two-step sign-in")}`);
  bindCode(data.id);
}

// ---------- Idle sign-out ----------
let idleTimer;
function armIdle() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(async () => {
    await sb.auth.signOut();
    toast("Signed out after inactivity.", "warn");
  }, IDLE_MINUTES * 60 * 1000);
}

// ---------- App shell ----------
// SF Symbols–style line icons (24px grid, inherit currentColor)
const ICON_PATHS = {
  home: '<path d="M3.5 10.2 12 3.5l8.5 6.7V19a1.5 1.5 0 0 1-1.5 1.5h-4.5v-6h-5v6H5A1.5 1.5 0 0 1 3.5 19z"/>',
  clients: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="17" cy="9" r="2.5"/><path d="M16.5 14.1c2.9.3 5 2.4 5 5.4"/>',
  projects: '<path d="M3 7.5A2 2 0 0 1 5 5.5h4l2 2h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  quotes: '<path d="M6.5 3h7.5l4.5 4.5V20a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v4.5h4.5M8.5 12.5h7M8.5 16.5h7"/>',
  invoices: '<path d="M5.5 3h13v18l-2.6-1.8-2.6 1.8-2.3-1.8-2.3 1.8-2.6-1.8L5.5 21z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  services: '<rect x="4" y="4" width="7" height="7" rx="1.8"/><rect x="13" y="4" width="7" height="7" rx="1.8"/><rect x="4" y="13" width="7" height="7" rx="1.8"/><rect x="13" y="13" width="7" height="7" rx="1.8"/>',
  settings: '<path d="M4 6.5h9M17 6.5h3M4 12h3M11 12h9M4 17.5h11M19 17.5h1"/><circle cx="15" cy="6.5" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="17.5" r="2"/>',
  signout: '<path d="M14.5 4H18a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3.5M10 8l-4 4 4 4M6 12h10"/>',
};
const icon = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name]}</svg>`;

const NAV = [
  ["#/", "Dashboard", "home", "Home"],
  ["#/clients", "Clients", "clients", "Clients"],
  ["#/projects", "Projects", "projects", "Projects"],
  ["#/quotes", "Quotations", "quotes", "Quotes"],
  ["#/invoices", "Invoices", "invoices", "Invoices"],
  ["#/services", "Services", "services"],
  ["#/settings", "Settings", "settings"],
];

let started = false;
async function startApp() {
  const { data: settings, error } = await sb.from("settings").select("*").eq("id", 1).maybeSingle();
  if (error || !settings) {
    renderAuthCard(`
      <h1>Not authorised</h1>
      <p class="muted">This account isn't on Leo's admin list.</p>
      <button class="btn btn--ghost btn--block" id="out">Sign out</button>`);
    $("#out").addEventListener("click", () => sb.auth.signOut());
    return;
  }
  ctx.settings = settings;
  ctx.refreshSettings = async () => {
    const { data } = await sb.from("settings").select("*").eq("id", 1).single();
    if (data) ctx.settings = data;
  };

  app.className = "shell";
  app.innerHTML = `
    <aside class="side">
      <a class="side__brand" href="#/"><img src="${BEE}" alt="" width="128" height="118"><span>Leo</span></a>
      <button class="side__toggle icon-btn" aria-label="Menu" aria-expanded="false">•••</button>
      <nav class="side__nav">
        ${NAV.map(([h, l, ic]) => `<a href="${h}">${icon(ic)}<span>${l}</span></a>`).join("")}
        <button class="side__out" id="signout">${icon("signout")}<span>Sign out</span></button>
      </nav>
    </aside>
    <main class="main" id="view" tabindex="-1"></main>
    <nav class="tabbar" aria-label="Sections">
      ${NAV.filter((n) => n[3]).map(([h, , ic, short]) => `<a href="${h}">${icon(ic)}<span>${short}</span></a>`).join("")}
    </nav>`;
  $("#signout").addEventListener("click", () => sb.auth.signOut());
  const toggle = $(".side__toggle");
  toggle.addEventListener("click", () => {
    const open = app.classList.toggle("nav-open");
    toggle.setAttribute("aria-expanded", String(open));
  });

  if (!started) {
    started = true;
    window.addEventListener("hashchange", route);
    ["pointerdown", "keydown", "scroll"].forEach((ev) => window.addEventListener(ev, armIdle, { passive: true }));
  }
  armIdle();
  route();
}

// ---------- Router ----------
const ROUTES = [
  [/^#\/?$/, () => views.dashboard],
  [/^#\/clients$/, () => views.clients],
  [/^#\/clients\/([\w-]+)$/, () => views.clientDetail],
  [/^#\/projects$/, () => views.projects],
  [/^#\/quotes$/, () => views.docList("quote")],
  [/^#\/invoices$/, () => views.docList("invoice")],
  [/^#\/doc\/new\/(quote|invoice)$/, () => docEditor],
  [/^#\/doc\/([\w-]+)$/, () => docEditor],
  [/^#\/services$/, () => views.services],
  [/^#\/settings$/, () => views.settings],
];

async function route() {
  if (!app.classList.contains("shell")) return;
  const view = $("#view");
  const [hash, query = ""] = (location.hash || "#/").split("?");
  const params = Object.fromEntries(new URLSearchParams(query));
  let match = null, viewFn = views.notFound;
  for (const [re, get] of ROUTES) {
    match = hash.match(re);
    if (match) { viewFn = get(); break; }
  }
  const section = "#/" + (hash.split("/")[1] || "");
  $$(".side__nav a, .tabbar a").forEach((a) => {
    const target = a.getAttribute("href");
    const docSection = hash.startsWith("#/doc") && ((params.kind || match?.[1]) === "invoice" ? "#/invoices" : "#/quotes");
    a.classList.toggle("is-active", target === section || target === docSection);
  });
  app.classList.remove("nav-open");
  view.innerHTML = `<div class="loading"><img src="${BEE}" alt=""></div>`;
  try {
    await viewFn(view, { ...params, id: match?.[1] }, ctx);
  } catch (err) {
    console.error(err);
    view.innerHTML = `<div class="empty"><h2>Something went wrong</h2><p class="muted">${esc(err.message || err)}</p></div>`;
  }
  view.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}
