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

  return (
    <>
      <NaglowekStrony
        tytul="Podgląd systemu"
        kontekst="Katalog komponentów modułu — paleta, typografia, pola, tabele i stany."
      />

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
        opis="Etykieta zawsze nad polem. Data segmentowa z potwierdzeniem słownym. Liczby w monie, do prawej, z sufiksem w polu."
      >
        <Karta>
          <div className="siatka-2">
            <div>
              <Pole etykieta="Data zdarzenia" wymagane podpowiedz="Data z dokumentu.">
                <PoleDaty wartosc={data1} przyZmianie={ustawData1} skroty max={fmt.dzisIso()} />
              </Pole>

              <Pole
                etykieta="Data z błędem"
                blad="Data zdarzenia nie może być późniejsza niż dzisiaj."
              >
                <PoleDaty wartosc={data2} przyZmianie={ustawData2} blad />
              </Pole>

              <Pole etykieta="Liczba akcji" wymagane>
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

              <Pole etykieta="Wybór z kartoteki" podpowiedz="Podpowiedzi od trzeciego znaku.">
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
          <Pole etykieta="Uzasadnienie" wymagane>
            <textarea autoFocus />
          </Pole>
        </Modal>
      )}

      {paleta && <PaletaPolecen przyZamknieciu={() => ustawPaleta(false)} />}
    </>
  );
}

window.EkranPodgladu = EkranPodgladu;
