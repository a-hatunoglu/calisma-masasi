/* Öğrenme uygulaması motoru — her ders sayfası window.DERS_VERI ile bu dosyayı yükler. */
(function () {
  'use strict';
  const D = window.DERS_VERI;
  const C = D.course;
  const MODS = D.modules.slice().sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  const MOD = Object.fromEntries(MODS.map(m => [m.id, m]));
  const QIDX = {};
  for (const m of MODS) for (const q of m.questions) QIDX[q.id] = { q, m };
  const $app = document.getElementById('app');
  document.body.dataset.course = C.id;
  document.title = C.title;

  /* ---------------- kalıcı durum ---------------- */
  const KEY = 'ogrenme:' + C.id;
  const DAY = 86400000;
  let S = load();
  save();
  function load() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* tarayıcı depolaması kapalı olabilir */ }
    s = s || {};
    // Ortopedik dersi için müfredat ve zihin haritası baştan yapılandırıldığından ilerlemeyi sıfırla, kişisel notları koru:
    if (C.id === 'ortopedik' && s.ortoVersion !== '2026-v2') {
      s.mods = {};
      s.wrong = {};
      s.cards = {};
      s.plan = null;
      s.log = [];
      s.ortoVersion = '2026-v2';
    }
    // Pulmoner dersi için zihin haritası ve 2026-2027 müfredatı baştan yapılandırıldığından ilerlemeyi sıfırla, kişisel notları koru:
    if (C.id === 'pulmoner' && s.pulmVersion !== '2026-v2') {
      s.mods = {};
      s.wrong = {};
      s.cards = {};
      s.plan = null;
      s.log = [];
      s.pulmVersion = '2026-v2';
    }
    s.mods = s.mods || {}; s.wrong = s.wrong || {}; s.cards = s.cards || {}; s.plan = s.plan || null; s.log = s.log || [];
    s.notebook = s.notebook || {
      activeId: 'sayfa-1',
      pages: [
        { id: 'sayfa-1', title: 'Genel Notlar', text: '', updatedAt: Date.now() }
      ]
    };
    if (!s.notebook.pages || !s.notebook.pages.length) {
      s.notebook = {
        activeId: 'sayfa-1',
        pages: [{ id: 'sayfa-1', title: 'Genel Notlar', text: '', updatedAt: Date.now() }]
      };
    }
    return s;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* yok say */ } }
  function ms(id) {
    const x = S.mods[id] || (S.mods[id] = {});
    x.steps = x.steps || {}; x.recall = x.recall || {};
    return x;
  }
  function mastery(id) { const x = S.mods[id]; return x && x.quiz ? x.quiz.best : null; }
  function markStep(id, k) { const x = ms(id); if (!x.steps[k]) { x.steps[k] = Date.now(); save(); } }

  /* ---------------- yardımcılar ---------------- */
  const OK_TAGS = 'p|ul|ol|li|strong|em|br|table|thead|tbody|tr|th|td|h4|span|sub|sup|b|i|code';
  const tagRe = new RegExp('<(?!\\/?(' + OK_TAGS + ')\\b)', 'g');
  const safe = s => String(s == null ? '' : s).replace(tagRe, '&lt;');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const L = 'ABCDE';
  const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const today0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const fmtDate = t => new Date(t).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
  const fmtDow = t => new Date(t).toLocaleDateString('tr-TR', { weekday: 'long' });
  const TYPE_TR = { tek: 'Tek doğru', olumsuz: 'Olumsuz kök', oncul: 'Öncüllü', 'kac-tane': 'Kaç tanesi', vaka: 'Vaka', eslestirme: 'Eşleştirme', hesap: 'Hesap' };
  const BLOOM_TR = { hatirlama: 'Hatırlama', anlama: 'Anlama', uygulama: 'Uygulama', analiz: 'Analiz' };
  const DIFF_TR = { 1: 'Kolay', 2: 'Orta', 3: 'Zor' };
  function h(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }

  /* ---------------- kabuk ---------------- */
  const NAV = [
    ['#/', 'Bölümler'], ['#/program', 'Program'], ['#/tekrar', 'Tekrar'], ['#/kartlar', 'Kartlar'], ['#/deneme', 'Deneme sınavı'], ['#/notlar', 'Not defteri']
  ];
  if (C.hasCalc) NAV.push(['#/hesap', 'Hesap atölyesi']);
  if (C.id === 'biyoistatistik') NAV.push(['#/simulasyon', '🎯 Sınav Simülasyonu']);
  function shell(active, inner) {
    const nav = NAV.map(([href, t]) => `<a href="${href}"${active === href ? ' aria-current="page"' : ''}>${t}</a>`).join('');
    $app.innerHTML = `<header class="top"><a class="home" href="index.html">Çalışma masası</a><span class="sep">/</span>
      <a class="course-name" href="#/">${esc(C.title)}</a><nav aria-label="Ders menüsü">${nav}</nav></header><main id="main"></main>`;
    initToolDrawer();
    const main = document.getElementById('main');
    if (typeof inner === 'string') main.innerHTML = inner; else if (inner) main.appendChild(inner);
    window.scrollTo(0, 0);
    return main;
  }

  /* ---------------- hakimiyet eğrisi ---------------- */
  function traceSVG(animate) {
    const n = MODS.length, W = Math.max(640, n * 64 + 80), H = 230, padL = 44, padR = 24, top = 22, bot = 52;
    const x = i => padL + (n === 1 ? (W - padL - padR) / 2 : i * (W - padL - padR) / (n - 1));
    const y = v => top + (1 - v / 100) * (H - top - bot);
    let pts = [], dots = '', labels = '';
    MODS.forEach((m, i) => {
      const v = mastery(m.id);
      const cx = x(i), cy = v == null ? y(0) : y(v);
      if (v != null) pts.push([cx, cy]);
      const title = `${m.title}: ${v == null ? 'henüz çözülmedi' : '%' + v}`;
      dots += `<a href="#/m/${m.id}" aria-label="${esc(title)}"><title>${esc(title)}</title><circle class="pt${v == null ? ' empty' : ''}" cx="${cx}" cy="${cy}" r="6"/></a>`;
      labels += `<text class="lbl" x="${cx}" y="${H - bot + 22}" text-anchor="middle">${i + 1}</text>`;
    });
    let len = 0; for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const line = pts.length > 1 ? `<polyline class="line${animate ? ' draw' : ''}" style="--len:${Math.ceil(len) + 2}" points="${pts.map(p => p.join(',')).join(' ')}"/>` : '';
    const ylab = [0, 50, 100].map(v => `<text class="ylbl" x="${padL - 10}" y="${y(v) + 4}" text-anchor="end">%${v}</text>`).join('');
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Bölümlere göre en iyi sınav puanları">
      ${ylab}<line class="goal" x1="${padL}" x2="${W - padR}" y1="${y(80)}" y2="${y(80)}"/>
      <text class="ylbl" x="${W - padR}" y="${y(80) - 6}" text-anchor="end">hedef %80</text>
      ${line}${dots}${labels}
      <text class="ylbl" x="${padL}" y="${H - 8}">Bölüm sırası</text></svg>`;
  }

  /* ---------------- ders ana sayfası ---------------- */
  function nextStep() {
    for (const m of MODS) {
      const x = S.mods[m.id];
      const best = x && x.quiz ? x.quiz.best : null;
      if (best == null || best < 70) {
        const k = STEPS.find(s => !(x && x.steps && x.steps[s.k]));
        return { m, k: k ? k.k : 'sinav', resume: !!(x && Object.keys(x.steps || {}).length) };
      }
    }
    return null;
  }
  function viewHome() {
    currentModId = null;
    updateDrawerCounts();
    const totalQ = MODS.reduce((a, m) => a + m.questions.length, 0);
    const done = MODS.filter(m => (mastery(m.id) || 0) >= 70).length;
    const nx = nextStep();
    const dueCards = dueCardList().length, wrongN = Object.keys(S.wrong).length;
    const rows = MODS.map((m, i) => {
      const v = mastery(m.id), x = S.mods[m.id];
      const started = x && Object.keys(x.steps || {}).length;
      const pill = v == null ? (started ? '<span class="pill mid">Devam ediyor</span>' : '<span class="pill">Başlanmadı</span>')
        : v >= 80 ? `<span class="pill ok">%${v}</span>` : `<span class="pill mid">%${v}</span>`;
      return `<li><a href="#/m/${m.id}"><span class="no">${i + 1}</span>
        <span><span class="t">${esc(m.title)}</span>${m.subtitle ? `<div class="st">${esc(m.subtitle)}</div>` : ''}</span>
        <span class="meta">${m.questions.length} soru, ${m.flashcards.length} kart<br>~${m.estMinutes || 45} dk</span>
        <span class="barcell">${pill}</span></a></li>`;
    }).join('');
    const nxHtml = nx ? `<section class="next"><div><h2>${nx.resume ? 'Kaldığın yerden devam et' : 'Sıradaki bölüm'}</h2>
        <p>${esc(nx.m.title)}: ${STEPS.find(s => s.k === nx.k).t.toLowerCase()} adımı</p></div>
        <a class="btn" href="#/m/${nx.m.id}/${nx.k}">${nx.resume ? 'Devam et' : 'Başla'}</a></section>`
      : `<section class="next"><div><h2>Tüm bölümler %70'in üzerinde</h2><p>Şimdi karma deneme sınavıyla kalıcılığı test et.</p></div><a class="btn" href="#/deneme">Deneme sınavı</a></section>`;
    shell('#/', `
      <h1>${esc(C.title)}</h1>
      <p class="lede">${esc(C.blurb)}</p>
      ${C.info ? `<p class="muted small">${esc(C.info)}</p>` : ''}
      <section class="trace" aria-labelledby="trace-h">
        <div class="trace-head"><strong id="trace-h">Hakimiyet eğrisi</strong>
          <span class="muted small">${done}/${MODS.length} bölüm tamam, toplam ${totalQ} soru</span></div>
        ${traceSVG(true)}
      </section>
      ${nxHtml}
      <div class="section-title"><h2>Bölümler</h2><span class="muted small">Her bölüm: hedefler, ön test, öğrenme parçaları, ayırt etme, kartlar, sınav, özet</span></div>
      <ol class="modlist" role="list">${rows}</ol>
      <div class="section-title"><h2>Pekiştirme araçları</h2></div>
      <div class="tools">
        <a class="tool" href="#/program"><span class="count">${S.plan ? '' : 'yeni'}</span><h3>Çalışma programı</h3><p>Sınav tarihine göre gün gün plan; 1-3-7 gün aralıklı tekrarlar dahil.</p></a>
        <a class="tool" href="#/tekrar"><span class="count">${wrongN}</span><h3>Hata defteri ve karma tekrar</h3><p>Yanlışların, üst üste iki kez doğru yapana kadar geri gelir.</p></a>
        <a class="tool" href="#/kartlar"><span class="count">${dueCards}</span><h3>Bugünkü kartlar</h3><p>Leitner kutuları: bildiğin kart seyrek, bilemediğin sık gelir.</p></a>
        <a class="tool" href="#/deneme"><h3>Deneme sınavı</h3><p>Süreli, karışık bölümlerden; açıklamalar sınav sonunda.</p></a>
        <a class="tool" href="#/notlar"><span class="count">${S.notebook.pages.length} sayfa</span><h3>Not defteri & Sözlük</h3><p>${esc(C.title)} dersine özel notların ve tüm bölümlerin kavramlar sözlüğü.</p></a>
        ${C.hasCalc ? `<a class="tool" href="#/hesap"><h3>Hesap atölyesi</h3><p>Her seferinde yeni veri seti; adım adım çözüm.</p></a>` : ''}
        ${C.id === 'biyoistatistik' ? `<a class="tool" href="#/simulasyon" style="border-left: 4px solid var(--accent);"><span class="count">2 Mod</span><h3>🎯 Vize Sınavı Simülasyonu</h3><p>Hocanın derste çözdüğü Excel frekans tablosu, dağılım ölçüleri ve parametrik test şartları (Seçenek 1: Tablo Sınavı, Seçenek 2: Soru Soru Test).</p></a>` : ''}
      </div>
      <p class="foot">İlerlemen bu tarayıcıda saklanır. Kaynaklar: ${esc(C.sourceNote || 'ders slaytları')}.</p>`);
  }

  /* ---------------- modül adımları ---------------- */
  const STEPS = [
    { k: 'hedef', t: 'Hedefler' }, { k: 'on', t: 'Ön test' }, { k: 'ogren', t: 'Öğren' }, { k: 'ayirt', t: 'Ayırt et' },
    { k: 'kart', t: 'Kartlar' }, { k: 'sinav', t: 'Pekiştirme sınavı' }, { k: 'ozet', t: 'Özet' }
  ];
  function viewModule(id, step, arg) {
    const m = MOD[id]; if (!m) return viewHome();
    currentModId = id;
    if (drawerEl && drawerEl.classList.contains('open')) renderDrawerBody(); else updateDrawerCounts();
    step = step || firstOpenStep(id);
    const x = ms(id);
    const stepNav = STEPS.map(s => `<li><a href="#/m/${id}/${s.k}" class="${x.steps[s.k] ? 'done' : ''}"${s.k === step ? ' aria-current="step"' : ''}>${s.t}</a></li>`).join('');
    const main = shell('', `<div class="mod-head"><p class="muted small">Bölüm ${MODS.indexOf(m) + 1} / ${MODS.length}</p><h1>${esc(m.title)}</h1>
      ${m.subtitle ? `<p class="lede">${esc(m.subtitle)}</p>` : ''}<p class="src">Kaynak: ${m.sources.map(esc).join('; ')}</p></div>
      <div class="module"><ol class="steps" aria-label="Bölüm adımları">${stepNav}</ol><div id="stage"></div></div>`);
    const stage = main.querySelector('#stage');
    ({ hedef: stHedef, on: stOn, ogren: stOgren, ayirt: stAyirt, kart: stKart, sinav: stSinav, ozet: stOzet }[step] || stHedef)(m, stage, arg);
  }
  function firstOpenStep(id) { const x = ms(id); const s = STEPS.find(s => !x.steps[s.k]); return s ? s.k : 'sinav'; }
  function nextOf(k) { const i = STEPS.findIndex(s => s.k === k); return STEPS[i + 1]; }
  function footer(m, k, extra) {
    const nx = nextOf(k);
    return `<div class="step-foot"><a class="btn quiet" href="#/">Bölümlere dön</a>${extra || ''}${nx ? `<a class="btn" href="#/m/${m.id}/${nx.k}" data-complete="${k}">${nx.t} adımına geç</a>` : ''}</div>`;
  }
  function bindFooter(m, el) {
    el.querySelectorAll('[data-complete]').forEach(a => a.addEventListener('click', () => markStep(m.id, a.dataset.complete)));
  }

  function stHedef(m, el) {
    const minutes = m.estMinutes || 45;
    el.innerHTML = `<div class="panel"><h2>Bu bölümün sonunda</h2>
      <ul class="objectives">${m.objectives.map(o => `<li>${safe(o)}</li>`).join('')}</ul>
      <p class="muted">Tahmini süre: ${minutes} dakika. Önce 3 soruluk bir ön test var. Bilmemen normal; amaç beynini konuya hazırlamak. Yanlış yaptığın ön test soruları, konuyu okurken daha dikkatli bakmanı sağlar.</p>
      </div>${footer(m, 'hedef')}`;
    bindFooter(m, el);
  }

  function stOn(m, el) {
    let pre = m.questions.filter(q => q.pre);
    if (pre.length < 3) pre = pre.concat(m.questions.filter(q => !q.pre).slice(0, 3 - pre.length));
    el.innerHTML = `<div class="panel"><div class="notice info">Ön test: puanı sayılmaz. Tahmin etmekten çekinme; açıklamaları dikkatlice oku.</div><div id="qz"></div></div>`;
    runQuiz(el.querySelector('#qz'), pre, {
      mode: 'instant', title: 'Ön test', logWrong: false,
      onFinish(res, box) {
        ms(m.id).pre = { score: res.correct, total: res.total }; markStep(m.id, 'on');
        box.insertAdjacentHTML('beforeend', `<div class="step-foot"><span></span><a class="btn" href="#/m/${m.id}/ogren">Öğrenmeye başla</a></div>`);
      }
    });
  }

  function stOgren(m, el, arg) {
    const x = ms(m.id);
    let i = arg != null ? +arg : (x.chunk || 0);
    if (!(i >= 0 && i < m.chunks.length)) i = 0;
    x.chunk = i; save();
    const c = m.chunks[i];
    const last = i === m.chunks.length - 1;
    el.innerHTML = `<div class="panel">
      <div class="chunk-meta"><span>Parça ${i + 1} / ${m.chunks.length}</span><span>${c.slides ? 'Slayt ' + esc(c.slides.replace(/^S/, '')) : ''}</span></div>
      <div class="bar" style="margin-bottom:24px"><i style="width:${pct(i + 1, m.chunks.length)}%"></i></div>
      <h2 class="chunk-title">${safe(c.title)}</h2>
      <div class="reading">${safe(c.html)}</div>
      ${c.recall ? `<div class="recall"><h3>Kendini yokla</h3><p class="q">${safe(c.recall.q)}</p>
        <label class="small muted" for="rc">Cevabını kendi cümlelerinle yaz (isteğe bağlı), sonra karşılaştır.</label>
        <textarea id="rc">${esc(x.recall[i] && x.recall[i].txt || '')}</textarea>
        <div class="row" style="margin-top:12px"><button class="btn ghost" id="show">Model cevabı göster</button></div>
        <div id="ans" hidden><div class="a">${safe(c.recall.a)}</div>
        <p class="small muted" style="margin:12px 0 6px">Kendi cevabın ne kadar tuttu?</p>
        <div class="row" id="rate">${['Tam bildim', 'Kısmen', 'Bilemedim'].map((t, k) => `<button class="btn quiet" data-r="${k}" aria-pressed="${x.recall[i] && x.recall[i].r === k}">${t}</button>`).join('')}</div></div></div>` : ''}
      </div>
      <div class="step-foot">
        ${i > 0 ? `<a class="btn quiet" href="#/m/${m.id}/ogren/${i - 1}">Önceki parça</a>` : '<span></span>'}
        ${last ? `<a class="btn" href="#/m/${m.id}/ayirt" data-complete="ogren">Ayırt et adımına geç</a>` : `<a class="btn" href="#/m/${m.id}/ogren/${i + 1}">Sonraki parça</a>`}
      </div>`;
    bindFooter(m, el);
    const ta = el.querySelector('#rc');
    if (ta) {
      ta.addEventListener('input', () => { x.recall[i] = Object.assign(x.recall[i] || {}, { txt: ta.value }); save(); });
      el.querySelector('#show').addEventListener('click', e => { el.querySelector('#ans').hidden = false; e.target.hidden = true; });
      if (x.recall[i] && x.recall[i].r != null) { el.querySelector('#ans').hidden = false; el.querySelector('#show').hidden = true; }
      el.querySelectorAll('#rate button').forEach(b => b.addEventListener('click', () => {
        x.recall[i] = Object.assign(x.recall[i] || {}, { r: +b.dataset.r }); save();
        el.querySelectorAll('#rate button').forEach(o => o.setAttribute('aria-pressed', o === b));
      }));
    }
  }

  function stAyirt(m, el) {
    const mn = (m.mnemonics || []).map(x => `<div class="mn"><h3>${safe(x.title)}</h3><p>${safe(x.text)}</p></div>`).join('');
    const cf = (m.confusions || []).map(x => `<div class="versus"><div>${safe(x.a)}</div><div>${safe(x.b)}</div><p>${safe(x.diff)}</p></div>`).join('');
    el.innerHTML = `${cf ? `<div class="panel"><h2 style="margin-bottom:16px">Sık karıştırılanlar</h2>${cf}</div>` : ''}
      ${mn ? `<div class="panel"><h2>Hafıza ipuçları</h2>${mn}</div>` : ''}
      ${!cf && !mn ? '<div class="panel empty">Bu bölüm için ayrıca ipucu yok.</div>' : ''}
      ${footer(m, 'ayirt')}`;
    bindFooter(m, el);
  }

  /* ---------------- kartlar (Leitner) ---------------- */
  const BOX_DAYS = [0, 1, 3, 7, 14, 30];
  function cardKey(mid, i) { return mid + '#' + i; }
  function allCards(mods) { const out = []; for (const m of mods) m.flashcards.forEach((c, i) => out.push({ key: cardKey(m.id, i), m, c })); return out; }
  function dueCardList() {
    const now = Date.now();
    const started = MODS.filter(m => { const x = S.mods[m.id]; return x && (x.steps.kart || x.steps.ogren || x.quiz); });
    return allCards(started).filter(k => { const s = S.cards[k.key]; return !s || s.due <= now; });
  }
  function gradeCard(key, knew) {
    const s = S.cards[key] || { box: 0 };
    s.box = knew ? Math.min(5, (s.box || 0) + 1) : 1;
    s.due = knew ? today0() + BOX_DAYS[s.box] * DAY : Date.now() + 10 * 60000;
    S.cards[key] = s; save();
  }
  function cardDeck(el, deck, onDone) {
    let i = 0, known = 0;
    deck = shuffle(deck);
    function render() {
      if (i >= deck.length) { el.innerHTML = `<div class="panel empty"><h2>Deste bitti</h2><p>${deck.length} karttan ${known} tanesini bildin. Bilemediklerin 10 dakika sonra tekrar gelecek.</p></div>`; onDone && onDone(known, deck.length); return; }
      const k = deck[i];
      const boxes = [1, 2, 3, 4, 5].map(b => `<span>Kutu ${b}: ${deck.filter(d => (S.cards[d.key] || {}).box === b).length}</span>`).join('');
      el.innerHTML = `<div class="flash" id="fl"><div class="flash-inner" tabindex="0" role="button" aria-label="Kartı çevir">
          <div class="face"><small>${i + 1} / ${deck.length}${k.m && MODS.length > 1 ? ' · ' + esc(k.m.title) : ''}</small>${safe(k.c.q)}</div>
          <div class="face back"><small>Cevap</small>${safe(k.c.a)}</div></div></div>
        <div class="flash-actions" id="fa"><button class="btn ghost" id="flip">Çevir (boşluk)</button></div>
        <div class="boxes">${boxes}</div>`;
      const fl = el.querySelector('#fl'), inner = fl.querySelector('.flash-inner');
      const flip = () => {
        fl.classList.toggle('flipped');
        if (fl.classList.contains('flipped') && !el.querySelector('#k1')) {
          el.querySelector('#fa').innerHTML = `<button class="btn quiet" id="k0">Bilemedim (1)</button><button class="btn" id="k1">Bildim (2)</button>`;
          el.querySelector('#k0').onclick = () => answer(false); el.querySelector('#k1').onclick = () => answer(true);
        }
      };
      const answer = ok => { gradeCard(k.key, ok); if (ok) known++; i++; render(); };
      inner.addEventListener('click', flip);
      el.querySelector('#flip').addEventListener('click', flip);
      keyHandler = e => {
        if (e.key === ' ' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); flip(); }
        if (fl.classList.contains('flipped')) { if (e.key === '1') answer(false); if (e.key === '2') answer(true); }
      };
    }
    render();
  }
  function stKart(m, el) {
    el.innerHTML = `<div class="panel"><p class="muted" style="margin-top:0">Önce cevabı zihninde söyle, sonra çevir. Dürüst ol: "Bildim" dediğin kart günler sonra tekrar gelir.</p><div id="deck"></div></div>${footer(m, 'kart')}`;
    bindFooter(m, el);
    cardDeck(el.querySelector('#deck'), allCards([m]), () => markStep(m.id, 'kart'));
  }

  function stSinav(m, el, arg) {
    const x = ms(m.id);
    const wrongOnly = arg === 'yanlis';
    let qs = m.questions;
    if (wrongOnly) qs = qs.filter(q => S.wrong[q.id]);
    const info = x.quiz ? `<p class="muted" style="margin-top:0">En iyi puanın %${x.quiz.best}, ${x.quiz.attempts} deneme. ${Object.keys(S.wrong).filter(k => QIDX[k] && QIDX[k].m.id === m.id).length ? `<a href="#/m/${m.id}/sinav/yanlis">Sadece hata defterindekileri çöz</a>` : ''}</p>` : '';
    el.innerHTML = `<div class="panel">${info}<div id="qz"></div></div>`;
    if (!qs.length) { el.querySelector('#qz').innerHTML = '<p class="empty">Bu bölümde hata defterinde soru kalmadı.</p>'; return; }
    runQuiz(el.querySelector('#qz'), shuffle(qs), {
      mode: 'instant', title: wrongOnly ? 'Hata defteri' : 'Pekiştirme sınavı',
      onFinish(res, box) {
        if (!wrongOnly) {
          const p = pct(res.correct, res.total);
          x.quiz = { best: Math.max(p, x.quiz ? x.quiz.best : 0), last: p, attempts: (x.quiz ? x.quiz.attempts : 0) + 1, at: Date.now() };
          S.log.push({ t: Date.now(), m: m.id, p }); S.log = S.log.slice(-300);
          markStep(m.id, 'sinav');
        }
        box.insertAdjacentHTML('beforeend', `<div class="step-foot"><a class="btn quiet" href="#/m/${m.id}/sinav">Yeniden çöz</a><a class="btn" href="#/m/${m.id}/ozet">Özete geç</a></div>`);
      }
    });
  }

  function stOzet(m, el) {
    markStep(m.id, 'ozet');
    const x = ms(m.id);
    const pre = x.pre ? `%${pct(x.pre.score, x.pre.total)}` : '—';
    const best = x.quiz ? `%${x.quiz.best}` : '—';
    const idx = MODS.indexOf(m), nm = MODS[idx + 1];
    el.innerHTML = `<div class="panel"><h2>Akılda kalacaklar</h2><ul class="reading" style="margin-top:16px">${m.summary.map(s => `<li>${safe(s)}</li>`).join('')}</ul></div>
      <div class="panel"><h2>Bu bölümdeki yolun</h2>
        <div class="breakdown"><table><tr><td>Ön test</td><td>${pre}</td></tr><tr><td>Pekiştirme sınavı (en iyi)</td><td>${best}</td></tr>
        <tr><td>Hata defterindeki soru</td><td>${m.questions.filter(q => S.wrong[q.id]).length}</td></tr></table>
        <div class="small muted">Aralıklı tekrar önerisi: bu bölümün kartlarına <strong>yarın</strong>, karma tekrara <strong>3 gün sonra</strong>, sınavı yeniden çözmeye <strong>7 gün sonra</strong> dön. Program sekmesi bunları otomatik planlar.</div></div>
      </div>
      <div class="step-foot"><a class="btn quiet" href="#/">Bölümlere dön</a>${nm ? `<a class="btn" href="#/m/${nm.id}">Sonraki bölüm: ${esc(nm.title)}</a>` : `<a class="btn" href="#/deneme">Deneme sınavına geç</a>`}</div>`;
  }

  /* ---------------- sınav motoru ---------------- */
  let keyHandler = null;
  document.addEventListener('keydown', e => { if (keyHandler && !e.ctrlKey && !e.metaKey && !e.altKey) keyHandler(e); });

  function prepQ(q) {
    const order = q.noShuffle ? [0, 1, 2, 3, 4] : shuffle([0, 1, 2, 3, 4]);
    return { q, order };
  }
  function logResult(q, ok) {
    const w = S.wrong[q.id];
    if (!ok) S.wrong[q.id] = { n: (w ? w.n : 0) + 1, streak: 0, at: Date.now() };
    else if (w) { w.streak = (w.streak || 0) + 1; if (w.streak >= 2) delete S.wrong[q.id]; }
  }
  function optsHTML(P, chosen, reveal) {
    return P.order.map((oi, pos) => {
      let cls = '';
      if (reveal) { if (oi === P.q.answer) cls = 'right'; else if (oi === chosen) cls = 'wrong'; }
      const why = reveal ? `<div class="why"><b>${oi === P.q.answer ? 'Doğru' : oi === chosen ? 'Senin seçimin' : 'Neden değil'}:</b> ${safe(P.q.why[oi])}</div>` : '';
      return `<li><button class="opt ${cls}" data-oi="${oi}" aria-pressed="${chosen === oi}"${reveal ? ' disabled' : ''}><span class="L">${L[pos]}</span><span>${safe(P.q.options[oi])}</span>${why}</button></li>`;
    }).join('');
  }
  function tags(q, m) {
    return `<span class="row" style="gap:6px">${m && MODS.length > 1 ? `<span class="tag">${esc(m.title)}</span>` : ''}<span class="tag">${TYPE_TR[q.type] || q.type}</span><span class="tag">${BLOOM_TR[q.bloom] || ''}</span><span class="tag">${DIFF_TR[q.difficulty] || ''}</span></span>`;
  }

  // mode: 'instant' (her sorudan sonra açıklama) | 'exam' (sonda açıklama)
  function runQuiz(el, questions, opt) {
    const P = questions.map(prepQ);
    const st = { i: 0, ans: new Array(P.length).fill(null), conf: new Array(P.length).fill(null), checked: new Array(P.length).fill(false), start: Date.now() };
    let timerId = null;
    if (opt.mode === 'exam' && opt.minutes) {
      timerId = setInterval(() => {
        const left = opt.minutes * 60000 - (Date.now() - st.start);
        const t = el.querySelector('.timer');
        if (left <= 0) { clearInterval(timerId); finish(); return; }
        if (t) t.textContent = `${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}`;
      }, 1000);
    }
    function render() {
      const p = P[st.i], q = p.q, meta = QIDX[q.id];
      const chosen = st.ans[st.i], reveal = opt.mode === 'instant' && st.checked[st.i];
      const correct = chosen === q.answer;
      let fb = '';
      if (reveal) {
        const hyper = !correct && st.conf[st.i] === 'emin'
          ? `<span class="hyper">Emin olduğun bir yanlış. Bu tür hatalar düzeltildiğinde en kalıcı öğrenme gerçekleşir; soru hata defterine eklendi.</span>` : (!correct ? '<span class="hyper">Hata defterine eklendi; iki kez üst üste doğru yapınca çıkacak.</span>' : '');
        fb = `<div class="feedback ${correct ? 'ok' : 'bad'}" role="status"><strong>${correct ? 'Doğru.' : 'Yanlış.'}</strong> Doğru cevap ${L[p.order.indexOf(q.answer)]}.
          <span class="tk"><strong>Ana fikir:</strong> ${safe(q.takeaway)}</span>${hyper}
          ${q.ref ? `<span class="hyper muted">Kaynak: ${esc(q.ref)}</span>` : ''}</div>`;
      }
      const examNav = opt.mode === 'exam' ? `<div class="exam-nav" aria-label="Soru gezgini">${P.map((_, k) => `<button data-go="${k}" class="${st.ans[k] != null ? 'ans' : ''} ${k === st.i ? 'cur' : ''}" aria-label="Soru ${k + 1}">${k + 1}</button>`).join('')}</div>` : '';
      el.innerHTML = `<div class="qhead"><span>${esc(opt.title || '')} · Soru ${st.i + 1} / ${P.length}</span>
          <div class="qprog bar"><i style="width:${pct(st.i + (reveal ? 1 : 0), P.length)}%"></i></div>
          ${opt.mode === 'exam' && opt.minutes ? '<span class="timer" aria-live="off">--:--</span>' : ''}</div>
        <div style="margin-bottom:12px">${tags(q, meta && meta.m)}</div>
        <p class="stem">${safe(q.stem)}</p>
        <ol class="opts" role="list">${optsHTML(p, chosen, reveal)}</ol>
        ${opt.mode === 'instant' && !reveal ? `<div class="conf"><span>Ne kadar eminsin?</span>
          <button data-c="emin" aria-pressed="${st.conf[st.i] === 'emin'}">Eminim</button>
          <button data-c="tahmin" aria-pressed="${st.conf[st.i] === 'tahmin'}">Tahmin</button></div>` : ''}
        ${fb}
        <div class="qfoot"><span class="kbd">Klavye: A–E seç, Enter ${opt.mode === 'instant' ? 'kontrol / sonraki' : 'sonraki'}</span>
          <div class="row">${opt.mode === 'exam' ? `${st.i > 0 ? '<button class="btn quiet" id="prev">Önceki</button>' : ''}${st.i < P.length - 1 ? '<button class="btn ghost" id="next">Sonraki</button>' : ''}<button class="btn" id="finish">Sınavı bitir</button>`
          : reveal ? `<button class="btn" id="next">${st.i < P.length - 1 ? 'Sonraki soru' : 'Sonucu gör'}</button>` : `<button class="btn" id="check" ${chosen == null ? 'disabled' : ''}>Cevabı kontrol et</button>`}</div></div>
        ${examNav}`;
      el.querySelectorAll('.opt:not(:disabled)').forEach(b => b.addEventListener('click', () => choose(+b.dataset.oi)));
      el.querySelectorAll('.conf button').forEach(b => b.addEventListener('click', () => { st.conf[st.i] = b.dataset.c; render(); }));
      const on = (id, f) => { const b = el.querySelector('#' + id); if (b) b.addEventListener('click', f); };
      on('check', check); on('next', next); on('prev', () => { st.i--; render(); }); on('finish', () => {
        const blank = st.ans.filter(a => a == null).length;
        if (!blank || confirm(`${blank} boş soru var. Yine de bitirilsin mi?`)) finish();
      });
      el.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => { st.i = +b.dataset.go; render(); }));
      if (reveal) { const f = el.querySelector('.feedback'); if (f) f.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
      keyHandler = e => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        const k = e.key.toUpperCase();
        const pos = L.indexOf(k);
        if (pos >= 0 && k.length === 1 && !(opt.mode === 'instant' && st.checked[st.i])) { choose(P[st.i].order[pos]); }
        else if (e.key === 'Enter') {
          e.preventDefault();
          if (opt.mode === 'exam') { if (st.i < P.length - 1) next(); }
          else if (st.checked[st.i]) next(); else if (st.ans[st.i] != null) check();
        }
      };
    }
    function choose(oi) { st.ans[st.i] = oi; render(); if (opt.mode === 'exam' && el.querySelector('.cur')) {} }
    function check() {
      if (st.ans[st.i] == null) return;
      st.checked[st.i] = true;
      const q = P[st.i].q;
      if (opt.logWrong !== false) { logResult(q, st.ans[st.i] === q.answer); save(); }
      render();
    }
    function next() { if (st.i < P.length - 1) { st.i++; render(); window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 90 }); } else finish(); }
    function finish() {
      if (timerId) clearInterval(timerId);
      keyHandler = null;
      if (opt.mode === 'exam') { P.forEach((p, k) => logResult(p.q, st.ans[k] === p.q.answer)); save(); }
      const res = { total: P.length, correct: P.filter((p, k) => st.ans[k] === p.q.answer).length, items: P.map((p, k) => ({ p, a: st.ans[k], c: st.conf[k] })) };
      const by = (key, map) => {
        const g = {};
        res.items.forEach(it => { const v = it.p.q[key]; g[v] = g[v] || [0, 0]; g[v][1]++; if (it.a === it.p.q.answer) g[v][0]++; });
        return Object.entries(g).map(([k, [a, b]]) => `<tr><td>${map[k] || k}</td><td>${a}/${b}</td></tr>`).join('');
      };
      const byMod = () => {
        const g = {};
        res.items.forEach(it => { const m = QIDX[it.p.q.id].m; g[m.id] = g[m.id] || [0, 0, m.title]; g[m.id][1]++; if (it.a === it.p.q.answer) g[m.id][0]++; });
        return Object.values(g).sort((x, y) => x[0] / x[1] - y[0] / y[1]).map(([a, b, t]) => `<tr><td>${esc(t)}</td><td>${a}/${b}</td></tr>`).join('');
      };
      const hyper = res.items.filter(it => it.c === 'emin' && it.a !== it.p.q.answer).length;
      const wrongs = res.items.filter(it => it.a !== it.p.q.answer);
      const reviewList = (opt.mode === 'exam' ? res.items : wrongs).map((it, k) => {
        const ok = it.a === it.p.q.answer;
        return `<details class="review-item"${opt.mode === 'exam' && !ok ? ' open' : ''}><summary>${ok ? '✓' : '✗'} ${safe(it.p.q.stem).replace(/<br>/g, ' ')}</summary>
          <ol class="opts" role="list">${optsHTML(it.p, it.a, true)}</ol>
          <div class="feedback ${ok ? 'ok' : 'bad'}"><strong>Ana fikir:</strong> ${safe(it.p.q.takeaway)}</div></details>`;
      }).join('');
      const p = pct(res.correct, res.total);
      el.innerHTML = `<div class="score"><div class="big">%${p}<br><small>${res.correct} / ${res.total} doğru</small></div>
        <div><h2>${p >= 85 ? 'Çok iyi. Bu konu oturmuş.' : p >= 70 ? 'İyi. Birkaç ayrıntı kalmış.' : p >= 50 ? 'Yarı yoldasın. Yanlışların ne söylüyor?' : 'Bu konuya bir tur daha gerek.'}</h2>
        <p class="muted">${hyper ? `${hyper} soruda "eminim" deyip yanlış yaptın. Onlara özellikle dikkat et.` : 'Yanlış yaptığın sorular hata defterine eklendi.'}</p></div></div>
        <div class="breakdown"><div><h3>Soru tipine göre</h3><table>${by('type', TYPE_TR)}</table></div>
        <div><h3>Bilişsel düzeye göre</h3><table>${by('bloom', BLOOM_TR)}</table></div>
        ${MODS.length > 1 && new Set(res.items.map(it => QIDX[it.p.q.id].m.id)).size > 1 ? `<div><h3>Bölüme göre (zayıftan güçlüye)</h3><table>${byMod()}</table></div>` : ''}</div>
        ${reviewList ? `<h2 style="margin:32px 0 8px">${opt.mode === 'exam' ? 'Tüm sorular ve açıklamalar' : 'Yanlışlarının açıklamaları'}</h2>${reviewList}` : ''}`;
      opt.onFinish && opt.onFinish(res, el);
    }
    render();
  }

  /* ---------------- tekrar / hata defteri ---------------- */
  function viewTekrar() {
    currentModId = null;
    updateDrawerCounts();
    const wrongIds = Object.keys(S.wrong).filter(id => QIDX[id]);
    const startedMods = MODS.filter(m => S.mods[m.id] && S.mods[m.id].quiz);
    const main = shell('#/tekrar', `<h1>Tekrar</h1><p class="lede">Karışık (serpiştirilmiş) tekrar, konuları birbirinden ayırt etmeyi öğretir. Hata defterindeki sorular önce gelir.</p>
      <div class="panel" style="margin-top:32px"><div class="form-grid">
        <div class="field"><label for="n">Soru sayısı</label><select id="n"><option>10</option><option selected>15</option><option>20</option><option>30</option></select></div>
        <div class="field"><label for="src">Kaynak</label><select id="src"><option value="mix">Hata defteri + çalıştığım bölümler</option><option value="wrong">Yalnızca hata defteri (${wrongIds.length})</option><option value="all">Tüm bölümler</option></select></div>
        <button class="btn" id="go">Tekrarı başlat</button></div>
        <p class="small muted">Hata defterinde ${wrongIds.length} soru var. Çalıştığın bölüm sayısı: ${startedMods.length}.</p></div>
      <div id="qz" class="panel" hidden></div>`);
    main.querySelector('#go').addEventListener('click', () => {
      const n = +main.querySelector('#n').value, src = main.querySelector('#src').value;
      const wrongQs = shuffle(wrongIds).map(id => QIDX[id].q);
      let pool;
      if (src === 'wrong') pool = wrongQs;
      else {
        const base = src === 'all' || !startedMods.length ? MODS : startedMods;
        const rest = shuffle(base.flatMap(m => m.questions).filter(q => !S.wrong[q.id]));
        pool = (src === 'all' ? [] : wrongQs).concat(rest);
      }
      pool = pool.slice(0, n);
      if (!pool.length) { main.querySelector('#qz').hidden = false; main.querySelector('#qz').innerHTML = '<p class="empty">Hata defterin boş. Bir bölüm sınavı çözerek başla.</p>'; return; }
      const qz = main.querySelector('#qz'); qz.hidden = false;
      runQuiz(qz, shuffle(pool), { mode: 'instant', title: 'Karma tekrar' });
      qz.scrollIntoView({ behavior: 'smooth' });
    });
  }

  function viewKartlar() {
    currentModId = null;
    updateDrawerCounts();
    const due = dueCardList();
    const main = shell('#/kartlar', `<h1>Bugünkü kartlar</h1><p class="lede">Sadece öğrenmeye başladığın bölümlerin kartları burada çıkar. Kutu 1 her gün, kutu 5 ayda bir gelir.</p>
      <div class="panel" style="margin-top:32px" id="deck"></div>`);
    const deckEl = main.querySelector('#deck');
    if (!due.length) {
      deckEl.innerHTML = `<div class="empty">Bugün için tekrar edilecek kart yok.<br><br><button class="btn ghost" id="all">Yine de tüm kartlarla çalış</button></div>`;
      deckEl.querySelector('#all').onclick = () => cardDeck(deckEl, allCards(MODS));
      return;
    }
    cardDeck(deckEl, due.slice(0, 40));
  }

  /* ---------------- deneme sınavı ---------------- */
  function viewDeneme() {
    currentModId = null;
    updateDrawerCounts();
    const checks = MODS.map(m => `<label><input type="checkbox" value="${m.id}" checked> ${esc(m.title)}</label>`).join('');
    const main = shell('#/deneme', `<h1>Deneme sınavı</h1><p class="lede">Gerçek sınav koşulu: süre işler, soru sırasında geri bildirim yok. Bitince tüm şıkların açıklamaları gelir.</p>
      <div class="panel" style="margin-top:32px" id="cfg"><div class="form-grid">
        <div class="field"><label for="n">Soru sayısı</label><select id="n"><option>20</option><option selected>30</option><option>40</option><option>60</option></select></div>
        <div class="field"><label for="t">Süre (soru başına)</label><select id="t"><option value="1">1 dakika</option><option value="1.25" selected>75 saniye</option><option value="1.5">90 saniye</option><option value="0">Süresiz</option></select></div>
        <button class="btn" id="go">Sınavı başlat</button></div>
        <h3 style="margin-top:24px">Kapsanacak bölümler</h3><div class="checks">${checks}</div></div>
      <div id="qz" class="panel" hidden></div>`);
    main.querySelector('#go').addEventListener('click', () => {
      const n = +main.querySelector('#n').value, per = +main.querySelector('#t').value;
      const ids = [...main.querySelectorAll('.checks input:checked')].map(i => i.value);
      if (!ids.length) { alert('En az bir bölüm seç.'); return; }
      // Bölümlerden dengeli örnekle: her bölümden sırayla çek
      const pools = ids.map(id => shuffle(MOD[id].questions));
      const pick = []; let k = 0;
      while (pick.length < n && pools.some(p => p.length)) { const p = pools[k++ % pools.length]; if (p.length) pick.push(p.pop()); }
      main.querySelector('#cfg').hidden = true;
      const qz = main.querySelector('#qz'); qz.hidden = false;
      runQuiz(qz, shuffle(pick), {
        mode: 'exam', title: 'Deneme', minutes: per ? Math.round(pick.length * per) : 0,
        onFinish(res, box) { S.log.push({ t: Date.now(), m: 'deneme', p: pct(res.correct, res.total) }); save();
          box.insertAdjacentHTML('afterbegin', '<div class="row" style="justify-content:flex-end;margin-bottom:16px"><a class="btn quiet" href="#/deneme" onclick="location.reload()">Yeni deneme</a></div>'); }
      });
    });
  }

  /* ---------------- çalışma programı ---------------- */
  function planTasks(cfg) {
    // Her bölümü öğrenme oturumlarına böl, 1-3-7 günlük tekrarları ekle, günlük kapasiteye yerleştir.
    const cap = cfg.daily;
    const learn = [];
    for (const m of MODS) {
      const est = m.estMinutes || 45, sessions = Math.max(1, Math.ceil(est / cap));
      const per = Math.ceil(m.chunks.length / sessions);
      for (let s = 0; s < sessions; s++) {
        const from = s * per + 1, to = Math.min(m.chunks.length, (s + 1) * per);
        const first = s === 0, last = s === sessions - 1;
        let desc = [];
        if (first) desc.push('hedefleri oku, 3 soruluk ön testi çöz');
        desc.push(`öğrenme parçaları ${from}–${to} (her parçanın sonunda "kendini yokla")`);
        if (last) desc.push('ayırt et + kartlar + pekiştirme sınavı (hedef ≥ %70)');
        learn.push({ kind: 'learn', m, s, last, min: Math.round(est / sessions), title: `${m.title}${sessions > 1 ? ` (${s + 1}/${sessions})` : ''}`, desc: desc.join('; '),
          link: `#/m/${m.id}/${first ? 'hedef' : 'ogren/' + (from - 1)}` });
      }
    }
    const start = cfg.start;
    const days = [];
    const reviewsByDay = {};
    const addReview = (d, t) => { (reviewsByDay[d] = reviewsByDay[d] || []).push(t); };
    let d = 0, li = 0;
    const examDay = cfg.exam ? Math.round((cfg.exam - start) / DAY) : null;
    while (li < learn.length || (reviewsByDay[d] && reviewsByDay[d].length) || d <= Math.max(...Object.keys(reviewsByDay).map(Number), 0)) {
      if (examDay != null && d >= examDay) break;
      const tasks = (reviewsByDay[d] || []).slice();
      let used = tasks.reduce((a, t) => a + t.min, 0);
      while (li < learn.length && (used + learn[li].min <= cap * 1.15 || !tasks.some(t => t.kind === 'learn'))) {
        if (cfg.restDays && new Date(start + d * DAY).getDay() === 0) break;
        const t = learn[li++]; tasks.push(t); used += t.min;
        if (t.last) {
          addReview(d + 1, { kind: 'rev', min: 10, title: `Kart tekrarı: ${t.m.title}`, desc: '1. gün tekrarı. Kartlar sekmesinde bugünkü desteyi bitir.', link: '#/kartlar' });
          addReview(d + 3, { kind: 'rev', min: 15, title: `Karma tekrar (15 soru)`, desc: `3. gün tekrarı (${t.m.title} dahil). Hata defteri + çalışılan bölümler.`, link: '#/tekrar' });
          addReview(d + 7, { kind: 'rev', min: 20, title: `Sınavı yeniden çöz: ${t.m.title}`, desc: '7. gün tekrarı. Hedef ≥ %85; düşükse ilgili parçaları yeniden oku.', link: `#/m/${t.m.id}/sinav` });
        }
        if (used >= cap) break;
      }
      // aynı gün birden fazla karma tekrar varsa tek göreve indir
      const merged = []; let seenMix = false;
      for (const t of tasks) { if (t.title.startsWith('Karma tekrar')) { if (seenMix) continue; seenMix = true; } merged.push(t); }
      days.push({ d, tasks: merged });
      d++;
      if (d > 400) break;
    }
    if (examDay != null) {
      // Son iki gün: deneme + hata defteri
      while (days.length < examDay) days.push({ d: days.length, tasks: [] });
      const finalTasks = [
        { kind: 'exam', min: 50, title: 'Deneme sınavı (40 soru, süreli)', desc: 'Tüm bölümler. Bitince bölüm bazlı tabloya bak; en zayıf iki bölümün özetini oku.', link: '#/deneme' },
        { kind: 'rev', min: 25, title: 'Hata defterini temizle', desc: 'Yalnızca hata defteri modunda, defter boşalana kadar.', link: '#/tekrar' }
      ];
      if (examDay >= 2) { days[examDay - 2].tasks.push(finalTasks[0]); days[examDay - 1].tasks.push(finalTasks[1]); }
      else if (examDay === 1) days[0].tasks.push(...finalTasks);
    } else {
      days.push({ d: days.length, tasks: [{ kind: 'exam', min: 50, title: 'Deneme sınavı (40 soru, süreli)', desc: 'Tüm bölümler; ardından hata defterini temizle.', link: '#/deneme' }] });
    }
    const left = learn.length - li;
    days.forEach(x => x.tasks.forEach((t, k) => { t.key = `${x.d}:${k}:${t.title}`; }));
    return { days, unscheduled: left, learnTotal: learn.reduce((a, t) => a + t.min, 0) };
  }
  function viewProgram() {
    currentModId = null;
    updateDrawerCounts();
    const p = S.plan;
    const t0 = today0();
    const iso = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    const form = `<div class="panel" style="margin-top:32px"><h2>Programı ayarla</h2><div class="form-grid" style="margin-top:16px">
        <div class="field"><label for="ps">Başlangıç</label><input type="date" id="ps" value="${iso(p ? p.start : t0)}"></div>
        <div class="field"><label for="pe">Sınav tarihi (isteğe bağlı)</label><input type="date" id="pe" value="${p && p.exam ? iso(p.exam) : ''}"></div>
        <div class="field"><label for="pd">Günlük süre</label><select id="pd">${[30, 45, 60, 90, 120, 180].map(v => `<option value="${v}"${(p ? p.daily : 60) === v ? ' selected' : ''}>${v} dakika</option>`).join('')}</select></div>
        <div class="field"><label><input type="checkbox" id="pr"${p && p.restDays ? ' checked' : ''}> Pazar günleri yeni konu yok</label></div>
        <button class="btn" id="mk">${p ? 'Programı güncelle' : 'Program oluştur'}</button></div></div>`;
    let body = '';
    if (p) {
      const plan = planTasks(p);
      const total = plan.days.reduce((a, x) => a + x.tasks.length, 0);
      const doneN = plan.days.reduce((a, x) => a + x.tasks.filter(t => p.done[t.key]).length, 0);
      let warn = '';
      if (plan.unscheduled) {
        const avail = Math.max(1, Math.round((p.exam - p.start) / DAY) - 2);
        const need = Math.ceil(plan.learnTotal / avail / 15) * 15 + 20;
        warn = `<div class="notice">Bu tempo ile ${plan.unscheduled} öğrenme oturumu sınavdan önce bitmiyor. Günlük süreyi en az ${need} dakikaya çıkar ya da başlangıcı öne al.</div>`;
      }
      body = `<div class="section-title"><h2>Gün gün plan</h2><span class="muted small">${doneN}/${total} görev tamam</span></div>
        <div class="bar" style="margin-bottom:16px"><i style="width:${pct(doneN, total)}%"></i></div>${warn}
        ${plan.days.map(x => {
          const date = p.start + x.d * DAY;
          if (!x.tasks.length) return `<div class="plan-day${date === t0 ? ' today' : ''}"><div class="d">${fmtDate(date)}<small>${fmtDow(date)}</small></div><div class="muted">Dinlenme ya da serbest tekrar</div></div>`;
          return `<div class="plan-day${date === t0 ? ' today' : ''}" ${date === t0 ? 'id="bugun"' : ''}><div class="d">${x.d + 1}. gün<small>${fmtDate(date)}, ${fmtDow(date)}${date === t0 ? ' (bugün)' : ''}</small></div><div>
            ${x.tasks.map(t => `<div class="task${p.done[t.key] ? ' done' : ''}"><input type="checkbox" data-k="${esc(t.key)}" ${p.done[t.key] ? 'checked' : ''} aria-label="${esc(t.title)} tamamlandı">
              <div><div class="tt">${esc(t.title)}</div><div class="td">${esc(t.desc)}</div></div>
              <div style="text-align:right"><div class="min">~${t.min} dk</div><a class="go" href="${t.link}">Aç</a></div></div>`).join('')}</div></div>`;
        }).join('')}`;
    } else {
      body = `<div class="panel empty" style="margin-top:16px">Tarih ve günlük süre seç; uygulama her bölümü oturumlara böler, 1., 3. ve 7. gün tekrarlarını ekler, sınavdan önceki iki güne deneme ve hata defteri koyar.</div>`;
    }
    const main = shell('#/program', `<h1>Çalışma programı</h1><p class="lede">Bölümler sırayla öğrenilir; her bölümden sonra 1, 3 ve 7 gün arayla kısa tekrarlar gelir. Bu aralıklı tekrar, bir kerede uzun çalışmaktan çok daha kalıcıdır.</p>${form}${body}`);
    main.querySelector('#mk').addEventListener('click', () => {
      const ps = main.querySelector('#ps').value, pe = main.querySelector('#pe').value;
      const toT = v => { const [y, mo, da] = v.split('-').map(Number); return new Date(y, mo - 1, da).getTime(); };
      const start = ps ? toT(ps) : t0, exam = pe ? toT(pe) : null;
      if (exam && exam <= start) { alert('Sınav tarihi başlangıçtan sonra olmalı.'); return; }
      S.plan = { start, exam, daily: +main.querySelector('#pd').value, restDays: main.querySelector('#pr').checked, done: S.plan ? S.plan.done : {} };
      save(); viewProgram();
    });
    main.querySelectorAll('.task input').forEach(cb => cb.addEventListener('change', () => {
      S.plan.done[cb.dataset.k] = cb.checked; if (!cb.checked) delete S.plan.done[cb.dataset.k]; save();
      cb.closest('.task').classList.toggle('done', cb.checked);
    }));
    const b = main.querySelector('#bugun'); if (b) b.scrollIntoView({ block: 'center' });
  }

  /* ---------------- hesap atölyesi ---------------- */
  function viewHesap() {
    currentModId = null;
    updateDrawerCounts();
    const H = window.HESAP;
    if (!H) return viewHome();
    const main = shell('#/hesap', `<h1>Hesap atölyesi</h1><p class="lede">Her soruda yeni bir veri seti. Önce elle çöz, sonra cevabını yaz. Yanlışsa adım adım çözüm açılır.</p>
      <div class="panel" style="margin-top:32px"><div class="field" style="max-width:360px"><label for="kind">Ölçü</label><select id="kind">${H.kinds.map(k => `<option value="${k.id}">${k.t}</option>`).join('')}<option value="rnd">Karışık</option></select></div>
      <div id="w" style="margin-top:24px"></div></div>`);
    const w = main.querySelector('#w');
    let streak = 0;
    function newQ() {
      let kid = main.querySelector('#kind').value;
      if (kid === 'rnd') kid = H.kinds[Math.floor(Math.random() * H.kinds.length)].id;
      const P = H.make(kid);
      w.innerHTML = `<p class="stem">${P.prompt}</p><div class="dataset">${P.data.map(v => `<span>${v}</span>`).join('')}</div>
        <div class="row"><div class="field"><label for="ans">Cevabın${P.hint ? ` (${P.hint})` : ''}</label><input id="ans" inputmode="decimal" autocomplete="off" style="max-width:200px"></div>
        <button class="btn" id="chk" style="align-self:end">Kontrol et</button><button class="btn quiet" id="skip" style="align-self:end">Çözümü göster</button></div>
        <div id="fb"></div>`;
      const ans = w.querySelector('#ans'); ans.focus();
      const show = ok => {
        w.querySelector('#fb').innerHTML = `<div class="feedback ${ok ? 'ok' : 'bad'}"><strong>${ok ? 'Doğru.' : 'Doğru cevap: ' + P.answerText}</strong>${ok ? ` Seri: ${streak}` : ''}</div>
          <div class="solution" style="margin-top:16px">${P.steps}</div><div class="row" style="margin-top:16px"><button class="btn" id="nq">Yeni soru</button></div>`;
        w.querySelector('#nq').onclick = newQ; w.querySelector('#nq').focus();
      };
      w.querySelector('#chk').onclick = () => {
        const v = parseFloat(String(ans.value).replace(',', '.'));
        if (isNaN(v)) { ans.focus(); return; }
        const ok = P.check(v); streak = ok ? streak + 1 : 0; show(ok);
      };
      ans.addEventListener('keydown', e => { if (e.key === 'Enter') w.querySelector('#chk').click(); });
      w.querySelector('#skip').onclick = () => { streak = 0; show(false); };
    }
    main.querySelector('#kind').addEventListener('change', newQ);
    newQ();
  }

  /* ---------------- sınav simülasyonu ---------------- */
  function viewSimulasyon() {
    currentModId = null;
    updateDrawerCounts();
    const Sim = window.SIMULASYON;
    const m6 = MOD['biyo-05'] || MODS[MODS.length - 1];
    const main = shell('#/simulasyon', `<div id="sim-app-root"></div>`);
    const root = main.querySelector('#sim-app-root');
    if (Sim && root) {
      Sim.render(root, m6, runQuiz);
    } else {
      root.innerHTML = '<div class="empty">Sınav simülasyonu yükleniyor veya bulunamadı.</div>';
    }
  }

  /* ---------------- yüzen araç paneli (kavramlar sözlüğü + not defteri) ---------------- */
  let currentModId = null;
  let drawerTab = 'glossary';
  let glScope = 'mod';
  let glFilter = '';
  let drawerEl = null, fabEl = null, backdropEl = null;

  function getCourseGlossary() {
    const list = [];
    for (const m of MODS) {
      if (m.glossary && m.glossary.length) {
        for (const item of m.glossary) {
          list.push({ term: item.term, def: item.def, mid: m.id, mtitle: m.title });
        }
      }
    }
    return list.sort((a, b) => a.term.localeCompare(b.term, 'tr'));
  }

  function initToolDrawer() {
    if (document.getElementById('tool-drawer-root')) return;

    const wrap = document.createElement('div');
    wrap.id = 'tool-drawer-root';
    wrap.innerHTML = `
      <button class="fab-toggle" id="fab-tool-toggle" aria-label="Kavramlar Sözlüğü ve Not Defteri" title="Kavramlar ve Notlarım">
        <span class="fab-icon">📖</span>
      </button>
      <div class="drawer-backdrop" id="tool-drawer-backdrop"></div>
      <aside class="tool-drawer" id="tool-drawer" aria-label="Kavramlar ve Notlar Paneli">
        <div class="td-header">
          <button class="td-tab active" data-tab="glossary">📖 Sözlük <span class="gl-badge" id="td-gl-count">0</span></button>
          <button class="td-tab" data-tab="notes">📝 Notlarım <span class="gl-badge" id="td-nb-count">1</span></button>
          <button class="td-close" id="td-close-btn" aria-label="Kapat">×</button>
        </div>
        <div class="td-body" id="td-body"></div>
      </aside>
    `;
    document.body.appendChild(wrap);

    fabEl = document.getElementById('fab-tool-toggle');
    backdropEl = document.getElementById('tool-drawer-backdrop');
    drawerEl = document.getElementById('tool-drawer');

    fabEl.addEventListener('click', toggleDrawer);
    backdropEl.addEventListener('click', closeDrawer);
    document.getElementById('td-close-btn').addEventListener('click', closeDrawer);

    wrap.querySelectorAll('.td-tab').forEach(b => {
      b.addEventListener('click', () => {
        drawerTab = b.dataset.tab;
        wrap.querySelectorAll('.td-tab').forEach(t => t.classList.toggle('active', t === b));
        renderDrawerBody();
      });
    });

    updateDrawerCounts();
  }

  function toggleDrawer() {
    if (!drawerEl) initToolDrawer();
    const isOpen = drawerEl.classList.toggle('open');
    fabEl.setAttribute('aria-expanded', String(isOpen));
    backdropEl.classList.toggle('show', isOpen);
    fabEl.querySelector('.fab-icon').textContent = isOpen ? '✕' : (drawerTab === 'notes' ? '📝' : '📖');
    if (isOpen) renderDrawerBody();
  }

  function closeDrawer() {
    if (!drawerEl) return;
    drawerEl.classList.remove('open');
    backdropEl.classList.remove('show');
    fabEl.setAttribute('aria-expanded', 'false');
    fabEl.querySelector('.fab-icon').textContent = '📖';
  }

  function openDrawer(tab) {
    if (!drawerEl) initToolDrawer();
    if (tab) {
      drawerTab = tab;
      document.querySelectorAll('#tool-drawer-root .td-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tab);
      });
    }
    if (!drawerEl.classList.contains('open')) toggleDrawer();
    else renderDrawerBody();
  }

  function updateDrawerCounts() {
    const glCountEl = document.getElementById('td-gl-count');
    const nbCountEl = document.getElementById('td-nb-count');
    if (glCountEl) {
      const curM = currentModId ? MOD[currentModId] : null;
      const count = (glScope === 'mod' && curM && curM.glossary) ? curM.glossary.length : getCourseGlossary().length;
      glCountEl.textContent = count;
    }
    if (nbCountEl && S.notebook && S.notebook.pages) {
      nbCountEl.textContent = S.notebook.pages.length;
    }
  }

  function renderDrawerBody() {
    const body = document.getElementById('td-body');
    if (!body) return;
    updateDrawerCounts();

    if (drawerTab === 'glossary') {
      renderGlossaryTab(body);
    } else {
      renderNotesTab(body);
    }
  }

  function renderGlossaryTab(body) {
    const curM = currentModId ? MOD[currentModId] : null;
    const allTerms = getCourseGlossary();
    const modTerms = (curM && curM.glossary) ? curM.glossary.map(g => ({ ...g, mid: curM.id, mtitle: curM.title })) : [];

    if (!curM) glScope = 'all';

    const sourceList = (glScope === 'mod' && curM) ? modTerms : allTerms;
    const q = (glFilter || '').trim().toLowerCase();
    const filtered = sourceList.filter(g => !q || g.term.toLowerCase().includes(q) || g.def.toLowerCase().includes(q));

    const scopeBar = curM ? `
      <div class="gl-scope-bar">
        <button class="gl-scope-btn${glScope === 'mod' ? ' active' : ''}" id="gl-scope-mod">Bu Bölüm (${modTerms.length})</button>
        <button class="gl-scope-btn${glScope === 'all' ? ' active' : ''}" id="gl-scope-all">Tüm Ders (${allTerms.length})</button>
      </div>
    ` : '';

    body.innerHTML = `
      <div class="gl-search">
        <input type="search" id="gl-drawer-search" placeholder="Kavram veya açıklama ara..." value="${esc(glFilter)}">
      </div>
      ${scopeBar}
      <div class="gl-list" id="gl-drawer-list">
        ${!filtered.length ? '<div class="gl-empty">Eşleşen kavram bulunamadı.</div>' :
          filtered.map((g, idx) => `
            <div class="gl-item${q ? ' open' : (idx < 2 ? ' open' : '')}">
              <div class="gl-term">
                <span>${esc(g.term)}</span>
                ${glScope === 'all' && g.mid !== (curM && curM.id) ? `<span class="tag" style="font-size:11px;margin-right:8px">${esc(g.mtitle.slice(0, 16))}...</span>` : ''}
              </div>
              <div class="gl-def">${esc(g.def)}</div>
            </div>
          `).join('')}
      </div>
    `;

    const searchInp = body.querySelector('#gl-drawer-search');
    searchInp.addEventListener('input', e => {
      glFilter = e.target.value;
      const listEl = document.getElementById('gl-drawer-list');
      if (listEl) {
        const curQ = glFilter.trim().toLowerCase();
        const curFiltered = sourceList.filter(g => !curQ || g.term.toLowerCase().includes(curQ) || g.def.toLowerCase().includes(curQ));
        listEl.innerHTML = !curFiltered.length ? '<div class="gl-empty">Eşleşen kavram bulunamadı.</div>' :
          curFiltered.map(g => `
            <div class="gl-item${curQ ? ' open' : ''}">
              <div class="gl-term">
                <span>${esc(g.term)}</span>
                ${glScope === 'all' && g.mid !== (curM && curM.id) ? `<span class="tag" style="font-size:11px;margin-right:8px">${esc(g.mtitle.slice(0, 16))}...</span>` : ''}
              </div>
              <div class="gl-def">${esc(g.def)}</div>
            </div>
          `).join('');
        listEl.querySelectorAll('.gl-term').forEach(termEl => {
          termEl.addEventListener('click', () => {
            termEl.closest('.gl-item').classList.toggle('open');
          });
        });
      }
    });

    const btnMod = body.querySelector('#gl-scope-mod');
    const btnAll = body.querySelector('#gl-scope-all');
    if (btnMod) btnMod.addEventListener('click', () => { glScope = 'mod'; renderDrawerBody(); });
    if (btnAll) btnAll.addEventListener('click', () => { glScope = 'all'; renderDrawerBody(); });

    body.querySelectorAll('.gl-term').forEach(termEl => {
      termEl.addEventListener('click', () => {
        termEl.closest('.gl-item').classList.toggle('open');
      });
    });
  }

  function renderNotesTab(body) {
    const nb = S.notebook;
    let activePage = nb.pages.find(p => p.id === nb.activeId) || nb.pages[0];
    if (!activePage) {
      activePage = { id: 'sayfa-' + Date.now(), title: 'Genel Notlar', text: '', updatedAt: Date.now() };
      nb.pages = [activePage];
      nb.activeId = activePage.id;
      save();
    }

    body.innerHTML = `
      <div class="nb-bar">
        ${nb.pages.map(p => `
          <button class="nb-tab${p.id === activePage.id ? ' active' : ''}" data-pid="${p.id}">
            <span>${esc(p.title || 'İsimsiz')}</span>
            ${nb.pages.length > 1 ? `<span class="nb-x" data-del="${p.id}" title="Sayfayı sil">×</span>` : ''}
          </button>
        `).join('')}
        <button class="nb-add" id="nb-drawer-add" title="Yeni sayfa ekle">+</button>
      </div>
      <div class="nb-editor">
        <div class="nb-title-row">
          <input type="text" class="nb-title-input" id="nb-drawer-title" value="${esc(activePage.title)}" placeholder="Sayfa başlığı...">
          <span class="nb-saved" id="nb-drawer-saved">Kaydedildi ✓</span>
        </div>
        <textarea class="nb-textarea" id="nb-drawer-text" placeholder="${esc(C.title)} dersine özel notlarını yaz...">${esc(activePage.text || '')}</textarea>
        <div class="nb-meta">
          <span id="nb-drawer-chars">${(activePage.text || '').length} karakter</span> ·
          <span id="nb-drawer-words">${(activePage.text || '').trim() ? (activePage.text || '').trim().split(/\s+/).length : 0} kelime</span>
        </div>
      </div>
    `;

    const titleInp = body.querySelector('#nb-drawer-title');
    const textArea = body.querySelector('#nb-drawer-text');
    const savedBadge = body.querySelector('#nb-drawer-saved');
    const charEl = body.querySelector('#nb-drawer-chars');
    const wordEl = body.querySelector('#nb-drawer-words');

    let saveTimer = null;
    function showSaved() {
      savedBadge.classList.add('show');
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => savedBadge.classList.remove('show'), 1500);
    }

    titleInp.addEventListener('input', () => {
      activePage.title = titleInp.value;
      activePage.updatedAt = Date.now();
      save();
      const tabSpan = body.querySelector(`.nb-tab[data-pid="${activePage.id}"] span`);
      if (tabSpan) tabSpan.textContent = activePage.title || 'İsimsiz';
      showSaved();
    });

    textArea.addEventListener('input', () => {
      activePage.text = textArea.value;
      activePage.updatedAt = Date.now();
      save();
      charEl.textContent = `${activePage.text.length} karakter`;
      const words = activePage.text.trim() ? activePage.text.trim().split(/\s+/).length : 0;
      wordEl.textContent = `${words} kelime`;
      showSaved();
    });

    body.querySelectorAll('.nb-tab').forEach(tab => {
      tab.addEventListener('click', e => {
        if (e.target.classList.contains('nb-x')) return;
        nb.activeId = tab.dataset.pid;
        save();
        renderDrawerBody();
      });
    });

    body.querySelectorAll('.nb-x').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const pid = btn.dataset.del;
        const pageToDelete = nb.pages.find(p => p.id === pid);
        if (confirm(`"${pageToDelete ? pageToDelete.title : 'Bu sayfa'}" silinecek. Onaylıyor musun?`)) {
          nb.pages = nb.pages.filter(p => p.id !== pid);
          nb.activeId = nb.pages[0].id;
          save();
          renderDrawerBody();
        }
      });
    });

    body.querySelector('#nb-drawer-add').addEventListener('click', () => {
      const newPage = {
        id: 'sayfa-' + Date.now(),
        title: 'Not ' + (nb.pages.length + 1),
        text: '',
        updatedAt: Date.now()
      };
      nb.pages.push(newPage);
      nb.activeId = newPage.id;
      save();
      renderDrawerBody();
      const newTitleInp = document.getElementById('nb-drawer-title');
      if (newTitleInp) newTitleInp.focus();
    });
  }

  function updateDrawerNoteTab() {
    if (drawerTab === 'notes' && drawerEl && drawerEl.classList.contains('open')) {
      renderDrawerBody();
    }
  }

  /* ---------------- not defteri ve sözlük (tam sayfa) ---------------- */
  function viewNotlar() {
    currentModId = null;
    updateDrawerCounts();
    const nb = S.notebook;
    let activePage = nb.pages.find(p => p.id === nb.activeId) || nb.pages[0];
    if (!activePage) {
      activePage = { id: 'sayfa-' + Date.now(), title: 'Genel Notlar', text: '', updatedAt: Date.now() };
      nb.pages = [activePage];
      nb.activeId = activePage.id;
      save();
    }

    const courseGlossary = getCourseGlossary();

    const main = shell('#/notlar', `
      <div class="row" style="justify-content:space-between;align-items:baseline;margin-bottom:8px">
        <h1>${esc(C.title)} Not Defteri</h1>
        <button class="btn ghost" id="open-gl-btn">📖 Yüzen Sözlüğü Aç (${courseGlossary.length})</button>
      </div>
      <p class="lede">Bu derse dair notlarını sekmeler halinde düzenle. Çalışırken sayfanın sağ altındaki yüzen düğmeden de notlarına ve kavramlar sözlüğüne her an erişebilirsin.</p>

      <div class="notes-page-layout">
        <aside class="notes-sidebar">
          <div class="row" style="justify-content:space-between;margin-bottom:12px">
            <strong>Sayfalar (${nb.pages.length})</strong>
            <button class="btn quiet" id="pg-add-page" style="padding:4px 10px;font-size:13px;min-height:32px">+ Yeni sayfa</button>
          </div>
          <ul class="notes-sidebar-list" id="pg-page-list">
            ${nb.pages.map(p => {
              const active = p.id === activePage.id;
              const preview = (p.text || '').trim().slice(0, 40) || 'Henüz not yazılmadı...';
              return `<li class="notes-sidebar-item${active ? ' active' : ''}" data-id="${p.id}">
                <div class="nst">${esc(p.title || 'İsimsiz')}</div>
                <div class="nsm">${esc(preview)}</div>
              </li>`;
            }).join('')}
          </ul>
        </aside>

        <section class="notes-main-editor">
          <div class="nb-title-row" style="padding:0 0 12px;border-bottom:1px solid var(--rule-soft)">
            <input type="text" class="nb-title-input" id="pg-title-inp" value="${esc(activePage.title)}" placeholder="Sayfa başlığı...">
            <span class="nb-saved" id="pg-saved-badge">Kaydedildi ✓</span>
            ${nb.pages.length > 1 ? `<button class="btn quiet" id="pg-del-btn" style="padding:4px 10px;font-size:13px;min-height:32px;color:var(--bad)">Sayfayı sil</button>` : ''}
          </div>
          <textarea class="nb-textarea" id="pg-textarea" style="flex:1;min-height:340px;margin-top:12px" placeholder="${esc(C.title)} dersine özel notlarını buraya yazabilirsin...">${esc(activePage.text || '')}</textarea>
          <div class="nb-meta" style="padding:10px 0 0;margin-top:12px">
            <span id="pg-char-count">${(activePage.text || '').length} karakter</span> ·
            <span id="pg-word-count">${(activePage.text || '').trim() ? (activePage.text || '').trim().split(/\s+/).length : 0} kelime</span> ·
            <span>Son düzenleme: ${fmtDate(activePage.updatedAt || Date.now())}</span>
          </div>
        </section>
      </div>

      <div class="section-title" style="margin-top:48px">
        <h2>${esc(C.title)} Kavramlar Sözlüğü (${courseGlossary.length} Terim)</h2>
        <span class="muted small">Tüm bölümlerdeki tıbbi ve teknik terimler</span>
      </div>
      <div class="panel">
        <div class="field" style="max-width:400px;margin-bottom:16px">
          <label for="pg-gl-search">Sözlükte Ara</label>
          <input type="search" id="pg-gl-search" placeholder="Terim veya açıklama ara...">
        </div>
        <div id="pg-gl-container"></div>
      </div>
    `);

    const titleInp = main.querySelector('#pg-title-inp');
    const textArea = main.querySelector('#pg-textarea');
    const savedBadge = main.querySelector('#pg-saved-badge');
    const charCount = main.querySelector('#pg-char-count');
    const wordCount = main.querySelector('#pg-word-count');

    let saveTimeout = null;
    function triggerSave() {
      savedBadge.classList.add('show');
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => savedBadge.classList.remove('show'), 1500);
      updateDrawerNoteTab();
    }

    titleInp.addEventListener('input', () => {
      activePage.title = titleInp.value;
      activePage.updatedAt = Date.now();
      save();
      const sidebarItem = main.querySelector(`.notes-sidebar-item[data-id="${activePage.id}"] .nst`);
      if (sidebarItem) sidebarItem.textContent = activePage.title || 'İsimsiz';
      triggerSave();
    });

    textArea.addEventListener('input', () => {
      activePage.text = textArea.value;
      activePage.updatedAt = Date.now();
      save();
      charCount.textContent = `${activePage.text.length} karakter`;
      const words = activePage.text.trim() ? activePage.text.trim().split(/\s+/).length : 0;
      wordCount.textContent = `${words} kelime`;
      const sidebarPreview = main.querySelector(`.notes-sidebar-item[data-id="${activePage.id}"] .nsm`);
      if (sidebarPreview) sidebarPreview.textContent = activePage.text.trim().slice(0, 40) || 'Henüz not yazılmadı...';
      triggerSave();
    });

    main.querySelectorAll('.notes-sidebar-item').forEach(li => {
      li.addEventListener('click', () => {
        nb.activeId = li.dataset.id;
        save();
        viewNotlar();
      });
    });

    main.querySelector('#pg-add-page').addEventListener('click', () => {
      const newPage = {
        id: 'sayfa-' + Date.now(),
        title: 'Not ' + (nb.pages.length + 1),
        text: '',
        updatedAt: Date.now()
      };
      nb.pages.push(newPage);
      nb.activeId = newPage.id;
      save();
      viewNotlar();
    });

    const delBtn = main.querySelector('#pg-del-btn');
    if (delBtn) {
      delBtn.addEventListener('click', () => {
        if (confirm(`"${activePage.title || 'Bu sayfa'}" silinecek. Onaylıyor musun?`)) {
          nb.pages = nb.pages.filter(p => p.id !== activePage.id);
          nb.activeId = nb.pages[0].id;
          save();
          viewNotlar();
        }
      });
    }

    main.querySelector('#open-gl-btn').addEventListener('click', () => openDrawer('glossary'));

    const glBox = main.querySelector('#pg-gl-container');
    const glSearch = main.querySelector('#pg-gl-search');
    function renderPageGlossary(q) {
      q = (q || '').trim().toLowerCase();
      const filtered = courseGlossary.filter(g => !q || g.term.toLowerCase().includes(q) || g.def.toLowerCase().includes(q));
      if (!filtered.length) {
        glBox.innerHTML = '<p class="empty">Eşleşen kavram bulunamadı.</p>';
        return;
      }
      glBox.innerHTML = `
        <div class="gl-list" style="padding:0">
          ${filtered.map(g => `
            <div class="gl-item open" style="padding:12px 0">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <strong style="color:var(--accent);font-size:16px">${esc(g.term)}</strong>
                <span class="tag">${esc(g.mtitle)}</span>
              </div>
              <p style="margin:6px 0 0;font-family:var(--f-read);font-size:16px;color:var(--ink-2)">${esc(g.def)}</p>
            </div>
          `).join('')}
        </div>
      `;
    }
    glSearch.addEventListener('input', e => renderPageGlossary(e.target.value));
    renderPageGlossary('');
  }

  /* ---------------- yönlendirme ---------------- */
  function route() {
    keyHandler = null;
    const parts = (location.hash.replace(/^#\/?/, '') || '').split('/').filter(Boolean);
    if (!parts.length) return viewHome();
    switch (parts[0]) {
      case 'm': return viewModule(parts[1], parts[2], parts[3]);
      case 'program': return viewProgram();
      case 'tekrar': return viewTekrar();
      case 'kartlar': return viewKartlar();
      case 'deneme': return viewDeneme();
      case 'hesap': return viewHesap();
      case 'simulasyon': return viewSimulasyon();
      case 'notlar': return viewNotlar();
      default: return viewHome();
    }
  }
  window.addEventListener('hashchange', route);
  route();
})();
