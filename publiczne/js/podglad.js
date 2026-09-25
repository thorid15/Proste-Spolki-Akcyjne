/* podglad.js — strona `/podglad`: wszystkie komponenty systemu w stanach.
   Sesja SESJA-PSA-6-INTERFEJS.md, faza 1 („Pokaż").

   To nie jest ekran produkcyjny — to katalog systemu wizualnego, po którym
   sprawdza się stany (domyślny, hover, fokus, błąd, wyłączony) bez klikania
   przez całą aplikację. Zostaje w module jako żywa dokumentacja: gdy któryś
   komponent zmieni się w kolejnych fazach, tu widać to od razu. */

function BlokPodgladu({ tytul, opis, children }) {
  return (
    <section style={{ marginBottom: 'var(--od-40)' }}>
      <h2 className="tytul-sekcji" style={{ marginBottom: 'var(--od-4)' }}>{tytul}</h2>
      {opis && <div className="podstawa-prawna" style={{ marginBottom: 'var(--od-16)' }}>{opis}</div>}
      {children}
    </section>
  );
}

function ProbkaKoloru({ token, opis }) {
  return (
    <div>
      <div style={{
        height: 56,
        background: `var(--${token})`,
        border: '1px solid var(--linia)',
        borderRadius: 'var(--r)',
      }} />
      <div className="dane" style={{ marginTop: 'var(--od-4)' }}>--{token}</div>
      <div className="podstawa-prawna">{opis}</div>
    </div>
  );
}

function EkranPodgladu() {
  const [data1, ustawData1] = useState(fmt.dzisIso());
  const [data2, ustawData2] = useState('');
  const [ilosc, ustawIlosc] = useState(1500);
  const [kwota, ustawKwota] = useState(250000);
  const [osoba, ustawOsobe] = useState(null);
  const [modal, ustawModal] = useState(false);
  const [paleta, ustawPaleta] = useState(false);
  const [zakladka, ustawZakladke] = useState('przeglad');
  const [fraza, ustawFraze] = useState('');
  const [strona, ustawStrone] = useState(2);
  const [panel, ustawPanel] = useState(false);
  const [adresPl, ustawAdresPl] = useState({ kraj: 'Polska', ulica: 'Bolesława Leśmiana', nr_domu: '3', nr_lokalu: 'U10', kod_pocztowy: '80-280', miejscowosc: 'Gdańsk' });
  const [adresZagr, ustawAdresZagr] = useState({ kraj: 'Niemcy', ulica: 'Invalidenstraße', nr_domu: '', kod_pocztowy: '10115', miejscowosc: 'Berlin' });
  const [tozsamosc1, ustawTozsamosc1] = useState({ pesel: '44051401359', bez_pesel: 0 });
  const [tozsamosc2, ustawTozsamosc2] = useState({ pesel: '44051401358', bez_pesel: 0 });
  const [tozsamosc3, ustawTozsamosc3] = useState({ pesel: '', bez_pesel: 1, data_urodzenia: '' });
  const [dowod, ustawDowod] = useState({ dowod_rodzaj: 'dowod_osobisty', dowod_numer: 'ABC123456' });
  const [kwotaPusta, ustawKwotePusta] = useState(null);
  const [kwotaMala, ustawKwoteMala] = useState(null);
  const [typOsoby, ustawTypOsoby] = useState('fizyczna');
  const [trybFormularza, ustawTrybFormularza] = useState('portal');
  const [osobaFormularza, ustawOsobeFormularza] = useState(PUSTA_OSOBA_FORMULARZA);
  const walidacjaOsoby = useWalidacjaOsoby(osobaFormularza, { tryb: trybFormularza });
  const [krokKreatora, ustawKrokKreatora] = useState(2);

  return (
    <>
      <BlokPodgladu tytul="Paleta" opis="Jeden kolor = jedno znaczenie w całej aplikacji.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 'var(--od-16)' }}>
          <ProbkaKoloru token="atrament" opis="tekst główny, linie osi" />
          <ProbkaKoloru token="atrament-2" opis="tekst drugorzędny" />
          <ProbkaKoloru token="atrament-3" opis="etykiety, wyciszone" />
          <ProbkaKoloru token="papier" opis="tło aplikacji" />
          <ProbkaKoloru token="karta" opis="powierzchnie" />
          <ProbkaKoloru token="linia" opis="linie, siatka" />
          <ProbkaKoloru token="rejestr" opis="kolor instytucjonalny" />
          <ProbkaKoloru token="rejestr-2" opis="hover, druga warstwa" />
          <ProbkaKoloru token="rejestr-tlo" opis="delikatne tła" />
          <ProbkaKoloru token="mosiadz" opis="czas: playhead, termin, obciążenia" />
          <ProbkaKoloru token="mosiadz-tlo" opis="tło mosiądzu" />
          <ProbkaKoloru token="sygnal" opis="po terminie, odmowa, destrukcja" />
        </div>
      </BlokPodgladu>

      <BlokPodgladu tytul="Typografia" opis="Trzy role, trzy kroje. Skala: 40 / 28 / 20 / 15 / 13 / 11.">
        <Karta>
          <div className="tytul-duzy">Hermes Data &amp; Software Solutions P.S.A.</div>
          <div className="podstawa-prawna" style={{ marginBottom: 'var(--od-16)' }}>
            EB Garamond 40 — nazwy spółek i tytuły ekranów
          </div>
          <div className="tytul-ekranu">Kokpit spółki</div>
          <div className="podstawa-prawna" style={{ marginBottom: 'var(--od-16)' }}>EB Garamond 28</div>
          <div style={{ fontSize: 'var(--st-15)' }}>
            Inter Tight 15 — treść interfejsu, etykiety, przyciski. Rejestr akcjonariuszy
            prowadzony przez notariusza na podstawie art. 300³¹ § 1 KSH.
          </div>
          <div className="rozdzielacz" />
          <div className="dane">AZ 96–100 · KRS 0001114217 · NIP 5842817145 · 12.03.2026 · a3f9c2e1b7d4</div>
          <div className="podstawa-prawna">
            IBM Plex Mono 13 — numery i serie akcji, KRS, NIP, daty w tabelach, skróty łańcucha.
            Zakresy z półpauzą, nie z dywizem.
          </div>
          <div className="rozdzielacz" />
          <div className="liczba" style={{ fontSize: 'var(--st-20)' }}>1 500 akcji · 95,00%</div>
          <div className="podstawa-prawna">Ilości i procenty: Inter Tight z tabular-nums.</div>
        </Karta>
      </BlokPodgladu>

      <BlokPodgladu tytul="Przyciski" opis="Stany: domyślny, hover, fokus (Tab), wyłączony.">
        <Karta>
          <div className="rzad" style={{ flexWrap: 'wrap', marginBottom: 'var(--od-16)' }}>
            <button className="btn btn-glowny">Dokonaj wpisu</button>
            <button className="btn">Anuluj</button>
            <button className="btn btn-sygnal">Odmów wpisu</button>
            <button className="btn btn-cichy">Cichy</button>
          </div>
          <div className="rzad" style={{ flexWrap: 'wrap', marginBottom: 'var(--od-16)' }}>
            <button className="btn btn-glowny btn-duzy">Duży główny</button>
            <button className="btn btn-maly">Mały</button>
          </div>
          <div className="rzad" style={{ flexWrap: 'wrap' }}>
            <button className="btn btn-glowny" disabled>Wyłączony główny</button>
            <button className="btn" disabled>Wyłączony</button>
          </div>
        </Karta>
      </BlokPodgladu>

      <BlokPodgladu
        tytul="Pola"
        opis="Etykieta zawsze nad polem, oznaczamy pola opcjonalne (nie obowiązkowe). Błąd pod polem, podpięty przez aria-describedby. Data segmentowa (wkleja też ISO). Liczby w monie, do prawej, z sufiksem w polu."
      >
        <Karta>
          <div className="siatka-2">
            <div>
              <Pole etykieta="Data zdarzenia" podpowiedz="Data z dokumentu.">
                <PoleDaty wartosc={data1} przyZmianie={ustawData1} skroty max={fmt.dzisIso()} />
              </Pole>

              <Pole
                etykieta="Data z błędem"
                blad="Data zdarzenia nie może być późniejsza niż dzisiaj."
              >
                <PoleDaty wartosc={data2} przyZmianie={ustawData2} blad />
              </Pole>

              <Pole etykieta="Liczba akcji">
                <PoleLiczbowe wartosc={ilosc} przyZmianie={ustawIlosc} sufiks="akcji" min={1} />
              </Pole>

              <Pole etykieta="Cena emisyjna">
                <PoleKwoty grosze={kwota} przyZmianie={ustawKwota} />
              </Pole>
            </div>

            <div>
              <Pole etykieta="Pole tekstowe" podpowiedz="Fokus: obramowanie zielone plus cień.">
                <input type="text" defaultValue="Kancelaria Notarialna Łukasz Kozon" />
              </Pole>

              <Pole etykieta="Pole z błędem" blad="Podaj numer KRS — dziesięć cyfr.">
                <input type="text" className="bledne" defaultValue="00011142" />
              </Pole>

              <Pole etykieta="Pole wyłączone">
                <input type="text" disabled defaultValue="PROSTA SPÓŁKA AKCYJNA" />
              </Pole>

              <Pole etykieta="Lista wyboru">
                <select defaultValue="zwykle">
                  <option value="zwykle">zwykłe</option>
                  <option value="uprzywilejowane">uprzywilejowane</option>
                  <option value="zalozycielskie">założycielskie</option>
                  <option value="nieme">nieme</option>
                </select>
              </Pole>

              <Pole etykieta="Wybór z kartoteki" podpowiedz="Nazwisko, firma, PESEL, NIP albo KRS — od drugiego znaku. Na końcu listy „+ Nowa osoba”.">
                <WyborZKartoteki wartosc={osoba} przyZmianie={ustawOsobe} />
              </Pole>
            </div>
          </div>

          <div className="rozdzielacz" />
          <Pole etykieta="Treść">
            <textarea defaultValue="Umowa sprzedaży akcji z 12 marca 2026 r., podpisy notarialnie poświadczone." />
          </Pole>
          <label className="chk">
            <input type="checkbox" defaultChecked />
            <span className="chk-tresc">
              Dokument stanowiący podstawę wpisu został przedłożony
              <div className="podstawa-prawna">art. 300³⁴ § 1 KSH</div>
            </span>
          </label>
        </Karta>
      </BlokPodgladu>

      <BlokPodgladu
        tytul="Kwota — stany"
        opis="Wpisuje się normalnie (10 · 10,5 · 1 000,00, przecinek albo kropka). Po opuszczeniu pola: 10,00. Więcej niż 2 cyfry po przecinku — komunikat, nie zaokrąglenie (D-045). Na zewnątrz grosze."
      >
        <Karta>
          <div className="siatka-3">
            <Pole etykieta="Pusta" opcjonalne><PoleKwoty grosze={kwotaPusta} przyZmianie={ustawKwotePusta} /></Pole>
            <Pole etykieta="Wypełniona" echo={`w groszach: ${kwota}`}><PoleKwoty grosze={kwota} przyZmianie={ustawKwota} /></Pole>
            <Pole etykieta="Wpisz 0,001 i wyjdź z pola" echo={`w groszach: ${kwotaMala === null ? 'brak' : kwotaMala}`}><PoleKwoty grosze={kwotaMala} przyZmianie={ustawKwoteMala} /></Pole>
          </div>
        </Karta>
      </BlokPodgladu>

      <BlokPodgladu
        tytul="Pola wspólne: adres, tożsamość, dokument, typ osoby"
        opis="Te same komponenty w kartotece, kreatorze i we wniosku klienta (FAZA 1 pkt 2)."
      >
        <Karta>
          <div className="siatka-2">
            <PoleAdres etykieta="Adres — Polska (maska 00-000)" dane={adresPl} przyZmianie={(l) => ustawAdresPl((p) => ({ ...p, ...l }))} idPrefiks="podglad-pl" />
            <PoleAdres
              etykieta="Adres zagraniczny, z błędem"
              dane={adresZagr}
              przyZmianie={(l) => ustawAdresZagr((p) => ({ ...p, ...l }))}
              idPrefiks="podglad-de"
              bledy={{ nr_domu: 'Wpisz numer domu.' }}
            />
          </div>
          <p className="podstawa-prawna">Jeden formatter do widoków i pism: „{formatujAdres(adresPl)}” · „{formatujAdres(adresZagr)}”</p>
          <div className="rozdzielacz" />
          <div className="siatka-3">
            <PoleTozsamosc dane={tozsamosc1} przyZmianie={(l) => ustawTozsamosc1((p) => ({ ...p, ...l }))} idPrefiks="podglad-t1" />
            <PoleTozsamosc dane={tozsamosc2} przyZmianie={(l) => ustawTozsamosc2((p) => ({ ...p, ...l }))} idPrefiks="podglad-t2" />
            <PoleTozsamosc
              dane={tozsamosc3} przyZmianie={(l) => ustawTozsamosc3((p) => ({ ...p, ...l }))} idPrefiks="podglad-t3"
              bledy={{ data_urodzenia: 'Wpisz datę urodzenia — bez numeru PESEL jest obowiązkowa.' }}
            />
          </div>
          <div className="rozdzielacz" />
          <div className="siatka-2">
            <PoleDowod rodzaj={dowod.dowod_rodzaj} numer={dowod.dowod_numer} przyZmianie={(l) => ustawDowod((p) => ({ ...p, ...l }))} idPrefiks="podglad" />
            <WyborTypuOsoby wartosc={typOsoby} przyZmianie={ustawTypOsoby} pytanie="Kto jest akcjonariuszem?" />
          </div>
        </Karta>
      </BlokPodgladu>

      <BlokPodgladu
        tytul="Walidacja (wzorzec GOV.UK)"
        opis="Po opuszczeniu pola, nie przy każdym znaku. Przy próbie przejścia dalej — podsumowanie u góry z odnośnikami do pól."
      >
        <Karta>
          <PodsumowanieBledow
            tytul="Popraw, zanim przejdziesz dalej"
            bledy={[
              { pole: 'podglad-blad-nazwisko', tresc: 'Wpisz nazwisko.' },
              { pole: 'podglad-t3-data_urodzenia', tresc: 'Wpisz datę urodzenia — bez numeru PESEL jest obowiązkowa.' },
            ]}
          />
          <div className="siatka-3">
            <Pole etykieta="Nazwisko" id="podglad-blad-nazwisko" blad="Wpisz nazwisko."><input type="text" /></Pole>
            <Pole etykieta="PESEL" ostrzezenie="Suma kontrolna numeru PESEL się nie zgadza — sprawdź numer z dokumentem."><input type="text" defaultValue="44051401358" /></Pole>
            <Pole etykieta="Telefon" opcjonalne><input type="tel" /></Pole>
          </div>
        </Karta>
      </BlokPodgladu>

      <BlokPodgladu
        tytul="Formularz osoby — wspólny dla kartoteki i portalu"
        opis="Jeden FormularzOsoby; tryb decyduje o polach zależnych od roli. Kancelaria dokłada pod nim AML i notatki (panel boczny kartoteki)."
      >
        <Karta>
          <div className="rzad" style={{ marginBottom: 'var(--od-16)' }}>
            <Zakladki
              zakladki={[{ kod: 'portal', nazwa: 'Portal klienta' }, { kod: 'kancelaria', nazwa: 'Kancelaria' }]}
              biezaca={trybFormularza}
              przyZmianie={ustawTrybFormularza}
            />
            <button type="button" className="btn btn-maly" onClick={walidacjaOsoby.pokazWszystkie}>Pokaż wszystkie błędy</button>
            <button type="button" className="btn btn-maly" onClick={() => ustawPanel(true)}>Otwórz panel boczny kartoteki</button>
          </div>
          {walidacjaOsoby.pokazywaneWszystkie && (
            <PodsumowanieBledow bledy={listaBledowOsoby(walidacjaOsoby.widoczne, 'podglad-osoba')} />
          )}
          <FormularzOsoby
            dane={osobaFormularza}
            przyZmianie={(l) => ustawOsobeFormularza((p) => ({ ...p, ...l }))}
            tryb={trybFormularza}
            bledy={walidacjaOsoby.widoczne}
            przyOpuszczeniu={walidacjaOsoby.dotknij}
            idPrefiks="podglad-osoba"
          />
        </Karta>
      </BlokPodgladu>

      <BlokPodgladu tytul="Statusy, liczniki, ładowanie" opis="Wszystko na Pigulce. Licznik = sprawy wymagające działania. Szkielet zamiast spinnera.">
        <Karta>
          <div className="rzad" style={{ flexWrap: 'wrap', marginBottom: 'var(--od-16)' }}>
            {Object.keys(NAZWY_STATUSU).map((st) => <StatusSpolki key={st} status={st} />)}
            <StatusAml status="brak" /><StatusAml status="wykonane" /><StatusAml status="niemozliwe" />
            <ZnacznikPrzegladuAml wymaga />
          </div>
          <div className="rzad" style={{ marginBottom: 'var(--od-16)' }}>
            <span className="szyna-poz" style={{ maxWidth: 220 }}>Wnioski <Licznik wartosc={3} opis="wniosków do weryfikacji" /></span>
            <span className="szyna-poz" style={{ maxWidth: 220 }}>Zgłoszenia <Licznik wartosc={0} /></span>
          </div>
          <Wyniki bledy={['Zbywca nie ma tylu akcji w tej serii.']} ostrzezenia={['Akcjonariusz nie ma potwierdzonej procedury AML.']} />
          <Spinner />
        </Karta>
      </BlokPodgladu>

      <BlokPodgladu tytul="Kreator: kroki klikalne i przyciski" opis="Wstecz zawsze, do przodu do kroków już ukończonych. Wyłączony przycisk mówi, dlaczego. Etykieta = skutek.">
        <Karta>
          <Kroki kroki={['Spółka', 'Umowa', 'Pierwsza emisja', 'Weryfikacja']} biezacy={krokKreatora} osiagniety={3} przyWyborze={ustawKrokKreatora} />
          <NawigacjaKreatora
            wstecz={{ etykieta: 'Wstecz', przy: () => ustawKrokKreatora((k) => Math.max(0, k - 1)) }}
            dalej={{ etykieta: 'Otwórz rejestr', wylaczony: true, powod: 'Brakuje daty wpisu emisji do KRS — uzupełnij ją w kroku „Pierwsza emisja”.' }}
          />
        </Karta>
      </BlokPodgladu>

      <BlokPodgladu tytul="Pigułki i komunikaty" opis="Kolor niesie znaczenie — nie dekoruje.">
        <Karta>
          <div className="rzad" style={{ flexWrap: 'wrap', marginBottom: 'var(--od-24)' }}>
            <Pigulka>neutralna</Pigulka>
            <Pigulka odmiana="rejestr">wpisana</Pigulka>
            <Pigulka odmiana="mosiadz">pozostały 2 dni</Pigulka>
            <Pigulka odmiana="sygnal">po terminie</Pigulka>
          </div>
          <Komunikat odmiana="info" tresc="Numery akcji przydziela aplikacja — podajesz wyłącznie ilość." />
          <Komunikat odmiana="rejestr" tresc="Treść gotowa do wpisu." />
          <Komunikat
            odmiana="uwaga"
            tytul="Akcje wyemitowane, a jeszcze nieobjęte"
            tresc="5 akcji czeka na wpis objęcia."
          />
          <Komunikat
            odmiana="blad"
            tytul="Wpis nie może zostać dokonany — przeszkody:"
            lista={[
              'Emisja nie ma daty wpisu do KRS — objęcie akcji jest zablokowane (art. 300³⁰ § 2 KSH).',
              'Zbywca nie ma tylu akcji w tej serii.',
            ]}
          />
        </Karta>
      </BlokPodgladu>

      <BlokPodgladu tytul="Tabela" opis="Nagłówek przyklejony, wiersz 44 px, bez zebry, cały wiersz odnośnikiem.">
        <Karta scisla>
          <table className="tabela">
            <thead>
              <tr>
                <th>Akcjonariusz</th>
                <th>Seria</th>
                <th className="do-prawej">Liczba akcji</th>
                <th>Numery</th>
                <th className="do-prawej">Udział</th>
                <th>Obciążenia</th>
              </tr>
            </thead>
            <tbody>
              <tr className="klikalna">
                <td>Grabski Jędrzej</td>
                <td className="kol-dane">AZ</td>
                <td className="do-prawej">95</td>
                <td className="kol-dane">1–95</td>
                <td className="do-prawej">95,00%</td>
                <td><span className="wyciszony">—</span></td>
              </tr>
              <tr className="klikalna">
                <td>Grabska Izabella</td>
                <td className="kol-dane">AZ</td>
                <td className="do-prawej">5</td>
                <td className="kol-dane">96–100</td>
                <td className="do-prawej">5,00%</td>
                <td><Pigulka odmiana="mosiadz">zastaw 96–97</Pigulka></td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>Razem</td>
                <td className="do-prawej">100</td>
                <td />
                <td className="do-prawej">100%</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </Karta>
      </BlokPodgladu>

      <BlokPodgladu tytul="Kroki, sekcje, pusty stan">
        <Kroki kroki={['Spółka', 'Umowa', 'Pierwsza emisja', 'Weryfikacja']} biezacy={2} />
        <Sekcja tytul="Emisje" licznik={2}>
          <div style={{ padding: 'var(--od-16) var(--od-24)' }}>Treść sekcji.</div>
        </Sekcja>
        <Sekcja tytul="Historia zdarzeń" licznik={12} domyslnieOtwarta>
          <div style={{ padding: 'var(--od-16) var(--od-24)' }}>Sekcja domyślnie otwarta.</div>
        </Sekcja>
        <Karta>
          <Pusto
            tytul="Kolejka jest pusta"
            opis="Nowe sprawy zakładasz z kokpitu spółki, przyciskiem „Nowe zdarzenie”."
            akcja={<button className="btn btn-glowny">Przejdź do spółek</button>}
          />
        </Karta>
      </BlokPodgladu>

      <BlokPodgladu tytul="Kafle statystyk" opis="Jeden odcień kafelka ikony dla wszystkich — kolor tutaj nic by nie znaczył.">
        <div className="kafle">
          <Kafel etykieta="Prowadzone rejestry" wartosc="24" delta="bilans akcji zgodny" deltaOdmiana="dodatnia" ikona="spolki" />
          <Kafel etykieta="Sprawy w toku" wartosc="7" delta="2 pilne" deltaOdmiana="uwaga" ikona="sprawy" />
          <Kafel etykieta="Akcjonariusze" wartosc="156" delta="212 osób w kartotece" ikona="osoby" />
          <Kafel etykieta="Zdarzenia rejestrowe" wartosc="1 204" delta="łańcuch nieprzerwany" deltaOdmiana="dodatnia" ikona="zdarzenie" />
        </div>
      </BlokPodgladu>

      <BlokPodgladu tytul="Wiersze listy" opis="Wiersz jest celem kliknięcia, nie siatką do czytania.">
        <Karta scisla tytul="Sprawy w toku" akcje={<button className="karta-link">Cała kolejka</button>}>
          <div className="lista-wierszy">
            <WierszListy
              ikona="zdarzenie" tytul="Przeniesienie akcji" podtytul="HERMES DATA & SOFTWARE SOLUTIONS P.S.A."
              przyKlik={() => {}} data="22.05.2026"
              prawo={<><Pigulka>w weryfikacji</Pigulka><Pigulka odmiana="mosiadz">2 dz.</Pigulka></>}
            />
            <WierszListy
              ikona="akcje" tytul="Emisja akcji" podtytul="Innovate P.S.A."
              przyKlik={() => {}} data="20.05.2026"
              prawo={<><Pigulka>nowa</Pigulka><Pigulka odmiana="sygnal">po terminie</Pigulka></>}
            />
            <WierszListy
              ikona="ostrzezenie" tytul="Zastaw na akcjach" podtytul="Future Investments P.S.A."
              przyKlik={() => {}} data="18.05.2026"
              prawo={<Pigulka odmiana="rejestr">wpisana</Pigulka>}
            />
          </div>
        </Karta>
      </BlokPodgladu>

      <BlokPodgladu tytul="Zakładki, metryka, pasek narzędzi">
        <Karta>
          <Zakladki
            zakladki={[
              { kod: 'przeglad', nazwa: 'Przegląd' },
              { kod: 'akcjonariusze', nazwa: 'Akcjonariusze', licznik: 12 },
              { kod: 'akcje', nazwa: 'Akcje' },
              { kod: 'historia', nazwa: 'Historia zmian', licznik: 4 },
            ]}
            biezaca={zakladka}
            przyZmianie={ustawZakladke}
          />
          <Metryka
            pozycje={[
              { etykieta: 'Numer KRS', wartosc: '0001114217', dane: true },
              { etykieta: 'NIP', wartosc: '5842817145', dane: true },
              { etykieta: 'Siedziba', wartosc: 'Gdańsk' },
              { etykieta: 'Umowa o prowadzenie rejestru', wartosc: '26.07.2024', dane: true },
              { etykieta: 'Akcje w obrocie', wartosc: '100' },
            ]}
          />
          <div className="rozdzielacz" />
          <div className="pasek-narzedzi" style={{ marginBottom: 0 }}>
            <Szukajka wartosc={fraza} przyZmianie={ustawFraze} placeholder="Szukaj spółki…" />
            <select defaultValue="wszystkie">
              <option value="wszystkie">Status: wszystkie</option>
              <option value="aktywna">aktywna</option>
            </select>
          </div>
        </Karta>
      </BlokPodgladu>

      <BlokPodgladu tytul="Stronicowanie i wykres iskrowy">
        <Karta scisla>
          <div style={{ padding: 'var(--od-24)' }}>
            <div className="etykieta" style={{ marginBottom: 'var(--od-8)' }}>Zdarzenia w ostatnich tygodniach</div>
            <Iskra punkty={[4, 6, 5, 9, 7, 12, 10, 14, 11, 16, 15, 19]} podpisy={['22 kwi', '20 maj']} />
          </div>
          <Stronicowanie strona={strona} stron={5} odPozycji={(strona - 1) * 12 + 1} doPozycji={strona * 12} razem={58} przyZmianie={ustawStrone} />
        </Karta>
      </BlokPodgladu>

      <BlokPodgladu tytul="Karta wyróżniona i szybkie akcje">
        <div className="siatka-2">
          <Karta tytul="Szybkie akcje">
            <SzybkieAkcje
              akcje={[
                { nazwa: 'Dodaj spółkę', ikona: 'spolki', przyKlik: () => {} },
                { nazwa: 'Dodaj osobę do kartoteki', ikona: 'osoby', przyKlik: () => {} },
                { nazwa: 'Przejdź do kolejki spraw', ikona: 'sprawy', przyKlik: () => {} },
              ]}
            />
          </Karta>
          <div className="karta-akcent">
            <div className="karta-akcent-tytul">Rejestru nie da się cofnąć</div>
            <div className="karta-akcent-tresc">
              Każde zdarzenie niesie skrót poprzedniego — realizacja obowiązku
              z art. 300³¹ § 4 KSH.
            </div>
            <button className="btn btn-maly">Zobacz rejestry</button>
          </div>
        </div>
      </BlokPodgladu>

      <BlokPodgladu tytul="Ikony" opis="Rysowane ręcznie, jedna siatka 24×24, kolor dziedziczony.">
        <Karta>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))', gap: 'var(--od-16)' }}>
            {Object.keys(SCIEZKI_IKON).map((n) => (
              <div key={n} style={{ textAlign: 'center' }}>
                <div className="wiersz-ikona" style={{ margin: '0 auto var(--od-4)' }}>
                  <Ikona nazwa={n} rozmiar={18} />
                </div>
                <div className="podstawa-prawna">{n}</div>
              </div>
            ))}
          </div>
        </Karta>
      </BlokPodgladu>

      <BlokPodgladu tytul="Nakładki">
        <Karta>
          <div className="rzad">
            <button className="btn" onClick={() => ustawModal(true)}>Otwórz modal</button>
            <button className="btn" onClick={() => ustawPaleta(true)}>Otwórz paletę poleceń</button>
            <span className="podstawa-prawna">Paleta również skrótem <span className="klawisz">Ctrl</span>+<span className="klawisz">K</span></span>
          </div>
        </Karta>
      </BlokPodgladu>

      {modal && (
        <Modal
          tytul="Sprostowanie zdarzenia #12"
          przyZamknieciu={() => ustawModal(false)}
          stopka={
            <>
              <button className="btn" onClick={() => ustawModal(false)}>Anuluj</button>
              <button className="btn btn-glowny">Zapisz sprostowanie</button>
            </>
          }
        >
          <Komunikat
            odmiana="info"
            tresc="Rejestr jest niezmienialny — sprostowanie jest nowym zdarzeniem wskazującym zdarzenie prostowane."
          />
          <Pole etykieta="Uzasadnienie">
            <textarea autoFocus />
          </Pole>
        </Modal>
      )}

      {paleta && <PaletaPolecen przyZamknieciu={() => ustawPaleta(false)} />}
      {panel && <PanelOsoby przyZamknieciu={() => ustawPanel(false)} przyZapisie={() => ustawPanel(false)} />}
    </>
  );
}

window.EkranPodgladu = EkranPodgladu;
