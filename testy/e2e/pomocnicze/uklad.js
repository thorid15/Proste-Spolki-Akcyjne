'use strict';

/**
 * Kontrola układu (SESJA-PSA-POPRAWKI-R4, zadanie 0).
 * sprawdzUklad(page, selektorKontenera) -> Promise<Array<{selektor, problem}>>
 *   a) poziomy scroll dokumentu,
 *   b) element tekstowy z scrollWidth > clientWidth + 1 (bez celowo przewijanych: overflow-x auto/scroll),
 *   c) element wychodzący poza obszar treści karty (prostokąt karty minus padding); dla tekstu
 *      wcięcie co najmniej połowy zaokrąglenia rogu — karta „ścisła” (padding 0) z tekstem przy
 *      krawędzi to tekst ucinany przez zaokrąglenie (P1).
 * Każde dopasowanie `selektorKontenera` sprawdzane osobno.
 */

async function sprawdzUklad(page, selektorKontenera) {
  return page.evaluate((selektor) => {
    const problemy = [];
    const opis = (el) => {
      const klasa = typeof el.className === 'string' && el.className.trim() ? `.${el.className.trim().split(/\s+/).join('.')}` : '';
      const tekst = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
      return `${el.tagName.toLowerCase()}${klasa}${tekst ? ` „${tekst}”` : ''}`;
    };
    const przewijany = (el, granica) => {
      for (let e = el; e && e !== granica.parentElement; e = e.parentElement) {
        const ox = getComputedStyle(e).overflowX;
        if (ox === 'auto' || ox === 'scroll') return true;
      }
      return false;
    };
    // Ukryte dla oka (np. `.sr-only` — tekst dla czytnika ekranu) nie jest problemem układu.
    const ukrytyDlaOka = (el) => {
      for (let e = el; e && e !== document.body; e = e.parentElement) {
        const s = getComputedStyle(e);
        const r = e.getBoundingClientRect();
        if ((s.position === 'absolute' || s.position === 'fixed') && r.width <= 1 && r.height <= 1) return true;
        if (/rect\(0(px)?,? 0(px)?,? 0(px)?,? 0(px)?\)/.test(s.clip) || /inset\(50%\)/.test(s.clipPath)) return true;
      }
      return false;
    };
    const widoczny = (el) => {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0 && !ukrytyDlaOka(el);
    };
    const maTekst = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());

    if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) {
      problemy.push({ selektor: 'document', problem: `poziomy scroll dokumentu (${document.documentElement.scrollWidth} > ${document.documentElement.clientWidth})` });
    }

    for (const karta of document.querySelectorAll(selektor)) {
      if (!widoczny(karta)) continue;
      const s = getComputedStyle(karta);
      const rk = karta.getBoundingClientRect();
      const promien = parseFloat(s.borderTopLeftRadius) || 0;
      const tresc = {
        lewo: rk.left + parseFloat(s.borderLeftWidth) + parseFloat(s.paddingLeft),
        prawo: rk.right - parseFloat(s.borderRightWidth) - parseFloat(s.paddingRight),
      };
      const dlaTekstu = {
        lewo: Math.max(tresc.lewo, rk.left + promien / 2),
        prawo: Math.min(tresc.prawo, rk.right - promien / 2),
      };
      for (const el of karta.querySelectorAll('*')) {
        if (!widoczny(el) || przewijany(el, karta)) continue;
        if (maTekst(el) && el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) {
          problemy.push({ selektor: opis(el), problem: `ucięty tekst (scrollWidth ${el.scrollWidth} > clientWidth ${el.clientWidth})` });
        }
        // Tekst: liczy się prostokąt samych znaków (Range), nie całego bloku z jego paddingiem.
        let r = el.getBoundingClientRect();
        const granice = maTekst(el) ? dlaTekstu : tresc;
        if (maTekst(el)) {
          // Tylko własne węzły tekstowe elementu (bez potomków, np. ukrytych dla oka).
          const prostokaty = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => {
            const zakres = document.createRange();
            zakres.selectNodeContents(n);
            return zakres.getBoundingClientRect();
          }).filter((x) => x.width > 0);
          if (prostokaty.length) {
            r = { left: Math.min(...prostokaty.map((x) => x.left)), right: Math.max(...prostokaty.map((x) => x.right)) };
          }
        }
        if (r.left < granice.lewo - 1 || r.right > granice.prawo + 1) {
          problemy.push({ selektor: opis(el), problem: `poza obszarem treści karty (${Math.round(r.left)}–${Math.round(r.right)} vs ${Math.round(granice.lewo)}–${Math.round(granice.prawo)})` });
        }
      }
    }
    return problemy;
  }, selektorKontenera);
}

module.exports = { sprawdzUklad };
