// Biyoistatistik interaktif hesap atölyesi motoru
(function () {
  'use strict';

  function rndInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function round(n, d) {
    const p = Math.pow(10, d || 2);
    return Math.round(n * p) / p;
  }

  function numFmt(n) {
    return String(round(n, 2)).replace('.', ',');
  }

  const KINDS = [
    { id: 'ort', t: 'Aritmetik Ortalama' },
    { id: 'med', t: 'Medyan (Ortanca)' },
    { id: 'range', t: 'Değişim Aralığı (Range)' },
    { id: 'q1', t: '1. Çeyreklik (Q1)' },
    { id: 'q3', t: '3. Çeyreklik (Q3)' },
    { id: 'iqr', t: 'Çeyrekler Arası Genişlik (IQR)' },
    { id: 'qd', t: 'Çeyrek Sapma (QD)' },
    { id: 'em', t: 'Ortalama Mutlak Sapma (em)' },
    { id: 'var', t: 'Varyans (σ²)' },
    { id: 'sd', t: 'Standart Sapma (σ)' },
    { id: 'dk', t: 'Değişim Katsayısı (dk %)' },
    { id: 'skew', t: 'Pearson Çarpıklık Katsayısı' }
  ];

  function make(kid) {
    switch (kid) {
      case 'ort': {
        const n = rndInt(5, 7);
        const data = [];
        let sum = 0;
        for (let i = 0; i < n; i++) {
          const val = rndInt(2, 20);
          data.push(val);
          sum += val;
        }
        const mean = sum / n;
        const ans = round(mean, 2);
        return {
          prompt: 'Aşağıdaki veri setinin <strong>aritmetik ortalamasını</strong> hesaplayınız:',
          data: data,
          hint: 'ondalık için virgül veya nokta, ör. 12,4',
          answerText: numFmt(ans),
          steps: `<ol>
            <li><strong>Toplam formülü:</strong> ΣX = ${data.join(' + ')} = ${sum}</li>
            <li><strong>Gözlem sayısı:</strong> n = ${n}</li>
            <li><strong>Aritmetik ortalama:</strong> x̄ = ΣX / n = ${sum} / ${n} = <strong>${numFmt(ans)}</strong></li>
          </ol>`,
          check: v => Math.abs(v - ans) <= 0.06
        };
      }

      case 'med': {
        const n = pick([5, 6, 7]);
        const data = [];
        for (let i = 0; i < n; i++) data.push(rndInt(4, 30));
        const sorted = data.slice().sort((a, b) => a - b);
        let median, steps;
        if (n % 2 === 1) {
          const midIdx = Math.floor(n / 2);
          median = sorted[midIdx];
          steps = `<ol>
            <li><strong>Verileri küçükten büyüğe sırala:</strong> ${sorted.join(', ')}</li>
            <li><strong>Terim sayısı tek (n = ${n}):</strong> Medyan tam ortadaki ${(n + 1) / 2}. terimdir.</li>
            <li><strong>Cevap:</strong> <strong>${median}</strong></li>
          </ol>`;
        } else {
          const m1 = sorted[n / 2 - 1];
          const m2 = sorted[n / 2];
          median = (m1 + m2) / 2;
          steps = `<ol>
            <li><strong>Verileri küçükten büyüğe sırala:</strong> ${sorted.join(', ')}</li>
            <li><strong>Terim sayısı çift (n = ${n}):</strong> Ortadaki iki terimin (${n / 2}. terim ${m1} ve ${(n / 2) + 1}. terim ${m2}) aritmetik ortalaması alınır: (${m1} + ${m2}) / 2 = <strong>${numFmt(median)}</strong></li>
          </ol>`;
        }
        return {
          prompt: 'Aşağıdaki veri setinin <strong>medyanını (ortancasını)</strong> hesaplayınız:',
          data: data,
          hint: 'ör. 15 veya 16,5',
          answerText: numFmt(median),
          steps: steps,
          check: v => Math.abs(v - median) <= 0.05
        };
      }

      case 'range': {
        const n = rndInt(5, 8);
        const data = [];
        for (let i = 0; i < n; i++) data.push(rndInt(5, 50));
        const min = Math.min(...data);
        const max = Math.max(...data);
        const r = max - min;
        return {
          prompt: 'Aşağıdaki veri setinin <strong>değişim aralığını (range / yayılma genişliği)</strong> hesaplayınız:',
          data: data,
          hint: 'tamsayı',
          answerText: String(r),
          steps: `<ol>
            <li><strong>En büyük değer (Maks):</strong> ${max}</li>
            <li><strong>En küçük değer (Min):</strong> ${min}</li>
            <li><strong>Range = Maks − Min:</strong> ${max} − ${min} = <strong>${r}</strong></li>
          </ol>`,
          check: v => v === r
        };
      }

      case 'q1':
      case 'q3':
      case 'iqr':
      case 'qd': {
        // Use clean small datasets with n = 5 or 7 so (n+1)/4 gives clear positions
        const n = pick([5, 7]);
        const data = [];
        for (let i = 0; i < n; i++) data.push(rndInt(10, 45));
        const sorted = data.slice().sort((a, b) => a - b);
        
        // Slayt kuralı: Q1 sırası = (n + 1) / 4, Q3 sırası = 3(n + 1) / 4
        // For n = 5: Q1 pos = 1.5 -> (X1 + X2)/2; Q3 pos = 4.5 -> (X4 + X5)/2
        // For n = 7: Q1 pos = 2 -> X2; Q3 pos = 6 -> X6
        let q1Val, q3Val, q1Expl, q3Expl;
        if (n === 5) {
          q1Val = (sorted[0] + sorted[1]) / 2;
          q3Val = (sorted[3] + sorted[4]) / 2;
          q1Expl = `Sıra: (5+1)/4 = 1,5. terim → 1. terim (${sorted[0]}) ile 2. terim (${sorted[1]}) ortalaması = (${sorted[0]} + ${sorted[1]})/2 = ${numFmt(q1Val)}`;
          q3Expl = `Sıra: 3(5+1)/4 = 4,5. terim → 4. terim (${sorted[3]}) ile 5. terim (${sorted[4]}) ortalaması = (${sorted[3]} + ${sorted[4]})/2 = ${numFmt(q3Val)}`;
        } else {
          q1Val = sorted[1];
          q3Val = sorted[5];
          q1Expl = `Sıra: (7+1)/4 = 2. terim → ${q1Val}`;
          q3Expl = `Sıra: 3(7+1)/4 = 6. terim → ${q3Val}`;
        }
        const iqrVal = round(q3Val - q1Val, 2);
        const qdVal = round(iqrVal / 2, 2);

        if (kid === 'q1') {
          return {
            prompt: 'Aşağıdaki serinin <strong>1. Çeyrekliğini (Q1)</strong> hesaplayınız:',
            data: data,
            hint: 'ondalık olabilir, ör. 14,5',
            answerText: numFmt(q1Val),
            steps: `<ol>
              <li><strong>Sıralı seri:</strong> ${sorted.join(', ')}</li>
              <li><strong>Q1 terim sırası formülü:</strong> (n + 1) / 4 = (${n} + 1) / 4 = ${(n + 1) / 4}</li>
              <li><strong>Değer:</strong> ${q1Expl}</li>
              <li><strong>Q1:</strong> <strong>${numFmt(q1Val)}</strong></li>
            </ol>`,
            check: v => Math.abs(v - q1Val) <= 0.05
          };
        } else if (kid === 'q3') {
          return {
            prompt: 'Aşağıdaki serinin <strong>3. Çeyrekliğini (Q3)</strong> hesaplayınız:',
            data: data,
            hint: 'ondalık olabilir, ör. 28,5',
            answerText: numFmt(q3Val),
            steps: `<ol>
              <li><strong>Sıralı seri:</strong> ${sorted.join(', ')}</li>
              <li><strong>Q3 terim sırası formülü:</strong> 3(n + 1) / 4 = 3(${n} + 1) / 4 = ${3 * (n + 1) / 4}</li>
              <li><strong>Değer:</strong> ${q3Expl}</li>
              <li><strong>Q3:</strong> <strong>${numFmt(q3Val)}</strong></li>
            </ol>`,
            check: v => Math.abs(v - q3Val) <= 0.05
          };
        } else if (kid === 'iqr') {
          return {
            prompt: 'Aşağıdaki serinin <strong>Çeyrekler Arası Genişliğini (IQR)</strong> hesaplayınız:',
            data: data,
            hint: 'IQR = Q3 − Q1',
            answerText: numFmt(iqrVal),
            steps: `<ol>
              <li><strong>Sıralı seri:</strong> ${sorted.join(', ')}</li>
              <li><strong>Q1 hesabı:</strong> ${q1Expl}</li>
              <li><strong>Q3 hesabı:</strong> ${q3Expl}</li>
              <li><strong>IQR formülü:</strong> Q3 − Q1 = ${numFmt(q3Val)} − ${numFmt(q1Val)} = <strong>${numFmt(iqrVal)}</strong></li>
            </ol>`,
            check: v => Math.abs(v - iqrVal) <= 0.05
          };
        } else {
          return {
            prompt: 'Aşağıdaki serinin <strong>Çeyrek Sapmasını / Yarı Genişliğini (QD)</strong> hesaplayınız:',
            data: data,
            hint: 'QD = (Q3 − Q1) / 2',
            answerText: numFmt(qdVal),
            steps: `<ol>
              <li><strong>Sıralı seri:</strong> ${sorted.join(', ')}</li>
              <li><strong>Q1:</strong> ${numFmt(q1Val)}, <strong>Q3:</strong> ${numFmt(q3Val)}</li>
              <li><strong>Çeyrek sapma formülü:</strong> QD = (Q3 − Q1) / 2 = (${numFmt(q3Val)} − ${numFmt(q1Val)}) / 2 = ${numFmt(iqrVal)} / 2 = <strong>${numFmt(qdVal)}</strong></li>
            </ol>`,
            check: v => Math.abs(v - qdVal) <= 0.05
          };
        }
      }

      case 'em': {
        // Small dataset with integer mean
        const base = rndInt(4, 15);
        const dev = [-4, -2, 0, 2, 4];
        const data = dev.map(d => base + d);
        const n = 5;
        const mean = base;
        const sumAbs = dev.reduce((a, b) => a + Math.abs(b), 0);
        const em = sumAbs / n;
        return {
          prompt: 'Aşağıdaki veri setinin <strong>ortalama mutlak sapmasını (em)</strong> hesaplayınız:',
          data: data,
          hint: 'em = Σ|xi − x̄| / n',
          answerText: numFmt(em),
          steps: `<ol>
            <li><strong>Aritmetik ortalama:</strong> x̄ = (${data.join(' + ')}) / ${n} = ${base * n} / ${n} = ${base}</li>
            <li><strong>Ortalamadan mutlak sapmalar (|xi − x̄|):</strong> ${data.map(x => `|${x} − ${base}| = ${Math.abs(x - base)}`).join(', ')}</li>
            <li><strong>Sapmaların toplamı:</strong> Σ|xi − x̄| = ${sumAbs}</li>
            <li><strong>Ortalama mutlak sapma:</strong> em = ${sumAbs} / ${n} = <strong>${numFmt(em)}</strong></li>
          </ol>`,
          check: v => Math.abs(v - em) <= 0.05
        };
      }

      case 'var':
      case 'sd': {
        // Clean small dataset with integer mean
        const base = rndInt(6, 18);
        const dev = pick([
          [-3, -1, 0, 1, 3],
          [-2, -2, 0, 2, 2],
          [-4, -2, 0, 2, 4],
          [-1, -1, 0, 1, 1]
        ]);
        const data = dev.map(d => base + d);
        const n = 5;
        const sumSq = dev.reduce((a, b) => a + b * b, 0);
        const variance = round(sumSq / n, 2);
        const sd = round(Math.sqrt(sumSq / n), 2);

        if (kid === 'var') {
          return {
            prompt: 'Aşağıdaki veri setinin <strong>varyansını (σ²)</strong> hesaplayınız (ders slaytlarındaki n formülü ile):',
            data: data,
            hint: 'σ² = Σ(xi − x̄)² / n',
            answerText: numFmt(variance),
            steps: `<ol>
              <li><strong>Aritmetik ortalama:</strong> x̄ = (${data.join(' + ')}) / ${n} = ${base * n} / ${n} = ${base}</li>
              <li><strong>Farkların kareleri (xi − x̄)²:</strong> ${data.map(x => `(${x} − ${base})² = ${(x - base) * (x - base)}`).join(', ')}</li>
              <li><strong>Kareler toplamı:</strong> Σ(xi − x̄)² = ${sumSq}</li>
              <li><strong>Varyans (slayt formülü / n):</strong> σ² = ${sumSq} / ${n} = <strong>${numFmt(variance)}</strong></li>
            </ol>`,
            check: v => Math.abs(v - variance) <= 0.05
          };
        } else {
          return {
            prompt: 'Aşağıdaki veri setinin <strong>standart sapmasını (σ)</strong> hesaplayınız (ders slaytlarındaki formülle):',
            data: data,
            hint: 'σ = √(varyans)',
            answerText: numFmt(sd),
            steps: `<ol>
              <li><strong>Aritmetik ortalama:</strong> x̄ = ${base}</li>
              <li><strong>Kareler toplamı:</strong> Σ(xi − x̄)² = ${sumSq}</li>
              <li><strong>Varyans (σ²):</strong> ${sumSq} / ${n} = ${numFmt(variance)}</li>
              <li><strong>Standart sapma:</strong> σ = √${numFmt(variance)} = <strong>${numFmt(sd)}</strong></li>
            </ol>`,
            check: v => Math.abs(v - sd) <= 0.05
          };
        }
      }

      case 'dk': {
        const mean = pick([20, 25, 40, 50]);
        const sd = pick([2, 4, 5, 8, 10]);
        const cv = round((sd / mean) * 100, 2);
        return {
          prompt: `Bir fizyoterapi araştırmasında deneklerin eklem hareket açıklığı ölçümlerinde <strong>ortalama x̄ = ${mean}°</strong> ve <strong>standart sapma s = ${sd}°</strong> bulunmuştur.<br>Bu serinin <strong>değişim katsayısını (dk %)</strong> hesaplayınız:`,
          data: [`x̄ = ${mean}`, `s = ${sd}`],
          hint: 'dk = (s / x̄) · 100, yüzde cinsinden',
          answerText: `%${numFmt(cv)}`,
          steps: `<ol>
            <li><strong>Değişim katsayısı formülü:</strong> dk = (s / x̄) × 100</li>
            <li><strong>Değerlerin yerine konması:</strong> dk = (${sd} / ${mean}) × 100</li>
            <li><strong>Hesap:</strong> ${round(sd / mean, 4)} × 100 = <strong>%${numFmt(cv)}</strong></li>
            <li><em>Not: Değişim katsayısı birimsizdir ve farklı birim veya ortalamalara sahip serilerin yayılımını karşılaştırmada kullanılır.</em></li>
          </ol>`,
          check: v => Math.abs(v - cv) <= 0.1
        };
      }

      case 'skew': {
        const mean = pick([15, 20, 24]);
        const med = pick([12, 18, 20, 22, 26]);
        const sd = pick([4, 5, 6]);
        const as = round((3 * (mean - med)) / sd, 2);
        const dir = as > 0 ? 'sağa çarpık (pozitif)' : as < 0 ? 'sola çarpık (negatif)' : 'simetrik';
        return {
          prompt: `Bir test grubunda <strong>ortalama x̄ = ${mean}</strong>, <strong>medyan = ${med}</strong> ve <strong>standart sapma σ = ${sd}</strong> olarak verilmiştir.<br>Medyan içeren Pearson çarpıklık katsayısını (As) hesaplayınız:`,
          data: [`x̄ = ${mean}`, `Medyan = ${med}`, `σ = ${sd}`],
          hint: 'As = 3(x̄ − Medyan) / σ',
          answerText: numFmt(as),
          steps: `<ol>
            <li><strong>Pearson Çarpıklık formülü:</strong> As = 3(x̄ − Medyan) / σ</li>
            <li><strong>Pay hesabı:</strong> 3 × (${mean} − ${med}) = 3 × (${mean - med}) = ${3 * (mean - med)}</li>
            <li><strong>Bölme:</strong> ${3 * (mean - med)} / ${sd} = <strong>${numFmt(as)}</strong></li>
            <li><strong>Yorum:</strong> As = ${numFmt(as)} → Seri <strong>${dir}</strong> dağılım gösterir.</li>
          </ol>`,
          check: v => Math.abs(v - as) <= 0.05
        };
      }

      default:
        return make('ort');
    }
  }

  window.HESAP = {
    kinds: KINDS,
    make: make
  };
})();
