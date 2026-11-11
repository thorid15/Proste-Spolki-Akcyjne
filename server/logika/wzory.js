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
 * Wygląd zdefiniowany tylko tutaj, dwa warianty: „pismo” — wspólny dla wszystkich pism (Liberation
 * Serif, A4, nagłówek z danymi kancelarii, stopka „numer · strona X z N”) i „informacja” — informacja
 * z rejestru dla klienta (znak notariatu, EB Garamond i Inter, metryka, tabele bez siatki).
 */

const fs = require('node:fs');
const path = require('node:path');
const PDFDocument = require('pdfkit');

const KATALOG_WZOROW = path.join(__dirname, '..', '..', 'wzory');
const KATALOG_CZCIONEK = path.join(KATALOG_WZOROW, 'czcionki');

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
// 3. PDF — dwa wyglądy: „pismo” (wszystkie pisma) i „informacja” (informacja z rejestru)
// ─────────────────────────────────────────────────────────────

const MM = 72 / 25.4;
const ZNAK_NOTARIATU = path.join(__dirname, '..', '..', 'publiczne', 'obrazy', 'notariat.png');

/** Barwy informacji — te same co w aplikacji (`publiczne/style/rejestr.css`). */
const KOLOR = { tekst: '#14181C', szary: '#565E68', jasny: '#8A929C', zielen: '#1F4D3D', tlo: '#F1F5F2', linia: '#E6E8E3' };

const WYGLADY = {
  pismo: {
    czcionki: { zwykla: 'LiberationSerif-Regular.ttf', gruba: 'LiberationSerif-Bold.ttf', kursywa: 'LiberationSerif-Italic.ttf' },
    marginesy: { top: 57, bottom: 64, left: 71, right: 57 },
    rozmiar: 11,
    tabela: 9.5,
  },
  // Informacja z rejestru: dokument dla klienta — znak notariatu, EB Garamond w tytułach,
  // Inter w treści (cyfry tabelaryczne), tabele bez siatki, kolor tylko w liniach i metryce.
  informacja: {
    czcionki: { zwykla: 'Inter-Regular.otf', gruba: 'Inter-SemiBold.otf', kursywa: 'Inter-Regular.otf', tytul: 'EBGaramond12-Regular.otf' },
    marginesy: { top: 12 * MM, bottom: 16 * MM, left: 16 * MM, right: 16 * MM },
    rozmiar: 9.5,
    tabela: 8.5,
  },
};

const ODSTEP = 2;
const PAD = 3;
const RZYMSKIE = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

/**
 * Komórka informacji: pogrubiony początek i dalszy tekst = nazwa w pierwszym wierszu, reszta
 * mniejszym, szarym krojem pod nią (np. akcjonariusz: nazwa, potem PESEL, adres, e-mail).
 */
function komorka(runs) {
  const r = runs.filter((o) => o.tekst.trim());
  if (r.length > 1 && r[0].gruby) {
    const dalej = naTekst(r.slice(1)).split('\n').map((s) => s.trim()).filter(Boolean);
    return { glowna: r[0].tekst.trim(), gruba: true, dalej };
  }
  return { glowna: naTekst(r), gruba: r.length > 0 && r.every((o) => o.gruby), dalej: [] };
}

function pdf(bloki, { numer = '', naglowek = null, tytul = '', autor = '', wyglad = 'pismo' } = {}) {
  const W = WYGLADY[wyglad];
  if (!W) throw new Error(`Nieznany wygląd „${wyglad}”.`);
  const ozdobny = wyglad === 'informacja';
  const { marginesy: MARGINESY, rozmiar: ROZMIAR, tabela: ROZMIAR_TABELI } = W;
  // Cyfry tabelaryczne tylko w kolumnach liczb (do prawej) — w Inter `tnum` rozsuwa też łączniki.
  const TNUM = { features: ['tnum'] };

  return new Promise((zrealizuj, odrzuc) => {
    const doc = new PDFDocument({ size: 'A4', margins: MARGINESY, bufferPages: true, info: { Title: tytul, Author: autor } });
    for (const [nazwa, plik] of Object.entries(W.czcionki)) doc.registerFont(nazwa, path.join(KATALOG_CZCIONEK, plik));
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
    const kreska = (x1, x2, y, grubosc, kolor) => doc.save().lineWidth(grubosc).strokeColor(kolor).moveTo(x1, y).lineTo(x2, y).stroke().restore();

    const runy = (runs, x, szerokosc, opcje = {}) => {
      const r = runs.filter((o) => o.tekst);
      if (r.length === 0) return;
      zapewnij(ROZMIAR + ODSTEP);
      loguj(naTekst(r));
      doc.fillColor(opcje.kolor || (ozdobny ? KOLOR.tekst : 'black'));
      r.forEach((o, i) => {
        doc.font(opcje.czcionka || (opcje.gruby ? 'gruba' : czcionka(o))).fontSize(opcje.rozmiar || ROZMIAR);
        const o2 = { width: szerokosc, align: opcje.align || 'justify', lineGap: ODSTEP, continued: i < r.length - 1 };
        if (i === 0) doc.text(o.tekst, x, doc.y, o2);
        else doc.text(o.tekst, o2);
      });
      doc.fillColor('black');
    };

    // ── Nagłówek ──
    if (naglowek && ozdobny) {
      const y0 = doc.y;
      const wysZnaku = 13 * MM;
      if (fs.existsSync(ZNAK_NOTARIATU)) doc.image(ZNAK_NOTARIATU, lewo, y0, { height: wysZnaku });
      const sz = szer * 0.6;
      const x = lewo + szer - sz;
      doc.font('tytul').fontSize(12.5).fillColor(KOLOR.tekst);
      loguj(naglowek.nazwa);
      doc.text(naglowek.nazwa, x, y0 - 2, { width: sz, align: 'right' });
      doc.font('zwykla').fontSize(7.5).fillColor(KOLOR.zielen);
      loguj(naglowek.rola);
      doc.text(naglowek.rola, x, doc.y + 1, { width: sz, align: 'right', characterSpacing: 0.15 });
      doc.fontSize(8).fillColor(KOLOR.szary);
      for (const linia of naglowek.linie || []) {
        loguj(linia);
        doc.text(linia, x, doc.y + 0.5, { width: sz, align: 'right', lineGap: 0.5 });
      }
      const y = Math.max(y0 + wysZnaku, doc.y) + 3 * MM;
      kreska(lewo, lewo + szer, y, 1.5, KOLOR.zielen);
      doc.fillColor('black');
      doc.y = y + 6 * MM;
    } else if (naglowek) {
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

    // ── Tabele ──
    const szerokosciKolumn = (b, rozmiarNaglowka, naglowekGruby) => {
      const kolumn = b.naglowek.length;
      const wszystkie = [b.naglowek, ...b.wiersze];
      const naturalna = [];
      const minimalna = [];
      const odstep = ozdobny ? 2.5 * MM : 2 * PAD + 1;
      // Informacja: etykieta kolumny może zająć dwa wiersze; komórka „nazwa + dane” mierzona
      // tak, jak jest rysowana (nazwa większym krojem, dane mniejszym).
      const pomiar = (t, glowa, k) => {
        if (glowa && ozdobny) {
          doc.font('gruba').fontSize(rozmiarNaglowka);
          const sz = (x) => doc.widthOfString(x, { characterSpacing: 0.5 }) + x.length * 0.5 + 1;
          const min = Math.max(...t.split(/\s+/).map(sz));
          return { nat: Math.min(sz(t), Math.max(min, sz(t) / 2 + 6)), pelna: sz(t), min };
        }
        const o = ozdobny && b.wyrownanie[k] === 'prawo' ? TNUM : {};
        doc.font(glowa && naglowekGruby ? 'gruba' : 'zwykla').fontSize(glowa ? rozmiarNaglowka : ROZMIAR_TABELI);
        let nat = Math.max(...t.split('\n').map((linia) => doc.widthOfString(linia, o)));
        const min = Math.max(...t.split(/\s+/).map((slowo) => doc.widthOfString(slowo, o)));
        return { nat, min };
      };
      const pelne = [];
      for (let k = 0; k < kolumn; k += 1) {
        let nat = 0;
        let pelna = 0;
        let min = 0;
        for (const w of wszystkie) {
          const glowa = w === b.naglowek;
          const c = ozdobny && !glowa ? komorka(w[k] || []) : null;
          let m;
          if (c && c.dalej.length) {
            doc.font('gruba').fontSize(ROZMIAR_TABELI + 0.5);
            const n = doc.widthOfString(c.glowna);
            doc.font('zwykla').fontSize(ROZMIAR_TABELI - 1.5);
            const d = c.dalej.map((linia) => doc.widthOfString(linia));
            const slowa = c.dalej.join(' ').split(/\s+/).map((x) => doc.widthOfString(x));
            m = { nat: Math.max(n, ...d), min: Math.max(...slowa, n / 2) };
          } else {
            const t = naTekst(w[k] || []);
            m = pomiar(glowa && ozdobny ? t.toUpperCase() : t, glowa, k);
          }
          nat = Math.max(nat, m.nat);
          pelna = Math.max(pelna, m.pelna || m.nat);
          min = Math.max(min, m.min);
        }
        naturalna.push(Math.min(nat, szer * 0.6) + odstep);
        pelne.push(Math.min(pelna, szer * 0.6) + odstep);
        minimalna.push(min + odstep);
      }
      const sumaPelnych = pelne.reduce((a, c) => a + c, 0);
      if (ozdobny && sumaPelnych <= szer) return pelne.map((s) => (s * szer) / sumaPelnych);
      const sumaNat = naturalna.reduce((a, c) => a + c, 0);
      const sumaMin = minimalna.reduce((a, c) => a + c, 0);
      if (sumaNat <= szer) return naturalna.map((s) => (s * szer) / sumaNat);
      // Najpierw zwęża się tylko najszersza kolumna (w informacji — akcjonariusz), reszta zostaje naturalna.
      const najszersza = naturalna.indexOf(Math.max(...naturalna));
      const reszta = szer - (sumaNat - naturalna[najszersza]);
      if (ozdobny && reszta >= minimalna[najszersza]) return naturalna.map((s, k) => (k === najszersza ? reszta : s));
      if (sumaMin <= szer) {
        const zapas = naturalna.map((s, k) => s - minimalna[k]);
        const sumaZapasu = zapas.reduce((a, c) => a + c, 0) || 1;
        return minimalna.map((m, k) => m + ((szer - sumaMin) * zapas[k]) / sumaZapasu);
      }
      return minimalna.map((m) => (m * szer) / sumaMin);
    };

    const tabela = (b) => {
      doc.fontSize(ROZMIAR_TABELI);
      const szerokosci = szerokosciKolumn(b, ROZMIAR_TABELI, true);

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

    // Informacja: tabela bez siatki — etykiety kapitalikami, wiersze rozdzielone włosową linią.
    const ROZMIAR_ETYKIETY = 6.5;
    const PADY = 1.25 * MM;
    const PADX = 2.5 * MM;
    const tabelaOzdobna = (b) => {
      const szerokosci = szerokosciKolumn(b, ROZMIAR_ETYKIETY, true);
      const wyrownaj = (k) => ({ lewo: 'left', prawo: 'right', srodek: 'center' })[b.wyrownanie[k] || 'lewo'];
      const pole = (k) => szerokosci[k] - (k === szerokosci.length - 1 ? 0 : PADX);
      const etykieta = { lineGap: 0.5, characterSpacing: 0.5 };
      const zwyklyK = (k) => (b.wyrownanie[k] === 'prawo' ? { ...TNUM, lineGap: 1 } : { lineGap: 1 });

      const hNaglowka = () => {
        doc.font('gruba').fontSize(ROZMIAR_ETYKIETY);
        return Math.max(...b.naglowek.map((runs, k) => doc.heightOfString(naTekst(runs).toUpperCase() || ' ', { ...etykieta, width: pole(k) }))) + 1.5 * MM;
      };
      const hKomorki = (runs, k) => {
        const c = komorka(runs);
        doc.font(c.gruba ? 'gruba' : 'zwykla').fontSize(c.dalej.length ? ROZMIAR_TABELI + 0.5 : ROZMIAR_TABELI);
        let h = doc.heightOfString(c.glowna || ' ', { ...zwyklyK(k), width: pole(k) });
        if (c.dalej.length) {
          doc.font('zwykla').fontSize(ROZMIAR_TABELI - 1.5);
          h += 0.5 + doc.heightOfString(c.dalej.join('\n'), { lineGap: 0.2, width: pole(k) });
        }
        return h;
      };
      const hWiersza = (w) => Math.max(...w.map(hKomorki)) + 2 * PADY;

      const rysujNaglowek = () => {
        const y = doc.y;
        const h = hNaglowka();
        let x = lewo;
        doc.font('gruba').fontSize(ROZMIAR_ETYKIETY).fillColor(KOLOR.szary);
        b.naglowek.forEach((runs, k) => {
          const t = naTekst(runs);
          if (t) {
            loguj(t, { kolumna: k, wiersz: -1 });
            doc.text(t.toUpperCase(), x, y, { ...etykieta, width: pole(k), align: wyrownaj(k) });
          }
          x += szerokosci[k];
        });
        kreska(lewo, lewo + szer, y + h, 0.75, KOLOR.jasny);
        doc.x = lewo;
        doc.y = y + h;
      };
      const rysujWiersz = (w, nr) => {
        const y = doc.y;
        const h = hWiersza(w);
        let x = lewo;
        w.forEach((runs, k) => {
          const c = komorka(runs);
          if (c.glowna || c.dalej.length) loguj(naTekst(runs), { kolumna: k, wiersz: nr });
          doc.font(c.gruba ? 'gruba' : 'zwykla').fontSize(c.dalej.length ? ROZMIAR_TABELI + 0.5 : ROZMIAR_TABELI).fillColor(KOLOR.tekst);
          doc.text(c.glowna, x, y + PADY, { ...zwyklyK(k), width: pole(k), align: wyrownaj(k) });
          if (c.dalej.length) {
            doc.font('zwykla').fontSize(ROZMIAR_TABELI - 1.5).fillColor(KOLOR.szary);
            doc.text(c.dalej.join('\n'), x, doc.y + 0.5, { lineGap: 0.2, width: pole(k), align: wyrownaj(k) });
          }
          x += szerokosci[k];
        });
        kreska(lewo, lewo + szer, y + h, 0.5, KOLOR.linia);
        doc.x = lewo;
        doc.y = y + h;
      };

      zapewnij(hNaglowka() + (b.wiersze[0] ? hWiersza(b.wiersze[0]) : 0));
      rysujNaglowek();
      b.wiersze.forEach((w, n) => {
        if (doc.y + hWiersza(w) > dol()) {
          doc.addPage();
          rysujNaglowek();
        }
        rysujWiersz(w, n);
      });
      doc.fillColor('black');
      doc.y += 2.5 * MM;
    };

    // Informacja: metryka — trzy fakty identyfikujące wypis, na zielonkawym tle z linią po lewej.
    const metryka = (b) => {
      const wagi = [1.6, 1, 1.2].slice(0, b.naglowek.length);
      const suma = wagi.reduce((a, c) => a + c, 0);
      const padX = 5 * MM;
      const padY = 3 * MM;
      const odstep = 6 * MM;
      const wnetrze = szer - 2 * padX - odstep * (wagi.length - 1);
      const kol = wagi.map((w) => (w * wnetrze) / suma);
      const wartosci = (b.wiersze[0] || []).map((runs) => komorka(runs));
      const hEtykiety = 6.5 + 1.2 * MM;
      const hWartosci = (c, k) => {
        doc.font(c.gruba ? 'gruba' : 'zwykla').fontSize(10);
        return doc.heightOfString([c.glowna, ...c.dalej].join('\n') || ' ', { width: kol[k], lineGap: 1 });
      };
      const h = 2 * padY + hEtykiety + Math.max(...wartosci.map(hWartosci));
      zapewnij(h);
      const y = doc.y;
      doc.save().rect(lewo, y, szer, h).fill(KOLOR.tlo).restore();
      doc.save().rect(lewo, y, 2, h).fill(KOLOR.zielen).restore();
      let x = lewo + padX;
      b.naglowek.forEach((runs, k) => {
        const etykieta = naTekst(runs);
        loguj(etykieta, { kolumna: k, wiersz: -1 });
        doc.font('gruba').fontSize(6.5).fillColor(KOLOR.zielen).text(etykieta.toUpperCase(), x, y + padY, { width: kol[k], characterSpacing: 0.7 });
        const c = wartosci[k] || { glowna: '', dalej: [] };
        loguj(naTekst((b.wiersze[0] || [])[k] || []), { kolumna: k, wiersz: 0 });
        doc.fillColor(KOLOR.tekst).font(c.gruba ? 'gruba' : 'zwykla').fontSize(10);
        doc.text(c.glowna, x, y + padY + hEtykiety, { width: kol[k], lineGap: 1 });
        if (c.dalej.length) doc.font('zwykla').text(c.dalej.join('\n'), x, doc.y, { width: kol[k], lineGap: 1 });
        x += kol[k] + odstep;
      });
      doc.fillColor('black');
      doc.x = lewo;
      doc.y = y + h + 6 * MM;
    };

    // Informacja: tabela bez nagłówka (pusty pierwszy wiersz) = pary „etykieta — wartość”.
    const pary = (b) => {
      const kolEtykiety = 46 * MM;
      const kolWartosci = szer - kolEtykiety - 4 * MM;
      b.wiersze.forEach((w, n) => {
        const etykieta = naTekst(w[0] || []);
        const c = komorka(w.slice(1).flat());
        doc.font(c.gruba ? 'gruba' : 'zwykla').fontSize(ROZMIAR);
        const h = Math.max(12, doc.heightOfString([c.glowna, ...c.dalej].join('\n') || ' ', { width: kolWartosci, lineGap: 1 }));
        zapewnij(h + 1 * MM);
        const y = doc.y;
        loguj(`${etykieta} | ${naTekst(w.slice(1).flat())}`, { wiersz: n });
        doc.font('zwykla').fontSize(8.5).fillColor(KOLOR.szary).text(etykieta, lewo, y + 1, { width: kolEtykiety });
        doc.font(c.gruba ? 'gruba' : 'zwykla').fontSize(ROZMIAR).fillColor(KOLOR.tekst);
        doc.text([c.glowna, ...c.dalej].join('\n'), lewo + kolEtykiety + 4 * MM, y, { width: kolWartosci, lineGap: 1 });
        doc.x = lewo;
        doc.y = y + h + 1 * MM;
      });
      doc.fillColor('black');
      doc.y += 2 * MM;
    };

    let sekcja = 0;
    let poTytule = false;
    for (const b of bloki) {
      doc.x = lewo;
      const zaTytulem = poTytule;
      poTytule = false;
      if (ozdobny && b.typ === 'naglowek' && b.poziom === 1) {
        doc.font('tytul').fontSize(21).fillColor(KOLOR.tekst);
        loguj(naTekst(b.runs));
        doc.text(naTekst(b.runs), lewo, doc.y, { width: szer });
        doc.fillColor('black');
        doc.y += 2.5 * MM;
        poTytule = true;
      } else if (ozdobny && b.typ === 'naglowek') {
        zapewnij(70);
        doc.y += sekcja === 0 ? 0 : 2.5 * MM;
        const nr = `${RZYMSKIE[sekcja] || sekcja + 1}.`;
        sekcja += 1;
        loguj(naTekst(b.runs));
        doc.font('tytul').fontSize(13.5).fillColor(KOLOR.jasny).text(`${nr} `, lewo, doc.y, { continued: true });
        doc.fillColor(KOLOR.tekst).text(naTekst(b.runs));
        const y = doc.y + 1 * MM;
        kreska(lewo, lewo + szer, y, 0.5, KOLOR.linia);
        doc.fillColor('black');
        doc.y = y + 2.5 * MM;
      } else if (ozdobny && b.typ === 'tabela' && zaTytulem) {
        metryka(b);
      } else if (ozdobny && b.typ === 'tabela' && b.naglowek.every((k) => !naTekst(k))) {
        pary(b);
      } else if (ozdobny && b.typ === 'tabela') {
        tabelaOzdobna(b);
      } else if (ozdobny && b.typ === 'akapit') {
        runy(b.runs, lewo, szer, { rozmiar: 8.5, kolor: KOLOR.szary, align: 'left' });
        doc.y += 2.5 * MM;
      } else if (b.typ === 'naglowek') {
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

    // ── Stopka ──
    const zakres = doc.bufferedPageRange();
    for (let i = 0; i < zakres.count; i += 1) {
      doc.switchToPage(zakres.start + i);
      const stopka = [numer, `strona ${i + 1} z ${zakres.count}`].filter(Boolean).join(' · ');
      teksty.push({ strona: i + 1, tekst: stopka });
      doc.page.margins.bottom = 0;
      if (ozdobny) {
        const y = doc.page.height - 12 * MM;
        kreska(lewo, lewo + szer, y, 0.5, KOLOR.linia);
        doc.font('zwykla').fontSize(7.5).fillColor(KOLOR.jasny);
        doc.text(numer, lewo, y + 2.5 * MM, { width: szer / 2, lineBreak: false });
        doc.text(`strona ${i + 1} z ${zakres.count}`, lewo + szer / 2, y + 2.5 * MM, { width: szer / 2, align: 'right', lineBreak: false });
        doc.fillColor('black');
      } else {
        doc.font('zwykla').fontSize(8);
        doc.text(stopka, lewo, doc.page.height - 40, { width: szer, align: 'center', lineBreak: false });
      }
      doc.page.margins.bottom = MARGINESY.bottom;
    }
    doc.on('end', () => zrealizuj({ bufor: Buffer.concat(czesci), strony: zakres.count, teksty }));
    doc.end();
  });
}

module.exports = { wypelnij, tekst, wczytaj, pdf };
