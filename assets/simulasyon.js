// Biyoistatistik Sınav Simülatörü Motoru (Seçenek 1 & Seçenek 2)
(function () {
  'use strict';

  function round(n, d) {
    const p = Math.pow(10, d != null ? d : 2);
    return Math.round(n * p) / p;
  }

  function parseVal(v) {
    if (v == null) return NaN;
    return parseFloat(String(v).trim().replace(',', '.'));
  }

  function fmtNum(n, d) {
    if (isNaN(n) || n == null) return '';
    return String(round(n, d != null ? d : 2)).replace('.', ',');
  }

  // Hocanın tahtada çözdüğü orijinal soru verileri
  const BOARD_ROWS = [
    { xi: 2, f: 4 },
    { xi: 4, f: 3 },
    { xi: 5, f: 1 },
    { xi: 6, f: 3 },
    { xi: 7, f: 1 },
    { xi: 8, f: 5 },
    { xi: 10, f: 2 },
    { xi: 13, f: 1 },
    { xi: 15, f: 1 },
    { xi: 16, f: 1 },
    { xi: 17, f: 3 }
  ];

  // Parametrik test 4 şartı seçenek havuzu (doğru 4 şart + çeldiriciler)
  const PARAMETRIC_OPTIONS = [
    { id: 'norm', text: '1. Normallik Varsayımı (Verilerin normal dağılım göstermesi — Shapiro-Wilk / Kolmogorov-Smirnov)', correct: true },
    { id: 'homog', text: '2. Varyansların Homojenliği (Grupların varyanslarının eşit olması — Levene Testi, p > 0,05)', correct: true },
    { id: 'scale', text: '3. Ölçüm Düzeyi (Değişkenin en az aralıklı veya oranlı ölçekte sürekli nicel olması)', correct: true },
    { id: 'indep', text: '4. Gözlemlerin Bağımsızlığı (Ölçümlerin birbirinden etkilenmemesi ve yansız örnekleme)', correct: true },
    { id: 'skewed', text: 'Verilerin sağa veya sola belirgin çarpık (asimetrik) dağılması', correct: false },
    { id: 'ordinal', text: 'Verilerin hafif-orta-şiddetli gibi ordinal (sıralı) ölçekte olması', correct: false },
    { id: 'big_n', text: 'Örneklem büyüklüğünün mutlaka en az 10.000 kişiden oluşması', correct: false },
    { id: 'bimodal', text: 'Verilerin tepe noktasının iki adet (bimodal) olması', correct: false }
  ];

  function calculateExpected(rows) {
    let N = 0;
    let sumXf = 0;
    rows.forEach(r => {
      N += r.f;
      sumXf += r.xi * r.f;
    });

    const mean = sumXf / N;

    // Mod: en yüksek frekansa sahip Xi
    let maxF = -1;
    let mode = rows[0].xi;
    rows.forEach(r => {
      if (r.f > maxF) {
        maxF = r.f;
        mode = r.xi;
      }
    });

    // Medyan & Birikimli Frekans
    let runningF = 0;
    const computedRows = rows.map(r => {
      runningF += r.f;
      const xf = r.xi * r.f;
      const x_ao = r.xi - mean;
      const abs_x_ao = Math.abs(x_ao);
      const f_abs = r.f * abs_x_ao;
      const sq = x_ao * x_ao;
      const f_sq = r.f * sq;
      return {
        xi: r.xi,
        f: r.f,
        F: runningF,
        xf: xf,
        x_ao: x_ao,
        abs_x_ao: abs_x_ao,
        f_abs: f_abs,
        sq: sq,
        f_sq: f_sq
      };
    });

    const medRank = (N + 1) / 2;
    let median = rows[0].xi;
    for (const r of computedRows) {
      if (r.F >= medRank) {
        median = r.xi;
        break;
      }
    }

    const range = rows[rows.length - 1].xi - rows[0].xi;

    let sumFAbs = 0;
    let sumFSq = 0;
    computedRows.forEach(r => {
      sumFAbs += r.f_abs;
      sumFSq += r.f_sq;
    });

    const oms = sumFAbs / N;
    const variance = sumFSq / N; // Hocanın tahtadaki N böleni
    const sd = Math.sqrt(variance);
    const cv = (sd / mean) * 100;

    // Çeyreklikler
    const q1Rank = (N + 1) / 4;
    const q3Rank = (3 * (N + 1)) / 4;
    let q1 = rows[0].xi;
    let q3 = rows[rows.length - 1].xi;
    for (const r of computedRows) {
      if (r.F >= q1Rank && q1 === rows[0].xi) q1 = r.xi;
      if (r.F >= q3Rank) { q3 = r.xi; break; }
    }
    const iqr = q3 - q1;

    return {
      rows: computedRows,
      N: N,
      sumXf: sumXf,
      mean: round(mean, 2),
      mode: mode,
      medRank: round(medRank, 1),
      median: median,
      range: range,
      sumFAbs: round(sumFAbs, 2),
      oms: round(oms, 3),
      sumFSq: round(sumFSq, 2),
      variance: round(variance, 2),
      sampleVariance: round(sumFSq / (N - 1), 2),
      sd: round(sd, 3),
      cv: round(cv, 2),
      q1Rank: round(q1Rank, 2),
      q1: q1,
      q3Rank: round(q3Rank, 2),
      q3: q3,
      iqr: iqr
    };
  }

  function generateRandomProblem() {
    // 6-8 satırlık yeni, gerçekçi frekans serisi üret
    const start = Math.floor(Math.random() * 3) + 2;
    const count = 7;
    const rows = [];
    let curX = start;
    for (let i = 0; i < count; i++) {
      curX += Math.floor(Math.random() * 2) + 2;
      const f = Math.floor(Math.random() * 4) + 1;
      rows.push({ xi: curX, f: f });
    }
    // Mod belirgin olsun diye ortadaki bir elemanın frekansını artır
    rows[3].f = Math.max(...rows.map(r => r.f)) + 2;
    return rows;
  }

  function renderSimulation(container, moduleObj, runQuizFn) {
    let currentRows = BOARD_ROWS.slice();
    let currentExp = calculateExpected(currentRows);
    let activeTab = 'tablo'; // 'tablo' | 'soru'

    function draw() {
      container.innerHTML = `
        <div class="panel" style="margin-bottom:var(--s5);">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:var(--s4); flex-wrap:wrap;">
            <div>
              <span class="tag" style="background:var(--accent-soft); color:var(--accent); font-weight:700; margin-bottom:8px; display:inline-block;">VİZE SINAV SİMÜLATÖRÜ</span>
              <h1 style="font-size:clamp(24px, 3.5vw, 34px);">Biyoistatistik Vize Sınavı Simülasyonu</h1>
              <p class="lede" style="margin-top:6px; font-size:16px;">
                Hocanın derste çözdüğü Excel frekans tablosu, dağılım ölçüleri ve <em>"Parametrik test 4 maddeyi tamamlayacak"</em> kuralı.
              </p>
            </div>
            <div style="text-align:right;">
              <a href="#/m/${moduleObj ? moduleObj.id : 'biyo-05'}" class="btn quiet" style="font-size:14px; min-height:38px;">📖 ${moduleObj ? moduleObj.order + '. Bölüm Ders Notunu Oku' : 'Ders Notunu Oku'}</a>
            </div>
          </div>

          <div class="sim-tabs" role="tablist">
            <button class="sim-tab-btn ${activeTab === 'tablo' ? 'active' : ''}" id="btn-tab-tablo" role="tab" aria-selected="${activeTab === 'tablo'}">
              📋 Seçenek 1: Bütünleşik Hesaplama Tablosu Sınavı
            </button>
            <button class="sim-tab-btn ${activeTab === 'soru' ? 'active' : ''}" id="btn-tab-soru" role="tab" aria-selected="${activeTab === 'soru'}">
              ❓ Seçenek 2: Soru Soru İnteraktif Puanlama Testi
            </button>
          </div>

          <div id="sim-content"></div>
        </div>
      `;

      container.querySelector('#btn-tab-tablo').onclick = () => { activeTab = 'tablo'; draw(); };
      container.querySelector('#btn-tab-soru').onclick = () => { activeTab = 'soru'; draw(); };

      const contentBox = container.querySelector('#sim-content');
      if (activeTab === 'tablo') {
        renderTableExam(contentBox);
      } else {
        renderQuestionExam(contentBox);
      }
    }

    // ----------------------------------------------------
    // SEÇENEK 1: BÜTÜNLEŞİK HESAPLAMA TABLOSU SINAVI
    // ----------------------------------------------------
    function renderTableExam(target) {
      const exp = currentExp;
      const isBoard = (currentRows === BOARD_ROWS);

      target.innerHTML = `
        <div class="sim-toolbar">
          <div class="sim-actions">
            <button class="btn quiet" id="btn-load-board" style="min-height:38px; font-size:13.5px;" ${isBoard ? 'disabled' : ''}>
              🏛️ Hocanın Orijinal Sorusu (N=25)
            </button>
            <button class="btn quiet" id="btn-load-rand" style="min-height:38px; font-size:13.5px;">
              🎲 Rastgele Yeni Soru Üret
            </button>
            <button class="btn quiet" id="btn-fill-sol" style="min-height:38px; font-size:13.5px;">
              👁️ Tam Çözümü Doldur
            </button>
            <button class="btn quiet" id="btn-clear" style="min-height:38px; font-size:13.5px;">
              🧹 Temizle
            </button>
          </div>
          <div>
            <button class="btn" id="btn-grade" style="min-height:42px; font-size:15px; font-weight:700;">
              ✨ Sınavı Bitir ve Puanla
            </button>
          </div>
        </div>

        <div id="sim-score-area"></div>

        <div class="notice info" style="margin: 0 0 var(--s4); font-size:14.5px;">
          <strong>Sınav Talimatı:</strong> Aşağıdaki tabloda ve özet kartlarında boş bırakılan tüm hücreleri hesaplayıp doldur. Ondalık kısımları virgül veya nokta ile girebilirsin (ör. <code>8,2</code> veya <code>8.2</code>). Tamamlayınca <strong>"Sınavı Bitir ve Puanla"</strong> butonuna tıkla.
        </div>

        <div class="sim-table-wrap">
          <table class="sim-table" id="exam-table">
            <thead>
              <tr>
                <th style="width:40px;">#</th>
                <th style="width:65px;">X<sub>i</sub> (Değer)</th>
                <th style="width:65px;">f (Sıklık)</th>
                <th>F (Birikimli f)</th>
                <th>X<sub>i</sub> · f</th>
                <th>X<sub>i</sub> − x̄</th>
                <th>|X<sub>i</sub> − x̄|</th>
                <th>f · |X<sub>i</sub> − x̄|</th>
                <th>(X<sub>i</sub> − x̄)²</th>
                <th>f · (X<sub>i</sub> − x̄)²</th>
              </tr>
            </thead>
            <tbody>
              ${exp.rows.map((r, i) => `
                <tr data-row="${i}" class="${r.xi === exp.mode ? 'highlight-row' : ''}">
                  <td style="text-align:center; color:var(--ink-3); font-size:12px;">${i + 1}</td>
                  <td style="text-align:center; font-weight:700;">${r.xi}</td>
                  <td style="text-align:center;">${r.f}</td>
                  <td><input class="sim-cell-input" data-k="F" data-idx="${i}" autocomplete="off" placeholder="F"></td>
                  <td><input class="sim-cell-input" data-k="xf" data-idx="${i}" autocomplete="off" placeholder="X·f"></td>
                  <td><input class="sim-cell-input" data-k="x_ao" data-idx="${i}" autocomplete="off" placeholder="X-AO"></td>
                  <td><input class="sim-cell-input" data-k="abs_x_ao" data-idx="${i}" autocomplete="off" placeholder="|X-AO|"></td>
                  <td><input class="sim-cell-input" data-k="f_abs" data-idx="${i}" autocomplete="off" placeholder="f·|sapma|"></td>
                  <td><input class="sim-cell-input" data-k="sq" data-idx="${i}" autocomplete="off" placeholder="sapma²"></td>
                  <td><input class="sim-cell-input" data-k="f_sq" data-idx="${i}" autocomplete="off" placeholder="f·sapma²"></td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td colspan="2" style="text-align:center;"><strong>TOPLAM</strong></td>
                <td style="text-align:center;"><strong>${exp.N}</strong></td>
                <td style="text-align:center; color:var(--ink-3); font-size:12px;">—</td>
                <td><input class="sim-cell-input" id="inp-sum-xf" autocomplete="off" placeholder="Σ X·f"></td>
                <td colspan="2" style="text-align:center; color:var(--ink-3); font-size:12px;">—</td>
                <td><input class="sim-cell-input" id="inp-sum-fabs" autocomplete="off" placeholder="Σ f·|sapma|"></td>
                <td style="text-align:center; color:var(--ink-3); font-size:12px;">—</td>
                <td><input class="sim-cell-input" id="inp-sum-fsq" autocomplete="off" placeholder="Σ f·sapma²"></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="sim-summary-layout">
          <!-- Merkezi Eğilim Kartı -->
          <div class="sim-card">
            <h3>🎯 Merkezi Eğilim Ölçüleri</h3>
            <div class="sim-card-row">
              <span class="label">Aritmetik Ortalama (x̄ = ΣXf / N):</span>
              <input class="sim-cell-input" id="inp-mean" style="max-width:90px;" placeholder="ör. 8,2">
            </div>
            <div class="sim-card-row">
              <span class="label">Mod (Tepe Değer):</span>
              <input class="sim-cell-input" id="inp-mode" style="max-width:90px;" placeholder="ör. 8">
            </div>
            <div class="sim-card-row">
              <span class="label">Medyan Terim Sırası:</span>
              <input class="sim-cell-input" id="inp-med-rank" style="max-width:90px;" placeholder="ör. 13">
            </div>
            <div class="sim-card-row">
              <span class="label">Medyanın Değeri:</span>
              <input class="sim-cell-input" id="inp-median" style="max-width:90px;" placeholder="ör. 8">
            </div>
          </div>

          <!-- Yayılım / Dağılım Ölçüleri Kartı -->
          <div class="sim-card">
            <h3>📊 Merkezi Yayılım / Dağılım Ölçüleri</h3>
            <div class="sim-card-row">
              <span class="label">Değişim Aralığı (Ranj = Xmax − Xmin):</span>
              <input class="sim-cell-input" id="inp-range" style="max-width:90px;" placeholder="ör. 15">
            </div>
            <div class="sim-card-row">
              <span class="label">Ortalama Mutlak Sapma (OMS):</span>
              <input class="sim-cell-input" id="inp-oms" style="max-width:90px;" placeholder="ör. 3,95">
            </div>
            <div class="sim-card-row">
              <span class="label">Varyans (S² = Σf·(X−x̄)² / N):</span>
              <input class="sim-cell-input" id="inp-variance" style="max-width:90px;" placeholder="ör. 24,08">
            </div>
            <div class="sim-card-row">
              <span class="label">Standart Sapma (S = √S²):</span>
              <input class="sim-cell-input" id="inp-sd" style="max-width:90px;" placeholder="ör. 4,91">
            </div>
            <div class="sim-card-row">
              <span class="label">Değişim Katsayısı (CV % = S/x̄ · 100):</span>
              <input class="sim-cell-input" id="inp-cv" style="max-width:90px;" placeholder="ör. 59,84">
            </div>
            <div class="sim-card-row">
              <span class="label">Çeyrekler Arası Genişlik (IQR = Q3 − Q1):</span>
              <input class="sim-cell-input" id="inp-iqr" style="max-width:90px;" placeholder="ör. 9">
            </div>
          </div>

          <!-- Sınav Teorik Sorusu: Parametrik Testin 4 Şartı -->
          <div class="sim-card" style="grid-column: 1 / -1;">
            <h3>⚖️ Sınav Teorik Sorusu: "Parametrik Test 4 Maddeyi Tamamlayacak"</h3>
            <p style="font-size:14.5px; color:var(--ink-2); margin-bottom:12px;">
              Hocanın sınav notunda belirttiği, bir araştırmada parametrik test (Independent t-test, ANOVA vb.) uygulanabilmesi için sağlanması zorunlu olan <strong>4 temel koşulu</strong> aşağıdaki listeden işaretleyiniz:
            </p>
            <div class="sim-criteria-grid">
              ${PARAMETRIC_OPTIONS.map((opt, i) => `
                <label class="sim-criterion" id="crit-box-${i}">
                  <input type="checkbox" data-cid="${opt.id}" style="width:19px; height:19px; margin-top:2px; accent-color:var(--accent);">
                  <span style="font-size:14.5px; line-height:1.4;">${opt.text}</span>
                </label>
              `).join('')}
            </div>
          </div>
        </div>
      `;

      // Event handlers
      target.querySelector('#btn-load-board').onclick = () => {
        currentRows = BOARD_ROWS.slice();
        currentExp = calculateExpected(currentRows);
        renderTableExam(target);
      };

      target.querySelector('#btn-load-rand').onclick = () => {
        currentRows = generateRandomProblem();
        currentExp = calculateExpected(currentRows);
        renderTableExam(target);
      };

      target.querySelector('#btn-clear').onclick = () => {
        target.querySelectorAll('input').forEach(inp => {
          if (inp.type === 'checkbox') inp.checked = false;
          else inp.value = '';
          inp.classList.remove('is-correct', 'is-wrong');
        });
        target.querySelector('#sim-score-area').innerHTML = '';
      };

      target.querySelector('#btn-fill-sol').onclick = () => {
        // Tablo hücrelerini doldur
        exp.rows.forEach((r, i) => {
          setInpVal(`[data-k="F"][data-idx="${i}"]`, r.F);
          setInpVal(`[data-k="xf"][data-idx="${i}"]`, r.xf);
          setInpVal(`[data-k="x_ao"][data-idx="${i}"]`, fmtNum(r.x_ao));
          setInpVal(`[data-k="abs_x_ao"][data-idx="${i}"]`, fmtNum(r.abs_x_ao));
          setInpVal(`[data-k="f_abs"][data-idx="${i}"]`, fmtNum(r.f_abs));
          setInpVal(`[data-k="sq"][data-idx="${i}"]`, fmtNum(r.sq));
          setInpVal(`[data-k="f_sq"][data-idx="${i}"]`, fmtNum(r.f_sq));
        });

        // Toplamları doldur
        setInpVal('#inp-sum-xf', exp.sumXf);
        setInpVal('#inp-sum-fabs', fmtNum(exp.sumFAbs));
        setInpVal('#inp-sum-fsq', fmtNum(exp.sumFSq));

        // Özet kutularını doldur
        setInpVal('#inp-mean', fmtNum(exp.mean));
        setInpVal('#inp-mode', exp.mode);
        setInpVal('#inp-med-rank', fmtNum(exp.medRank));
        setInpVal('#inp-median', exp.median);
        setInpVal('#inp-range', exp.range);
        setInpVal('#inp-oms', fmtNum(exp.oms, 3));
        setInpVal('#inp-variance', fmtNum(exp.variance));
        setInpVal('#inp-sd', fmtNum(exp.sd, 3));
        setInpVal('#inp-cv', fmtNum(exp.cv));
        setInpVal('#inp-iqr', exp.iqr);

        // Parametrik 4 şartı işaretle
        PARAMETRIC_OPTIONS.forEach((opt, i) => {
          const cb = target.querySelector(`input[data-cid="${opt.id}"]`);
          if (cb) cb.checked = opt.correct;
        });

        gradeExam(false);
      };

      function setInpVal(selector, val) {
        const inp = target.querySelector(selector);
        if (inp) inp.value = String(val).replace('.', ',');
      }

      function gradeExam(showScroll = true) {
        let totalItems = 0;
        let correctItems = 0;

        function checkField(selector, expected, tol = 0.08) {
          totalItems++;
          const inp = target.querySelector(selector);
          if (!inp) return;
          const userVal = parseVal(inp.value);
          const expVal = typeof expected === 'number' ? expected : parseVal(expected);
          const ok = !isNaN(userVal) && Math.abs(userVal - expVal) <= tol;
          if (ok) {
            correctItems++;
            inp.classList.add('is-correct');
            inp.classList.remove('is-wrong');
          } else {
            inp.classList.add('is-wrong');
            inp.classList.remove('is-correct');
          }
        }

        // Tablo satırlarını denetle
        exp.rows.forEach((r, i) => {
          checkField(`[data-k="F"][data-idx="${i}"]`, r.F, 0.1);
          checkField(`[data-k="xf"][data-idx="${i}"]`, r.xf, 0.1);
          checkField(`[data-k="x_ao"][data-idx="${i}"]`, r.x_ao, 0.1);
          checkField(`[data-k="abs_x_ao"][data-idx="${i}"]`, r.abs_x_ao, 0.1);
          checkField(`[data-k="f_abs"][data-idx="${i}"]`, r.f_abs, 0.1);
          checkField(`[data-k="sq"][data-idx="${i}"]`, r.sq, 0.15);
          checkField(`[data-k="f_sq"][data-idx="${i}"]`, r.f_sq, 0.25);
        });

        // Toplamları denetle
        checkField('#inp-sum-xf', exp.sumXf, 0.1);
        checkField('#inp-sum-fabs', exp.sumFAbs, 0.2);
        checkField('#inp-sum-fsq', exp.sumFSq, 0.5);

        // Özetleri denetle
        checkField('#inp-mean', exp.mean, 0.1);
        checkField('#inp-mode', exp.mode, 0.1);
        checkField('#inp-med-rank', exp.medRank, 0.1);
        checkField('#inp-median', exp.median, 0.1);
        checkField('#inp-range', exp.range, 0.1);
        checkField('#inp-oms', exp.oms, 0.1);
        // Varyans: hem N (24.08) hem n-1 (25.08) toleransla kabul edilebilir
        const varInp = target.querySelector('#inp-variance');
        if (varInp) {
          totalItems++;
          const uv = parseVal(varInp.value);
          const ok = (!isNaN(uv) && (Math.abs(uv - exp.variance) <= 0.15 || Math.abs(uv - exp.sampleVariance) <= 0.15));
          if (ok) {
            correctItems++;
            varInp.classList.add('is-correct');
            varInp.classList.remove('is-wrong');
          } else {
            varInp.classList.add('is-wrong');
            varInp.classList.remove('is-correct');
          }
        }
        checkField('#inp-sd', exp.sd, 0.15);
        checkField('#inp-cv', exp.cv, 0.4);
        checkField('#inp-iqr', exp.iqr, 0.2);

        // Parametrik 4 şartı denetle (Her biri 1 puan)
        PARAMETRIC_OPTIONS.forEach((opt, i) => {
          totalItems++;
          const cb = target.querySelector(`input[data-cid="${opt.id}"]`);
          const box = target.querySelector(`#crit-box-${i}`);
          const isChecked = cb && cb.checked;
          const ok = (isChecked === opt.correct);
          if (ok) {
            correctItems++;
            if (box) { box.style.borderColor = 'var(--ok)'; box.style.backgroundColor = 'var(--ok-bg)'; }
          } else {
            if (box) { box.style.borderColor = 'var(--bad)'; box.style.backgroundColor = 'var(--bad-bg)'; }
          }
        });

        const score = Math.round((correctItems / totalItems) * 100);
        let badgeCls = score >= 80 ? 'good' : score >= 50 ? 'mid' : 'bad';
        let msg = score >= 85 ? 'Tebrikler! Vize sınavına tam anlamıyla hazırsın.' : score >= 60 ? 'Gayet iyi, birkaç hesaplama ve formül tekrarıyla 100 alırsın!' : 'Eksiklerin var. Kırmızı ile işaretlenen alanları ve çözümü dikkatlice incele.';

        const scoreArea = target.querySelector('#sim-score-area');
        scoreArea.innerHTML = `
          <div class="sim-score-banner ${badgeCls}">
            <div>
              <div class="sim-score-big">${score} / 100</div>
              <div style="font-size:15px; margin-top:4px;">${msg}</div>
              <div style="font-size:13.5px; opacity:.9; margin-top:2px;">
                Toplam ${totalItems} değerlendirme kriterinden <strong>${correctItems} tanesi doğru</strong>.
              </div>
            </div>
            <div>
              <button class="btn quiet" id="btn-re-calc" style="background:#fff; font-size:14px;">Tekrar Çöz</button>
            </div>
          </div>
        `;
        scoreArea.querySelector('#btn-re-calc').onclick = () => {
          target.querySelector('#btn-clear').click();
        };

        if (showScroll) {
          scoreArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }

      target.querySelector('#btn-grade').onclick = () => gradeExam(true);
    }

    // ----------------------------------------------------
    // SEÇENEK 2: SORU SORU İNTERAKTİF PUANLAMA TESTİ
    // ----------------------------------------------------
    function renderQuestionExam(target) {
      const qList = (moduleObj && moduleObj.questions) ? moduleObj.questions : [];
      if (!qList.length) {
        target.innerHTML = `<div class="empty">Bu bölüm için soru bulunamadı.</div>`;
        return;
      }

      target.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; gap:var(--s3); flex-wrap:wrap; margin-bottom:var(--s4);">
          <div>
            <h2 style="font-size:20px; font-weight:700;">🎯 Vize Sınavı Soru Soru Test Modu</h2>
            <p class="muted small" style="margin-top:2px;">
              Hocanın Excel frekans tablosu hesaplamaları ve parametrik testlerin 4 şartından oluşan 15 soruluk özel vize testi.
            </p>
          </div>
          <div class="row">
            <span class="tag" style="background:var(--accent-soft); color:var(--accent); font-weight:600;">15 Soru · Puanlı</span>
          </div>
        </div>
        <div id="sim-quiz-runner"></div>
      `;

      const runnerBox = target.querySelector('#sim-quiz-runner');
      if (typeof runQuizFn === 'function') {
        runQuizFn(runnerBox, qList, {
          mode: 'instant',
          title: 'Vize Sınavı Test Simülasyonu',
          logWrong: true,
          onFinish(res, box) {
            const p = Math.round((res.correct / res.total) * 100);
            box.insertAdjacentHTML('beforeend', `
              <div class="step-foot" style="margin-top:24px;">
                <button class="btn quiet" id="btn-retry-quiz">Testi Yeniden Çöz</button>
                <button class="btn" id="btn-switch-table">📋 Seçenek 1: Tablo Sınavına Geç</button>
              </div>
            `);
            box.querySelector('#btn-retry-quiz').onclick = () => renderQuestionExam(target);
            box.querySelector('#btn-switch-table').onclick = () => {
              activeTab = 'tablo';
              draw();
            };
          }
        });
      } else {
        runnerBox.innerHTML = `<p class="muted">Quiz motoru yükleniyor...</p>`;
      }
    }

    draw();
  }

  window.SIMULASYON = {
    BOARD_ROWS: BOARD_ROWS,
    calculateExpected: calculateExpected,
    generateRandomProblem: generateRandomProblem,
    render: renderSimulation
  };
})();
