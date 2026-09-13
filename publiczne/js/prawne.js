/* prawne.js — dokumenty, do których prowadzi stopka: polityka prywatności
   i regulamin portalu.

   Ładowany przez OBIE aplikacje (kancelaryjną i portal klienta), bo stopka
   jest w obu ta sama, a odnośnik, który w jednej z nich prowadzi donikąd,
   jest gorszy niż brak odnośnika.

   Treść stoi tutaj, nie w bazie: to dokumenty ustrojowe usługi, zmieniane
   razem z jej działaniem, a nie dane do redagowania z ekranu. Zmienia się je
   przy okazji zmiany tego, co opisują — i wtedy wersja poniżej też rośnie. */

const WERSJA_DOKUMENTOW_PRAWNYCH = '1.0 — wrzesień 2026';

function useKancelariaPrawne() {
  const { dane } = useDane('/api/wspolne/kancelaria');
  return (dane && dane.kancelaria) || {};
}

function adresKancelarii(k) {
  const zAtomow = [
    k.kancelaria_ulica,
    [k.kancelaria_kod, k.kancelaria_miasto].filter(Boolean).join(' ').trim(),
  ].filter(Boolean).join(', ');
  return zAtomow || [k.adres, k.miejscowosc].filter(Boolean).join(', ');
}

/** Wspólna rama dokumentu: tytuł, data wersji, treść w jednej kolumnie. */
function DokumentPrawny({ tytul, wstep, children }) {
  return (
    <div className="dokument-prawny">
      <h1 className="dokument-prawny-tytul">{tytul}</h1>
      <div className="dokument-prawny-wersja">Wersja {WERSJA_DOKUMENTOW_PRAWNYCH}</div>
      {wstep && <p className="dokument-prawny-wstep">{wstep}</p>}
      {children}
      <button className="btn" style={{ marginTop: 'var(--od-24)' }} onClick={() => idz('/')}>
        ← Wróć
      </button>
    </div>
  );
}

function Ustep({ tytul, children }) {
  return (
    <section className="dokument-prawny-ustep">
      <h2>{tytul}</h2>
      {children}
    </section>
  );
}

function EkranPolitykaPrywatnosci() {
  const k = useKancelariaPrawne();
  const adres = adresKancelarii(k);

  return (
    <DokumentPrawny
      tytul="Polityka prywatności"
      wstep={
        'Dokument opisuje, kto i po co przetwarza dane osobowe w portalu rejestru akcjonariuszy '
        + 'prostych spółek akcyjnych oraz jakie prawa przysługują osobom, których te dane dotyczą. '
        + 'Wypełnia obowiązek informacyjny z art. 13 i 14 rozporządzenia (UE) 2016/679 (RODO).'
      }
    >
      <Ustep tytul="1. Administrator danych">
        <p>
          Administratorem danych osobowych jest {k.nazwa || 'kancelaria notarialna prowadząca rejestr'}
          {adres ? `, ${adres}` : ''}
          {k.kancelaria_nip ? `, NIP ${k.kancelaria_nip}` : ''}.
        </p>
        <p>
          W sprawach dotyczących danych osobowych można pisać na adres
          {k.email ? <> <a href={`mailto:${k.email}`}>{k.email}</a></> : ' poczty elektronicznej kancelarii'}
          {k.telefon ? ` albo dzwonić pod numer ${k.telefon}` : ''}.
        </p>
      </Ustep>

      <Ustep tytul="2. Po co przetwarzamy dane">
        <ul>
          <li>
            <strong>Prowadzenie rejestru akcjonariuszy</strong> — zawarcie i wykonanie umowy
            o prowadzenie rejestru oraz dokonywanie w nim wpisów (art. 300<sup>30</sup> i następne
            Kodeksu spółek handlowych).
          </li>
          <li>
            <strong>Obsługa wniosku o prowadzenie rejestru</strong> — zebranie danych spółki,
            osoby reprezentującej ją przy zawarciu umowy oraz akcjonariuszy, przygotowanie
            dokumentów do podpisu i przyjęcie podpisanych skanów.
          </li>
          <li>
            <strong>Obowiązki instytucji obowiązanej</strong> — stosowanie środków bezpieczeństwa
            finansowego wynikających z ustawy o przeciwdziałaniu praniu pieniędzy oraz finansowaniu
            terroryzmu.
          </li>
          <li>
            <strong>Prowadzenie konta w portalu</strong> — uwierzytelnienie, obsługa zgłoszeń
            i wydawanie informacji z rejestru.
          </li>
        </ul>
      </Ustep>

      <Ustep tytul="3. Podstawy prawne">
        <ul>
          <li>art. 6 ust. 1 lit. b) RODO — niezbędność do zawarcia i wykonania umowy;</li>
          <li>
            art. 6 ust. 1 lit. c) RODO — obowiązek prawny ciążący na administratorze, w tym
            obowiązki wynikające z Kodeksu spółek handlowych, Prawa o notariacie oraz przepisów
            o przeciwdziałaniu praniu pieniędzy;
          </li>
          <li>
            art. 6 ust. 1 lit. a) RODO — zgoda, wyłącznie tam, gdzie jej udzielono: zgoda
            akcjonariusza na komunikację przy wykorzystaniu poczty elektronicznej
            (art. 300<sup>33</sup> § 1 pkt 4 Kodeksu spółek handlowych). Zgodę można cofnąć
            w każdej chwili; cofnięcie nie wpływa na czynności dokonane wcześniej.
          </li>
        </ul>
      </Ustep>

      <Ustep tytul="4. Zakres danych">
        <p>
          Dane spółki i jej reprezentanta, dane akcjonariuszy w zakresie stanowiącym treść rejestru
          (nazwisko i imię albo firma, numer PESEL albo data urodzenia, numer w rejestrze i nazwa
          rejestru, adres, a przy wyrażonej zgodzie także adres poczty elektronicznej), dane
          o akcjach i obciążeniach na nich ustanowionych, a także dane kontaktowe konta w portalu
          oraz zapisy o dostępie do rejestru.
        </p>
      </Ustep>

      <Ustep tytul="5. Odbiorcy danych">
        <p>
          Dane udostępniamy wyłącznie tam, gdzie nakazuje to prawo albo gdzie jest to niezbędne do
          prowadzenia rejestru: spółce i akcjonariuszom w zakresie wynikającym
          z art. 300<sup>35</sup> Kodeksu spółek handlowych, sądom i organom uprawnionym na
          podstawie przepisów, a także dostawcom usług technicznych działającym na nasze zlecenie
          i na podstawie umowy powierzenia. Dane nie są przekazywane poza Europejski Obszar
          Gospodarczy.
        </p>
      </Ustep>

      <Ustep tytul="6. Okres przechowywania">
        <p>
          Przez czas prowadzenia rejestru akcjonariuszy, a po jego zakończeniu — przez okres
          wynikający z przepisów o przechowywaniu dokumentów notarialnych oraz z przedawnienia
          roszczeń. Dane zgłoszeń, które nie doprowadziły do zawarcia umowy, usuwamy po
          zakończeniu korespondencji w sprawie.
        </p>
      </Ustep>

      <Ustep tytul="7. Prawa osoby, której dane dotyczą">
        <ul>
          <li>dostęp do danych i otrzymanie ich kopii;</li>
          <li>sprostowanie danych nieprawidłowych i uzupełnienie niekompletnych;</li>
          <li>ograniczenie przetwarzania oraz sprzeciw — w zakresie przewidzianym przepisami;</li>
          <li>
            usunięcie danych — z zastrzeżeniem, że dane stanowiące treść rejestru akcjonariuszy
            przechowujemy na podstawie obowiązku prawnego i nie podlegają one usunięciu na
            żądanie;
          </li>
          <li>wniesienie skargi do Prezesa Urzędu Ochrony Danych Osobowych.</li>
        </ul>
      </Ustep>

      <Ustep tytul="8. Ciasteczka">
        <p>
          Portal używa wyłącznie ciasteczka sesyjnego, które utrzymuje zalogowanie. Jest ono
          niezbędne do działania usługi, nie służy do profilowania i nie jest udostępniane nikomu
          innemu. Nie korzystamy z narzędzi analitycznych ani reklamowych.
        </p>
      </Ustep>

      <Ustep tytul="9. Czy podanie danych jest obowiązkowe">
        <p>
          Podanie danych stanowiących treść rejestru wynika z przepisów prawa — bez nich nie da się
          dokonać wpisu. Podanie adresu poczty elektronicznej akcjonariusza jest dobrowolne
          i wchodzi do rejestru dopiero po złożeniu przez niego podpisanego oświadczenia.
        </p>
      </Ustep>
    </DokumentPrawny>
  );
}

function EkranRegulamin() {
  const k = useKancelariaPrawne();
  const adres = adresKancelarii(k);

  return (
    <DokumentPrawny
      tytul="Regulamin portalu"
      wstep={
        'Regulamin opisuje zasady korzystania z portalu rejestru akcjonariuszy prowadzonego przez '
        + 'kancelarię. Portal jest narzędziem do obsługi rejestru — nie zastępuje umowy '
        + 'o prowadzenie rejestru ani czynności notarialnych.'
      }
    >
      <Ustep tytul="§ 1. Kto prowadzi portal">
        <p>
          Portal prowadzi {k.nazwa || 'kancelaria notarialna'}
          {adres ? `, ${adres}` : ''}
          {k.email ? <>, kontakt: <a href={`mailto:${k.email}`}>{k.email}</a></> : ''}.
        </p>
      </Ustep>

      <Ustep tytul="§ 2. Do czego służy portal">
        <ul>
          <li>złożenie wniosku o prowadzenie rejestru akcjonariuszy prostej spółki akcyjnej;</li>
          <li>pobranie dokumentów do podpisu i odesłanie ich podpisanych skanów;</li>
          <li>podgląd rejestru w zakresie odpowiadającym roli konta;</li>
          <li>zgłaszanie żądań wpisu wraz z dokumentami;</li>
          <li>pobranie informacji z rejestru na wskazany dzień.</li>
        </ul>
      </Ustep>

      <Ustep tytul="§ 3. Konto">
        <p>
          Konta zakłada kancelaria po weryfikacji tożsamości — w portalu nie ma samodzielnej
          rejestracji. Hasło ustawia się z linku aktywacyjnego przesłanego pocztą elektroniczną.
          Hasła nie wolno udostępniać osobom trzecim; o jego ujawnieniu należy niezwłocznie
          powiadomić kancelarię.
        </p>
      </Ustep>

      <Ustep tytul="§ 4. Wniosek i dokumenty">
        <p>
          Za prawdziwość i kompletność danych wpisanych we wniosku odpowiada osoba, która go składa.
          Złożenie wniosku nie jest równoznaczne z zawarciem umowy o prowadzenie rejestru.
          Kancelaria sprawdza dane, przygotowuje komplet dokumentów i udostępnia go do podpisu;
          może też odesłać wniosek do uzupełnienia albo odmówić jego przyjęcia.
        </p>
        <p>
          Dokumenty podpisuje się własnoręcznie, kwalifikowanym podpisem elektronicznym, podpisem
          zaufanym albo osobistym. Skany muszą być czytelne, a podpis widoczny w całości.
        </p>
      </Ustep>

      <Ustep tytul="§ 5. Wpisy w rejestrze">
        <p>
          Wpis następuje na żądanie spółki albo osoby mającej interes prawny, po przedłożeniu
          dokumentów uzasadniających wpis. Podmiot prowadzący rejestr bada treść i formę tych
          dokumentów; nie ma obowiązku badania ich zgodności z prawem ani prawdziwości podpisów,
          chyba że poweźmie w tym względzie uzasadnione wątpliwości (art. 300<sup>34</sup> § 5
          Kodeksu spółek handlowych). Wpisu dokonuje się niezwłocznie, nie później niż w terminie
          tygodnia od otrzymania żądania.
        </p>
      </Ustep>

      <Ustep tytul="§ 6. Opłaty">
        <p>
          Wynagrodzenie kancelarii nie przekracza stawek maksymalnych z rozporządzenia Ministra
          Sprawiedliwości w sprawie maksymalnych stawek taksy notarialnej. Wysokość wynagrodzenia
          i sposób rozliczeń określa umowa o prowadzenie rejestru.
        </p>
      </Ustep>

      <Ustep tytul="§ 7. Dostępność usługi">
        <p>
          Kancelaria dokłada starań, żeby portal działał bez przerw, ale nie gwarantuje
          nieprzerwanej dostępności — możliwe są przerwy techniczne. Niedostępność portalu nie
          wpływa na terminy ustawowe: żądanie wpisu można zawsze złożyć bezpośrednio w kancelarii.
        </p>
      </Ustep>

      <Ustep tytul="§ 8. Reklamacje">
        <p>
          Uwagi dotyczące działania portalu można zgłaszać
          {k.email ? <> na adres <a href={`mailto:${k.email}`}>{k.email}</a></> : ' pocztą elektroniczną'}.
          Odpowiadamy w terminie 14 dni.
        </p>
      </Ustep>

      <Ustep tytul="§ 9. Zmiany regulaminu">
        <p>
          O zmianie regulaminu informujemy pocztą elektroniczną oraz w portalu, z wyprzedzeniem co
          najmniej 14 dni. Zmiany nie naruszają praw nabytych na podstawie zawartych już umów.
        </p>
      </Ustep>
    </DokumentPrawny>
  );
}

/**
 * Trasa dokumentów prawnych, wspólna dla obu aplikacji i dostępna BEZ
 * logowania: prowadzą do niej odnośniki ze stopki, która stoi także pod
 * ekranem logowania. Zwraca `null`, gdy adres jej nie dotyczy — dzięki temu
 * wywołanie w routingu jest jedną linią.
 */
function ekranPrawny(segmenty) {
  if (segmenty[0] === 'polityka-prywatnosci') return <EkranPolitykaPrywatnosci />;
  if (segmenty[0] === 'regulamin') return <EkranRegulamin />;
  return null;
}

/**
 * Sam dokument, w ramie z paskiem marki i stopką — dla gościa, który klika
 * „Regulamin" z ekranu logowania i nie ma jeszcze żadnej powłoki aplikacji.
 */
function StronaPrawna({ children }) {
  const kancelaria = useKancelariaPrawne();
  return (
    <div className="pion" style={{ minHeight: '100vh' }}>
      <div className="marka-pasek bez-druku">
        <div className="marka-pasek-nazwa">{kancelaria.nazwa || 'Kancelaria Notarialna'}</div>
      </div>
      <main className="tresc">{children}</main>
      <StopkaKancelarii kancelaria={kancelaria} />
    </div>
  );
}

window.EkranPolitykaPrywatnosci = EkranPolitykaPrywatnosci;
window.EkranRegulamin = EkranRegulamin;
window.ekranPrawny = ekranPrawny;
window.StronaPrawna = StronaPrawna;
