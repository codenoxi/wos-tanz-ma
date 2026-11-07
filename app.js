(() => {
  'use strict';

  // ---------- Daten & Konstanten ----------
  const DATA = window.TANZ_DATA;
  const STYLES = DATA.styles;           // Reihenfolge = Reihenfolge der Buttons
  const TRACKS = DATA.tracks;           // {i: id, t: titel, a: interpret, p: preview-url, s: [stil-index]}
  const LESSON_LEN = 10;
  const DAY_GOAL = 20;
  const STORE_KEY = 'wostanzma.v1';
  const MAX_BOX = 5;
  // Gewicht je Lernstufe: Stufe 0 (unsicher) kommt ~10x so oft dran wie Stufe 5 (sitzt)
  const BOX_WEIGHT = [10, 7, 4.5, 2.5, 1.5, 1];
  const RING = 2 * Math.PI * 45;

  const TIPS = {
    'langsamer-walzer': '3/4-Takt, langsam und getragen (ca. 28–30 Takte/Min). Weiches „1-2-3“, viel Schwung.',
    'wiener-walzer': '3/4-Takt wie der Langsame Walzer, aber doppelt so schnell (ca. 58–60 Takte/Min). Dreht sich förmlich von selbst.',
    'tango': '2/4- bzw. 4/4-Takt, ca. 31–33 Takte/Min. Abgehackt, staccato, marschartige Akzente.',
    'quickstep': '4/4-Takt, schnell (ca. 50–52 Takte/Min). Swing/Big-Band-Sound, fröhlich und hüpfend.',
    'discofox': '4/4-Takt, gleichmäßiger Beat (ca. 120–135 BPM). Pop, Schlager, Disco – alles, wozu man auf der Hochzeit tanzt.',
    'cha-cha-cha': '4/4-Takt, ca. 30–32 Takte/Min. Latin-Pop mit dem typischen „Cha-Cha-Cha“-Rhythmus auf 4 und 1.',
    'rumba': '4/4-Takt, langsam (ca. 25–27 Takte/Min). Romantisch, gefühlvoll, Latin-Ballade.',
    'samba': '2/4-Takt, ca. 50–52 Takte/Min. Brasilianisch, federnd, viel Percussion („Bounce“).',
    'mambo': '4/4-Takt, flotter Latin-Party-Rhythmus. Schneller und treibender als Cha-Cha, oft mit Bläsern.',
    'jive': '4/4-Takt, ca. 42–44 Takte/Min. Rock ’n’ Roll und Swing, sehr energiegeladen.',
    'paso-doble': '2/4-Takt, ca. 60–62 Takte/Min. Spanischer Marsch, dramatisch, Stierkampf-Stimmung.',
    'polka': '2/4-Takt, schnell und hüpfend. Blasmusik, „um-pa um-pa“.',
    'boarischer': '2/4- bzw. 4/4-Takt, gemütlicher als die Polka. Volksmusik, „Hupf“ auf jedem zweiten Schritt.',
  };

  // Tänze, die man leicht verwechselt – werden öfter als Ablenkung angeboten
  const SIMILAR_GROUPS = [
    ['langsamer-walzer', 'wiener-walzer'],
    ['tango', 'paso-doble'],
    ['quickstep', 'jive', 'discofox'],
    ['cha-cha-cha', 'rumba', 'mambo', 'samba'],
    ['polka', 'boarischer', 'paso-doble'],
    ['discofox', 'cha-cha-cha'],
  ];
  const styleIndex = Object.fromEntries(STYLES.map((s, i) => [s.id, i]));
  const similar = STYLES.map(() => new Set());
  for (const g of SIMILAR_GROUPS) {
    for (const a of g) for (const b of g) if (a !== b) similar[styleIndex[a]].add(styleIndex[b]);
  }

  const tracksByStyle = STYLES.map(() => []);
  TRACKS.forEach((t, ti) => t.s.forEach(si => tracksByStyle[si].push(ti)));

  // ---------- Speicher (vorerst im Browser) ----------
  const defaultState = () => ({
    v: 1, round: 0, xp: 0, bestCombo: 0,
    styles: {},   // stil-id -> {box, right, wrong, last}
    tracks: {},   // track-id -> {last, right, wrong}
    conf: {},     // richtig-id -> {getippt-id: anzahl}
    retry: [],    // falsch beantwortete Songs: {t: track-id, s: stil-index, due: runde}
    day: { date: null, count: 0, streak: 0 },
    settings: { choices: 4, disabled: [] },
  });

  let state = load();
  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const s = Object.assign(defaultState(), JSON.parse(raw));
        s.settings = Object.assign(defaultState().settings, s.settings);
        return s;
      }
    } catch (e) { /* privates Fenster o. Ä. */ }
    return defaultState();
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* egal */ }
  }
  const styleStat = idx => (state.styles[STYLES[idx].id] ||= { box: 0, right: 0, wrong: 0, last: -99 });
  const trackStat = id => (state.tracks[id] ||= { last: -99, right: 0, wrong: 0 });

  function enabledStyles() {
    const list = STYLES.map((_, i) => i)
      .filter(i => tracksByStyle[i].length && !state.settings.disabled.includes(STYLES[i].id));
    return list.length >= 2 ? list : STYLES.map((_, i) => i);
  }

  // ---------- Hilfsfunktionen ----------
  const $ = id => document.getElementById(id);
  const rand = n => Math.floor(Math.random() * n);
  function weightedPick(items, weightOf) {
    const ws = items.map(weightOf);
    let r = Math.random() * ws.reduce((a, b) => a + b, 0);
    for (let i = 0; i < items.length; i++) { r -= ws[i]; if (r <= 0) return items[i]; }
    return items[items.length - 1];
  }
  function localDate(offsetDays = 0) {
    const d = new Date(); d.setDate(d.getDate() + offsetDays);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  // ---------- Auswahl der nächsten Frage ----------
  const badTracks = new Set();   // Previews, die nicht laden
  let lastStyle = -1;

  function pickQuestion() {
    state.round++;
    const enabled = enabledStyles();

    // 1. Falsch beantwortete Songs kommen ein paar Runden später nochmal
    const dueIdx = state.retry.findIndex(r => r.due <= state.round && enabled.includes(r.s) && r.s !== lastStyle);
    if (dueIdx >= 0) {
      const r = state.retry.splice(dueIdx, 1)[0];
      const ti = TRACKS.findIndex(t => t.i === r.t);
      if (ti >= 0 && !badTracks.has(ti)) return { track: TRACKS[ti], style: r.s, retry: true };
    }

    // 2. Tanzstil nach Lernstufe gewichtet ziehen (schwache Tänze öfter)
    const pool = enabled.length > 1 ? enabled.filter(i => i !== lastStyle) : enabled;
    const style = weightedPick(pool, i => {
      const st = styleStat(i);
      const idle = Math.min((state.round - st.last) / 15, 1); // lange nicht gehört -> etwas öfter
      return BOX_WEIGHT[st.box] * (1 + idle);
    });

    // 3. Song: einer der am längsten nicht gespielten dieses Stils
    const candidates = tracksByStyle[style].filter(ti => !badTracks.has(ti));
    candidates.sort((a, b) => (state.tracks[TRACKS[a].i]?.last ?? -99) - (state.tracks[TRACKS[b].i]?.last ?? -99));
    const oldest = candidates.slice(0, Math.max(1, Math.ceil(candidates.length / 3)));
    return { track: TRACKS[oldest[rand(oldest.length)]], style, retry: false };
  }

  function buildChoices(q) {
    const enabled = enabledStyles();
    const n = Math.min(state.settings.choices || enabled.length, enabled.length);
    const others = enabled.filter(i => !q.track.s.includes(i));
    const myConf = state.conf[STYLES[q.style].id] || {};
    const picked = [];
    while (picked.length < n - 1 && others.length) {
      const c = weightedPick(others, i => {
        const id = STYLES[i].id;
        const back = (state.conf[id] || {})[STYLES[q.style].id] || 0;
        return 1 + (similar[q.style].has(i) ? 2 : 0) + 3 * (myConf[id] || 0) + 1.5 * back;
      });
      picked.push(c);
      others.splice(others.indexOf(c), 1);
    }
    return [q.style, ...picked].sort((a, b) => a - b);
  }

  // ---------- Audio ----------
  const audio = $('audio');
  const ring = $('ring');
  ring.style.strokeDasharray = RING;

  function setPlayingUI(playing) {
    $('playBtn').classList.toggle('playing', playing);
    $('playIcon').textContent = playing ? '❚❚' : '▶';
    $('playBtn').setAttribute('aria-label', playing ? 'Pause' : 'Abspielen');
  }
  function playCurrent() {
    if (audio.ended) audio.currentTime = 0;
    audio.play().catch(() => setPlayingUI(false));
  }
  audio.addEventListener('play', () => setPlayingUI(true));
  audio.addEventListener('pause', () => setPlayingUI(false));
  audio.addEventListener('ended', () => setPlayingUI(false));
  audio.addEventListener('timeupdate', () => {
    const dur = audio.duration && isFinite(audio.duration) ? audio.duration : 30;
    ring.style.strokeDashoffset = RING * (1 - Math.min(audio.currentTime / dur, 1));
  });
  audio.addEventListener('error', () => {
    if (!current || answered || !audio.src) return;
    badTracks.add(TRACKS.indexOf(current.track));
    state.round--;
    nextQuestion(); // still überspringen, zählt nicht
  });
  $('playBtn').addEventListener('click', () => (audio.paused ? playCurrent() : audio.pause()));

  // ---------- Ablauf ----------
  let current = null;
  let answered = false;
  let combo = 0;
  let lesson = null;

  function show(view) {
    for (const v of ['startView', 'quizView', 'doneView', 'statsView']) $(v).hidden = v !== view;
    window.scrollTo(0, 0);
  }

  function startLesson() {
    lesson = { n: 0, right: 0, xp: 0, bestCombo: 0, wrongStyles: {} };
    combo = 0;
    show('quizView');
    nextQuestion();
  }

  function nextQuestion() {
    if (lesson.n >= LESSON_LEN) return finishLesson();
    answered = false;
    current = pickQuestion();
    lastStyle = current.style;
    current.options = buildChoices(current);

    $('song').innerHTML = `<div class="song-hidden">${current.retry ? '🔁 Den hattest du falsch – nochmal!' : '🎵 Welcher Tanz ist das?'}</div>`;
    $('feedback').hidden = true;
    renderChoices();
    renderLessonBar();

    ring.style.strokeDashoffset = RING;
    audio.src = current.track.p;
    playCurrent();
  }

  function renderChoices() {
    $('choices').innerHTML = current.options.map((si, k) =>
      `<button class="choice" data-style="${si}">${k < 9 ? `<span class="key">${k + 1}</span>` : ''}${esc(STYLES[si].name)}</button>`
    ).join('');
  }

  function renderLessonBar() {
    $('lessonBar').style.width = `${(lesson.n / LESSON_LEN) * 100}%`;
    const c = $('combo');
    c.hidden = combo < 2;
    c.textContent = `🔥 ${combo}`;
  }

  function answer(guess) {
    if (answered) return;
    answered = true;
    const { track, style } = current;
    const correct = track.s.includes(guess);
    const st = styleStat(style);
    const ts = trackStat(track.i);
    const styleId = STYLES[style].id;
    const guessId = STYLES[guess].id;
    let gained = 0;

    if (correct) {
      st.box = Math.min(MAX_BOX, st.box + 1);
      st.right++; ts.right++;
      combo++;
      gained = 10 + Math.min(combo - 1, 5) * 2;
      lesson.right++;
    } else {
      st.box = Math.max(0, st.box - 2);
      st.wrong++; ts.wrong++;
      combo = 0;
      const c = (state.conf[styleId] ||= {});
      c[guessId] = (c[guessId] || 0) + 1;
      if (!current.retry) {
        state.retry.push({ t: track.i, s: style, due: state.round + 3 + rand(3) });
        state.retry = state.retry.slice(-10);
      }
      lesson.wrongStyles[style] = (lesson.wrongStyles[style] || 0) + 1;
    }
    st.last = state.round;
    ts.last = state.round;
    state.xp += gained;
    lesson.xp += gained;
    lesson.bestCombo = Math.max(lesson.bestCombo, combo);
    state.bestCombo = Math.max(state.bestCombo, combo);
    lesson.n++;
    countDay();
    save();

    // Buttons einfärben
    for (const b of $('choices').children) {
      const si = Number(b.dataset.style);
      b.disabled = true;
      if (track.s.includes(si)) b.classList.add('correct');
      else if (si === guess) b.classList.add('wrong');
    }

    // Song aufdecken
    $('song').innerHTML =
      `<div class="song-title">${esc(track.t)}</div>` +
      `<div class="song-artist">${esc(track.a)}</div>` +
      `<a href="https://open.spotify.com/track/${encodeURIComponent(track.i)}" target="_blank" rel="noopener">In Spotify öffnen ↗</a>`;

    const fb = $('feedback');
    fb.className = `feedback ${correct ? 'ok' : 'bad'}`;
    if (correct) {
      const praise = ['Richtig!', 'Genau!', 'Super!', 'Passt!', 'Sauber!'][rand(5)];
      $('feedbackTitle').textContent = combo >= 3 ? `${praise} 🔥 ${combo} in Folge  +${gained} XP` : `${praise}  +${gained} XP`;
      $('feedbackTip').innerHTML = `<strong>${esc(STYLES[style].name)}:</strong> ${esc(TIPS[styleId] || '')}`;
    } else {
      $('feedbackTitle').textContent = `Leider nein – das ist ${STYLES[style].name}`;
      $('feedbackTip').innerHTML =
        `<strong>${esc(STYLES[style].name)}:</strong> ${esc(TIPS[styleId] || '')}<br>` +
        `<strong>${esc(STYLES[guess].name)}</strong> (dein Tipp): ${esc(TIPS[guessId] || '')}`;
    }
    fb.hidden = false;
    $('nextBtn').textContent = lesson.n >= LESSON_LEN ? 'Lektion abschließen' : 'Weiter';
    renderLessonBar();
    renderHeader();
    $('nextBtn').focus({ preventScroll: true });
    fb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function countDay() {
    const today = localDate();
    const d = state.day;
    if (d.date !== today) {
      d.streak = d.date === localDate(-1) ? d.streak + 1 : 1;
      d.date = today;
      d.count = 0;
    }
    d.count++;
  }

  function finishLesson() {
    audio.pause();
    const r = lesson.right;
    $('doneEmoji').textContent = r >= 9 ? '🏆' : r >= 7 ? '🎉' : r >= 5 ? '👍' : '💪';
    $('doneTitle').textContent = r >= 9 ? 'Meisterhaft!' : r >= 7 ? 'Stark getanzt!' : r >= 5 ? 'Gut gemacht!' : 'Dranbleiben!';
    $('doneScore').textContent = `${r}/${LESSON_LEN}`;
    $('doneXp').textContent = `+${lesson.xp}`;
    $('doneCombo').textContent = lesson.bestCombo;
    const weak = Object.entries(lesson.wrongStyles).sort((a, b) => b[1] - a[1]).map(([si]) => STYLES[si].name);
    $('doneHint').textContent = weak.length
      ? `Diese Tänze kommen in der nächsten Lektion öfter: ${weak.join(', ')}.`
      : 'Keinen einzigen Fehler – die Lernstufen steigen.';
    show('doneView');
    renderHeader();
  }

  function goHome() {
    audio.pause();
    current = null;
    renderHeader();
    show('startView');
  }

  // ---------- Kopfzeile, Fortschritt, Einstellungen ----------
  function renderHeader() {
    const d = state.day;
    const active = d.date === localDate() || d.date === localDate(-1);
    $('dayStreak').textContent = `🔥 ${active ? d.streak : 0}`;
    $('xp').textContent = `⭐ ${state.xp}`;
    const todayCount = d.date === localDate() ? d.count : 0;
    $('dayGoalText').textContent = `${Math.min(todayCount, DAY_GOAL)} / ${DAY_GOAL} Songs`;
    $('dayGoalBar').style.width = `${Math.min(todayCount / DAY_GOAL, 1) * 100}%`;
  }

  function renderStats() {
    $('styleStats').innerHTML = STYLES.map((s, i) => {
      const st = state.styles[s.id];
      const seen = st ? st.right + st.wrong : 0;
      const box = st ? st.box : 0;
      const meta = seen ? `${Math.round((st.right / seen) * 100)} % · ${seen}× gehört` : 'noch nicht gespielt';
      const pips = Array.from({ length: MAX_BOX }, (_, k) => `<div class="pip${k < box ? ' on' : ''}"></div>`).join('');
      return `<div class="style-row${seen && box <= 1 ? ' weak' : ''}"><span class="name">${esc(s.name)}</span><span class="meta">${meta}</span><div class="pips" title="Stufe ${box} von ${MAX_BOX}">${pips}</div></div>`;
    }).join('');

    const pairs = [];
    for (const [a, m] of Object.entries(state.conf)) for (const [b, n] of Object.entries(m)) pairs.push([a, b, n]);
    pairs.sort((x, y) => y[2] - x[2]);
    const name = id => STYLES[styleIndex[id]]?.name || id;
    $('confusions').innerHTML = pairs.length
      ? pairs.slice(0, 8).map(([a, b, n]) => `<div class="confusion"><span><strong>${esc(name(a))}</strong> für ${esc(name(b))} gehalten</span><span>${n}×</span></div>`).join('')
      : '<p class="muted">Noch keine – weiter so!</p>';

    $('choiceCount').value = String(state.settings.choices);
    $('styleToggles').innerHTML = STYLES.map(s =>
      `<label><input type="checkbox" data-id="${s.id}" ${state.settings.disabled.includes(s.id) ? '' : 'checked'}>${esc(s.name)}</label>`
    ).join('');
    $('dataInfo').textContent = `${TRACKS.length} Songs aus ${STYLES.length} Spotify-Playlists · Stand ${DATA.updated}`;
  }

  $('styleToggles').addEventListener('change', e => {
    const id = e.target.dataset.id;
    if (!id) return;
    const dis = new Set(state.settings.disabled);
    e.target.checked ? dis.delete(id) : dis.add(id);
    if (STYLES.length - dis.size < 2) { e.target.checked = true; return; }
    state.settings.disabled = [...dis];
    save();
  });
  $('choiceCount').addEventListener('change', e => { state.settings.choices = Number(e.target.value); save(); });
  $('resetBtn').addEventListener('click', () => {
    if (!confirm('Wirklich den gesamten Fortschritt löschen?')) return;
    const settings = state.settings;
    state = defaultState();
    state.settings = settings;
    save();
    renderStats();
    renderHeader();
  });

  // ---------- Events ----------
  let statsReturn = 'startView';
  $('startBtn').addEventListener('click', startLesson);
  $('againBtn').addEventListener('click', startLesson);
  $('homeBtn').addEventListener('click', goHome);
  $('quitBtn').addEventListener('click', goHome);
  $('nextBtn').addEventListener('click', nextQuestion);
  $('choices').addEventListener('click', e => {
    const b = e.target.closest('.choice');
    if (b && !b.disabled) answer(Number(b.dataset.style));
  });
  $('statsBtn').addEventListener('click', () => {
    const visible = ['startView', 'quizView', 'doneView'].find(v => !$(v).hidden);
    if (!visible) return;
    if (visible === 'quizView') audio.pause();
    statsReturn = visible;
    renderStats();
    show('statsView');
  });
  $('closeStatsBtn').addEventListener('click', () => { renderHeader(); show(statsReturn); });

  document.addEventListener('keydown', e => {
    if ($('quizView').hidden || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === ' ') { e.preventDefault(); audio.paused ? playCurrent() : audio.pause(); return; }
    if (e.key === 'Enter' && answered) { e.preventDefault(); nextQuestion(); return; }
    const k = Number(e.key);
    if (!answered && k >= 1 && k <= 9 && current.options[k - 1] !== undefined) answer(current.options[k - 1]);
  });

  renderHeader();
})();
