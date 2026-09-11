/* =====================================================================
   THE ROUND — game engine.

   One screen, mirrored to a TV. That single constraint drives everything:
   nobody may ever see something the room can't. So there is no hidden
   state, no answer key sitting in a corner, and in Party Mode no button
   that reveals an answer early. The laptop driver presses one key and
   sees the question at the same instant as the person on the sofa.
   ===================================================================== */

"use strict";

/* ---------- tiny helpers ---------- */
const $  = sel => document.querySelector(sel);
const stage = () => $("#stage");
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const fmt = n => Number.isInteger(n) ? n.toLocaleString("en-US") : n.toLocaleString("en-US", { maximumFractionDigits: 2 });
const LS = {
  get(k, d) { try { return JSON.parse(localStorage.getItem("round.v1:" + k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem("round.v1:" + k, JSON.stringify(v)); } catch {} }
};

const COLORS = ["var(--t1)","var(--t2)","var(--t3)","var(--t4)","var(--t5)","var(--t6)"];
const NAMES = ["Quizteama Aguilera","Les Quizerables","Trivia Newton-John","The Smartinis","Sherlock Homies",
  "Tequila Mockingbird","Victorious Secret","E=MC Hammer","The Quizzard of Oz","Risky Quizness",
  "Universally Challenged","Beer Pressure","Agatha Quiztie","The Wrong Answers","Quizzy Rascal","Awkward Turtles"];

/* ---------- sound: no files, just oscillators ---------- */
const Sound = {
  ctx: null, muted: LS.get("mute", false),
  up() { if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch {} } if (this.ctx && this.ctx.state === "suspended") this.ctx.resume(); },
  note(freq, start, dur, type = "sine", vol = .16) {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime + start, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .012);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g).connect(this.ctx.destination); o.start(t); o.stop(t + dur + .02);
  },
  tick()    { this.note(880, 0, .06, "square", .05); },
  last()    { this.note(1320, 0, .10, "square", .09); },
  go()      { this.note(523, 0, .12); this.note(784, .09, .22); },
  reveal()  { this.note(392, 0, .12, "triangle", .13); this.note(587, .10, .30, "triangle", .13); },
  right()   { [523, 659, 784, 1047].forEach((f, i) => this.note(f, i * .065, .28, "triangle", .14)); },
  wrong()   { this.note(196, 0, .26, "sawtooth", .09); this.note(146, .10, .34, "sawtooth", .09); },
  round()   { [392, 523, 659].forEach((f, i) => this.note(f, i * .10, .4, "sine", .13)); },
  win()     { [523, 659, 784, 1047, 1319].forEach((f, i) => this.note(f, i * .11, .6, "triangle", .15)); },
  toggle()  { this.muted = !this.muted; LS.set("mute", this.muted); if (!this.muted) this.go(); return this.muted; }
};

/* ---------- round definitions ---------- */
const RT = {
  snap: { name: "Snap Judgement", worth: "1 point", time: 20, pts: 1,
    rule: "Four options. Everyone commits on LOCK IN — fingers up. 1 = A, 2 = B, 3 = C, 4 = D." },
  odd: { name: "Odd One Out", worth: "2 points", time: 25, pts: 2,
    rule: "Three of these belong together. One doesn't. Write down the odd one." },
  emoji: { name: "Emoji Decode", worth: "2 points", time: 25, pts: 2,
    rule: "Say it out loud if it helps. Write down what the emoji spell." },
  closest: { name: "Closest Wins", worth: "3 points · 5 if exact", time: 30, pts: 3,
    rule: "Write a number down. Closest team takes it. You don't need to know anything — just guess well." },
  lie: { name: "Spot the Lie", worth: "2 points", time: 25, pts: 2,
    rule: "Two of these are true. One is a filthy lie. Write down which one." },
  really: { name: "Really?!", worth: "1 point", time: 12, pts: 1,
    rule: "True or false, fast. Thumbs up or thumbs down on LOCK IN." },
  connect: { name: "The Connection", worth: "4 · 3 · 2 · 1", time: 0, pts: 4,
    rule: "Four clues, one at a time. Shout STOP the moment you see the link. The earlier you stop, the more it's worth." },
  wager: { name: "The Final Wager", worth: "You decide", time: 40, pts: 0,
    rule: "Bet any part of your score. Get it right and you double the bet. Get it wrong and it's gone." }
};

/* rounds where a human decides who was right */
const SCORED = ["snap", "odd", "emoji", "lie", "really"];

const PLANS = {
  quick:    { label: "Quick",    mins: "~15 min", spec: [["snap",5],["emoji",5],["closest",4],["wager",1]] },
  standard: { label: "Standard", mins: "~30 min", spec: [["snap",5],["odd",4],["emoji",5],["closest",4],["really",6],["wager",1]] },
  full:     { label: "The Works",mins: "~45 min", spec: [["snap",6],["odd",5],["emoji",6],["closest",5],["lie",4],["really",8],["connect",5],["wager",1]] }
};

/* ---------- game state ---------- */
const G = {
  mode: "party", length: "standard",
  teams: [], plan: [], ri: 0, qi: 0, phase: "setup",
  picks: new Set(), guesses: {}, bets: {}, votes: {},
  clueIdx: 0, lockedOut: new Set(), buzzTeam: null,
  timer: null, paused: false, roundStartScores: [], revealToken: 0, prerollIv: null
};

/* pull n unseen questions of a type, remembering what's been used */
function draw(type, n) {
  const seen = new Set(LS.get("seen." + type, []));
  const pool = BANK[type];
  let fresh = pool.map((q, i) => i).filter(i => !seen.has(i));
  if (fresh.length < n) { fresh = pool.map((q, i) => i); seen.clear(); }
  const take = shuffle(fresh).slice(0, n);
  LS.set("seen." + type, [...seen, ...take].slice(-Math.floor(pool.length * 0.7)));
  return take.map(i => {
    const q = JSON.parse(JSON.stringify(pool[i]));
    // Reshuffle every list that has a right answer in it. Written as authored, the lie is
    // always last and the odd one out usually is — after two questions the room stops
    // reading and just picks the bottom one.
    reorder(q, "options", "answer");      // Snap Judgement, Final Wager
    reorder(q, "statements", "lie");      // Spot the Lie
    reorder(q, "items", "answer");        // Odd One Out
    return q;                             // The Connection is left alone: its clues are authored in a deliberate order
  });
}

function reorder(q, listKey, answerKey) {
  const list = q[listKey];
  if (!list) return;
  const order = shuffle(list.map((_, k) => k));
  q[listKey] = order.map(k => list[k]);
  q[answerKey] = order.indexOf(q[answerKey]);
}

function buildPlan() {
  G.plan = PLANS[G.length].spec.map(([type, n]) => ({ type, items: draw(type, n) }));
  G.ri = 0; G.qi = 0;
}

const round = () => G.plan[G.ri];
const meta  = () => RT[round().type];
const item  = () => round().items[G.qi];
const isLast = () => G.ri === G.plan.length - 1 && G.qi === round().items.length - 1;

/* ---------- timer ---------- */
function runTimer(secs, done) {
  stopTimer();
  const bar = $("#tbar"), wrap = $("#twrap"), secsEl = $("#secs");
  if (!bar) { return; }
  const end = performance.now() + secs * 1000;
  let lastWhole = Math.ceil(secs), flashed = false;
  G.paused = false;
  const tick = now => {
    if (G.paused) { G.timer = requestAnimationFrame(tick); return; }
    const left = Math.max(0, end - now), frac = left / (secs * 1000);
    bar.style.transform = `scaleX(${frac})`;
    const whole = Math.ceil(left / 1000);
    if (whole !== lastWhole) {
      lastWhole = whole;
      if (secsEl) secsEl.textContent = whole;
      if (whole <= 3 && whole > 0) Sound.last(); else if (whole <= 6) Sound.tick();
    }
    wrap.classList.toggle("warn", frac < .45);
    wrap.classList.toggle("out", frac < .18);
    if (frac < .28 && !flashed) { flashed = true; lockInFlash(); }
    if (left <= 0) { G.timer = null; done(); return; }
    G.timer = requestAnimationFrame(tick);
  };
  G.timer = requestAnimationFrame(tick);
}
function stopTimer() {
  if (G.timer) cancelAnimationFrame(G.timer);
  G.timer = null; G.paused = false; document.body.classList.remove("paused");
}
function lockInFlash() {
  const d = document.createElement("div");
  d.className = "lockin"; d.innerHTML = "<span>LOCK IN</span>";
  document.body.appendChild(d); setTimeout(() => d.remove(), 1000);
}

/* ---------- shared chrome ---------- */
function miniScores() {
  if (!G.teams.length) return "";
  const lead = Math.max(...G.teams.map(t => t.score));
  return `<div class="mini">${G.teams.map(t => `<div class="m">
    <i class="dot" style="background:${t.color}"></i>
    <span class="nm">${esc(t.name)}</span>
    <span class="sc" style="${t.score === lead && lead > 0 ? "color:var(--gold)" : ""}">${t.score}</span>
  </div>`).join("")}</div>`;
}
function topBar(extra = "") {
  const r = round(), m = meta();
  return `<div class="bar">
    <span class="pill">${esc(m.name)}</span>
    <span class="pill">Q <b>${G.qi + 1}</b>&thinsp;/&thinsp;${r.items.length}</span>
    ${extra}
    <span class="spacer"></span>
    ${miniScores()}
  </div>`;
}
function foot(hints) {
  return `<div class="foot">${hints.map(h => `<span class="hint">${h}</span>`).join("")}
    <span class="hint"><b>M</b>${Sound.muted ? "unmute" : "mute"}</span>
    <span class="hint"><b>esc</b>menu</span></div>`;
}
const KEY = k => `<b class="key">${k}</b>`;

function paint(html) { stage().innerHTML = html; }

/* =====================================================================
   SETUP
   ===================================================================== */
function screenSetup() {
  stopTimer();
  G.phase = "setup";
  if (!G.teams.length) {
    const saved = LS.get("teams", null);
    G.teams = saved && saved.length >= 2
      ? saved.map((n, i) => ({ name: n, color: COLORS[i % 6], score: 0 }))
      : shuffle(NAMES).slice(0, 2).map((n, i) => ({ name: n, color: COLORS[i], score: 0 }));
  }
  paint(`
  <div class="screen">
    <div class="center" style="margin-bottom:3.4vmin">
      <div class="kicker" style="margin-bottom:1.4vmin">A trivia game for a room and one screen</div>
      <h1 class="wordmark">The R<em>ou</em>nd</h1>
    </div>

    <div class="setup">
      <div class="panel wide">
        <div class="kicker">How are you playing?</div>
        <div class="modes">
          <button class="mode ${G.mode === "party" ? "on" : ""}" data-mode="party">
            <span class="tagline">Nobody sits out</span>
            <h3>Party Mode</h3>
            <p>The game runs itself. Every question opens behind a 3-2-1 countdown and closes on a timer, so whoever is holding the laptop sees it at the same moment as everyone else. No answer can be reached early.</p>
          </button>
          <button class="mode ${G.mode === "host" ? "on" : ""}" data-mode="host">
            <span class="tagline">One of you runs it</span>
            <h3>Host Mode</h3>
            <p>You drive, and you're not on a team. No timers — read it out, let them argue, reveal when you're ready, award points however you see fit. The screen is the only answer key, so a reveal is for the whole room at once.</p>
          </button>
        </div>
      </div>

      <div class="panel">
        <div class="kicker">Teams <span style="color:var(--dim);letter-spacing:.1em"> — 2 to 6</span></div>
        <div class="teamrows" id="teamrows"></div>
        <div class="row" style="justify-content:flex-start;margin-top:1.8vmin">
          <button class="btn ghost" id="addteam">+ Add team</button>
          <button class="btn ghost" id="reroll">🎲 New names</button>
        </div>
      </div>

      <div class="panel">
        <div class="kicker">How long have you got?</div>
        <div class="segs">
          ${Object.entries(PLANS).map(([k, p]) => `<button class="seg ${G.length === k ? "on" : ""}" data-len="${k}">
            <b>${p.label}</b><span>${p.mins} · ${p.spec.length} rounds</span></button>`).join("")}
        </div>
      </div>

      <div class="center wide" style="gap:1.2vmin;display:flex;flex-direction:column;padding-bottom:2vmin">
        <button class="btn primary big" id="start">Start the game ${KEY("space")}</button>
        <p class="hint" style="letter-spacing:.14em">One pen and one scrap of paper per team is all you need.</p>
      </div>
    </div>
  </div>`);

  renderTeamRows();
  stage().querySelectorAll("[data-mode]").forEach(b => b.onclick = () => { G.mode = b.dataset.mode; Sound.up(); screenSetup(); });
  stage().querySelectorAll("[data-len]").forEach(b => b.onclick = () => { G.length = b.dataset.len; screenSetup(); });
  $("#addteam").onclick = () => { if (G.teams.length < 6) { G.teams.push({ name: pickName(), color: COLORS[G.teams.length], score: 0 }); screenSetup(); } };
  $("#reroll").onclick = () => { const n = shuffle(NAMES).slice(0, G.teams.length); G.teams.forEach((t, i) => t.name = n[i]); screenSetup(); };
  $("#start").onclick = startGame;
}
function pickName() {
  const used = new Set(G.teams.map(t => t.name));
  return shuffle(NAMES).find(n => !used.has(n)) || "Team " + (G.teams.length + 1);
}
function renderTeamRows() {
  $("#teamrows").innerHTML = G.teams.map((t, i) => `<div class="teamrow">
    <i class="swatch" style="background:${t.color}"></i>
    <input value="${esc(t.name)}" data-i="${i}" maxlength="28" aria-label="Team ${i + 1} name">
    ${G.teams.length > 2 ? `<button class="x" data-del="${i}" aria-label="Remove team">×</button>` : ""}
  </div>`).join("");
  $("#teamrows").querySelectorAll("input").forEach(inp => {
    inp.oninput = () => { G.teams[+inp.dataset.i].name = inp.value; };
    inp.onkeydown = e => e.stopPropagation();
  });
  $("#teamrows").querySelectorAll("[data-del]").forEach(b => b.onclick = () => {
    G.teams.splice(+b.dataset.del, 1); G.teams.forEach((t, i) => t.color = COLORS[i]); screenSetup();
  });
}

function startGame() {
  Sound.up();
  G.teams = G.teams.filter(t => t.name.trim()).map((t, i) => ({ name: t.name.trim() || "Team " + (i + 1), color: COLORS[i], score: 0 }));
  if (G.teams.length < 2) { G.teams.push({ name: pickName(), color: COLORS[1], score: 0 }); }
  LS.set("teams", G.teams.map(t => t.name));
  buildPlan();
  screenRoundCard();
}

/* =====================================================================
   ROUND CARD
   ===================================================================== */
function screenRoundCard() {
  stopTimer(); G.phase = "roundcard"; G.qi = 0;
  G.roundStartScores = G.teams.map(t => t.score);
  const m = meta();
  Sound.round();
  paint(`<div class="screen center">
    <div style="display:flex;flex-direction:column;align-items:center;gap:2.8vmin">
      <div class="roundno">Round ${G.ri + 1} of ${G.plan.length}</div>
      <h2 class="roundname">${esc(m.name)}</h2>
      <span class="worth">${esc(m.worth)}</span>
      <p class="rule">${esc(m.rule)}</p>
      <button class="btn primary big" id="go" style="margin-top:1.6vmin">
        ${round().items.length} question${round().items.length > 1 ? "s" : ""} — let's go ${KEY("space")}</button>
    </div>
    ${foot([`${KEY("space")}start`])}
  </div>`);
  $("#go").onclick = nextQuestion;
}

/* =====================================================================
   QUESTION — pre-roll then the question itself
   ===================================================================== */
function nextQuestion() {
  G.picks.clear(); G.guesses = {}; G.votes = {};
  G.clueIdx = 0; G.lockedOut.clear(); G.buzzTeam = null;
  if (round().type === "wager") return screenWagerBets();
  if (G.mode === "party" && round().type !== "connect") return screenPreroll();
  screenQuestion();
}

function screenPreroll() {
  G.phase = "preroll";
  let n = 3;
  const render = () => paint(`<div class="screen center">
    ${topBar()}
    <div class="grow center" style="display:flex;flex-direction:column;gap:2vmin">
      <div class="kicker">Eyes up — nobody reads ahead</div>
      <div class="preroll">${n}</div>
    </div>
    ${foot([])}
  </div>`);
  render(); Sound.tick();
  clearInterval(G.prerollIv);
  G.prerollIv = setInterval(() => {
    n--;
    if (n === 0) { clearInterval(G.prerollIv); Sound.go(); screenQuestion(); return; }
    render(); Sound.tick();
  }, 800);
}

function screenQuestion() {
  G.phase = "question";
  const t = round().type, q = item(), m = meta();
  const timed = G.mode === "party" && m.time > 0;
  const body = {
    snap: qMultipleChoice, wager: qMultipleChoice, odd: qOdd, emoji: qEmoji,
    closest: qClosest, lie: qLie, really: qReally, connect: qConnect
  }[t](q);

  const controls = t === "connect" ? "" : (G.mode === "host"
    ? `<div class="row" style="margin-top:3vmin">
         <button class="btn primary big" id="reveal">Reveal the answer ${KEY("space")}</button>
         <button class="btn ghost" id="skip">Skip</button>
       </div>`
    : "");

  paint(`<div class="screen">
    ${topBar()}
    ${timed ? `<div class="timerrow"><div class="timer" id="twrap"><i id="tbar"></i></div><span class="secs" id="secs">${m.time}</span></div>` : ""}
    <div class="grow center" style="display:flex;flex-direction:column;gap:3.4vmin;justify-content:center">
      ${body}
      ${controls}
    </div>
    ${foot(timed ? [`${KEY("space")}pause`] : t === "connect" ? [] : [`${KEY("space")}reveal`])}
  </div>`);

  if (t === "connect") return wireConnect();
  if (G.mode === "host") { $("#reveal").onclick = () => goReveal(); $("#skip").onclick = () => afterQuestion(); }
  if (timed) runTimer(m.time, () => goReveal());
}

/* --- question bodies --- */
function qMultipleChoice(q) {
  return `<h2 class="q">${esc(q.q)}</h2>
    <div class="opts">${q.options.map((o, i) => `<div class="opt" data-i="${i}">
      <span class="lt">${"ABCD"[i]}</span><span>${esc(o)}</span></div>`).join("")}</div>`;
}
function qOdd(q) {
  return `<h2 class="q sm">Which one does not belong?</h2>
    <div class="tiles">${q.items.map((it, i) => `<div class="tile" data-i="${i}">${esc(it)}</div>`).join("")}</div>`;
}
function qEmoji(q) {
  return `<div class="kicker">${esc(q.cat)}</div><div class="emo">${q.emoji}</div>`;
}
function qClosest(q) {
  return `<h2 class="q">${esc(q.q)}</h2><div class="kicker">Closest number wins it</div>`;
}
function qLie(q) {
  return `<h2 class="q sm">Two are true. One is a lie.</h2>
    <div class="opts one">${q.statements.map((s, i) => `<div class="opt" data-i="${i}">
      <span class="lt">${"ABC"[i]}</span><span>${esc(s)}</span></div>`).join("")}</div>`;
}
function qReally(q) {
  return `<h2 class="q">${esc(q.s)}</h2>
    <div class="tf"><div class="opt" data-i="1"><span>True</span></div><div class="opt" data-i="0"><span>False</span></div></div>`;
}
function qConnect(q) {
  const worth = [4, 3, 2, 1][Math.min(G.clueIdx, 3)];
  return `<div class="kicker">What links these? — worth <b style="color:var(--gold)">${worth} point${worth > 1 ? "s" : ""}</b> right now</div>
    <div class="clues">${q.clues.map((c, i) => `<div class="clue ${i > G.clueIdx ? "pending" : ""}">
      <span class="n">${i + 1}</span><span>${i <= G.clueIdx ? esc(c) : "• • •"}</span></div>`).join("")}</div>
    <div class="row" id="connectctl"></div>`;
}

/* =====================================================================
   THE CONNECTION — buzz-in flow, scored inline
   ===================================================================== */
function wireConnect() {
  const q = item(), worth = [4, 3, 2, 1][Math.min(G.clueIdx, 3)];
  const ctl = $("#connectctl");
  const live = G.teams.map((t, i) => ({ t, i })).filter(e => !G.lockedOut.has(e.i));

  if (G.buzzTeam === null) {
    ctl.innerHTML = `
      <button class="btn primary big" id="buzz">Somebody shouted STOP</button>
      ${G.clueIdx < 3 ? `<button class="btn big" id="nextclue">Next clue ${KEY("space")}</button>`
                      : `<button class="btn big" id="giveup">Nobody has it — reveal ${KEY("space")}</button>`}`;
    $("#buzz").onclick = () => {
      ctl.innerHTML = `<div style="width:100%"><div class="askwho" style="margin-bottom:1.6vmin">Who was it?</div>
        <div class="picks">${live.map(e => `<button class="pick" data-buzz="${e.i}">
          <span class="key">${e.i + 1}</span><i class="swatch" style="background:${e.t.color}"></i>
          <span class="nm">${esc(e.t.name)}</span></button>`).join("")}</div></div>`;
      ctl.querySelectorAll("[data-buzz]").forEach(b => b.onclick = () => { G.buzzTeam = +b.dataset.buzz; wireConnect(); });
    };
    if ($("#nextclue")) $("#nextclue").onclick = () => { G.clueIdx++; Sound.tick(); screenQuestion(); };
    if ($("#giveup")) $("#giveup").onclick = () => goReveal();
    return;
  }

  const buzzed = G.teams[G.buzzTeam];
  ctl.innerHTML = `<div style="width:100%;text-align:center">
    <div class="askwho" style="margin-bottom:1.6vmin">${esc(buzzed.name)} — were they right?</div>
    <div class="row"><button class="btn big good" id="yes">Yes — ${worth} point${worth > 1 ? "s" : ""}</button>
    <button class="btn big bad" id="no">No</button></div></div>`;
  $("#yes").onclick = () => {
    buzzed.score += worth;
    Sound.right(); goReveal({ winner: buzzed.name, gained: worth });
  };
  $("#no").onclick = () => {
    Sound.wrong(); G.lockedOut.add(G.buzzTeam); G.buzzTeam = null;   // index, so duplicate names can't collide
    if (G.lockedOut.size >= G.teams.length || G.clueIdx >= 3) return goReveal();
    G.clueIdx++; screenQuestion();
  };
}

/* =====================================================================
   CLOSEST WINS — collect guesses, then count up to the truth
   ===================================================================== */
function screenCollectGuesses() {
  stopTimer(); G.phase = "collect";
  const q = item();
  paint(`<div class="screen">
    ${topBar()}
    <div class="grow center" style="display:flex;flex-direction:column;gap:3vmin;justify-content:center">
      <h2 class="q sm">${esc(q.q)}</h2>
      <div class="kicker">Everyone says their number out loud at the same time, then type them in</div>
      <div class="betrows">${G.teams.map((t, i) => `<div class="betrow">
        <i class="swatch" style="background:${t.color}"></i>
        <span class="nm">${esc(t.name)}</span>
        <input type="text" inputmode="decimal" data-g="${i}" placeholder="—">
      </div>`).join("")}</div>
      <button class="btn primary big" id="lockguess">Lock them in ${KEY("enter")}</button>
    </div>
    ${foot([`${KEY("enter")}reveal`])}
  </div>`);
  const inputs = [...stage().querySelectorAll("[data-g]")];
  inputs.forEach((inp, i) => {
    inp.onkeydown = e => {
      e.stopPropagation();
      if (e.key === "Enter") { e.preventDefault(); if (i < inputs.length - 1) inputs[i + 1].focus(); else $("#lockguess").click(); }
    };
  });
  inputs[0].focus();
  $("#lockguess").onclick = () => {
    inputs.forEach((inp, i) => { const v = parseFloat(String(inp.value).replace(/[^0-9.\-]/g, "")); if (!isNaN(v)) G.guesses[i] = v; });
    goReveal();
  };
}

/* =====================================================================
   FINAL WAGER
   ===================================================================== */
function screenWagerBets() {
  stopTimer(); G.phase = "bets";
  paint(`<div class="screen">
    ${topBar()}
    <div class="grow center" style="display:flex;flex-direction:column;gap:3vmin;justify-content:center">
      <h2 class="q sm">Place your bets.</h2>
      <div class="kicker">Write it down first, then type it in. Max is your score — or 3 if you're on nothing.</div>
      <div class="betrows">${G.teams.map((t, i) => `<div class="betrow">
        <i class="swatch" style="background:${t.color}"></i>
        <span class="nm">${esc(t.name)}</span>
        <span class="have">has ${t.score}</span>
        <input type="text" inputmode="numeric" data-b="${i}" value="${Math.max(3, t.score)}">
      </div>`).join("")}</div>
      <button class="btn primary big" id="lockbets">Bets are in ${KEY("enter")}</button>
    </div>
    ${foot([`${KEY("enter")}continue`])}
  </div>`);
  const inputs = [...stage().querySelectorAll("[data-b]")];
  inputs.forEach((inp, i) => {
    inp.onkeydown = e => { e.stopPropagation(); if (e.key === "Enter") { e.preventDefault(); i < inputs.length - 1 ? inputs[i + 1].focus() : $("#lockbets").click(); } };
  });
  inputs[0].focus(); inputs[0].select();
  $("#lockbets").onclick = () => {
    inputs.forEach((inp, i) => {
      const cap = Math.max(3, G.teams[i].score);
      let v = parseInt(String(inp.value).replace(/[^0-9]/g, ""), 10); if (isNaN(v)) v = 0;
      G.bets[i] = Math.max(0, Math.min(cap, v));
    });
    G.mode === "party" ? screenPreroll() : screenQuestion();
  };
}

function screenCollectWagerAnswers() {
  stopTimer(); G.phase = "wageranswers";
  const q = item();
  paint(`<div class="screen">
    ${topBar()}
    <div class="grow center" style="display:flex;flex-direction:column;gap:2.6vmin;justify-content:center">
      <h2 class="q sm">${esc(q.q)}</h2>
      <div class="kicker">Lock in each team's answer</div>
      <div class="betrows">${G.teams.map((t, i) => `<div class="betrow">
        <i class="swatch" style="background:${t.color}"></i>
        <span class="nm">${esc(t.name)}</span>
        <span class="have">bet ${G.bets[i] ?? 0}</span>
        <span class="abcd">${[0,1,2,3].map(k => `<button data-v="${i}:${k}">${"ABCD"[k]}</button>`).join("")}</span>
      </div>`).join("")}</div>
      <button class="btn primary big" id="settle">Settle it ${KEY("enter")}</button>
    </div>
    ${foot([`${KEY("enter")}reveal`])}
  </div>`);
  stage().querySelectorAll("[data-v]").forEach(b => b.onclick = () => {
    const [i, k] = b.dataset.v.split(":").map(Number);
    G.votes[i] = k;
    stage().querySelectorAll(`[data-v^="${i}:"]`).forEach(x => x.classList.toggle("on", x === b));
  });
  $("#settle").onclick = () => goReveal();
}

/* =====================================================================
   REVEAL
   ===================================================================== */
function goReveal(extra = {}) {
  stopTimer();
  const t = round().type;
  if (t === "closest" && G.phase !== "collect" && !Object.keys(G.guesses).length) return screenCollectGuesses();
  if (t === "wager" && G.phase !== "wageranswers") return screenCollectWagerAnswers();
  screenReveal(extra);
}

function screenReveal(extra = {}) {
  G.phase = "reveal";
  const token = ++G.revealToken;
  const t = round().type, q = item();
  Sound.reveal();
  let body = "";

  if (t === "snap") {
    body = `<h2 class="q sm">${esc(q.q)}</h2>
      <div class="opts">${q.options.map((o, i) => `<div class="opt ${i === q.answer ? "right" : "fade"}">
        <span class="lt">${"ABCD"[i]}</span><span>${esc(o)}</span></div>`).join("")}</div>`;
  }
  else if (t === "odd") {
    body = `<div class="tiles">${q.items.map((it, i) => `<div class="tile ${i === q.answer ? "right" : "fade"}">${esc(it)}</div>`).join("")}</div>
      <div class="answerline">${esc(q.because)}</div>`;
  }
  else if (t === "emoji") {
    body = `<div class="emo" style="font-size:clamp(34px,9vmin,110px)">${q.emoji}</div>
      <div class="answerline">${esc(q.answer)}</div>`;
  }
  else if (t === "lie") {
    body = `<div class="opts one">${q.statements.map((s, i) => `<div class="opt ${i === q.lie ? "" : "fade"}" ${i === q.lie ? 'style="border-color:var(--bad);background:rgba(255,92,108,.12)"' : ""}>
        <span class="lt" ${i === q.lie ? 'style="background:var(--bad);color:#2A0A0E;font-weight:600"' : ""}>${"ABC"[i]}</span><span>${esc(s)}</span></div>`).join("")}</div>
      <div class="answerline" style="color:var(--bad)">${"ABC"[q.lie]} is the lie</div>`;
  }
  else if (t === "really") {
    body = `<h2 class="q sm">${esc(q.s)}</h2>
      <div class="answerline" style="font-size:clamp(34px,9vmin,110px);color:${q.t ? "var(--good)" : "var(--bad)"}">${q.t ? "TRUE" : "FALSE"}</div>`;
  }
  else if (t === "connect") {
    body = `<div class="clues">${q.clues.map((c, i) => `<div class="clue"><span class="n">${i + 1}</span><span>${esc(c)}</span></div>`).join("")}</div>
      <div class="answerline">${esc(q.answer)}</div>
      ${extra.winner ? `<div class="verdict">${esc(extra.winner)} takes ${extra.gained}</div>` : `<div class="verdict">Nobody got it</div>`}`;
  }
  else if (t === "closest") {
    body = `<h2 class="q sm">${esc(q.q)}</h2>
      <div class="bignum" id="countup">0<small>${esc(q.unit)}</small></div>
      <div class="picks" id="closestrows"></div>`;
  }
  else if (t === "wager") {
    body = `<h2 class="q sm">${esc(q.q)}</h2>
      <div class="opts">${q.options.map((o, i) => `<div class="opt ${i === q.answer ? "right" : "fade"}">
        <span class="lt">${"ABCD"[i]}</span><span>${esc(o)}</span></div>`).join("")}</div>
      <div class="picks" id="wagerrows"></div>`;
  }

  const needsScoring = SCORED.includes(t);
  paint(`<div class="screen">
    ${topBar()}
    <div class="grow center" style="display:flex;flex-direction:column;gap:2.8vmin;justify-content:center">
      ${body}
      <div class="fact">${esc(q.fact)}</div>
      ${needsScoring || t === "closest" ? "" : `<button class="btn primary big" id="next">${isLast() ? "Final scores" : "Next"} ${KEY("space")}</button>`}
    </div>
    ${foot([needsScoring ? `${KEY("space")}score it` : `${KEY("space")}next`])}
  </div>`);

  if (t === "closest") settleClosest(q, token);
  if (t === "wager") settleWager(q);
  if (!needsScoring && $("#next")) $("#next").onclick = afterQuestion;
  if (needsScoring) setTimeout(() => { if (G.phase === "reveal" && G.revealToken === token) screenScore(); },
    G.mode === "party" ? 2800 : 1800);
}

function settleClosest(q, token) {
  const entries = G.teams.map((t, i) => ({ t, i, g: G.guesses[i] })).filter(e => e.g !== undefined && isFinite(e.g));
  const best = entries.length ? Math.min(...entries.map(e => Math.abs(e.g - q.value))) : Infinity;
  const winners = entries.filter(e => Math.abs(e.g - q.value) === best);
  const exact = best === 0;
  winners.forEach(w => { w.t.score += exact ? 5 : 3; });

  // count up to the real number
  const node = $("#countup"); const dur = 1300, t0 = performance.now();
  const step = now => {
    if (G.revealToken !== token || !node.isConnected) return;   // screen moved on; abandon quietly
    const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
    node.innerHTML = `${fmt(Math.round(q.value * e * 100) / 100)}<small>${esc(q.unit)}</small>`;
    if (p < 1) { requestAnimationFrame(step); return; }
    node.innerHTML = `${fmt(q.value)}<small>${esc(q.unit)}</small>`;
    Sound.right();
    const rows = $("#closestrows"); if (!rows) return;
    {
      rows.innerHTML = entries.sort((a, b) => Math.abs(a.g - q.value) - Math.abs(b.g - q.value))
        .map(e => { const win = winners.includes(e);
          return `<div class="pick ${win ? "on" : ""}"><i class="swatch" style="background:${e.t.color}"></i>
            <span class="nm">${esc(e.t.name)}</span>
            <span style="font-family:var(--mono)">${fmt(e.g)}</span>
            <span class="tick" style="opacity:${win ? 1 : 0}">+${exact ? 5 : 3}</span></div>`; }).join("");
      const b = document.createElement("button");
      b.className = "btn primary big"; b.id = "next"; b.innerHTML = `${isLast() ? "Final scores" : "Next"} <b>space</b>`;
      b.onclick = afterQuestion; rows.after(b);
    }
  };
  requestAnimationFrame(step);
}

function settleWager(q) {
  const rows = G.teams.map((t, i) => {
    const bet = G.bets[i] ?? 0, vote = G.votes[i], got = vote === q.answer;
    if (vote !== undefined) t.score += got ? bet : -bet;
    t.score = Math.max(0, t.score);
    return `<div class="pick ${got ? "on" : ""}" ${!got ? 'style="border-color:var(--bad)"' : ""}>
      <i class="swatch" style="background:${t.color}"></i><span class="nm">${esc(t.name)}</span>
      <span style="font-family:var(--mono);color:${got ? "var(--good)" : "var(--bad)"}">${vote === undefined ? "—" : (got ? "+" : "−") + bet}</span></div>`;
  }).join("");
  $("#wagerrows").innerHTML = rows;
  Sound.right();
}

/* =====================================================================
   SCORING PANEL — one tap per team, then move on
   ===================================================================== */
function screenScore() {
  G.phase = "score";
  const pts = meta().pts;
  paint(`<div class="screen">
    ${topBar()}
    <div class="grow center" style="display:flex;flex-direction:column;gap:3vmin;justify-content:center">
      <div class="askwho">Who got it? — ${pts} point${pts > 1 ? "s" : ""} each</div>
      <div class="picks" id="picks">${G.teams.map((t, i) => `<button class="pick" data-p="${i}">
        <span class="key">${i + 1}</span><i class="swatch" style="background:${t.color}"></i>
        <span class="nm">${esc(t.name)}</span><span class="tick">✓</span></button>`).join("")}</div>
      <div class="row">
        <button class="btn ghost" id="all">Everyone ${KEY("A")}</button>
        <button class="btn ghost" id="none">Nobody ${KEY("N")}</button>
        <button class="btn primary big" id="next">${isLast() ? "Final scores" : "Next"} ${KEY("space")}</button>
      </div>
    </div>
    ${foot([`${KEY("1-6")}toggle`, `${KEY("space")}next`])}
  </div>`);
  const sync = () => stage().querySelectorAll("[data-p]").forEach(b => b.classList.toggle("on", G.picks.has(+b.dataset.p)));
  stage().querySelectorAll("[data-p]").forEach(b => b.onclick = () => { togglePick(+b.dataset.p); sync(); });
  $("#all").onclick = () => { G.teams.forEach((t, i) => G.picks.add(i)); Sound.tick(); sync(); };
  $("#none").onclick = () => { G.picks.clear(); Sound.tick(); sync(); };
  $("#next").onclick = commitScore;
  sync();
}
function togglePick(i) {
  if (G.picks.has(i)) { G.picks.delete(i); Sound.tick(); } else { G.picks.add(i); Sound.right(); }
}
function commitScore() {
  const pts = meta().pts;
  G.picks.forEach(i => G.teams[i].score += pts);
  afterQuestion();
}

/* =====================================================================
   FLOW
   ===================================================================== */
function afterQuestion() {
  stopTimer();
  if (G.qi < round().items.length - 1) { G.qi++; return nextQuestion(); }
  if (G.ri < G.plan.length - 1) return screenScoreboard();
  screenWinner();
}

function screenScoreboard() {
  G.phase = "scoreboard";
  const sorted = G.teams.map((t, i) => ({ t, gained: t.score - (G.roundStartScores[i] ?? 0) })).sort((a, b) => b.t.score - a.t.score);
  const top = Math.max(1, ...G.teams.map(t => t.score));
  paint(`<div class="screen">
    <div class="bar"><span class="pill">After round <b>${G.ri + 1}</b></span><span class="spacer"></span>
      <span class="pill">${esc(RT[G.plan[G.ri + 1].type].name)} is next</span></div>
    <div class="grow center" style="display:flex;flex-direction:column;gap:4vmin;justify-content:center">
      <h2 class="roundname" style="font-size:clamp(30px,7.4vmin,92px)">Standings</h2>
      <div class="board">${sorted.map((e, r) => `<div class="brow ${r === 0 ? "lead" : ""}">
        <span class="rank">${r + 1}</span>
        <span class="nm">${esc(e.t.name)}</span>
        <span class="track"><i class="fill" style="background:${e.t.color};width:0"></i></span>
        <span class="sc">${e.t.score}</span>
        <span class="delta">${e.gained > 0 ? "+" + e.gained : ""}</span>
      </div>`).join("")}</div>
      ${G.mode === "host" ? `<div class="row"><button class="btn ghost" id="adjust">Adjust scores</button></div>` : ""}
      <button class="btn primary big" id="next">Round ${G.ri + 2} ${KEY("space")}</button>
    </div>
    ${foot([`${KEY("space")}continue`])}
  </div>`);
  requestAnimationFrame(() => stage().querySelectorAll(".fill").forEach((f, r) => {
    f.style.width = Math.round((sorted[r].t.score / top) * 100) + "%";
  }));
  Sound.round();
  $("#next").onclick = () => { G.ri++; screenRoundCard(); };
  if ($("#adjust")) $("#adjust").onclick = screenAdjust;
}

function screenAdjust() {
  G.phase = "adjust";
  paint(`<div class="screen">
    <div class="bar"><span class="pill">Host controls</span></div>
    <div class="grow center" style="display:flex;flex-direction:column;gap:3vmin;justify-content:center">
      <h2 class="q sm">Fix anything.</h2>
      <div class="betrows">${G.teams.map((t, i) => `<div class="betrow">
        <i class="swatch" style="background:${t.color}"></i><span class="nm">${esc(t.name)}</span>
        <span class="abcd"><button data-adj="${i}:-1">−</button><button data-adj="${i}:1">+</button></span>
        <input type="text" inputmode="numeric" data-s="${i}" value="${t.score}">
      </div>`).join("")}</div>
      <button class="btn primary big" id="back">Done ${KEY("space")}</button>
    </div>
    ${foot([`${KEY("space")}done`])}
  </div>`);
  const sync = () => stage().querySelectorAll("[data-s]").forEach((inp, i) => inp.value = G.teams[i].score);
  stage().querySelectorAll("[data-adj]").forEach(b => b.onclick = () => {
    const [i, d] = b.dataset.adj.split(":").map(Number);
    G.teams[i].score = Math.max(0, G.teams[i].score + d); Sound.tick(); sync();
  });
  stage().querySelectorAll("[data-s]").forEach((inp, i) => {
    inp.onkeydown = e => e.stopPropagation();
    inp.oninput = () => { const v = parseInt(inp.value.replace(/[^0-9]/g, ""), 10); G.teams[i].score = isNaN(v) ? 0 : v; };
  });
  $("#back").onclick = screenScoreboard;
}

function screenWinner() {
  G.phase = "winner"; stopTimer(); Sound.win();
  const sorted = G.teams.slice().sort((a, b) => b.score - a.score);
  const top = sorted[0].score, champs = sorted.filter(t => t.score === top);
  paint(`<div class="screen center">
    <div style="display:flex;flex-direction:column;align-items:center;gap:2.4vmin;width:100%">
      <div class="trophy">${champs.length > 1 ? "🤝" : "🏆"}</div>
      <div class="roundno">${champs.length > 1 ? "It's a draw" : "Winner"}</div>
      <h2 class="winname">${champs.map(c => esc(c.name)).join(" & ")}</h2>
      <div class="board" style="margin-top:2.4vmin">${sorted.map((t, r) => `<div class="brow ${r === 0 ? "lead" : ""}">
        <span class="rank">${r + 1}</span><span class="nm">${esc(t.name)}</span>
        <span class="track"><i class="fill" style="background:${t.color};width:0"></i></span>
        <span class="sc">${t.score}</span></div>`).join("")}</div>
      <div class="row" style="margin-top:2.4vmin">
        <button class="btn primary big" id="again">Play again ${KEY("space")}</button>
        <button class="btn ghost big" id="menu">Change teams</button>
      </div>
    </div>
  </div>`);
  requestAnimationFrame(() => stage().querySelectorAll(".fill").forEach((f, r) => {
    f.style.width = Math.round((sorted[r].score / Math.max(1, top)) * 100) + "%";
  }));
  $("#again").onclick = () => { G.teams.forEach(t => t.score = 0); buildPlan(); screenRoundCard(); };
  $("#menu").onclick = () => { G.teams.forEach(t => t.score = 0); screenSetup(); };
}

/* =====================================================================
   KEYBOARD — one key does the right thing at every point
   ===================================================================== */
function primary() {
  Sound.up();
  switch (G.phase) {
    case "setup":      return startGame();
    case "roundcard":  return nextQuestion();
    case "preroll":    return;
    case "question":
      if (round().type === "connect") { const b = $("#nextclue") || $("#giveup"); return b && b.click(); }
      if (G.mode === "host") return goReveal();
      G.paused = !G.paused;                              // party mode: space only pauses
      document.body.classList.toggle("paused", G.paused);
      flashToast(G.paused ? "Paused" : "Running");
      return;
    case "collect":    return $("#lockguess") && $("#lockguess").click();
    case "bets":       return $("#lockbets") && $("#lockbets").click();
    case "wageranswers": return $("#settle") && $("#settle").click();
    case "reveal": {
      const n = $("#next"); if (n) return n.click();
      if (SCORED.includes(round().type)) return screenScore();
      return;                                            // count-up still running
    }
    case "score":      return commitScore();
    case "scoreboard": return $("#next").click();
    case "adjust":     return screenScoreboard();
    case "winner":     return $("#again").click();
  }
}

document.addEventListener("keydown", e => {
  if (e.target.tagName === "INPUT") return;
  const k = e.key.toLowerCase();

  if (k === "m") { const muted = Sound.toggle(); flashToast(muted ? "Muted" : "Sound on"); return; }
  if (k === "escape") {
    if (G.phase === "setup") return;
    if (confirm("Leave the game and go back to the menu?")) { stopTimer(); clearInterval(G.prerollIv); G.teams.forEach(t => t.score = 0); screenSetup(); }
    return;
  }
  if (k === " " || k === "enter") { e.preventDefault(); return primary(); }

  if (G.phase === "score") {
    if (k === "a") return $("#all").click();
    if (k === "n") return $("#none").click();
    const n = parseInt(k, 10);
    if (n >= 1 && n <= G.teams.length) { togglePick(n - 1); stage().querySelectorAll("[data-p]").forEach(b => b.classList.toggle("on", G.picks.has(+b.dataset.p))); }
    return;
  }
  // The Connection: 1-6 names the team that shouted, then Y / N judges them
  if (G.phase === "question" && round().type === "connect") {
    const n = parseInt(k, 10);
    if (n >= 1 && n <= G.teams.length) {
      const sel = `[data-buzz="${n - 1}"]`;
      let btn = stage().querySelector(sel);
      if (!btn && $("#buzz")) { $("#buzz").click(); btn = stage().querySelector(sel); }
      if (btn) btn.click();
      return;
    }
    if (k === "y" && $("#yes")) return $("#yes").click();
    if (k === "n" && $("#no")) return $("#no").click();
  }
});

function flashToast(msg) {
  const d = document.createElement("div");
  d.style.cssText = "position:fixed;bottom:4vmin;left:50%;transform:translateX(-50%);background:var(--card);border:1px solid var(--line);border-radius:999px;padding:1.2vmin 3vmin;font-family:var(--mono);font-size:1.6vmin;letter-spacing:.2em;text-transform:uppercase;color:var(--ink-2);z-index:50";
  d.textContent = msg; document.body.appendChild(d); setTimeout(() => d.remove(), 1200);
}

/* keep a party from being ruined by a sleeping laptop */
if ("wakeLock" in navigator) {
  const keepAwake = () => navigator.wakeLock.request("screen").catch(() => {});
  document.addEventListener("click", function once() { keepAwake(); document.removeEventListener("click", once); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") keepAwake(); });
}

screenSetup();
