/* ==========================================================================
   Vinci — TheVincis site concierge
   Scripted brain + optional LLM fallback · contextual & warm psychology
   No dependencies — runs standalone alongside GSAP/Lenis.
   ========================================================================== */
(() => {
  "use strict";

  /* ============ Config ============ */
  const CFG = {
    waNumber: "919159176884",                 // WhatsApp, country code first, digits only
    email: "vincis.contact@gmail.com",
    web3formsKey: "",                         // optional: web3forms.com access key → leads land in inbox silently
    llmEndpoint: "",                          // optional: serverless URL → POST {message, history} → {reply}
    nudgeAfterMs: 22000,                      // one contextual nudge, then silence
    exitAfterMs: 15000,                       // exit-intent armed only after real time on page
  };

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ss = {
    get: (k) => sessionStorage.getItem("vinci." + k),
    set: (k, v) => sessionStorage.setItem("vinci." + k, v),
  };

  const state = {
    open: false,
    started: false,
    awaiting: null,        // null | 'name' | 'phone' | free text
    node: null,
    context: "hero",       // section currently in view
    lead: { name: "", phone: "", interest: "" },
    history: [],           // for the LLM fallback
  };

  /* ============ Contextual psychology copy (relevance = attention) ============ */
  const CONTEXT = {
    hero:       { nudge: "Most agencies quote before asking three questions. I ask the questions first." },
    services:   { nudge: "Six disciplines is a lot of menu. Tell me your problem — I'll point at the right one.",
                  opener: "I noticed you reading the services. Let's find yours." },
    collective: { nudge: "Design, security, engineering — ask me how the three hands work together.",
                  opener: "The Collective page — good eye. Two allies, one standard." },
    product:    { nudge: "Run a restaurant or café? Ask me what TableServe changes on a busy night.",
                  opener: "TableServe caught your eye? Good taste — it's our flagship." },
    founder:    { nudge: "Want to talk to Sathya directly? Thirty seconds and I'll set it up.",
                  opener: "That's Sathya — the engineer behind all of this." },
    faq:        { nudge: "A question the FAQ didn't cover? That's my favourite kind." },
    contact:    { nudge: "Forms feel like paperwork. WhatsApp is one tap — your pick.",
                  opener: "One step from a conversation. I can make it even shorter." },
    /* sub-pages */
    iyra:       { nudge: "Curious about Iyra? Ask me when it launches — or what an app like it would cost you.",
                  opener: "Iyra caught your eye? It logs UPI spends all by itself." },
    svc_web:    { nudge: "Reading about websites? Tell me what yours needs to do — leads, bookings or orders.",
                  opener: "Websites that earn their keep — you're on the right page. Literally." },
    svc_data:   { nudge: "Your numbers already know. Ask me what a dashboard would show you.",
                  opener: "Data analytics — good instinct. The decisions are already in your numbers." },
    svc_seo:    { nudge: "Want to be found on Google and cited by ChatGPT? That's exactly this page.",
                  opener: "SEO, AEO, GEO — the full visibility stack. Ask me anything about it." },
  };

  /* ---- Page awareness: BUJJI knows which page he's standing on ---- */
  const PAGE = [
    [/qr-ordering-system/, "product", "TableServe (QR Ordering)"],
    [/iyra-money-tracker/, "iyra", "Custom Mobile Application"],
    [/services\/web-development/, "svc_web", "Purpose-Driven Website"],
    [/services\/data-analytics/, "svc_data", "Data Analytics & BI"],
    [/services\/seo-aeo-geo/, "svc_seo", "SEO · AEO · GEO"],
  ].find(([re]) => re.test(location.pathname));
  if (PAGE) {
    state.context = PAGE[1];       // the nudge/opener speak to this page
    state.lead.interest = PAGE[2]; // and the lead already knows its topic
  }

  /* ============ Helpers ============ */
  const waText = () => {
    const l = state.lead;
    const who = l.name ? `I'm ${l.name}. ` : "";
    const what = l.interest ? `I'm interested in ${l.interest}. ` : "I'd like a free consultation. ";
    return `Hi TheVincis! ${who}${what}(via BUJJI on your website)`;
  };
  const waLink = () => `https://wa.me/${CFG.waNumber}?text=${encodeURIComponent(waText())}`;
  const mailLink = () => {
    const l = state.lead;
    const su = encodeURIComponent(`Free consultation — ${l.interest || "General"}${l.name ? " (" + l.name + ")" : ""}`);
    const bo = encodeURIComponent(`Name: ${l.name || "-"}\nPhone: ${l.phone || "-"}\nInterest: ${l.interest || "-"}\n\n(sent via BUJJI, the site concierge)`);
    return `mailto:${CFG.email}?subject=${su}&body=${bo}`;
  };

  function sendLeadSilently() {
    if (!CFG.web3formsKey) return;
    fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        access_key: CFG.web3formsKey,
        subject: "BUJJI lead — " + (state.lead.interest || "General"),
        from_name: "BUJJI (site concierge)",
        name: state.lead.name,
        phone: state.lead.phone,
        interest: state.lead.interest,
      }),
    }).catch(() => {});
  }

  /* ============ Conversation flows (the scripted brain) ============ */
  const FLOWS = {
    start: {
      say: [
        "Welcome — I'm <b>BUJJI</b>, the concierge here. 🖋️",
        "Quick one, so I point you right: are you building something <b>new</b>, or fixing something that already <b>exists</b>?",
      ],
      options: [
        { label: "Something new", next: "q_new" },
        { label: "Fixing what exists", next: "q_fix" },
        { label: "Just exploring", next: "explore" },
      ],
    },

    q_new: {
      say: ["Love that. The blank page is where we do our best work.", "Which of these is closest?"],
      options: "domains",
    },
    q_fix: {
      say: ["Good instinct — fixing beats rebuilding when it's possible. Let's see what we're dealing with.", "Which of these is closest?"],
      options: "domains",
    },

    /* --- Service nodes: hook → proof → invitation --- */
    t_serve: {
      interest: "TableServe (QR Ordering)",
      say: [
        "<b>TableServe</b> — guests scan a QR at the table, browse a live menu, and the order lands in the kitchen instantly. No app download, no lost orders at rush hour.",
        "It's not a reseller product. We wrote it, we run it — you'd be talking to the people who built it.",
      ],
      options: [
        { label: "What would it cost?", next: "pricing" },
        { label: "See TableServe details", href: "/qr-ordering-system/" },
        { label: "Talk to a human about this", next: "cap_name" },
        { label: "← Other services", next: "q_new" },
      ],
    },
    mobile: {
      interest: "Custom Mobile Application",
      say: [
        "Android & iOS apps built around how your business actually runs — not a template with your logo on it.",
        "Our own app, <b>Iyra Money Tracker</b>, launches soon on Google Play — we ship what we sell.",
      ],
      options: [
        { label: "What would it cost?", next: "pricing" },
        { label: "Show me Iyra", next: "iyra" },
        { label: "Talk to a human about this", next: "cap_name" },
        { label: "← Other services", next: "q_new" },
      ],
    },
    website: {
      interest: "Purpose-Driven Website",
      say: [
        "We build websites that <b>earn their keep</b> — leads, bookings, orders, trust. Not show-off pages.",
        "Honest test: if a site won't bring you customers, we won't build it. That's the deal.",
      ],
      options: [
        { label: "What would it cost?", next: "pricing" },
        { label: "Talk to a human about this", next: "cap_name" },
        { label: "← Other services", next: "q_new" },
      ],
    },
    saas: {
      interest: "SaaS / Custom Platform",
      say: [
        "End-to-end platforms — frontend, backend, database, deployment — engineered with DevSecOps discipline so they stay fast and secure as you grow.",
        "One team, zero handoffs. TableServe came out of this exact discipline.",
      ],
      options: [
        { label: "What would it cost?", next: "pricing" },
        { label: "Talk to a human about this", next: "cap_name" },
        { label: "← Other services", next: "q_new" },
      ],
    },
    data: {
      interest: "Data Analytics & BI",
      say: [
        "Your numbers already know. We make them talk — dashboards and decision systems in Python, SQL, Power BI and Tableau.",
        "The goal isn't a pretty chart. It's the decision you haven't made yet.",
      ],
      options: [
        { label: "What would it cost?", next: "pricing" },
        { label: "Talk to a human about this", next: "cap_name" },
        { label: "← Other services", next: "q_new" },
      ],
    },
    seo: {
      interest: "SEO · AEO · GEO",
      say: [
        "The full visibility stack: <b>SEO</b> ranks you on Google, <b>AEO</b> gets you quoted in featured snippets, <b>GEO</b> gets you cited by ChatGPT and Perplexity.",
        "Most businesses stop at the first one. That's why they're invisible in AI answers.",
      ],
      options: [
        { label: "What would it cost?", next: "pricing" },
        { label: "Talk to a human about this", next: "cap_name" },
        { label: "← Other services", next: "q_new" },
      ],
    },

    /* --- Pricing: honesty as the persuasion --- */
    pricing: {
      say: [
        "Honest answer: it depends on scope — and anyone who quotes before understanding your problem is guessing with your money.",
        "Here's how it works instead: a <b>free consultation</b>, three sharp questions, then a scoped proposal with clear timelines. No obligation, reply within one working day.",
      ],
      options: [
        { label: "Fair — set it up", next: "cap_name" },
        { label: "I'll think about it", next: "soft_close" },
      ],
    },

    soft_close: {
      say: [
        "Fair enough. I'll be right here in the corner if it sparks.",
        "One thing worth knowing: the consultation is free. <i>Staying invisible isn't.</i>",
      ],
      options: [
        { label: "Alright, let's talk", next: "cap_name" },
        { label: "Show me your work instead", next: "explore" },
      ],
    },

    /* --- Lead capture: micro-commitment ladder --- */
    cap_name: {
      say: ["Two details and I'll set it up personally. What should I call you?"],
      input: "name",
    },
    cap_phone: {
      say: ["Thanks, {name}. And the best number for WhatsApp?"],
      input: "phone",
    },
    cap_done: {
      say: [
        "Done, {name} — you're one tap from a real conversation.",
        "Sathya replies within one working day. Faster on WhatsApp, usually.",
      ],
      options: [
        { label: "💬 Continue on WhatsApp", wa: true },
        { label: "✉️ Send as email instead", mail: true },
        { label: "Explore more first", next: "explore" },
      ],
      run: sendLeadSilently,
    },

    /* --- Showcase / explore --- */
    explore: {
      say: ["Then let me show off a little. Three things worth your minute:"],
      options: [
        { label: "TableServe — QR ordering", next: "t_serve" },
        { label: "Iyra — money tracker app", next: "iyra" },
        { label: "The Vincis Collective", next: "collective" },
        { label: "Who built you, BUJJI?", next: "meta" },
      ],
    },
    iyra: {
      interest: "Custom Mobile Application",
      say: [
        "<b>Iyra</b> logs UPI spends automatically from payment notifications — budgets, savings rate, cashflow trends, even a shared household view.",
        "Launching soon on Google Play. Built in-house, like everything else here.",
      ],
      options: [
        { label: "See the Iyra page", href: "/iyra-money-tracker/" },
        { label: "I want an app like this", next: "cap_name" },
        { label: "← Back", next: "explore" },
      ],
    },
    collective: {
      say: [
        "Da Vinci painted with one hand and drew fortress walls with the other. We allied with both:",
        "<b>CreativzEdge</b> — 15+ years of design mastery, Chennai & Mumbai. Brands trusted by Padma Shri percussionist Drums Sivamani.",
        "<b>Blackfyre</b> — open-source cloud compliance. 678 controls, 9 frameworks, evidence vault. Read-only keys, ever.",
      ],
      options: [
        { label: "How do I use all three?", next: "pricing" },
        { label: "← Back", next: "explore" },
      ],
    },
    meta: {
      say: [
        "Me? TheVincis built me — scripted by hand, styled to the house design system, zero cookie-cutter widgets.",
        "I'm also a quiet demo: everything on this site is built this way. <i>Working systems, not showpieces.</i>",
        "Want one like me greeting your customers?",
      ],
      options: [
        { label: "Yes — what's involved?", next: "pricing" },
        { label: "← Back", next: "explore" },
      ],
    },
    founder: {
      say: [
        "<b>Sathyanarayana D</b> — founder & principal engineer. Microsoft and Infosys certified, security-first, 200+ professionals trained, 3 products shipped.",
        "One rule that never bends: understand the problem, build the fix, prove it with numbers.",
      ],
      options: [
        { label: "Talk to Sathya", next: "cap_name" },
        { label: "← Back", next: "explore" },
      ],
    },

    /* --- Exit intent: one honest save, played once --- */
    exit: {
      say: [
        "Before you go — one honest question:",
        "Would it help if the details landed straight in your WhatsApp? No forms, one tap.",
      ],
      options: [
        { label: "💬 Yes — WhatsApp me", wa: true },
        { label: "No thanks", next: "exit_no" },
      ],
    },
    exit_no: {
      say: ["No pressure. The door's always open — and so is the free consultation."],
      options: [
        { label: "Actually, one question…", next: "q_new" },
      ],
    },

    /* --- Free-text fallback when nothing matches --- */
    lost: {
      say: [
        "Honest answer — that one's past my script. I'm well-read, not all-knowing. 🖋️",
        "Two ways to a real answer:",
      ],
      options: [
        { label: "💬 Ask on WhatsApp", wa: true },
        { label: "Browse what I do know", next: "q_new" },
      ],
    },
  };

  const DOMAIN_OPTIONS = [
    { label: "🍽 Restaurant / QR ordering", next: "t_serve" },
    { label: "📱 Mobile app", next: "mobile" },
    { label: "🌐 Website that gets customers", next: "website" },
    { label: "⚙️ SaaS / custom platform", next: "saas" },
    { label: "📊 Data & dashboards", next: "data" },
    { label: "🔍 Get found on Google & AI", next: "seo" },
  ];

  /* --- Keyword NLU for free-typed messages (free-tier "brain") --- */
  const PRICE_RE = /price|cost|quote|charge|budget|how much|fees?|pricing/i;
  const SERVICE_NLU = [
    [/tableserve|\bqr\b|restaurant|cafe|café|menu|hotel|kitchen/i, "t_serve"],
    [/iyra|money.?track|upi/i, "iyra"],
    [/\bapp\b|android|ios|mobile|play ?store/i, "mobile"],
    [/website|web ?site|portfolio|landing/i, "website"],
    [/saas|platform|software|full.?stack|backend/i, "saas"],
    [/data|dashboard|analytics|power ?bi|tableau|\bsql\b|\bbi\b/i, "data"],
    [/seo|aeo|geo|google|rank|search|chatgpt|perplexity|visib/i, "seo"],
  ];
  const NLU = [
    [/blackfyre|creativz|collective|design|security|compliance/i, "collective"],
    [/founder|sathya|who runs|owner/i, "founder"],
    [/who (are|built|made) you|about you|chatbot|\bbot\b/i, "meta"],
    [/whatsapp|call|contact|phone|talk|human|consult|book|meet/i, "cap_name"],
    [/^(hi|hey|hello|hai|vanakkam|namaste)\b/i, "q_new"],
    [/thank|nice|great|good|super|awesome/i, "soft_close"],
  ];

  /* ============ DOM ============ */
  const root = document.createElement("div");
  root.className = "vinci";
  root.innerHTML = `
    <div class="vinci__nudge" role="status" hidden>
      <button class="vinci__nudge-close" aria-label="Dismiss">×</button>
      <p></p>
    </div>
    <button class="vinci__launcher" aria-label="Chat with BUJJI, the TheVincis concierge" aria-expanded="false">
      <img class="vinci__face" src="/images/bujji-face.jpg" alt="" aria-hidden="true">
      <span class="vinci__badge" hidden>1</span>
    </button>
    <section class="vinci__panel" role="dialog" aria-modal="false" aria-label="Vinci — TheVincis concierge" hidden>
      <header class="vinci__head">
        <span class="vinci__avatar" aria-hidden="true"><img class="vinci__face" src="/images/bujji-face.jpg" alt=""></span>
        <div class="vinci__id">
          <strong>BUJJI</strong>
          <span><i class="vinci__dot" aria-hidden="true"></i>TheVincis Concierge</span>
        </div>
        <button class="vinci__close" aria-label="Close chat">×</button>
      </header>
      <div class="vinci__msgs" data-lenis-prevent></div>
      <form class="vinci__inputrow" novalidate>
        <input type="text" name="q" placeholder="Type a message…" autocomplete="off" aria-label="Message BUJJI">
        <button type="submit" aria-label="Send">↑</button>
      </form>
      <footer class="vinci__foot">Hand-built by TheVincis — <button type="button" class="vinci__foot-link">yes, we build these</button></footer>
    </section>`;
  document.body.appendChild(root);

  const el = {
    launcher: root.querySelector(".vinci__launcher"),
    badge: root.querySelector(".vinci__badge"),
    nudge: root.querySelector(".vinci__nudge"),
    nudgeText: root.querySelector(".vinci__nudge p"),
    nudgeClose: root.querySelector(".vinci__nudge-close"),
    panel: root.querySelector(".vinci__panel"),
    close: root.querySelector(".vinci__close"),
    msgs: root.querySelector(".vinci__msgs"),
    form: root.querySelector(".vinci__inputrow"),
    input: root.querySelector(".vinci__inputrow input"),
    footLink: root.querySelector(".vinci__foot-link"),
  };

  /* ============ Message engine — human cadence ============ */
  const wait = (ms) => new Promise((r) => setTimeout(r, prefersReduced ? 0 : ms));
  const scrollMsgs = () => { el.msgs.scrollTop = el.msgs.scrollHeight; };
  const interp = (s) => s.replaceAll("{name}", state.lead.name || "friend");

  function bubble(html, who) {
    const b = document.createElement("div");
    b.className = "vinci__msg vinci__msg--" + who;
    if (who === "user") b.textContent = html;           // user text is never injected as HTML
    else b.innerHTML = html;
    el.msgs.appendChild(b);
    scrollMsgs();
    return b;
  }

  let queue = Promise.resolve();
  function botSay(html) {
    queue = queue.then(async () => {
      const t = document.createElement("div");
      t.className = "vinci__msg vinci__msg--bot vinci__typing";
      t.innerHTML = "<span></span><span></span><span></span>";
      el.msgs.appendChild(t);
      scrollMsgs();
      // reading + typing time scaled to message length — the single biggest "feels human" lever
      await wait(Math.min(1900, Math.max(650, html.length * 16)));
      t.remove();
      bubble(html, "bot");
      state.history.push({ role: "assistant", content: html.replace(/<[^>]+>/g, "") });
    });
    return queue;
  }

  function clearOptions() {
    el.msgs.querySelectorAll(".vinci__opts").forEach((o) => o.remove());
  }

  function showOptions(opts) {
    queue = queue.then(() => {
      clearOptions();
      const row = document.createElement("div");
      row.className = "vinci__opts";
      opts.forEach((o) => {
        let node;
        if (o.wa || o.mail || o.href) {
          node = document.createElement("a");
          node.href = o.wa ? waLink() : o.mail ? mailLink() : o.href;
          if (o.wa) node.target = "_blank";
          if (o.wa) node.rel = "noopener";
          node.className = "vinci__opt" + (o.wa ? " vinci__opt--gold" : "");
          node.addEventListener("click", () => {
            bubble(o.label, "user");
            clearOptions();
            botSay("Perfect. Tell them BUJJI sent you. 🖋️");
          });
        } else {
          node = document.createElement("button");
          node.type = "button";
          node.className = "vinci__opt";
          node.addEventListener("click", () => {
            bubble(o.label, "user");
            state.history.push({ role: "user", content: o.label });
            go(o.next);
          });
        }
        node.textContent = o.label;
        row.appendChild(node);
      });
      el.msgs.appendChild(row);
      scrollMsgs();
    });
  }

  function go(id) {
    const node = FLOWS[id];
    if (!node) return;
    state.node = id;
    state.awaiting = node.input || null;
    if (node.interest) state.lead.interest = node.interest;
    clearOptions();
    node.say.forEach((m) => botSay(interp(m)));
    if (node.options) showOptions(node.options === "domains" ? DOMAIN_OPTIONS : node.options);
    if (node.input) queue = queue.then(() => el.input.focus());
    if (node.run) queue = queue.then(() => node.run());
  }

  /* ============ Free text handling ============ */
  async function handleFree(text) {
    state.history.push({ role: "user", content: text });

    if (state.awaiting === "name") {
      state.lead.name = text.replace(/[^\p{L}\p{N} .'-]/gu, "").trim().slice(0, 40) || "friend";
      state.awaiting = null;
      go("cap_phone");
      return;
    }
    if (state.awaiting === "phone") {
      const digits = text.replace(/\D/g, "");
      if (digits.length < 8) {
        botSay("That doesn't look like a full number — mind trying again? (digits only is fine)");
        return;
      }
      state.lead.phone = digits;
      state.awaiting = null;
      go("cap_done");
      return;
    }

    // Optional LLM fallback (free-tier serverless) — degrades silently to keyword brain
    if (CFG.llmEndpoint) {
      try {
        const res = await fetch(CFG.llmEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, history: state.history.slice(-12) }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.reply) {
            botSay(data.reply);
            showOptions([
              { label: "Book a free consultation", next: "cap_name" },
              { label: "See services", next: "q_new" },
            ]);
            return;
          }
        }
      } catch (_) { /* fall through to keyword brain */ }
    }

    // Cost questions win, but remember which service they were about
    const svc = SERVICE_NLU.find(([re]) => re.test(text));
    if (PRICE_RE.test(text)) {
      if (svc && FLOWS[svc[1]].interest) state.lead.interest = FLOWS[svc[1]].interest;
      go("pricing");
      return;
    }
    if (svc) { go(svc[1]); return; }
    for (const [re, target] of NLU) {
      if (re.test(text)) { go(target); return; }
    }
    go("lost");
  }

  /* ============ Open / close ============ */
  function openPanel(entry) {
    if (state.open) return;
    state.open = true;
    ss.set("opened", "1");
    hideNudge();
    el.badge.hidden = true;
    el.panel.hidden = false;
    el.launcher.setAttribute("aria-expanded", "true");
    void el.panel.offsetHeight; // flush display:none → flex before transitioning
    root.classList.add("vinci--open");

    if (!state.started) {
      state.started = true;
      if (entry === "exit") {
        go("exit");
      } else {
        const opener = CONTEXT[state.context] && CONTEXT[state.context].opener;
        if (opener) botSay(opener);
        go("start");
      }
    } else if (entry === "exit") {
      go("exit"); // returning visitor heading for the door still gets the save
    }
  }
  function closePanel() {
    state.open = false;
    root.classList.remove("vinci--open");
    el.launcher.setAttribute("aria-expanded", "false");
    // let the CSS exit transition finish before hiding
    setTimeout(() => { if (!state.open) el.panel.hidden = true; }, prefersReduced ? 0 : 260);
  }

  el.launcher.addEventListener("click", () => (state.open ? closePanel() : openPanel()));
  el.close.addEventListener("click", closePanel);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && state.open) closePanel(); });
  el.footLink.addEventListener("click", () => { openPanel(); if (state.started) { bubble("Who built you?", "user"); go("meta"); } });

  el.form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = el.input.value.trim();
    if (!text) return;
    el.input.value = "";
    bubble(text, "user");
    handleFree(text);
  });

  /* ============ Section awareness (IntersectionObserver) ============ */
  const sections = [
    [".hero", "hero"], ["#services", "services"], ["#collective", "collective"],
    ["#product", "product"], ["#founder", "founder"], ["#faq", "faq"], ["#contact", "contact"],
  ];
  const io = new IntersectionObserver(
    (entries) => entries.forEach((en) => { if (en.isIntersecting) state.context = en.target.dataset.vinciCtx; }),
    { threshold: 0.4 }
  );
  sections.forEach(([sel, key]) => {
    const s = document.querySelector(sel);
    if (s) { s.dataset.vinciCtx = key; io.observe(s); }
  });

  /* ============ The one nudge — contextual, then silence ============ */
  let nudgeTimer = null;
  function showNudge() {
    if (state.open || ss.get("nudged") || ss.get("opened")) return;
    ss.set("nudged", "1");
    const ctx = CONTEXT[state.context] || CONTEXT.hero;
    el.nudgeText.textContent = ctx.nudge;
    el.nudge.hidden = false;
    el.badge.hidden = false;
    root.classList.add("vinci--nudging");
  }
  function hideNudge() {
    el.nudge.hidden = true;
    root.classList.remove("vinci--nudging");
  }
  el.nudge.addEventListener("click", (e) => {
    if (e.target === el.nudgeClose) { hideNudge(); return; }
    openPanel();
  });
  if (!ss.get("nudged") && !ss.get("opened")) {
    nudgeTimer = setTimeout(showNudge, CFG.nudgeAfterMs);
  }

  /* ============ Exit intent — one honest save (desktop only) ============ */
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    const armedAt = Date.now();
    document.addEventListener("mouseout", (e) => {
      if (e.relatedTarget || e.clientY > 8) return;
      if (Date.now() - armedAt < CFG.exitAfterMs) return;
      if (state.open || ss.get("exit") || state.lead.phone) return;
      ss.set("exit", "1");
      clearTimeout(nudgeTimer);
      hideNudge();
      openPanel("exit");
    });
  }
})();
