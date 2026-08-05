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

const STYL = `
  font-family: Georgia, 'Times New Roman', serif; color: #1f1a14; line-height: 1.6;
  max-width: 640px; margin: 0 auto; padding: 8px;
`;

function szkielet({ tytul, kancelaria, tresc, stopkaDodatkowa }) {
  return `
<!doctype html>
<html lang="pl"><head><meta charset="utf-8"><title>${esc(tytul)}</title></head>
<body style="${STYL}">
  <div style="border-bottom: 2px solid #1f1a14; padding-bottom: 12px; margin-bottom: 20px;">
    <div style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; color: #6b6256;">
      ${esc(kancelaria.nazwa)}
    </div>
    ${kancelaria.adres ? `<div style="font-size: 12px; color: #6b6256;">${esc(kancelaria.adres)}</div>` : ''}
    ${kancelaria.miejscowosc ? `<div style="font-size: 12px; color: #6b6256;">${esc(kancelaria.miejscowosc)}</div>` : ''}
    ${kancelaria.telefon || kancelaria.email
      ? `<div style="font-size: 12px; color: #6b6256;">${esc(
          [kancelaria.telefon, kancelaria.email].filter(Boolean).join(' · ')
        )}</div>`
      : ''}
  </div>
  <h1 style="font-size: 22px; font-weight: 500; margin: 0 0 18px;">${esc(tytul)}</h1>
  ${tresc}
  <div style="margin-top: 32px; padding-top: 14px; border-top: 1px solid #e0d9ca; font-size: 11px; color: #9e9487;">
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
      <tr><td style="padding: 4px 0; color: #6b6256; width: 160px;">Rodzaj zdarzenia</td>
          <td style="padding: 4px 0;">${esc(typZdarzenie.nazwa)}</td></tr>
      <tr><td style="padding: 4px 0; color: #6b6256;">Data zdarzenia</td>
          <td style="padding: 4px 0;">${dataPl(zdarzenie.data_zdarzenia)}</td></tr>
      <tr><td style="padding: 4px 0; color: #6b6256;">Data i godzina wpisu</td>
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
    <p style="background: #f5e8ea; border-radius: 6px; padding: 12px 14px;">${esc(powodOdmowy)}</p>
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
    <p style="background: #f2ede0; border-radius: 6px; padding: 12px 14px;">${esc(powodWstrzymania)}</p>
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

/**
 * art. 300(35) KSH — informacja z rejestru. `stan` to gotowy wynik
 * `widoki.widokStanu()` — maskowanie jest juz zastosowane wzgledem roli
 * odbiorcy, tu tylko ukladamy HTML (sekcja 10: czego NIE umieszczac na
 * wydrukach — pole `uwagi`, checklisty, notatki AML, hash — widokStanu ich
 * juz nie zwraca dla roli innej niz kancelaria).
 */
function informacjaZRejestru({ kancelaria, spolka, data, stan }) {
  const wiersze = stan.akcjonariusze
    .map((a) => {
      const oznaczenie = a.osoba ? esc(a.osoba.oznaczenie) : 'nieznany';
      const identyfikator = a.osoba && a.osoba.jawny_identyfikator ? ` · ${esc(a.osoba.jawny_identyfikator)}` : '';
      const obciazone = a.obciazenia && a.obciazenia.length ? ' 🔒' : '';
      return `
        <tr>
          <td style="padding: 6px 8px; border-bottom: 1px solid #e0d9ca;">${oznaczenie}${identyfikator}${obciazone}</td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #e0d9ca;">${esc(a.seria)}</td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #e0d9ca; text-align: right;">${esc(a.ilosc)}</td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #e0d9ca; font-family: monospace; font-size: 11px;">${esc(a.numery)}</td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #e0d9ca; text-align: right;">${esc(a.procent)}%</td>
        </tr>`;
    })
    .join('');

  const tresc = `
    <p>
      Informacja z rejestru akcjonariuszy spółki <strong>${esc(spolka.nazwa)}</strong>
      ${spolka.krs ? ` (KRS ${esc(spolka.krs)})` : ''}, sporządzona na podstawie art. 300(35)
      Kodeksu spółek handlowych, według stanu na dzień <strong>${dataPl(data)}</strong>.
    </p>
    <table style="width: 100%; border-collapse: collapse; margin: 18px 0; font-size: 13px;">
      <thead>
        <tr style="text-align: left; color: #6b6256; font-size: 11px; text-transform: uppercase;">
          <th style="padding: 6px 8px;">Akcjonariusz</th>
          <th style="padding: 6px 8px;">Seria</th>
          <th style="padding: 6px 8px; text-align: right;">Ilość</th>
          <th style="padding: 6px 8px;">Numery</th>
          <th style="padding: 6px 8px; text-align: right;">Udział</th>
        </tr>
      </thead>
      <tbody>${wiersze || '<tr><td colspan="5" style="padding:6px 8px;">Brak wpisanych akcjonariuszy.</td></tr>'}</tbody>
    </table>
    <p style="font-size: 12px; color: #6b6256;">
      Razem akcji wyemitowanych i objętych: ${esc(stan.razem_akcji)}.
      ${'🔒'} oznacza akcje obciążone zastawem, użytkowaniem lub zajęciem.
    </p>
    <p style="font-size: 11px; color: #9e9487;">
      Dane osób innych niż wnioskujący mogą być częściowo zamaskowane zgodnie z art. 300(35) § 1(1) KSH.
    </p>
  `;
  return szkielet({
    tytul: 'Informacja z rejestru akcjonariuszy',
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
};
