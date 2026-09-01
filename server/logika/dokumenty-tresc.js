'use strict';

/**
 * Deterministyczna, offline generacja tresci dokumentow wychodzacych
 * (sekcja 1 i 10 specyfikacji, master: brak bibliotek PDF).
 *
 * Zwracamy gotowy HTML: ten sam tekst idzie jako tresc e-maila (nodemailer)
 * i jako zapis audytowy w `psa_wydane_dokumenty.tresc_html`. Do wydruku na
 * kanale papierowym pracownik otwiera zapisana tresc i drukuje ja
 * `window.print()` po stronie klienta - tu nie generujemy zadnego pliku.
 *
 * Czego NIE umieszczamy (sekcja 10): pole `uwagi`, checklisty weryfikacji,
 * notatki AML, dane kontaktowe innych akcjonariuszy, hashe lancucha.
 */

function esc(tekst) {
  return String(tekst == null ? '' : tekst).replace(/[&<>"']/g, (znak) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[znak]));
}

function dataPl(iso) {
  if (!iso) return '—';
  const [r, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}.${m}.${r}`;
}

/**
 * Paleta i kroje TE SAME, co w aplikacji (`publiczne/style/rejestr.css`) —
 * klient dostaje mailem i w portalu dokument wyglądający jak reszta systemu,
 * a nie jak wydruk z innej epoki.
 *
 * Wartości są tu WPISANE WPROST, a nie przez zmienne CSS: to samo HTML idzie
 * jako treść e-maila, a programy pocztowe nie obsługują `var(--…)` ani
 * arkuszy zewnętrznych — działa wyłącznie styl w atrybucie. Z tego samego
 * powodu w krojach liczą się dopiero pozycje systemowe: webfontów
 * (Inter Tight, EB Garamond) poczta i tak nie wczyta.
 */
const ATRAMENT = '#14181C';
const ATRAMENT_2 = '#565E68';
const ATRAMENT_3 = '#8A929C';
const LINIA = '#E6E8E3';
const SYGNAL_TLO = '#F9EBE9';
const MOSIADZ_TLO = '#F7EFE2';
const FONT_TEKST = "'Inter Tight', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const FONT_TYTUL = "'EB Garamond', 'Iowan Old Style', Georgia, serif";
const FONT_DANE = "'IBM Plex Mono', ui-monospace, 'SF Mono', Consolas, monospace";

const STYL = `
  font-family: ${FONT_TEKST}; color: ${ATRAMENT}; line-height: 1.6;
  max-width: 640px; margin: 0 auto; padding: 8px;
`;

/**
 * `zeZnakiem` dokłada godło Notariatu ścieżką WZGLĘDNĄ. Ma sens wyłącznie
 * tam, gdzie dokument otwiera się pod adresem serwera (portal, ekran
 * kancelarii). W e-mailu ścieżka względna nie ma się do czego odnieść,
 * a wklejanie 100 kB base64 do każdego zapisanego dokumentu rozdmuchałoby
 * archiwum `psa_wydane_dokumenty` — dlatego domyślnie wyłączone.
 */
function szkielet({ tytul, kancelaria, tresc, stopkaDodatkowa, zeZnakiem = false }) {
  return `
<!doctype html>
<html lang="pl"><head><meta charset="utf-8"><title>${esc(tytul)}</title>
<!-- Bez tego iOS i część programów pocztowych zamienia „art. 300(35) § 1"
     na numer telefonu: sygnatury przepisów robiły się niebieskimi odnośnikami. -->
<meta name="format-detection" content="telephone=no,date=no,address=no"></head>
<body style="${STYL}">
  <div style="border-bottom: 2px solid ${ATRAMENT}; padding-bottom: 12px; margin-bottom: 20px;">
    ${zeZnakiem
      ? `<img src="/obrazy/notariat.png" alt="Notariat Rzeczypospolitej Polskiej"
             style="height: 34px; width: auto; display: block; margin-bottom: 10px;">`
      : ''}
    <div style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; color: ${ATRAMENT_2};">
      ${esc(kancelaria.nazwa)}
    </div>
    ${kancelaria.adres ? `<div style="font-size: 12px; color: ${ATRAMENT_2};">${esc(kancelaria.adres)}</div>` : ''}
    ${kancelaria.miejscowosc ? `<div style="font-size: 12px; color: ${ATRAMENT_2};">${esc(kancelaria.miejscowosc)}</div>` : ''}
    ${kancelaria.telefon || kancelaria.email
      ? `<div style="font-size: 12px; color: ${ATRAMENT_2};">${esc(
          [kancelaria.telefon, kancelaria.email].filter(Boolean).join(' · ')
        )}</div>`
      : ''}
  </div>
  <h1 style="font-family: ${FONT_TYTUL}; font-size: 24px; font-weight: 500; margin: 0 0 18px;">${esc(tytul)}</h1>
  ${tresc}
  <div style="margin-top: 32px; padding-top: 14px; border-top: 1px solid ${LINIA}; font-size: 11px; color: ${ATRAMENT_3};">
    Rejestr akcjonariuszy prowadzony na podstawie art. 300(31) § 1 Kodeksu spółek handlowych.
    ${stopkaDodatkowa ? `<br>${esc(stopkaDodatkowa)}` : ''}
  </div>
</body></html>`;
}

/**
 * art. 300(34) § 7 KSH — niezwloczne powiadomienie o wpisie: zadajacego i spolke.
 */
function zawiadomienieWpis({ kancelaria, spolka, zdarzenie, typZdarzenie, podsumowanie, odbiorcaNazwa }) {
  const tresc = `
    <p>Szanowni Państwo,</p>
    <p>
      uprzejmie zawiadamiam, że w rejestrze akcjonariuszy spółki
      <strong>${esc(spolka.nazwa)}</strong>${spolka.krs ? ` (KRS ${esc(spolka.krs)})` : ''}
      dokonano wpisu.
    </p>
    <table style="width: 100%; border-collapse: collapse; margin: 18px 0; font-size: 13px;">
      <tr><td style="padding: 4px 0; color: ${ATRAMENT_2}; width: 160px;">Rodzaj zdarzenia</td>
          <td style="padding: 4px 0;">${esc(typZdarzenie.nazwa)}</td></tr>
      <tr><td style="padding: 4px 0; color: ${ATRAMENT_2};">Data zdarzenia</td>
          <td style="padding: 4px 0;">${dataPl(zdarzenie.data_zdarzenia)}</td></tr>
      <tr><td style="padding: 4px 0; color: ${ATRAMENT_2};">Data i godzina wpisu</td>
          <td style="padding: 4px 0;">${esc(zdarzenie.data_wpisu)}</td></tr>
    </table>
    <p>${esc(podsumowanie || 'Treść wpisu opisana jest w rejestrze akcjonariuszy spółki.')}</p>
    <p style="margin-top: 24px;">Z poważaniem,<br>${esc(kancelaria.nazwa)}</p>
  `;
  return szkielet({
    tytul: 'Zawiadomienie o wpisie do rejestru akcjonariuszy',
    kancelaria,
    tresc,
    stopkaDodatkowa: odbiorcaNazwa ? `Adresat: ${odbiorcaNazwa}` : null,
  });
}

/** art. 300(34) § 7 zd. 2 KSH — odmowa wpisu, z podaniem przyczyn. */
function zawiadomienieOdmowa({ kancelaria, spolka, typZdarzenie, powodOdmowy, odbiorcaNazwa }) {
  const tresc = `
    <p>Szanowni Państwo,</p>
    <p>
      uprzejmie zawiadamiam, że w rejestrze akcjonariuszy spółki
      <strong>${esc(spolka.nazwa)}</strong>${spolka.krs ? ` (KRS ${esc(spolka.krs)})` : ''}
      odmówiono dokonania wpisu dotyczącego zdarzenia: <strong>${esc(typZdarzenie.nazwa)}</strong>.
    </p>
    <p><strong>Przyczyna odmowy:</strong></p>
    <p style="background: ${SYGNAL_TLO}; border-radius: 6px; padding: 12px 14px;">${esc(powodOdmowy)}</p>
    <p style="margin-top: 24px;">Z poważaniem,<br>${esc(kancelaria.nazwa)}</p>
  `;
  return szkielet({
    tytul: 'Zawiadomienie o odmowie wpisu',
    kancelaria,
    tresc,
    stopkaDodatkowa: odbiorcaNazwa ? `Adresat: ${odbiorcaNazwa}` : null,
  });
}

/**
 * art. 300(34) § 3 KSH — uprzednie powiadomienie osoby, ktorej uprawnienia
 * maja byc wykreslone, zmienione lub obciazone, o tresci zamierzonego wpisu.
 */
function powiadomienieZamierzonegoWpisu({ kancelaria, spolka, typZdarzenie, podsumowanie, odbiorcaNazwa }) {
  const tresc = `
    <p>Szanowni Państwo,</p>
    <p>
      działając jako podmiot prowadzący rejestr akcjonariuszy spółki
      <strong>${esc(spolka.nazwa)}</strong>${spolka.krs ? ` (KRS ${esc(spolka.krs)})` : ''},
      uprzejmie zawiadamiam o treści zamierzonego wpisu, który dotyczy Państwa uprawnień:
    </p>
    <p><strong>${esc(typZdarzenie.nazwa)}</strong></p>
    <p>${esc(podsumowanie || '')}</p>
    <p>
      Zgodnie z art. 300(34) § 3 Kodeksu spółek handlowych wpis nastąpi, chyba że wyrażą
      Państwo zgodę na jego dokonanie albo zgłoszą Państwo sprzeciw w terminie umożliwiającym
      jego rozpatrzenie przed dokonaniem wpisu.
    </p>
    <p style="margin-top: 24px;">Z poważaniem,<br>${esc(kancelaria.nazwa)}</p>
  `;
  return szkielet({
    tytul: 'Powiadomienie o treści zamierzonego wpisu',
    kancelaria,
    tresc,
    stopkaDodatkowa: odbiorcaNazwa ? `Adresat: ${odbiorcaNazwa}` : null,
  });
}

/** Wezwanie do uzupelnienia — wskazanie przeszkody i skutkow. */
function wezwanieDoUzupelnienia({ kancelaria, spolka, typZdarzenie, powodWstrzymania, odbiorcaNazwa }) {
  const tresc = `
    <p>Szanowni Państwo,</p>
    <p>
      w toku rozpoznawania żądania wpisu do rejestru akcjonariuszy spółki
      <strong>${esc(spolka.nazwa)}</strong>${spolka.krs ? ` (KRS ${esc(spolka.krs)})` : ''}
      dotyczącego zdarzenia: <strong>${esc(typZdarzenie.nazwa)}</strong>, stwierdzono przeszkodę
      uniemożliwiającą dokonanie wpisu.
    </p>
    <p><strong>Wskazana przeszkoda:</strong></p>
    <p style="background: ${MOSIADZ_TLO}; border-radius: 6px; padding: 12px 14px;">${esc(powodWstrzymania)}</p>
    <p>
      Bieg ustawowego terminu na dokonanie wpisu zostaje zawieszony do czasu usunięcia
      wskazanej przeszkody. Prosimy o jej usunięcie i przekazanie brakujących dokumentów
      lub wyjaśnień — po ich wpłynięciu rozpoznawanie sprawy zostanie niezwłocznie wznowione.
    </p>
    <p style="margin-top: 24px;">Z poważaniem,<br>${esc(kancelaria.nazwa)}</p>
  `;
  return szkielet({
    tytul: 'Wezwanie do uzupełnienia',
    kancelaria,
    tresc,
    stopkaDodatkowa: odbiorcaNazwa ? `Adresat: ${odbiorcaNazwa}` : null,
  });
}

/* ── Informacja z rejestru: elementy skladowe ──
   Dokument ma siedem sekcji o tej samej budowie, wiec skladamy je z trzech
   klockow zamiast powtarzac ten sam HTML siedem razy. Style w atrybutach,
   nie w klasach — ten sam dokument idzie jako tresc e-maila, a poczta nie
   czyta arkuszy. */

function sekcjaHtml(tytul, wnetrze) {
  return `
    <div style="margin-top: 22px;">
      <div style="font-size: 11px; font-weight: 600; letter-spacing: 0.06em;
                  text-transform: uppercase; color: ${ATRAMENT_2};
                  padding-bottom: 6px; margin-bottom: 10px;
                  border-bottom: 1px solid ${LINIA};">${esc(tytul)}</div>
      ${wnetrze}
    </div>`;
}

/**
 * Pary „etykieta — wartosc". Pozycje bez wartosci WYPADAJA: puste „NIP: —"
 * w informacji dla sadu czyta sie jak brak danych w rejestrze, a nie jak
 * dane, ktorych spolka nie ma.
 */
function paryHtml(pary) {
  const wiersze = pary
    .filter(([, wartosc]) => wartosc !== null && wartosc !== undefined && String(wartosc).trim() !== '')
    .map(([etykieta, wartosc]) => `
      <tr>
        <td style="padding: 3px 12px 3px 0; color: ${ATRAMENT_2}; white-space: nowrap;
                   vertical-align: top; width: 200px;">${esc(etykieta)}</td>
        <td style="padding: 3px 0; vertical-align: top;">${esc(wartosc)}</td>
      </tr>`)
    .join('');
  if (!wiersze) return '';
  return `<table style="width: 100%; border-collapse: collapse; font-size: 13px;">${wiersze}</table>`;
}

/**
 * Tabela. `kolumny` to `[nazwa, doPrawej?, mono?]`, `wiersze` to tablice
 * gotowych, juz zescapowanych komorek.
 */
function tabelaHtml(kolumny, wiersze, pustaTresc) {
  if (!wiersze.length) {
    return `<div style="font-size: 13px; color: ${ATRAMENT_2};">${esc(pustaTresc)}</div>`;
  }
  // Odstep miedzy kolumnami niesie PRAWY margines kazdej komorki — przy
  // kolumnie wyrownanej do prawej to on oddziela liczbe od tresci sasiada
  // („500” i „1–100” sklejaly sie w „5001–100”). Ostatnia kolumna go nie ma,
  // zeby tabela konczyla sie rowno z reszta dokumentu.
  const odstep = (i) => (i === kolumny.length - 1 ? 'padding-right: 0;' : 'padding-right: 16px;');
  const glowa = kolumny
    .map(([nazwa, doPrawej], i) => `<th style="padding-top: 5px; padding-bottom: 5px; ${odstep(i)}
        text-align: ${doPrawej ? 'right' : 'left'};
        font-weight: 600; font-size: 10px; letter-spacing: 0.04em; text-transform: uppercase;
        color: ${ATRAMENT_2}; border-bottom: 1px solid ${LINIA}; white-space: nowrap;">${esc(nazwa)}</th>`)
    .join('');
  const cialo = wiersze
    .map((w) => `<tr>${w
      .map((komorka, i) => {
        const [, doPrawej, mono] = kolumny[i];
        return `<td style="padding-top: 6px; padding-bottom: 6px; ${odstep(i)}
          text-align: ${doPrawej ? 'right' : 'left'};
          border-bottom: 1px solid ${LINIA}; vertical-align: top;
          ${mono ? `font-family: ${FONT_DANE}; font-size: 11px;` : ''}">${komorka}</td>`;
      })
      .join('')}</tr>`)
    .join('');
  return `<table style="width: 100%; border-collapse: collapse; font-size: 13px;">
    <thead><tr>${glowa}</tr></thead><tbody>${cialo}</tbody></table>`;
}

const OPISY_ODBIORCY = {
  kancelaria: 'podmiot prowadzący rejestr',
  spolka: 'spółka, której rejestr dotyczy',
  akcjonariusz: 'akcjonariusz',
  organ: 'sąd, prokurator, komornik albo organ egzekucyjny',
};

/**
 * art. 300(35) KSH — informacja z rejestru akcjonariuszy. JEDYNY dokument,
 * jaki aplikacja wystawia ze stanu rejestru, i JEDYNE miejsce, w ktorym
 * powstaje jego tresc: ten sam HTML oglada kancelaria na ekranie, dostaje
 * klient w portalu i niesie e-mail. Wczesniej byly dwa rendery tego samego
 * pisma — React w `publiczne/js/wydruk.js` i ten — wiec poprawka tresci
 * musiala trafic w oba albo klient dostawal co innego niz notariusz.
 *
 * `stan` to gotowy wynik `widoki.widokStanu()`: maskowanie jest juz
 * zastosowane wzgledem roli odbiorcy, tu tylko ukladamy HTML. Czego NIE
 * umieszczamy (sekcja 10): pole `uwagi`, checklisty weryfikacji, notatki
 * AML, hashe lancucha — `widokStanu` nie zwraca ich dla roli innej niz
 * kancelaria.
 *
 * `zeZnakiem` wlacza godlo Notariatu jako `<img src="/obrazy/notariat.png">`.
 * Wlaczamy je tam, gdzie dokument oglada sie pod adresem serwera (portal,
 * ekran kancelarii); w e-mailu zostaje wylaczone, bo sciezka wzgledna nie
 * ma sie tam do czego odniesc, a wklejanie 100 kB base64 do KAZDEGO
 * zapisanego dokumentu rozdmuchaloby archiwum `psa_wydane_dokumenty`.
 */
function informacjaZRejestru({ kancelaria, spolka, data, stan, odbiorca, zeZnakiem = false }) {
  const opisOdbiorcy = (odbiorca && odbiorca.opis)
    || OPISY_ODBIORCY[(odbiorca && odbiorca.rola) || stan.rola]
    || OPISY_ODBIORCY.spolka;

  const adresSpolki = [
    spolka.ulica
      ? `${spolka.ulica} ${spolka.nr_domu || ''}${spolka.nr_lokalu ? `/${spolka.nr_lokalu}` : ''}`.trim()
      : null,
    [spolka.kod_pocztowy, spolka.miejscowosc].filter(Boolean).join(' '),
  ].filter(Boolean).join(', ');

  const zamaskowane = stan.akcjonariusze.some((a) => a.osoba && a.osoba.zamaskowane);

  // ── Akcjonariusze (art. 300(33) § 1 pkt 2–5) ──
  const wierszeAkcjonariuszy = stan.akcjonariusze.map((a) => {
    const oznaczenie = a.osoba ? esc(a.osoba.oznaczenie) : 'nieznany';
    const identyfikator = a.osoba && a.osoba.jawny_identyfikator
      ? `<div style="color: ${ATRAMENT_2}; font-size: 11px;">${esc(a.osoba.jawny_identyfikator)}</div>`
      : '';
    const obciazone = a.obciazenia && a.obciazenia.length
      ? `<div style="color: ${ATRAMENT_2}; font-size: 11px;">akcje obciążone</div>`
      : '';
    return [
      `${oznaczenie}${identyfikator}${obciazone}`,
      esc(a.seria),
      esc(a.ilosc),
      esc(a.numery),
      `${esc(a.procent)}%`,
    ];
  });

  // ── Emisje i serie (art. 300(33) § 1 pkt 3–4) ──
  const bilansWgKlucza = new Map((stan.bilans || []).map((b) => [b.emisja_klucz, b]));
  const wierszeEmisji = (stan.emisje || []).map((e) => {
    const b = bilansWgKlucza.get(e.klucz) || {};
    return [
      esc(e.seria),
      esc(e.tytul || '—'),
      esc(e.podstawa_prawna || '—'),
      esc(e.zakres),
      esc(e.ilosc),
      esc(b.umorzone || 0),
      esc(b.w_obrocie == null ? '—' : b.w_obrocie),
      dataPl(e.data_emisji),
    ];
  });

  // Sekcje ponizej sa WARUNKOWE: pusta tabela „uprawnien" w pismie do sadu
  // sugeruje, ze o cos nie zapytano, a nie ze ich nie ma.
  const uprawnienia = stan.uprawnienia || [];
  const obciazenia = stan.obciazenia || [];
  const ograniczenia = stan.ograniczenia || [];

  const tresc = `
    ${paryHtml([
      ['Spółka', spolka.nazwa],
      ['Stan na dzień', dataPl(data)],
      ['Odbiorca informacji', opisOdbiorcy],
    ])}

    ${sekcjaHtml('Spółka', paryHtml([
      ['Firma', spolka.nazwa],
      ['Forma prawna', spolka.forma_prawna],
      ['Siedziba i adres', adresSpolki],
      ['Sąd rejestrowy', [spolka.sad_rejestrowy, spolka.wydzial].filter(Boolean).join(', ')],
      ['Numer KRS', spolka.krs],
      ['NIP', spolka.nip],
      ['REGON', spolka.regon],
    ]))}

    ${sekcjaHtml('Podmiot prowadzący rejestr', paryHtml([
      ['Podmiot', kancelaria.nazwa],
      // Podstawy prawnej NIE powtarzamy: niesie ja stopka dokumentu.
      ['Data uchwały o wyborze', spolka.data_uchwaly_wyboru ? dataPl(spolka.data_uchwaly_wyboru) : null],
      ['Data umowy o prowadzenie rejestru', spolka.data_umowy ? dataPl(spolka.data_umowy) : null],
      ['Data otwarcia rejestru', spolka.data_otwarcia_rejestru ? dataPl(spolka.data_otwarcia_rejestru) : null],
    ]))}

    ${sekcjaHtml('Akcjonariusze', `
      ${tabelaHtml(
        [['Akcjonariusz'], ['Seria'], ['Ilość', true], ['Numery', false, true], ['Udział', true]],
        wierszeAkcjonariuszy,
        'Rejestr nie wykazuje akcjonariuszy.'
      )}
      <div style="margin-top: 8px; font-size: 12px; color: ${ATRAMENT_2};">
        Razem akcji wyemitowanych i objętych: ${esc(stan.razem_akcji)}.
      </div>`)}

    ${sekcjaHtml('Emisje i serie akcji', tabelaHtml(
      [['Seria'], ['Tytuł'], ['Podstawa'], ['Numery', false, true],
       ['Wyemitowane', true], ['Umorzone', true], ['W obrocie', true], ['Data']],
      wierszeEmisji,
      'Rejestr nie wykazuje emisji.'
    ))}

    ${uprawnienia.length === 0 ? '' : sekcjaHtml(
      'Uprawnienia, przywileje i obowiązki związane z akcjami',
      tabelaHtml(
        [['Rodzaj'], ['Dotyczy'], ['Tytuł'], ['Treść'], ['Od dnia']],
        uprawnienia.map((u) => [
          esc(u.rodzaj),
          esc(u.osoba ? u.osoba.oznaczenie : u.seria || 'cała spółka'),
          esc(u.tytul || '—'),
          esc(u.tresc || '—'),
          dataPl(u.data_ustanowienia),
        ]),
        ''
      )
    )}

    ${obciazenia.length === 0 ? '' : sekcjaHtml(
      'Obciążenia i zajęcia akcji',
      tabelaHtml(
        [['Typ'], ['Seria'], ['Numery', false, true], ['Uprawniony'], ['Prawo głosu'], ['Od dnia']],
        obciazenia.map((o) => [
          esc(o.typ === 'zajecie' ? 'zajęcie' : o.typ),
          esc(o.seria || '—'),
          esc(o.numery),
          esc(o.uprawniony ? o.uprawniony.oznaczenie : '—'),
          o.prawo_glosu ? 'tak' : 'nie',
          dataPl(o.data_od),
        ]),
        ''
      )
    )}

    ${ograniczenia.length === 0 ? '' : sekcjaHtml(
      'Ograniczenia w rozporządzaniu akcjami',
      tabelaHtml(
        [['Zakres'], ['Seria'], ['Numery', false, true], ['Zgoda spółki'], ['Prawo pierwszeństwa'], ['Opis']],
        ograniczenia.map((o) => [
          esc(o.zakres === 'spolka' ? 'cała spółka' : o.zakres),
          esc(o.seria || '—'),
          esc(o.numery || '—'),
          o.wymaga_zgody_spolki ? 'tak' : 'nie',
          o.prawo_pierwszenstwa ? 'tak' : 'nie',
          esc(o.opis || '—'),
        ]),
        ''
      )
    )}

    <p style="margin-top: 28px; font-size: 12px;">
      Dokument stanowi informację z rejestru akcjonariuszy w rozumieniu
      art. 300(35) § 3 Kodeksu spółek handlowych.
    </p>
    ${zamaskowane ? `
    <p style="font-size: 11px; color: ${ATRAMENT_3};">
      Numery PESEL, daty urodzenia i adresy zamieszkania pozostałych akcjonariuszy
      zostały zasłonięte — art. 300(35) § 1(1) Kodeksu spółek handlowych.
    </p>` : ''}

    <div style="margin-top: 46px; text-align: right;">
      <div style="display: inline-block; border-top: 1px solid ${ATRAMENT}; padding-top: 6px;
                  font-size: 11px; color: ${ATRAMENT_2}; min-width: 220px; text-align: center;">
        podpis i pieczęć notariusza
      </div>
    </div>
  `;

  return szkielet({
    tytul: 'Informacja z rejestru akcjonariuszy',
    kancelaria,
    tresc,
    zeZnakiem,
  });
}

/**
 * art. 476 § 1(1) KSH (nowelizacja) — wykaz akcjonariuszy. Dwa wyzwalacze,
 * jeden dokument: wykreślenie spółki z rejestru przedsiębiorców ORAZ
 * odpowiedź na zapytanie sądu rejestrowego (art. 25da ustawy o KRS, sąd
 * pozyskuje wykaz bezpośrednio od podmiotu prowadzącego rejestr). `stan` to
 * wynik `widoki.widokStanu()` dla ROLI KANCELARIA (bez maskowania) — sąd ma
 * pełny wgląd, tak jak organy z art. 300(35) § 1(1) KSH.
 */
function wykazAkcjonariuszy({ kancelaria, spolka, data, stan, powod }) {
  const wiersze = stan.akcjonariusze
    .map((a) => {
      const oznaczenie = a.osoba ? esc(a.osoba.oznaczenie) : 'nieznany';
      const identyfikator = a.osoba && a.osoba.jawny_identyfikator ? ` · ${esc(a.osoba.jawny_identyfikator)}` : '';
      const pesel = a.osoba && a.osoba.typ === 'fizyczna' && a.osoba.pesel ? ` · PESEL ${esc(a.osoba.pesel)}` : '';
      return `
        <tr>
          <td style="padding: 6px 8px; border-bottom: 1px solid ${LINIA};">${oznaczenie}${identyfikator}${pesel}</td>
          <td style="padding: 6px 8px; border-bottom: 1px solid ${LINIA};">${esc(a.seria)}</td>
          <td style="padding: 6px 8px; border-bottom: 1px solid ${LINIA}; text-align: right;">${esc(a.ilosc)}</td>
          <td style="padding: 6px 8px; border-bottom: 1px solid ${LINIA}; font-family: ${FONT_DANE}; font-size: 11px;">${esc(a.numery)}</td>
          <td style="padding: 6px 8px; border-bottom: 1px solid ${LINIA}; text-align: right;">${esc(a.procent)}%</td>
        </tr>`;
    })
    .join('');

  const tresc = `
    <p>
      Wykaz akcjonariuszy spółki <strong>${esc(spolka.nazwa)}</strong>${spolka.krs ? ` (KRS ${esc(spolka.krs)})` : ''},
      sporządzony na podstawie art. 476 § 1(1) Kodeksu spółek handlowych, według stanu na dzień
      <strong>${dataPl(data)}</strong>.
    </p>
    ${powod ? `<p style="font-size: 12px; color: ${ATRAMENT_2};">Podstawa sporządzenia: ${esc(powod)}.</p>` : ''}
    <table style="width: 100%; border-collapse: collapse; margin: 18px 0; font-size: 13px;">
      <thead>
        <tr style="text-align: left; color: ${ATRAMENT_2}; font-size: 11px; text-transform: uppercase;">
          <th style="padding: 6px 8px;">Akcjonariusz</th>
          <th style="padding: 6px 8px;">Seria</th>
          <th style="padding: 6px 8px; text-align: right;">Ilość</th>
          <th style="padding: 6px 8px;">Numery</th>
          <th style="padding: 6px 8px; text-align: right;">Udział</th>
        </tr>
      </thead>
      <tbody>${wiersze || '<tr><td colspan="5" style="padding:6px 8px;">Brak wpisanych akcjonariuszy.</td></tr>'}</tbody>
    </table>
    <p style="font-size: 12px; color: ${ATRAMENT_2};">Razem akcji wyemitowanych i objętych: ${esc(stan.razem_akcji)}.</p>
  `;
  return szkielet({
    tytul: 'Wykaz akcjonariuszy',
    kancelaria,
    tresc,
  });
}

/**
 * art. 300(32) § 3 KSH (nowelizacja) — zawiadomienie sądu rejestrowego
 * o wygaśnięciu lub rozwiązaniu umowy o prowadzenie rejestru, w terminie
 * 7 dni (`przepisy.TERMINY.ZAWIADOMIENIE_SADU_DNI`).
 */
function zawiadomienieSaduORozwiazaniu({ kancelaria, spolka, dataZakonczenia, tryb }) {
  const tresc = `
    <p>Do Sądu Rejestrowego,</p>
    <p>
      działając jako podmiot prowadzący rejestr akcjonariuszy spółki
      <strong>${esc(spolka.nazwa)}</strong>${spolka.krs ? ` (KRS ${esc(spolka.krs)})` : ''},
      na podstawie art. 300(32) § 3 Kodeksu spółek handlowych zawiadamiam o
      ${esc(tryb || 'rozwiązaniu')} umowy o prowadzenie rejestru akcjonariuszy tej spółki
      z dniem <strong>${dataPl(dataZakonczenia)}</strong>.
    </p>
    <p style="margin-top: 24px;">Z poważaniem,<br>${esc(kancelaria.nazwa)}</p>
  `;
  return szkielet({
    tytul: 'Zawiadomienie o rozwiązaniu umowy o prowadzenie rejestru',
    kancelaria,
    tresc,
  });
}

module.exports = {
  esc,
  dataPl,
  zawiadomienieWpis,
  zawiadomienieOdmowa,
  powiadomienieZamierzonegoWpisu,
  wezwanieDoUzupelnienia,
  informacjaZRejestru,
  wykazAkcjonariuszy,
  zawiadomienieSaduORozwiazaniu,
};
