'use strict';

/**
 * Silnik wzorów pism (U-04): wzór Markdown z polami → bloki → PDF (pdfkit).
 *
 * Składnia wzoru: `{{pole}}`, `{{#lista nazwa}}…{{/lista}}`, `{{#jesli [!]pole}}…{{/jesli}}`;
 * Markdown: `#`/`##`/`###`, akapity (wiersz zakończony `\` łamie linię), `**pogrubienie**`,
 * `*kursywa*`, listy (`-`, `1.`, `1)`, `a)`; wcięcie = poziom), tabele (`|---:|` = do prawej),
 * `---` = podział strony, `[podpis: A | B]` = blok podpisów. Wartości pól wstawia się po
 * rozbiorze Markdownu, więc żaden znak w danych nie zmienia układu pisma.
 *
 * Wygląd jest wspólny dla wszystkich pism i zdefiniowany tylko tutaj: krój Liberation Serif,
 * A4, nagłówek z danymi kancelarii (opcjonalny), stopka „numer · strona X z N”.
 */

const fs = require('node:fs');
const path = require('node:path');
const PDFDocument = require('pdfkit');

const KATALOG_WZOROW = path.join(__dirname, '..', '..', 'wzory');
const KATALOG_CZCIONEK = path.join(KATALOG_WZOROW, 'czcionki');
const CZCIONKI = {
  zwykla: 'LiberationSerif-Regular.ttf',
  gruba: 'LiberationSerif-Bold.ttf',
  kursywa: 'LiberationSerif-Italic.ttf',
};

const POCZ = '';
const KON = '';

// ─────────────────────────────────────────────────────────────
// 1. Wypełnianie pól, list i warunków
// ─────────────────────────────────────────────────────────────

const ZNACZNIK = /\{\{\s*(#lista|#jesli|\/lista|\/jesli)?\s*(!?[\w.]+)?\s*\}\}/g;

/** Szablon → drzewo; znacznik bloku sam w wierszu znika razem z wierszem. */
function drzewo(szablon) {
  const korzen = { dzieci: [] };
  const stos = [korzen];
  let ostatni = 0;
  const tekst = (t) => t && stos[stos.length - 1].dzieci.push({ typ: 'tekst', t });
  for (const m of szablon.matchAll(ZNACZNIK)) {
    const [calosc, rodzaj, nazwa] = m;
    let start = m.index;
    let koniec = m.index + calosc.length;
    if (rodzaj) {
      const poczWiersza = szablon.lastIndexOf('\n', start - 1) + 1;
      const konWiersza = szablon.indexOf('\n', koniec);
      const konW = konWiersza === -1 ? szablon.length : konWiersza;
      if (/^[ \t]*$/.test(szablon.slice(poczWiersza, start)) && /^[ \t]*$/.test(szablon.slice(koniec, konW))) {
        start = Math.max(poczWiersza, ostatni);
        koniec = konWiersza === -1 ? konW : konW + 1;
      }
    }
    tekst(szablon.slice(ostatni, start));
    ostatni = koniec;
    if (!rodzaj) {
      stos[stos.length - 1].dzieci.push({ typ: 'pole', nazwa });
    } else if (rodzaj.startsWith('#')) {
      const wezel = { typ: rodzaj.slice(1), nazwa: nazwa.replace(/^!/, ''), neg: nazwa.startsWith('!'), dzieci: [] };
      stos[stos.length - 1].dzieci.push(wezel);
      stos.push(wezel);
    } else {
      const otwarty = stos.pop();
      if (stos.length === 0 || otwarty.typ !== rodzaj.slice(1)) throw new Error(`Wzór: nieoczekiwany ${calosc}.`);
    }
  }
  if (stos.length > 1) throw new Error(`Wzór: niezamknięty {{#${stos[stos.length - 1].typ} ${stos[stos.length - 1].nazwa}}}.`);
  tekst(szablon.slice(ostatni));
  return korzen.dzieci;
}

function szukaj(nazwa, konteksty) {
  for (let i = konteksty.length - 1; i >= 0; i -= 1) {
    let v = konteksty[i];
    for (const k of nazwa.split('.')) v = v == null ? undefined : v[k];
    if (v !== undefined) return v;
  }
  return undefined;
}

function rozwin(wezly, konteksty, wartosci, brakujace) {
  let wynik = '';
  for (const w of wezly) {
    if (w.typ === 'tekst') wynik += w.t;
    else if (w.typ === 'pole') {
      const v = szukaj(w.nazwa, konteksty);
      if (v == null) {
        if (!brakujace.includes(w.nazwa)) brakujace.push(w.nazwa);
        wartosci.push(`{{${w.nazwa}}}`);
      } else {
        wartosci.push(String(v));
      }
      wynik += `${POCZ}${wartosci.length - 1}${KON}`;
    } else if (w.typ === 'lista') {
      const lista = szukaj(w.nazwa, konteksty);
      for (const el of Array.isArray(lista) ? lista : []) wynik += rozwin(w.dzieci, [...konteksty, el], wartosci, brakujace);
    } else {
      const v = szukaj(w.nazwa, konteksty);
      const prawda = Array.isArray(v) ? v.length > 0 : Boolean(v);
      if (prawda !== w.neg) wynik += rozwin(w.dzieci, konteksty, wartosci, brakujace);
    }
  }
  return wynik;
}

// ─────────────────────────────────────────────────────────────
// 2. Rozbiór Markdownu (ograniczony zestaw)
// ─────────────────────────────────────────────────────────────

/** Tekst wiersza → odcinki { tekst, gruby, kursywa }; pola podstawione po rozbiorze. */
function odcinki(t, wartosci) {
  const runs = [];
  let gruby = false;
  let kursywa = false;
  let biezacy = '';
  const zamknij = () => {
    if (biezacy) runs.push({ tekst: biezacy, gruby, kursywa });
    biezacy = '';
  };
  for (let i = 0; i < t.length; i += 1) {
    const z = t[i];
    if (z === '\\' && i + 1 < t.length) {
      biezacy += t[i + 1];
      i += 1;
    } else if (z === '*' && t[i + 1] === '*') {
      zamknij();
      gruby = !gruby;
      i += 1;
    } else if (z === '*') {
      zamknij();
      kursywa = !kursywa;
    } else {
      biezacy += z;
    }
  }
  zamknij();
  const podstaw = (s) => s.replace(new RegExp(`${POCZ}(\\d+)${KON}`, 'g'), (_, n) => wartosci[Number(n)]);
  const wynik = [];
  for (const r of runs) {
    const tekst = podstaw(r.tekst);
    const pop = wynik[wynik.length - 1];
    if (pop && pop.gruby === r.gruby && pop.kursywa === r.kursywa) pop.tekst += tekst;
    else if (tekst) wynik.push({ ...r, tekst });
  }
  return wynik;
}

function komorki(wiersz) {
  const t = wiersz.trim().replace(/^\|/, '').replace(/(?<!\\)\|$/, '');
  return t.split(/(?<!\\)\|/).map((k) => k.trim());
}

const SEPARATOR = /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
const POZYCJA_LISTY = /^(\s*)(-|\d+[.)]|[a-z]\))\s+(.*)$/;
const PODPIS = /^\[podpis:(.*)\]$/;

function parsuj(md, wartosci) {
  const wiersze = md.split('\n');
  const bloki = [];
  let akapit = null;
  let lista = null;
  const zamknij = () => {
    if (akapit) bloki.push({ typ: 'akapit', runs: odcinki(akapit, wartosci) });
    if (lista) {
      bloki.push({
        typ: 'lista',
        elementy: lista.map((e) => ({ znacznik: e.znacznik, poziom: e.poziom, runs: odcinki(e.tekst, wartosci) })),
      });
    }
    akapit = null;
    lista = null;
  };
  const dolacz = (dotad, w) => {
    const lamanie = /(?<!\\)(\\\\)*\\$/.test(w);
    const tekst = lamanie ? w.slice(0, -1).trimEnd() : w.trim();
    if (dotad == null) return { t: tekst, lam: lamanie };
    return { t: dotad.t + (dotad.lam ? '\n' : ' ') + tekst, lam: lamanie };
  };
  let stanAkapitu = null;
  let stanPozycji = null;

  for (let i = 0; i < wiersze.length; i += 1) {
    const w = wiersze[i];
    const t = w.trim();
    if (t === '') {
      zamknij();
      stanAkapitu = null;
      stanPozycji = null;
      continue;
    }
    if (/^-{3,}$/.test(t)) {
      zamknij();
      bloki.push({ typ: 'strona' });
      continue;
    }
    const podpis = t.match(PODPIS);
    if (podpis) {
      zamknij();
      bloki.push({ typ: 'podpis', podpisy: podpis[1].split('|').map((p) => odcinki(p.trim(), wartosci).map((r) => r.tekst).join('')) });
      continue;
    }
    const naglowek = t.match(/^(#{1,3})\s+(.*)$/);
    if (naglowek) {
      zamknij();
      bloki.push({ typ: 'naglowek', poziom: naglowek[1].length, runs: odcinki(naglowek[2], wartosci) });
      continue;
    }
    if (t.startsWith('|') && i + 1 < wiersze.length && SEPARATOR.test(wiersze[i + 1].trim())) {
      zamknij();
      const wyrownanie = komorki(wiersze[i + 1]).map((k) => (k.endsWith(':') ? (k.startsWith(':') && k.length > 2 ? 'srodek' : 'prawo') : 'lewo'));
      const tabela = { typ: 'tabela', wyrownanie, naglowek: komorki(w).map((k) => odcinki(k, wartosci)), wiersze: [] };
      i += 2;
      while (i < wiersze.length && wiersze[i].trim().startsWith('|')) {
        tabela.wiersze.push(komorki(wiersze[i]).map((k) => odcinki(k, wartosci)));
        i += 1;
      }
      i -= 1;
      bloki.push(tabela);
      continue;
    }
    const pozycja = w.match(POZYCJA_LISTY);
    if (pozycja) {
      if (akapit) {
        zamknij();
        stanAkapitu = null;
      }
      lista = lista || [];
      stanPozycji = dolacz(null, pozycja[3]);
      lista.push({
        znacznik: pozycja[2] === '-' ? '–' : pozycja[2],
        poziom: Math.min(2, Math.floor(pozycja[1].length / 2)),
        tekst: stanPozycji.t,
      });
      continue;
    }
    if (lista) {
      stanPozycji = dolacz(stanPozycji, w);
      lista[lista.length - 1].tekst = stanPozycji.t;
      continue;
    }
    stanAkapitu = dolacz(stanAkapitu, w);
    akapit = stanAkapitu.t;
  }
  zamknij();
  return bloki;
}

/** Wzór + dane → { bloki, brakujace } (brakujące pola zostają w treści jako `{{pole}}`). */
function wypelnij(szablon, dane) {
  const wartosci = [];
  const brakujace = [];
  const md = rozwin(drzewo(szablon), [dane || {}], wartosci, brakujace);
  return { bloki: parsuj(md, wartosci), brakujace };
}

const naTekst = (runs) => runs.map((r) => r.tekst).join('');

/** Treść pisma jako zwykły tekst (sprawdzenia i treść bez układu). */
function tekst(bloki) {
  const linie = [];
  for (const b of bloki) {
    if (b.typ === 'naglowek' || b.typ === 'akapit') linie.push(naTekst(b.runs));
    else if (b.typ === 'lista') for (const e of b.elementy) linie.push(`${'  '.repeat(e.poziom)}${e.znacznik} ${naTekst(e.runs)}`);
    else if (b.typ === 'tabela') for (const w of [b.naglowek, ...b.wiersze]) linie.push(w.map(naTekst).join(' | '));
    else if (b.typ === 'podpis') linie.push(b.podpisy.join(' | '));
  }
  return linie.join('\n');
}

function wczytaj(nazwa) {
  if (!/^[a-z0-9-]+$/.test(nazwa)) throw new Error(`Nieprawidłowa nazwa wzoru „${nazwa}”.`);
  return fs.readFileSync(path.join(KATALOG_WZOROW, `${nazwa}.md`), 'utf8');
}

// ─────────────────────────────────────────────────────────────
// 3. PDF — jeden wygląd dla wszystkich pism
// ─────────────────────────────────────────────────────────────

const ROZMIAR = 11;
const ROZMIAR_TABELI = 9.5;
const ODSTEP = 2;
const MARGINESY = { top: 57, bottom: 64, left: 71, right: 57 };
const PAD = 3;

function pdf(bloki, { numer = '', naglowek = null, tytul = '', autor = '' } = {}) {
  return new Promise((zrealizuj, odrzuc) => {
    const doc = new PDFDocument({ size: 'A4', margins: MARGINESY, bufferPages: true, info: { Title: tytul, Author: autor } });
    for (const [nazwa, plik] of Object.entries(CZCIONKI)) doc.registerFont(nazwa, path.join(KATALOG_CZCIONEK, plik));
    const czesci = [];
    doc.on('data', (c) => czesci.push(c));
    doc.on('error', odrzuc);

    let strona = 1;
    doc.on('pageAdded', () => {
      strona += 1;
    });
    const teksty = [];
    const loguj = (tekst, meta = {}) => teksty.push({ strona, tekst, ...meta });
    const lewo = MARGINESY.left;
    const szer = doc.page.width - MARGINESY.left - MARGINESY.right;
    const dol = () => doc.page.height - MARGINESY.bottom;
    const zapewnij = (wysokosc) => {
      if (doc.y + wysokosc > dol()) doc.addPage();
    };
    const czcionka = (r) => (r.gruby ? 'gruba' : r.kursywa ? 'kursywa' : 'zwykla');

    const runy = (runs, x, szerokosc, opcje = {}) => {
      const r = runs.filter((o) => o.tekst);
      if (r.length === 0) return;
      zapewnij(ROZMIAR + ODSTEP);
      loguj(naTekst(r));
      r.forEach((o, i) => {
        doc.font(opcje.gruby ? 'gruba' : czcionka(o)).fontSize(opcje.rozmiar || ROZMIAR);
        const o2 = { width: szerokosc, align: opcje.align || 'justify', lineGap: ODSTEP, continued: i < r.length - 1 };
        if (i === 0) doc.text(o.tekst, x, doc.y, o2);
        else doc.text(o.tekst, o2);
      });
    };

    if (naglowek) {
      const y0 = doc.y;
      doc.font('zwykla').fontSize(9);
      for (const linia of naglowek.lewy || []) {
        loguj(linia);
        doc.text(linia, lewo, doc.y, { width: szer * 0.6, lineGap: 1 });
      }
      const yLewy = doc.y;
      if (naglowek.prawy) {
        doc.fontSize(ROZMIAR);
        loguj(naglowek.prawy);
        doc.text(naglowek.prawy, lewo + szer * 0.5, y0, { width: szer * 0.5, align: 'right' });
      }
      doc.y = Math.max(yLewy, doc.y) + 18;
    }

    const tabela = (b) => {
      const kolumn = b.naglowek.length;
      doc.fontSize(ROZMIAR_TABELI);
      const wszystkie = [b.naglowek, ...b.wiersze];
      const naturalna = [];
      const minimalna = [];
      for (let k = 0; k < kolumn; k += 1) {
        let nat = 0;
        let min = 0;
        for (const w of wszystkie) {
          const t = naTekst(w[k] || []);
          doc.font(w === b.naglowek ? 'gruba' : 'zwykla');
          for (const linia of t.split('\n')) nat = Math.max(nat, doc.widthOfString(linia));
          for (const slowo of t.split(/\s+/)) min = Math.max(min, doc.widthOfString(slowo));
        }
        naturalna.push(Math.min(nat, szer * 0.6) + 2 * PAD + 1);
        minimalna.push(min + 2 * PAD + 1);
      }
      const sumaNat = naturalna.reduce((a, c) => a + c, 0);
      const sumaMin = minimalna.reduce((a, c) => a + c, 0);
      let szerokosci;
      if (sumaNat <= szer) szerokosci = naturalna.map((s) => (s * szer) / sumaNat);
      else if (sumaMin <= szer) {
        const zapas = naturalna.map((s, k) => s - minimalna[k]);
        const sumaZapasu = zapas.reduce((a, c) => a + c, 0) || 1;
        szerokosci = minimalna.map((m, k) => m + ((szer - sumaMin) * zapas[k]) / sumaZapasu);
      } else szerokosci = minimalna.map((m) => (m * szer) / sumaMin);

      const wysokosc = (w, gruby) => {
        let h = 0;
        w.forEach((runs, k) => {
          const caleGrube = gruby || (runs.length > 0 && runs.every((r) => r.gruby));
          doc.font(caleGrube ? 'gruba' : 'zwykla');
          h = Math.max(h, doc.heightOfString(naTekst(runs) || ' ', { width: szerokosci[k] - 2 * PAD, lineGap: 1 }));
        });
        return h + 2 * PAD;
      };
      const rysuj = (w, gruby, nrWiersza) => {
        const h = wysokosc(w, gruby);
        const y = doc.y;
        let x = lewo;
        w.forEach((runs, k) => {
          const t = naTekst(runs);
          const caleGrube = gruby || (runs.length > 0 && runs.every((r) => r.gruby));
          doc.lineWidth(0.5).strokeColor('#808080').rect(x, y, szerokosci[k], h).stroke();
          doc.fillColor('black').font(caleGrube ? 'gruba' : 'zwykla').fontSize(ROZMIAR_TABELI);
          const align = { lewo: 'left', prawo: 'right', srodek: 'center' }[b.wyrownanie[k] || 'lewo'];
          if (t) {
            loguj(t, { kolumna: k, wiersz: nrWiersza });
            doc.text(t, x + PAD, y + PAD, { width: szerokosci[k] - 2 * PAD, align, lineGap: 1 });
          }
          x += szerokosci[k];
        });
        doc.x = lewo;
        doc.y = y + h;
      };

      const hNagl = wysokosc(b.naglowek, true);
      zapewnij(hNagl + (b.wiersze[0] ? wysokosc(b.wiersze[0], false) : 0));
      rysuj(b.naglowek, true, -1);
      b.wiersze.forEach((w, n) => {
        if (doc.y + wysokosc(w, false) > dol()) {
          doc.addPage();
          rysuj(b.naglowek, true, -1);
        }
        rysuj(w, false, n);
      });
      doc.y += ROZMIAR * 0.6;
    };

    for (const b of bloki) {
      doc.x = lewo;
      if (b.typ === 'naglowek') {
        const rozmiar = b.poziom === 1 ? 13 : ROZMIAR;
        zapewnij(rozmiar * 4);
        doc.y += b.poziom === 1 ? 4 : 6;
        runy(b.runs, lewo, szer, { gruby: true, rozmiar, align: b.poziom === 3 ? 'left' : 'center' });
        doc.y += b.poziom === 1 ? 8 : 3;
      } else if (b.typ === 'akapit') {
        runy(b.runs, lewo, szer);
        doc.y += ROZMIAR * 0.5;
      } else if (b.typ === 'lista') {
        for (const e of b.elementy) {
          const wciecie = e.poziom * 18;
          const naZnacznik = Math.max(18, doc.font('zwykla').fontSize(ROZMIAR).widthOfString(`${e.znacznik} `) + 2);
          zapewnij(ROZMIAR + ODSTEP);
          const y = doc.y;
          doc.text(e.znacznik, lewo + wciecie, y, { lineBreak: false });
          doc.y = y;
          runy(e.runs, lewo + wciecie + naZnacznik, szer - wciecie - naZnacznik);
          doc.y += 2;
        }
        doc.y += ROZMIAR * 0.4;
      } else if (b.typ === 'tabela') {
        tabela(b);
      } else if (b.typ === 'strona') {
        if (doc.y > MARGINESY.top + 1) doc.addPage();
      } else if (b.typ === 'podpis') {
        zapewnij(70);
        doc.y += 36;
        const y = doc.y;
        const kol = szer / b.podpisy.length;
        doc.font('zwykla').fontSize(ROZMIAR);
        b.podpisy.forEach((p, k) => {
          const x = lewo + k * kol;
          doc.text('.'.repeat(45), x, y, { width: kol, align: 'center' });
          doc.fontSize(9);
          loguj(p);
          doc.text(p, x, doc.y, { width: kol, align: 'center' });
          doc.fontSize(ROZMIAR);
        });
        doc.x = lewo;
        doc.y += ROZMIAR;
      }
    }

    const zakres = doc.bufferedPageRange();
    for (let i = 0; i < zakres.count; i += 1) {
      doc.switchToPage(zakres.start + i);
      const stopka = [numer, `strona ${i + 1} z ${zakres.count}`].filter(Boolean).join(' · ');
      doc.page.margins.bottom = 0;
      doc.font('zwykla').fontSize(8);
      teksty.push({ strona: i + 1, tekst: stopka });
      doc.text(stopka, lewo, doc.page.height - 40, { width: szer, align: 'center', lineBreak: false });
      doc.page.margins.bottom = MARGINESY.bottom;
    }
    doc.on('end', () => zrealizuj({ bufor: Buffer.concat(czesci), strony: zakres.count, teksty }));
    doc.end();
  });
}

module.exports = { wypelnij, tekst, wczytaj, pdf };
