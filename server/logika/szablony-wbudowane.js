'use strict';

/**
 * Szablony wbudowane - wersja 1 każdego dokumentu wychodzącego (faza 4).
 *
 * Zasiewane raz, przy starcie, jeżeli danego kodu jeszcze nie ma. Nigdy nie
 * nadpisują wersji istniejącej: jeśli notariusz zredagował własną, zostaje
 * jego. Zmiana treści wbudowanej w kolejnych wydaniach aplikacji doda się
 * jako NOWA wersja dopiero wtedy, gdy ktoś świadomie ją aktywuje.
 *
 * Treść to WYŁĄCZNIE ciało pisma. Papier firmowy (nagłówek kancelarii,
 * stopka z podstawą prawną, numeracja) dokłada `server/dokumenty.js` przy
 * renderowaniu - dzięki temu redakcja szablonu dotyczy tekstu, a nie układu,
 * i zmiana danych kancelarii nie wymaga poprawiania trzynastu szablonów.
 *
 * Klucze wspólne dostępne w każdym szablonie (patrz `server/dokumenty.js`):
 *   spolka_nazwa, spolka_krs, spolka_siedziba, spolka_adres,
 *   kancelaria_nazwa, notariusz, data_dzis, miejscowosc_kancelarii
 */

/** Akapit o mechanizmie integralności - wymagany w umowie (art. 300(31) § 4 KSH). */
const AKAPIT_INTEGRALNOSCI = `
    <p>
      Rejestr prowadzony jest w postaci elektronicznej, w systemie teleinformatycznym
      Podmiotu prowadzącego rejestr, w sposób zapewniający bezpieczeństwo i integralność
      zawartych w nim danych. Rejestr ma postać dziennika zdarzeń, do którego wpisy są
      wyłącznie dopisywane; treść wpisu już dokonanego nie podlega zmianie ani usunięciu.
      Każde zdarzenie opatrzone jest znacznikiem czasu oraz skrótem kryptograficznym
      obejmującym skrót zdarzenia poprzedniego, wskutek czego zmiana zapisu wcześniejszego
      bez przepisania całej dalszej historii rejestru nie jest możliwa. Poprawienie omyłki
      następuje przez wpis prostujący, wskazujący zdarzenie prostowane, z zachowaniem
      zapisu pierwotnego.
    </p>`;

const SZABLONY = [
  // ── Zawiadomienia w toku sprawy ────────────────────────────────────────
  {
    kod: 'zawiadomienie_wpis_zadajacy',
    tytul: 'Zawiadomienie o dokonaniu wpisu',
    opis: 'Do żądającego wpisu. Wysyłane niezwłocznie po dokonaniu wpisu.',
    podstawa_prawna: 'art. 300(34) § 7 KSH',
    tresc: `
    <p>{{odbiorca_nazwa}}</p>
    <p>
      Zawiadamiam, że w rejestrze akcjonariuszy spółki {{spolka_nazwa}} z siedzibą
      w {{spolka_siedziba}}, wpisanej do Krajowego Rejestru Sądowego pod numerem
      {{spolka_krs}}, dokonano wpisu na podstawie żądania złożonego dnia
      {{data_wplywu_slownie}} r.
    </p>
    <p><strong>Treść wpisu:</strong> {{podsumowanie}}</p>
    <p>Data zdarzenia: {{data_zdarzenia_slownie}} r. Data dokonania wpisu: {{data_wpisu_slownie}} r.</p>
    <p>
      Wobec spółki za akcjonariusza uważa się wyłącznie osobę wpisaną do rejestru
      akcjonariuszy (art. 300(38) § 1 Kodeksu spółek handlowych).
    </p>`,
  },
  {
    kod: 'zawiadomienie_wpis_spolka',
    tytul: 'Zawiadomienie o dokonaniu wpisu — do spółki',
    opis: 'Do spółki, wraz z listą akcjonariuszy w załączeniu.',
    podstawa_prawna: 'art. 300(34) § 7 KSH',
    tresc: `
    <p>Zarząd spółki {{spolka_nazwa}}</p>
    <p>
      Zawiadamiam, że w prowadzonym przeze mnie rejestrze akcjonariuszy spółki
      {{spolka_nazwa}} dokonano dnia {{data_wpisu_slownie}} r. wpisu o następującej treści:
    </p>
    <p><strong>{{podsumowanie}}</strong></p>
    <p>
      W załączeniu przekazuję listę akcjonariuszy według stanu na dzień {{data_stanu_slownie}} r.
      Po otrzymaniu niniejszego zawiadomienia zarząd niezwłocznie składa do sądu rejestrowego
      nową listę akcjonariuszy, podpisaną przez wszystkich członków zarządu
      (art. 300(34) § 8 Kodeksu spółek handlowych).
    </p>
    <table style="width:100%; border-collapse:collapse; margin-top:14px;">
      <thead>
        <tr>
          <th style="text-align:left; border-bottom:1px solid #b9b1a3; padding:6px 4px;">Akcjonariusz</th>
          <th style="text-align:left; border-bottom:1px solid #b9b1a3; padding:6px 4px;">Seria</th>
          <th style="text-align:right; border-bottom:1px solid #b9b1a3; padding:6px 4px;">Liczba akcji</th>
          <th style="text-align:left; border-bottom:1px solid #b9b1a3; padding:6px 4px;">Numery</th>
        </tr>
      </thead>
      <tbody>
        {{#akcjonariusze}}
        <tr>
          <td style="padding:5px 4px; border-bottom:1px solid #e0d9ca;">{{oznaczenie}}</td>
          <td style="padding:5px 4px; border-bottom:1px solid #e0d9ca;">{{seria}}</td>
          <td style="padding:5px 4px; border-bottom:1px solid #e0d9ca; text-align:right;">{{ilosc}}</td>
          <td style="padding:5px 4px; border-bottom:1px solid #e0d9ca;">{{numery}}</td>
        </tr>
        {{/akcjonariusze}}
      </tbody>
    </table>`,
  },
  {
    kod: 'lista_akcjonariuszy_sad',
    tytul: 'Lista akcjonariuszy do złożenia w sądzie rejestrowym',
    opis: 'Dla zarządu — do złożenia w sądzie rejestrowym po zawiadomieniu o wpisie.',
    podstawa_prawna: 'art. 300(34) § 8 KSH',
    tresc: `
    <p>
      Lista akcjonariuszy spółki {{spolka_nazwa}} z siedzibą w {{spolka_siedziba}},
      wpisanej do Krajowego Rejestru Sądowego pod numerem {{spolka_krs}}, sporządzona
      na podstawie rejestru akcjonariuszy według stanu na dzień {{data_stanu_slownie}} r.
    </p>
    <table style="width:100%; border-collapse:collapse; margin-top:14px;">
      <thead>
        <tr>
          <th style="text-align:left; border-bottom:1px solid #b9b1a3; padding:6px 4px;">Akcjonariusz</th>
          <th style="text-align:left; border-bottom:1px solid #b9b1a3; padding:6px 4px;">Seria</th>
          <th style="text-align:right; border-bottom:1px solid #b9b1a3; padding:6px 4px;">Liczba akcji</th>
          <th style="text-align:left; border-bottom:1px solid #b9b1a3; padding:6px 4px;">Numery</th>
          <th style="text-align:left; border-bottom:1px solid #b9b1a3; padding:6px 4px;">Zastaw / użytkowanie</th>
        </tr>
      </thead>
      <tbody>
        {{#akcjonariusze}}
        <tr>
          <td style="padding:5px 4px; border-bottom:1px solid #e0d9ca;">{{oznaczenie}}</td>
          <td style="padding:5px 4px; border-bottom:1px solid #e0d9ca;">{{seria}}</td>
          <td style="padding:5px 4px; border-bottom:1px solid #e0d9ca; text-align:right;">{{ilosc}}</td>
          <td style="padding:5px 4px; border-bottom:1px solid #e0d9ca;">{{numery}}</td>
          <td style="padding:5px 4px; border-bottom:1px solid #e0d9ca;">{{obciazenia}}</td>
        </tr>
        {{/akcjonariusze}}
      </tbody>
    </table>
    <p style="margin-top:18px;">
      Łączna liczba akcji zarejestrowanych w rejestrze: {{razem_akcji}}
      ({{razem_akcji_slownie}}).
    </p>
    <p style="margin-top:28px;">
      Listę podpisują wszyscy członkowie zarządu spółki.
    </p>`,
  },
  {
    kod: 'powiadomienie_zamierzony_wpis',
    tytul: 'Powiadomienie o treści zamierzonego wpisu',
    opis:
      'Do osoby, której uprawnienia mają być wykreślone, zmienione lub obciążone — ' +
      'przed dokonaniem wpisu, chyba że wyraziła zgodę.',
    podstawa_prawna: 'art. 300(34) § 3 KSH',
    tresc: `
    <p>{{odbiorca_nazwa}}</p>
    <p>
      Zawiadamiam o treści zamierzonego wpisu do rejestru akcjonariuszy spółki
      {{spolka_nazwa}}, którym mają zostać {{skutek_dla_odbiorcy}} uprawnienia
      przysługujące Panu/Pani z akcji tej spółki.
    </p>
    <p><strong>Treść zamierzonego wpisu:</strong> {{podsumowanie}}</p>
    <p>
      Powiadomienie następuje przed dokonaniem wpisu, stosownie do art. 300(34) § 3
      Kodeksu spółek handlowych. Ewentualne zastrzeżenia proszę zgłosić niezwłocznie
      na adres podany w nagłówku.
    </p>`,
  },
  {
    kod: 'wezwanie_przeszkoda',
    tytul: 'Wezwanie do usunięcia przeszkody wpisu',
    opis: 'Wysyłane przy wstrzymaniu sprawy. Od dnia usunięcia przeszkody biegnie nowy termin 7 dni.',
    podstawa_prawna: 'art. 300(34) § 1 KSH',
    tresc: `
    <p>{{odbiorca_nazwa}}</p>
    <p>
      W związku z żądaniem wpisu do rejestru akcjonariuszy spółki {{spolka_nazwa}},
      złożonym dnia {{data_wplywu_slownie}} r., zawiadamiam, że dokonanie wpisu wymaga
      uprzedniego usunięcia następującej przeszkody:
    </p>
    <p><strong>{{opis_przeszkody}}</strong></p>
    <p>
      Wpis zostanie dokonany w terminie siedmiu dni od dnia usunięcia przeszkody
      (art. 300(34) § 1 zdanie drugie Kodeksu spółek handlowych).
    </p>
    <p>
      Zwracam uwagę, że wobec spółki za akcjonariusza uważa się wyłącznie osobę wpisaną
      do rejestru akcjonariuszy, wobec czego niedokonanie wpisu uniemożliwia wykonywanie
      praw z akcji wobec spółki (art. 300(38) § 1 Kodeksu spółek handlowych).
    </p>`,
  },
  {
    kod: 'zawiadomienie_odmowa',
    tytul: 'Zawiadomienie o niedokonaniu wpisu',
    opis: 'Do żądającego, z podaniem przyczyn.',
    podstawa_prawna: 'art. 300(34) § 7 zd. 2 KSH',
    tresc: `
    <p>{{odbiorca_nazwa}}</p>
    <p>
      Zawiadamiam, że nie dokonano wpisu do rejestru akcjonariuszy spółki
      {{spolka_nazwa}}, o który wystąpiono dnia {{data_wplywu_slownie}} r.
    </p>
    <p><strong>Przyczyny niedokonania wpisu:</strong></p>
    <p>{{powod_odmowy}}</p>
    <p>
      Zawiadomienie następuje stosownie do art. 300(34) § 7 zdanie drugie Kodeksu spółek
      handlowych. Ponowne żądanie wpisu może zostać złożone po ustaniu przyczyn wskazanych
      powyżej, wraz z dokumentami uzasadniającymi dokonanie wpisu.
    </p>`,
  },

  // ── Informacja z rejestru (art. 300(35) § 3 KSH), trzy warianty ────────
  {
    kod: 'informacja_z_rejestru_spolka',
    tytul: 'Informacja z rejestru akcjonariuszy — dla spółki',
    opis: 'Pełny zakres danych. Wydawana spółce, której rejestr dotyczy.',
    podstawa_prawna: 'art. 300(35) § 1 i 3 KSH',
    tresc: `
    <p>
      Informacja z rejestru akcjonariuszy spółki {{spolka_nazwa}} z siedzibą
      w {{spolka_siedziba}}, KRS {{spolka_krs}}, sporządzona według stanu na dzień
      {{data_stanu_slownie}} r.
    </p>
    <table style="width:100%; border-collapse:collapse; margin-top:14px;">
      <thead>
        <tr>
          <th style="text-align:left; border-bottom:1px solid #b9b1a3; padding:6px 4px;">Akcjonariusz</th>
          <th style="text-align:left; border-bottom:1px solid #b9b1a3; padding:6px 4px;">Seria</th>
          <th style="text-align:right; border-bottom:1px solid #b9b1a3; padding:6px 4px;">Liczba akcji</th>
          <th style="text-align:left; border-bottom:1px solid #b9b1a3; padding:6px 4px;">Numery</th>
          <th style="text-align:right; border-bottom:1px solid #b9b1a3; padding:6px 4px;">Udział</th>
        </tr>
      </thead>
      <tbody>
        {{#akcjonariusze}}
        <tr>
          <td style="padding:5px 4px; border-bottom:1px solid #e0d9ca;">{{oznaczenie}}</td>
          <td style="padding:5px 4px; border-bottom:1px solid #e0d9ca;">{{seria}}</td>
          <td style="padding:5px 4px; border-bottom:1px solid #e0d9ca; text-align:right;">{{ilosc}}</td>
          <td style="padding:5px 4px; border-bottom:1px solid #e0d9ca;">{{numery}}</td>
          <td style="padding:5px 4px; border-bottom:1px solid #e0d9ca; text-align:right;">{{procent}}</td>
        </tr>
        {{/akcjonariusze}}
      </tbody>
    </table>
    <p style="margin-top:18px;">
      Łączna liczba akcji: {{razem_akcji}} ({{razem_akcji_slownie}}).
    </p>
    <p style="margin-top:10px; font-size:12px;">
      Niniejszy dokument stanowi informację z rejestru akcjonariuszy w rozumieniu
      art. 300(35) § 3 Kodeksu spółek handlowych.
    </p>`,
  },
  {
    kod: 'informacja_z_rejestru_akcjonariusz',
    tytul: 'Informacja z rejestru akcjonariuszy — dla akcjonariusza',
    opis:
      'Dane pozostałych akcjonariuszy w zakresie ograniczonym: bez numeru PESEL, ' +
      'daty urodzenia i adresu zamieszkania.',
    podstawa_prawna: 'art. 300(35) § 1(1) i 3 KSH',
    tresc: `
    <p>{{odbiorca_nazwa}}</p>
    <p>
      Informacja z rejestru akcjonariuszy spółki {{spolka_nazwa}} z siedzibą
      w {{spolka_siedziba}}, KRS {{spolka_krs}}, sporządzona według stanu na dzień
      {{data_stanu_slownie}} r.
    </p>
    <table style="width:100%; border-collapse:collapse; margin-top:14px;">
      <thead>
        <tr>
          <th style="text-align:left; border-bottom:1px solid #b9b1a3; padding:6px 4px;">Akcjonariusz</th>
          <th style="text-align:left; border-bottom:1px solid #b9b1a3; padding:6px 4px;">Seria</th>
          <th style="text-align:right; border-bottom:1px solid #b9b1a3; padding:6px 4px;">Liczba akcji</th>
          <th style="text-align:left; border-bottom:1px solid #b9b1a3; padding:6px 4px;">Numery</th>
          <th style="text-align:right; border-bottom:1px solid #b9b1a3; padding:6px 4px;">Udział</th>
        </tr>
      </thead>
      <tbody>
        {{#akcjonariusze}}
        <tr>
          <td style="padding:5px 4px; border-bottom:1px solid #e0d9ca;">{{oznaczenie}}</td>
          <td style="padding:5px 4px; border-bottom:1px solid #e0d9ca;">{{seria}}</td>
          <td style="padding:5px 4px; border-bottom:1px solid #e0d9ca; text-align:right;">{{ilosc}}</td>
          <td style="padding:5px 4px; border-bottom:1px solid #e0d9ca;">{{numery}}</td>
          <td style="padding:5px 4px; border-bottom:1px solid #e0d9ca; text-align:right;">{{procent}}</td>
        </tr>
        {{/akcjonariusze}}
      </tbody>
    </table>
    <p style="margin-top:18px;">
      Łączna liczba akcji: {{razem_akcji}} ({{razem_akcji_slownie}}).
    </p>
    <p style="margin-top:10px; font-size:12px;">
      Numeru PESEL, daty urodzenia ani adresu zamieszkania pozostałych akcjonariuszy
      nie udostępnia się (art. 300(35) § 1(1) Kodeksu spółek handlowych). Niniejszy
      dokument stanowi informację z rejestru akcjonariuszy w rozumieniu art. 300(35) § 3
      tej ustawy.
    </p>`,
  },
  {
    kod: 'informacja_z_rejestru_organ',
    tytul: 'Informacja z rejestru akcjonariuszy — dla sądu, prokuratury lub organu egzekucyjnego',
    opis: 'Pełny zakres danych. Wymaga wskazania sygnatury toczącego się postępowania.',
    podstawa_prawna: 'art. 300(35) § 4 KSH',
    tresc: `
    <p>{{odbiorca_nazwa}}</p>
    <p>
      W odpowiedzi na żądanie w sprawie o sygnaturze {{sygnatura}}, przekazuję informację
      z rejestru akcjonariuszy spółki {{spolka_nazwa}} z siedzibą w {{spolka_siedziba}},
      KRS {{spolka_krs}}, według stanu na dzień {{data_stanu_slownie}} r.
    </p>
    <table style="width:100%; border-collapse:collapse; margin-top:14px;">
      <thead>
        <tr>
          <th style="text-align:left; border-bottom:1px solid #b9b1a3; padding:6px 4px;">Akcjonariusz</th>
          <th style="text-align:left; border-bottom:1px solid #b9b1a3; padding:6px 4px;">Identyfikacja</th>
          <th style="text-align:left; border-bottom:1px solid #b9b1a3; padding:6px 4px;">Seria</th>
          <th style="text-align:right; border-bottom:1px solid #b9b1a3; padding:6px 4px;">Liczba akcji</th>
          <th style="text-align:left; border-bottom:1px solid #b9b1a3; padding:6px 4px;">Numery</th>
        </tr>
      </thead>
      <tbody>
        {{#akcjonariusze}}
        <tr>
          <td style="padding:5px 4px; border-bottom:1px solid #e0d9ca;">{{oznaczenie}}</td>
          <td style="padding:5px 4px; border-bottom:1px solid #e0d9ca;">{{identyfikacja}}</td>
          <td style="padding:5px 4px; border-bottom:1px solid #e0d9ca;">{{seria}}</td>
          <td style="padding:5px 4px; border-bottom:1px solid #e0d9ca; text-align:right;">{{ilosc}}</td>
          <td style="padding:5px 4px; border-bottom:1px solid #e0d9ca;">{{numery}}</td>
        </tr>
        {{/akcjonariusze}}
      </tbody>
    </table>
    <p style="margin-top:10px; font-size:12px;">
      Informacja wydana w związku z toczącym się postępowaniem, stosownie do art. 300(35)
      § 4 Kodeksu spółek handlowych.
    </p>`,
  },

  // ── Dokumenty relacji ze spółką ────────────────────────────────────────
  {
    kod: 'uchwala_wyboru',
    tytul: 'Uchwała akcjonariuszy o wyborze podmiotu prowadzącego rejestr',
    opis: 'Wzór do wykorzystania przez spółkę. Wybór podmiotu wymaga uchwały akcjonariuszy.',
    podstawa_prawna: 'art. 300(31) § 5 KSH',
    tresc: `
    <p style="text-align:center;"><strong>UCHWAŁA AKCJONARIUSZY<br>spółki {{spolka_nazwa}}</strong></p>
    <p style="text-align:center;">z dnia {{data_uchwaly_slownie}} r.<br>
      w sprawie wyboru podmiotu prowadzącego rejestr akcjonariuszy</p>
    <p><strong>§ 1.</strong> Akcjonariusze spółki {{spolka_nazwa}} z siedzibą
      w {{spolka_siedziba}} wybierają {{kancelaria_nazwa}} — {{notariusz}} — na podmiot
      prowadzący rejestr akcjonariuszy spółki.</p>
    <p><strong>§ 2.</strong> Zarząd spółki jest obowiązany do niezwłocznego zawarcia
      z podmiotem wskazanym w § 1 umowy o prowadzenie rejestru akcjonariuszy.</p>
    <p><strong>§ 3.</strong> Uchwała wchodzi w życie z dniem podjęcia.</p>
    <p style="margin-top:24px; font-size:12px;">
      Podstawa: art. 300(31) § 5 Kodeksu spółek handlowych — wybór podmiotu prowadzącego
      rejestr akcjonariuszy wymaga uchwały akcjonariuszy.
    </p>`,
  },
  {
    kod: 'umowa_o_prowadzenie',
    tytul: 'Umowa o prowadzenie rejestru akcjonariuszy',
    opis: 'Wzór umowy między spółką a kancelarią. Zawiera opis technicznego sposobu prowadzenia rejestru.',
    podstawa_prawna: 'art. 300(32) KSH',
    tresc: `
    <p style="text-align:center;"><strong>UMOWA O PROWADZENIE REJESTRU AKCJONARIUSZY</strong></p>
    <p>
      zawarta dnia {{data_umowy_slownie}} r. w {{miejscowosc_kancelarii}} pomiędzy:
      spółką {{spolka_nazwa}} z siedzibą w {{spolka_siedziba}}, KRS {{spolka_krs}},
      zwaną dalej <strong>Spółką</strong>, a {{kancelaria_nazwa}}, w imieniu której działa
      {{notariusz}}, zwanym dalej <strong>Podmiotem prowadzącym rejestr</strong>.
    </p>

    <p><strong>§ 1. Przedmiot umowy</strong></p>
    <p>
      Podmiot prowadzący rejestr zobowiązuje się do prowadzenia rejestru akcjonariuszy
      Spółki na zasadach określonych w art. 300(31)–300(35) Kodeksu spółek handlowych
      oraz w niniejszej umowie. Podstawą zawarcia umowy jest uchwała akcjonariuszy
      z dnia {{data_uchwaly_slownie}} r.
    </p>

    <p><strong>§ 2. Techniczny sposób prowadzenia rejestru</strong></p>
    ${AKAPIT_INTEGRALNOSCI}
    <p>
      Rejestr jest jawny dla Spółki i każdego akcjonariusza, którzy mają prawo dostępu
      do zawartych w nim danych za pośrednictwem Podmiotu prowadzącego rejestr oraz prawo
      żądania wydania informacji z rejestru w postaci papierowej lub elektronicznej.
    </p>

    <p><strong>§ 3. Wynagrodzenie i terminy płatności</strong></p>
    <p>
      Za prowadzenie rejestru Spółka zapłaci wynagrodzenie w wysokości {{oplata_roczna}}
      za każdy rozpoczęty rok prowadzenia rejestru, płatne w terminie {{termin_platnosci_dni}}
      dni od dnia doręczenia rachunku. Za dokonanie wpisu w rejestrze — {{oplata_wpis}}
      za wpis. Za wydanie informacji z rejestru — {{oplata_informacja}} za informację.
      Ujawnienie zajęcia praw majątkowych akcjonariusza jest wolne od opłat
      (art. 300(34) § 2 Kodeksu spółek handlowych).
    </p>

    <p><strong>§ 4. Przechowywanie dokumentów</strong></p>
    <p>
      Dokumenty stanowiące podstawę wpisów Podmiot prowadzący rejestr przechowuje przez
      okres {{okres_przechowywania}} od dnia dokonania wpisu, w sposób zapewniający ich
      integralność i poufność.
    </p>

    <p><strong>§ 5. Rozwiązanie umowy</strong></p>
    <p>
      Rozwiązanie umowy przez Spółkę jest dopuszczalne jedynie pod warunkiem zawarcia nowej
      umowy o prowadzenie rejestru akcjonariuszy. Rozwiązanie umowy przez Podmiot prowadzący
      rejestr jest dopuszczalne jedynie z ważnych powodów, z zachowaniem terminu wypowiedzenia
      nie krótszego niż trzy miesiące. Za ważne powody strony uznają w szczególności:
      {{wazne_powody}}.
    </p>
    <p>
      W razie rozwiązania albo wygaśnięcia umowy Podmiot prowadzący rejestr przekazuje Spółce
      albo wskazanemu przez nią nowemu podmiotowi prowadzącemu rejestr komplet danych rejestru
      wraz z pełną historią zdarzeń oraz dokumentacją stanowiącą podstawę wpisów, w postaci
      umożliwiającej odczytanie bez użycia systemu Podmiotu prowadzącego rejestr.
    </p>

    <p style="margin-top:32px;">
      ……………………………………<br>Spółka
      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
      ……………………………………<br>Podmiot prowadzący rejestr
    </p>`,
  },
  {
    kod: 'oswiadczenie_zarzadu',
    tytul: 'Oświadczenie zarządu potwierdzające zawarcie umowy',
    opis:
      'Załącznik do zgłoszenia umowy do sądu rejestrowego. Obowiązek wchodzi w życie 18.02.2027 ' +
      '(Dz.U. 2026 poz. 176).',
    podstawa_prawna: 'art. 300(32) § 1(3) KSH',
    tresc: `
    <p style="text-align:center;"><strong>OŚWIADCZENIE ZARZĄDU</strong></p>
    <p>
      Zarząd spółki {{spolka_nazwa}} z siedzibą w {{spolka_siedziba}}, KRS {{spolka_krs}},
      oświadcza, że dnia {{data_umowy_slownie}} r. spółka zawarła umowę o prowadzenie rejestru
      akcjonariuszy z {{kancelaria_nazwa}}.
    </p>
    <p>
      Umowę zawarł(a) {{umowe_zawarl_opis}}. Siedziba i adres kancelarii:
      {{kancelaria_adres}}.
    </p>
    <p style="margin-top:24px; font-size:12px;">
      Oświadczenie składane stosownie do art. 300(32) § 1(3) Kodeksu spółek handlowych,
      jako załącznik do zgłoszenia zawarcia umowy do sądu rejestrowego.
    </p>
    <p style="margin-top:28px;">……………………………………<br>podpisy członków zarządu</p>`,
  },

  // ── Walne zgromadzenie ─────────────────────────────────────────────────
  {
    kod: 'lista_uprawnionych_wz',
    tytul: 'Lista uprawnionych do udziału w walnym zgromadzeniu',
    opis:
      'Stan na dzień przypadający trzy dni przed walnym zgromadzeniem. ' +
      'Zawiera liczbę przysługujących głosów.',
    podstawa_prawna: 'art. 300(91) i art. 300(93) § 1 KSH',
    tresc: `
    <p>
      Lista osób uprawnionych do uczestnictwa w walnym zgromadzeniu spółki
      {{spolka_nazwa}}, zwołanym na dzień {{data_wz_slownie}} r., sporządzona według stanu
      rejestru akcjonariuszy na dzień {{data_stanu_slownie}} r. — to jest na dzień
      przypadający trzy dni przed dniem walnego zgromadzenia.
    </p>
    <table style="width:100%; border-collapse:collapse; margin-top:14px;">
      <thead>
        <tr>
          <th style="text-align:left; border-bottom:1px solid #b9b1a3; padding:6px 4px;">Uprawniony</th>
          <th style="text-align:left; border-bottom:1px solid #b9b1a3; padding:6px 4px;">Seria</th>
          <th style="text-align:left; border-bottom:1px solid #b9b1a3; padding:6px 4px;">Numery</th>
          <th style="text-align:right; border-bottom:1px solid #b9b1a3; padding:6px 4px;">Liczba akcji</th>
          <th style="text-align:right; border-bottom:1px solid #b9b1a3; padding:6px 4px;">Liczba głosów</th>
        </tr>
      </thead>
      <tbody>
        {{#uprawnieni}}
        <tr>
          <td style="padding:5px 4px; border-bottom:1px solid #e0d9ca;">{{oznaczenie}}</td>
          <td style="padding:5px 4px; border-bottom:1px solid #e0d9ca;">{{seria}}</td>
          <td style="padding:5px 4px; border-bottom:1px solid #e0d9ca;">{{numery}}</td>
          <td style="padding:5px 4px; border-bottom:1px solid #e0d9ca; text-align:right;">{{ilosc}}</td>
          <td style="padding:5px 4px; border-bottom:1px solid #e0d9ca; text-align:right;">{{glosy}}</td>
        </tr>
        {{/uprawnieni}}
      </tbody>
    </table>
    <p style="margin-top:18px;">
      Łączna liczba głosów: {{razem_glosow}} ({{razem_glosow_slownie}}).
    </p>
    <p style="margin-top:10px; font-size:12px;">
      Akcja daje prawo do jednego głosu (art. 300(23) § 1 Kodeksu spółek handlowych).
      Przy akcji, do której uprawnionych jest kilka osób, głos przypada na akcję, a prawa
      wykonuje wspólny przedstawiciel (art. 300(38) § 3 tej ustawy).
    </p>`,
  },
];

/**
 * Dane próbne do podglądu szablonu przed wydaniem.
 *
 * Służą dwóm rzeczom naraz: podglądowi w ekranie administratora i testowi,
 * który renderuje KAŻDY szablon wbudowany i sprawdza, że nie zostaje ani jeden
 * nieuzupełniony klucz. Dzięki temu literówka w nazwie pola wychodzi przy
 * `npm test`, a nie na piśmie wysłanym do sądu.
 *
 * Wartości są jawnie fikcyjne — żeby podgląd nigdy nie został wzięty
 * za prawdziwy dokument.
 */
const DANE_PROBNE = {
  // wspólne dokłada `server/dokumenty.js` (spolka_*, kancelaria_*, notariusz…)
  odbiorca_nazwa: 'Jan Przykładowy',
  podsumowanie: 'przeniesienie 30 akcji serii A o numerach 1–30 na rzecz Jana Przykładowego',
  skutek_dla_odbiorcy: 'wykreślone',
  data_wplywu: '2026-03-02',
  data_zdarzenia: '2026-03-01',
  data_wpisu: '2026-03-04',
  data_stanu: '2026-03-04',
  data_uchwaly: '2026-01-15',
  data_umowy: '2026-01-20',
  data_wz: '2026-06-10',
  opis_przeszkody:
    'Do żądania nie dołączono zgody spółki na zbycie akcji nie w pełni pokrytych ' +
    '(art. 300(40) § 1 Kodeksu spółek handlowych).',
  powod_odmowy:
    'Nie usunięto przeszkody wskazanej w wezwaniu z dnia 4 marca 2026 r. — ' +
    'nie przedłożono zgody spółki na zbycie akcji nie w pełni pokrytych.',
  sygnatura: 'IX GC 123/26',
  razem_akcji: 100,
  razem_glosow: 100,
  oplata_roczna: '1 200,00 zł',
  oplata_wpis: '100,00 zł',
  oplata_informacja: '50,00 zł',
  termin_platnosci_dni: 14,
  okres_przechowywania: 'dziesięciu lat',
  wazne_powody:
    'zaleganie z zapłatą wynagrodzenia przez okres przekraczający trzy miesiące, ' +
    'brak możliwości zastosowania środków bezpieczeństwa finansowego wobec akcjonariuszy, ' +
    'zaprzestanie prowadzenia kancelarii notarialnej',
  umowe_zawarl_opis: 'notariusz prowadzący kancelarię',
  akcjonariusze: [
    {
      oznaczenie: 'Przykładowy Jan',
      identyfikacja: 'PESEL 44051401359',
      seria: 'A',
      ilosc: 60,
      numery: '1–60',
      procent: '60,00%',
      obciazenia: '—',
    },
    {
      oznaczenie: 'Przykładowa Anna',
      identyfikacja: 'PESEL 85050512345',
      seria: 'A',
      ilosc: 40,
      numery: '61–100',
      procent: '40,00%',
      obciazenia: 'zastaw na akcjach 61–70',
    },
  ],
  uprawnieni: [
    { oznaczenie: 'Przykładowy Jan', seria: 'A', numery: '1–60', ilosc: 60, glosy: 60 },
    { oznaczenie: 'Przykładowa Anna', seria: 'A', numery: '61–100', ilosc: 40, glosy: 40 },
  ],
};

module.exports = { SZABLONY, AKAPIT_INTEGRALNOSCI, DANE_PROBNE };
