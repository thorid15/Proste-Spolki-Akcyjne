/* sprawy.js — kolejka spraw i kokpit sprawy (sekcja 7 i 9 specyfikacji).

   Kroki 3–4 kreatora są tu OSADZONE (dispatch przez KROKI_TRESCI z kreator.js)
   — ta sama ścieżka obsługuje zarówno świeżo założoną sprawę (przyjście
   wprost z EkranNowejSprawy), jak i wznowienie sprawy z kolejki, z
   zachowanym roboczym stanem (`dane_wejsciowe_json`). */

const NAZWY_STANU_SPRAWY = {
  nowa: 'nowa', weryfikacja: 'w weryfikacji', wstrzymana: 'wstrzymana',
  wpisana: 'wpisana', odmowa: 'odmowa', anulowana: 'anulowana',
};
const ODMIANY_STANU_SPRAWY = {
  nowa: 'neutralna', weryfikacja: 'neutralna', wstrzymana: 'mosiadz',
  wpisana: 'rejestr', odmowa: 'sygnal', anulowana: 'neutralna',
};

/* Charakter żądającego (art. 300(34) § 1 KSH) — lustro słownika z
   server/logika/przepisy.js. Trzymamy własną kopię etykiet, bo widok sprawy
   nie pobiera katalogu reguł. */
const OPISY_ROL_ZADAJACEGO = {
  akcjonariusz: 'akcjonariusz',
  zbywca: 'zbywca akcji',
  nabywca: 'nabywca akcji',
  zastawnik: 'zastawnik',
  uzytkownik: 'użytkownik akcji',
  uprawniony_do_zaskarzenia: 'uprawniony do zaskarżenia uchwały walnego zgromadzenia',
  spolka: 'spółka',
  inna: 'inna osoba mająca interes prawny',
};

/* Przyczyna niedokonania wpisu (art. 300(34) § 7 zd. 2 KSH) — lustro
   server/logika/przepisy.js:OPISY_PRZYCZYN_ODMOWY_WPISU. */
const OPISY_PRZYCZYN_ODMOWY_WPISU = {
  brak_dokumentow: 'nie przedłożono dokumentów uzasadniających wpis',
  dokumenty_nie_potwierdzaja: 'dokumenty nie potwierdzają zdarzenia będącego podstawą wpisu',
  watpliwosci_co_do_tresci: 'treść lub forma dokumentów budzi uzasadnione wątpliwości',
  niezgodnosc_z_rejestrem: 'żądanie jest niezgodne z dotychczasową treścią rejestru',
  przeszkoda_nieusunieta: 'nie usunięto przeszkody wskazanej w wezwaniu',
  brak_aml: 'nie można zastosować środków bezpieczeństwa finansowego (AML)',
  inna: 'inna przyczyna',
};
const PRZYCZYNA_ODMOWY_WYMAGA_OPISU = 'inna';

/** Widok sprawy — pełniejszy niż pigułka w kolejce: nazywa oba zegary wprost. */
function ZnacznikTerminu({ termin }) {
  if (termin.zamrozony) return <Pigulka odmiana="mosiadz">termin zawieszony</Pigulka>;
  if (termin.po_terminie) return <Pigulka odmiana="sygnal">po terminie ustawowym</Pigulka>;
  if (termin.po_celu) {
    return (
      <Pigulka odmiana="mosiadz">
        po celu wewnętrznym · do terminu ustawowego {termin.dni_pozostale} dz.
      </Pigulka>
    );
  }
  return (
    <Pigulka odmiana="neutralna">
      do celu {termin.dni_do_celu} dz. · do terminu ustawowego {termin.dni_pozostale} dz.
    </Pigulka>
  );
}

/* Starzenie sprawy niesie teraz pigułka terminu w wierszu (`TerminPigulka`
   z pulpit.js) — mosiądz dla pilnych, czerwień wyłącznie po terminie.
   Pasek przy krawędzi wiersza zniknął razem z tabelą kolejki. */

/* ─────────────────────────────────────────────────────
   KOLEJKA
   ───────────────────────────────────────────────────── */
function EkranKolejkiSpraw({ spolkaId }) {
  const [pokazZakonczone, ustawPokazZakonczone] = useParametrAdresu('zakonczone', false);
  const [szukaj, ustawSzukaj] = useParametrAdresu('q', '');
  const parametry = new URLSearchParams();
  if (pokazZakonczone) parametry.set('stan', 'wpisana,odmowa,anulowana');
  if (spolkaId) parametry.set('spolka_id', spolkaId);
  const { dane, ladowanie } = useDane(`/api/psa/sprawy?${parametry.toString()}`, [pokazZakonczone, spolkaId]);

  const wszystkie = (dane && dane.sprawy) || [];
  const fraza = szukaj.trim().toLowerCase();
  const sprawy = fraza
    ? wszystkie.filter(
        (s) =>
          (s.spolka_nazwa || '').toLowerCase().includes(fraza) ||
          (s.typ_nazwa || '').toLowerCase().includes(fraza)
      )
    : wszystkie;

  return (
    <>
      {spolkaId && wszystkie.length > 0 && (
        <div className="pasek-narzedzi">
          <Pigulka odmiana="rejestr">Tylko: {wszystkie[0].spolka_nazwa}</Pigulka>
          <button className="btn btn-sm" onClick={() => idz('/sprawy')} style={{ marginLeft: 'auto' }}>
            Pokaż wszystkie sprawy
          </button>
        </div>
      )}
      <div className="pasek-narzedzi">
        <Szukajka wartosc={szukaj} przyZmianie={ustawSzukaj} placeholder="Szukaj po spółce albo rodzaju zdarzenia…" />
        <select
          aria-label="Filtruj sprawy wg stanu"
          value={pokazZakonczone ? 'zakonczone' : 'wtoku'}
          onChange={(z) => ustawPokazZakonczone(z.target.value === 'zakonczone')}
        >
          <option value="wtoku">Sprawy w toku</option>
          <option value="zakonczone">Sprawy zakończone</option>
        </select>
        <span className="podstawa-prawna" style={{ marginLeft: 'auto' }}>
          {fmt.liczba(sprawy.length)} {fmt.odmien(sprawy.length, 'sprawa', 'sprawy', 'spraw')}
        </span>
      </div>

      {ladowanie ? (
        <Spinner />
      ) : sprawy.length === 0 ? (
        <Karta>
          <Pusto
            ikona={pokazZakonczone ? 'archiwum' : 'sprawdz'}
            tytul={
              fraza
                ? 'Nic nie pasuje do wyszukiwania'
                : pokazZakonczone
                ? 'Brak zakończonych spraw'
                : 'Kolejka jest pusta'
            }
            opis={
              fraza
                ? 'Zmień frazę albo przełącz się na inny zbiór spraw.'
                : pokazZakonczone
                ? 'Sprawy zakończone pojawią się tu po pierwszym wpisie albo odmowie.'
                : 'Żadna sprawa nie czeka na wpis. Nowe zakładasz z kokpitu spółki.'
            }
            akcja={
              !fraza && !pokazZakonczone ? (
                <button className="btn" onClick={() => idz('/spolki')}>Przejdź do spółek</button>
              ) : null
            }
          />
        </Karta>
      ) : (
        <Karta scisla>
          <div className="lista-wierszy">
            {sprawy.map((s) => (
              <WierszListy
                key={s.id}
                ikona={IKONY_ZDARZEN[s.typ_zdarzenia] || 'sprawy'}
                tytul={nazwaCzynnosci(s.typ_zdarzenia, s.typ_nazwa)}
                podtytul={`${s.spolka_nazwa} · ${s.zrodlo === 'z_urzedu' ? 'z urzędu' : s.zrodlo}`}
                przyKlik={() => idz(`/sprawy/${s.id}`)}
                prawo={
                  <>
                    {/* Z-202/P-014: sygnal, nie blokada - sprawa idzie dalej normalnie. */}
                    <ZnacznikPrzegladuAml wymaga={s.zadajacy_wymaga_przegladu_aml} />
                    <Pigulka odmiana={s.stan === 'wpisana' ? 'rejestr' : s.stan === 'odmowa' ? 'sygnal' : undefined}>
                      {NAZWY_STANU_SPRAWY[s.stan] || s.stan}
                    </Pigulka>
                    {!['wpisana', 'odmowa', 'anulowana'].includes(s.stan) && <TerminPigulka termin={s.termin} />}
                  </>
                }
                data={fmt.data(s.data_wplywu)}
              />
            ))}
          </div>
        </Karta>
      )}
    </>
  );
}

/* ─────────────────────────────────────────────────────
   DOKUMENTY
   ───────────────────────────────────────────────────── */
/**
 * Dokumenty sprawy. Zalaczniki przychodza z portalu klienta razem ze
 * zgloszeniem — pracownik dosyla plik tylko WYJATKOWO (papier z poczty,
 * dokument z innego zrodla), wiec pole na plik siedzi za przyciskiem,
 * a nie stoi otwarte pod lista i nie pyta, „jaki to dokument", skoro
 * pracownik i tak go otwiera i czyta.
 */
function PanelDokumentow({ sprawaId, dokumenty, odswiez }) {
  const [dosylanie, ustawDosylanie] = useState(false);
  const [wysylanie, ustawWysylanie] = useState(false);
  const [blad, ustawBlad] = useState(null);
  const wejscie = useRef(null);

  async function wgraj(zdarzenie) {
    const pliki = [...zdarzenie.target.files];
    if (pliki.length === 0) return;
    ustawWysylanie(true);
    ustawBlad(null);
    try {
      const formularz = new FormData();
      formularz.append('typ_dokumentu', 'inny');
      for (const plik of pliki) formularz.append('pliki', plik);
      const odp = await fetch(`/api/psa/sprawy/${sprawaId}/dokumenty`, { method: 'POST', body: formularz });
      if (!odp.ok) {
        const tresc = await odp.json();
        throw new Error(tresc.blad || `Błąd ${odp.status}`);
      }
      ustawDosylanie(false);
      odswiez();
    } catch (e) {
      ustawBlad(e.message);
    } finally {
      ustawWysylanie(false);
      zdarzenie.target.value = '';
    }
  }

  return (
    <Sekcja tytul="Dokumenty" licznik={dokumenty.length} domyslnieOtwarta>
      <div style={{ padding: '18px 24px' }}>
        <Komunikat odmiana="blad" tresc={blad} />
        {dokumenty.length === 0 ? (
          <div className="przyciemnione" style={{ marginBottom: 16 }}>Brak wgranych dokumentów.</div>
        ) : (
          <table className="tbl" style={{ marginBottom: 16 }}>
            <thead><tr><th>Plik</th><th>Typ</th><th>Wgrał</th><th>Data</th></tr></thead>
            <tbody>
              {dokumenty.map((d) => (
                <tr key={d.id}>
                  <td>
                    <a href={`/api/psa/sprawy/${sprawaId}/dokumenty/${d.id}`} target="_blank" rel="noreferrer">
                      {nazwaPlikuDoWyswietlenia({ nazwaOryginalna: d.nazwa_pliku, rodzaj: d.typ_dokumentu, data: d.utworzono })}
                    </a>
                  </td>
                  <td className="przyciemnione">{d.typ_dokumentu}</td>
                  <td className="przyciemnione">{d.wgral}</td>
                  <td className="przyciemnione">{fmt.data(d.utworzono)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="row-g">
          <input
            ref={wejscie}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            className="pole-pliku-ukryte" aria-label="Plik do wgrania"
            disabled={wysylanie}
            onChange={wgraj}
          />
          <button
            type="button"
            className="btn btn-maly"
            disabled={wysylanie}
            onClick={() => {
              ustawDosylanie(true);
              if (wejscie.current) wejscie.current.click();
            }}
          >
            {wysylanie ? 'Wysyłanie…' : 'Dołącz dokument'}
          </button>
          {dosylanie && !wysylanie && (
            <span className="przyciemnione male">Plik trafi do akt tej sprawy.</span>
          )}
        </div>
      </div>
    </Sekcja>
  );
}

/* ─────────────────────────────────────────────────────
   AKCJE WORKFLOW (wstrzymaj / wznów / odmów / anuluj)
   ───────────────────────────────────────────────────── */
/**
 * Okno z powodem. `minDlugosc` — ta sama granica co na serwerze (przycisk aktywny dopiero po niej).
 * Błąd z `przyZapisie` (rzucony wyjątek) zostaje w oknie razem z wpisanym tekstem.
 */
/** `akcja` — nazwa czynności na przycisku potwierdzenia (ta sama co przycisk, który otworzył okno). */
function ModalPowod({ tytul, etykieta, przyZamknieciu, przyZapisie, minDlugosc = 1, akcja = 'Potwierdź', zamknij = 'Anuluj' }) {
  const [powod, ustawPowod] = useState('');
  const [blad, ustawBlad] = useState(null);
  const [zapis, ustawZapis] = useState(false);
  const zaKrotki = powod.trim().length < minDlugosc;
  async function zatwierdz() {
    ustawBlad(null);
    ustawZapis(true);
    try {
      await przyZapisie(powod.trim());
    } catch (e) {
      ustawBlad(e.message || 'Nie udało się zapisać.');
    } finally {
      ustawZapis(false);
    }
  }
  return (
    <Modal
      tytul={tytul}
      przyZamknieciu={przyZamknieciu}
      stopka={
        <>
          <button className="btn" onClick={przyZamknieciu}>{zamknij}</button>
          <button className="btn btn-glowny" disabled={zaKrotki || zapis} onClick={zatwierdz}>
            {akcja}
          </button>
        </>
      }
    >
      <Komunikat odmiana="blad" tresc={blad} />
      <Pole etykieta={etykieta} wymagane podpowiedz={minDlugosc > 1 ? `Co najmniej ${minDlugosc} znaków.` : undefined}>
        <textarea value={powod} onChange={(z) => ustawPowod(z.target.value)} autoFocus />
      </Pole>
    </Modal>
  );
}

/** Wstrzymanie — przeszkoda, sposób jej usunięcia i termin (wzór 06, blok A3 sesji 8). */
function ModalWstrzymania({ przyZamknieciu, przyZapisie }) {
  const [powod, ustawPowod] = useState('');
  const [sposobUsuniecia, ustawSposobUsuniecia] = useState('');
  const [terminUsuniecia, ustawTerminUsuniecia] = useState('');

  return (
    <Modal
      tytul="Wstrzymanie sprawy"
      przyZamknieciu={przyZamknieciu}
      stopka={
        <>
          <button className="btn" onClick={przyZamknieciu}>Anuluj</button>
          <button
            className="btn btn-glowny"
            disabled={!powod.trim()}
            onClick={() => przyZapisie({
              powod: powod.trim(),
              sposob_usuniecia: sposobUsuniecia.trim() || null,
              termin_usuniecia: terminUsuniecia || null,
            })}
          >
            Wstrzymaj sprawę
          </button>
        </>
      }
    >
      <Pole etykieta="Przeszkoda uniemożliwiająca wpis" wymagane>
        <textarea value={powod} onChange={(z) => ustawPowod(z.target.value)} autoFocus />
      </Pole>
      <Pole
        etykieta="Sposób usunięcia przeszkody (opcjonalnie)"
        podpowiedz="Co konkretnie ma dostarczyć żądający — trafia wprost do wezwania."
      >
        <textarea value={sposobUsuniecia} onChange={(z) => ustawSposobUsuniecia(z.target.value)} />
      </Pole>
      <Pole
        etykieta="Termin usunięcia (opcjonalnie)"
        podpowiedz="Przepisy nie narzucają liczby dni — termin wskazuje notariusz."
      >
        <PoleDaty wartosc={terminUsuniecia} przyZmianie={ustawTerminUsuniecia} />
      </Pole>
    </Modal>
  );
}

/** Odmowa wpisu — przyczyna z katalogu zamkniętego (blok B5 sesji 8), opis
    obowiązkowy tylko przy „inna”, bo tam sam kod nic nie mówi. */
function ModalOdmowy({ przyZamknieciu, przyZapisie }) {
  const [kod, ustawKod] = useState('');
  const [opis, ustawOpis] = useState('');
  const wymagaOpisu = kod === PRZYCZYNA_ODMOWY_WYMAGA_OPISU;

  return (
    <Modal
      tytul="Odmowa wpisu"
      przyZamknieciu={przyZamknieciu}
      stopka={
        <>
          <button className="btn" onClick={przyZamknieciu}>Anuluj</button>
          <button
            className="btn btn-glowny"
            disabled={!kod || (wymagaOpisu && !opis.trim())}
            onClick={() => przyZapisie({ powod_odmowy_kod: kod, powod_odmowy: opis.trim() })}
          >
            Odmów wpisu
          </button>
        </>
      }
    >
      <Pole etykieta="Przyczyna odmowy (art. 300(34) § 7 zd. 2 KSH)" wymagane>
        <select value={kod} onChange={(z) => ustawKod(z.target.value)} autoFocus>
          <option value="" disabled>wybierz przyczynę…</option>
          {Object.entries(OPISY_PRZYCZYN_ODMOWY_WPISU).map(([k, etykieta]) => (
            <option key={k} value={k}>{etykieta}</option>
          ))}
        </select>
      </Pole>
      <Pole
        etykieta={wymagaOpisu ? 'Opis przyczyny' : 'Dodatkowy opis (opcjonalnie)'}
        wymagane={wymagaOpisu}
        podpowiedz="Trafia w piśmie wprost pod nazwę przyczyny."
      >
        <textarea value={opis} onChange={(z) => ustawOpis(z.target.value)} />
      </Pole>
    </Modal>
  );
}

/**
 * R4 K1: wszystkie akcje sprawy w jednym pasku (PasekAkcji) — podstawa wpisu i żądanie wpisu jako
 * drugorzędne, przycisk główny zależny od stanu (rozpocznij weryfikację / wznów).
 */
function PasekAkcjiSprawy({ sprawa, odswiez, zakonczona, przyZmianieTypu, przyZadaniu }) {
  const [modal, ustawModal] = useState(null);
  const [bladAkcji, ustawBladAkcji] = useState(null);

  async function wykonaj(akcja, dodatkowe) {
    ustawBladAkcji(null);
    try {
      await API.patch(`/api/psa/sprawy/${sprawa.id}`, { akcja, ...dodatkowe });
      ustawModal(null);
      odswiez();
    } catch (e) {
      ustawBladAkcji(e.message);
    }
  }

  const stan = sprawa.stan;
  const akcje = [
    // D-097: podstawa wpisu to krok 2 kreatora, a weryfikacja zaczyna się sama (D-098). Rodzaj wpisu zmienia się
    // tylko w sprawie z portalu — klient wybiera grupę, czynność kwalifikuje pracownik (A-006).
    !zakonczona && sprawa.zrodlo === 'portal' && { etykieta: 'Zmień rodzaj wpisu', przyKlik: przyZmianieTypu },
    { etykieta: 'Wystaw żądanie wpisu', przyKlik: przyZadaniu },
    stan === 'weryfikacja' && { etykieta: 'Wstrzymaj', przyKlik: () => ustawModal('wstrzymaj') },
    ['weryfikacja', 'wstrzymana'].includes(stan) && { etykieta: 'Odmów wpisu', przyKlik: () => ustawModal('odmow'), niebezpieczna: true },
    !zakonczona && { etykieta: 'Anuluj sprawę', przyKlik: () => ustawModal('anuluj') },
    // Sprawa z portalu wpada w stan „nowa”; kreator wpisu otwiera się dopiero w „weryfikacji”.
    stan === 'wstrzymana' && { etykieta: 'Wznów', przyKlik: () => wykonaj('wznow'), glowna: true },
  ];

  return (
    <>
      <Komunikat odmiana="blad" tresc={bladAkcji} />
      <PasekAkcji akcje={akcje} />
      {modal === 'wstrzymaj' && (
        <ModalWstrzymania przyZamknieciu={() => ustawModal(null)} przyZapisie={(dane) => wykonaj('wstrzymaj', dane)} />
      )}
      {modal === 'odmow' && (
        <ModalOdmowy przyZamknieciu={() => ustawModal(null)} przyZapisie={(dane) => wykonaj('odmow', dane)} />
      )}
      {modal === 'anuluj' && (
        <ModalPowod
          tytul="Anulowanie sprawy"
          akcja="Anuluj sprawę"
          zamknij="Zostaw sprawę"
          etykieta="Powód anulowania"
          przyZamknieciu={() => ustawModal(null)}
          przyZapisie={(powod) => wykonaj('anuluj', { powod })}
        />
      )}
    </>
  );
}

/* ─────────────────────────────────────────────────────
   POWIADOMIENIE / ZGODA (art. 300(34) § 3 KSH)
   ───────────────────────────────────────────────────── */
/**
 * D-090: ścieżką domyślną jest powiadomienie (e-mail przy zgodzie na e-mail, inaczej list — znacznik przy
 * adresacie); zgoda na wpis — jedno opcjonalne pole (D-088). `domyslnyOdbiorca` — np. zbywca z kreatora.
 */
/**
 * Powiadomienie wysłane listem czeka w kolejce do nadania — dopiero nadanie ustawia `powiadomienie_wyslano`
 * (server/listy.js). Panel i przycisk wpisu pokazują ten stan wprost, zamiast znikającego okna `alert`
 * (SESJA-PSA-ANALIZA-PRZEPLYWOW, A-008), a ponowne „Wyślij powiadomienie” nie dubluje listu.
 */
function useListPowiadomieniaWKolejce(sprawaId, zaleznosci = []) {
  const { dane, ladowanie } = useDane(sprawaId ? '/api/psa/listy?status=do_wyslania' : null, [sprawaId, ...zaleznosci]);
  // `undefined` — jeszcze nie wiadomo (przycisk wysyłki ukryty, żeby nie wysłać drugiego listu); `null` — brak listu.
  if (sprawaId && (ladowanie || !dane)) return undefined;
  return ((dane && dane.listy) || []).find((l) => l.sprawa_id === sprawaId && l.rodzaj_pisma === 'powiadomienie') || null;
}

/** Przyczyna blokady wpisu — gdy powiadomienie czeka na nadanie, mówi o tym zamiast „najpierw wyślij powiadomienie”. */
function przyczynaBlokadyWpisu(sprawa, listWKolejce) {
  if (!sprawa.blokada_wpisu) return null;
  return listWKolejce
    ? 'Powiadomienie czeka w kolejce listów — wpis będzie możliwy po nadaniu listu.'
    : sprawa.blokada_wpisu.przyczyna;
}

function PanelPowiadomienia({ sprawa, spolka, odswiez, domyslnyOdbiorca = null }) {
  const [wyslanoListow, ustawWyslanoListow] = useState(0);
  const listWKolejce = useListPowiadomieniaWKolejce(sprawa.id, [wyslanoListow]);
  const [osobaId, ustawOsobeId] = useState(domyslnyOdbiorca);
  useEffect(() => { if (domyslnyOdbiorca) ustawOsobeId(domyslnyOdbiorca); }, [domyslnyOdbiorca]);
  const [wysylanie, ustawWysylanie] = useState(false);
  const [zgodaOk, ustawZgodaOk] = useState(false);
  const [dataZgody, ustawDateZgody] = useState(dzisIso());
  const [blad, ustawBlad] = useState(null);

  async function wyslij() {
    if (!osobaId) return;
    ustawWysylanie(true);
    ustawBlad(null);
    try {
      const odp = await API.post(`/api/psa/sprawy/${sprawa.id}/powiadomienie`, { osoba_id: osobaId });
      // W4.3 — bez zgody na e-mail pismo idzie do kolejki listów (adres z rejestru).
      if (odp.wysylka.status === 'list') ustawWyslanoListow((n) => n + 1);
      else if (!odp.wysylka.wyslano) ustawBlad(odp.wysylka.powod);
      odswiez();
    } catch (e) {
      ustawBlad(e.message);
    } finally {
      ustawWysylanie(false);
    }
  }

  async function odnotujZgode() {
    if (!zgodaOk) return;
    ustawWysylanie(true);
    ustawBlad(null);
    try {
      await API.post(`/api/psa/sprawy/${sprawa.id}/zgoda`, { dopuszczalna: true, data: dataZgody });
      odswiez();
    } catch (e) {
      ustawBlad(e.message);
    } finally {
      ustawWysylanie(false);
    }
  }


  return (
    <div id="panel-powiadomienia"><Karta tytul="Uprzednie powiadomienie (art. 300(34) § 3 KSH)">
      {sprawa.powiadomienie_wyslano && (
        <Komunikat odmiana="ok" tresc={`Powiadomienie wysłano ${fmt.dataCzas(sprawa.powiadomienie_wyslano)}${stanTrybuTestowego() ? ' — testowa, niewysłana (skrzynka testowa)' : ''}.`} />
      )}
      {sprawa.zgoda_forma && (
        <Komunikat
          odmiana={sprawa.zgoda_wazna ? 'ok' : 'uwaga'}
          tresc={sprawa.zgoda_wazna
            ? `Odnotowano zgodę (${sprawa.zgoda_forma_nazwa}) z dnia ${fmt.data(sprawa.zgoda_data)}.`
            : `Odnotowana zgoda („${sprawa.zgoda_forma_nazwa}”) nie jest w dopuszczalnej formie — przed wpisem wyślij powiadomienie.`}
        />
      )}
      <Komunikat odmiana="blad" tresc={blad} />
      {!sprawa.powiadomienie_wyslano && listWKolejce && (
        <Komunikat
          odmiana="info"
          tresc={<>Powiadomienie czeka w kolejce listów (adres z rejestru: {listWKolejce.odbiorca_nazwa}) — wpis będzie możliwy po nadaniu. <a href="#/listy">Listy do wysyłki</a></>}
        />
      )}

      {listWKolejce === null && (
        <>
          <Pole etykieta="Kogo powiadomić (osoba, której prawa zmienia wpis)">
            <WyborZKartoteki wartosc={osobaId} przyZmianie={ustawOsobeId} />
            <ZnacznikKontaktuOsoby osobaId={osobaId} />
          </Pole>
          <div className="przyciski-karty">
            <button className="btn btn-glowny" disabled={!osobaId || wysylanie} onClick={wyslij}>
              {wysylanie ? 'Wysyłanie…' : 'Wyślij powiadomienie'}
            </button>
          </div>
        </>
      )}

      <label className="chk" style={{ marginTop: 'var(--od-16)' }}>
        <input type="checkbox" checked={zgodaOk} onChange={(z) => ustawZgodaOk(z.target.checked)} />
        <span className="chk-tresc">
          Osoba wyraziła zgodę na wpis w dopuszczalnej formie — wpis bez powiadomienia
          <div className="podstawa-prawna">
            art. 300(34) § 3 zd. 2 KSH: podpis zaufany, kwalifikowany, osobisty, notarialnie poświadczony albo złożony
            w kancelarii. Skan i zwykły oryginał — nie.
          </div>
        </span>
      </label>
      {zgodaOk && (
        <div className="siatka-2">
          <Pole etykieta="Data zgody">
            <PoleDaty wartosc={dataZgody} przyZmianie={(v) => ustawDateZgody(v || '')} />
          </Pole>
          <div className="przyciski-karty" style={{ alignSelf: 'end' }}>
            <button className="btn" disabled={wysylanie} onClick={odnotujZgode}>Odnotuj zgodę</button>
          </div>
        </div>
      )}
    </Karta></div>
  );
}

/* ─────────────────────────────────────────────────────
   KROKI 3–4 OSADZONE — wspólne dla nowej i wznawianej sprawy
   ───────────────────────────────────────────────────── */
/** „1–100, 150” z listy zakresów numerów akcji. */
function opiszZakresy(zakresy) {
  return (zakresy || [])
    .map((z) => (z.nr_od === z.nr_do ? String(z.nr_od) : `${z.nr_od}–${z.nr_do}`))
    .join(', ');
}

/**
 * Co dokładnie trafi do rejestru — WSZYSCY wskazani i WSZYSTKIE akcje,
 * z numerami przydzielonymi przez aplikację.
 *
 * Krok „Co się zmienia" obiecuje: „wyliczony zakres zobaczysz do
 * potwierdzenia w następnym kroku". Dotąd krok weryfikacji kwitował to
 * jednym zdaniem „Treść gotowa do wpisu", więc przy objęciu przez kilka
 * osób pracownik potwierdzał wpis, nie widząc ani kto obejmuje, ani które
 * numery akcji dostaje.
 */
function PrzydzialDoPotwierdzenia({ dane }) {
  if (!dane) return null;
  // D-102: zmiana danych akcjonariusza — do potwierdzenia „dziś w rejestrze → po wpisie”.
  if (dane.po && dane.przed) {
    return (
      <>
        <div className="fl odstep-g">Do wpisu — zmiana danych: {dane.osoba_nazwa}</div>
        <table className="tbl">
          <thead><tr><th>Dane</th><th>Dziś w rejestrze</th><th>Po wpisie</th></tr></thead>
          <tbody>
            {Object.keys(dane.po).map((k) => (
              <tr key={k}><td>{ETYKIETY_POL_REJESTRU[k] || k}</td><td>{dane.przed[k] || '—'}</td><td><strong>{dane.po[k] || '—'}</strong></td></tr>
            ))}
          </tbody>
        </table>
      </>
    );
  }
  const pozycje = dane.pozycje || [];
  if (pozycje.length === 0) return null;

  const kto = (p) => p.nabywca_nazwa || p.osoba_nazwa
    || (p.nabywca_osoba_id || p.osoba_id ? `osoba #${p.nabywca_osoba_id || p.osoba_id}` : '—');
  const razem = pozycje.reduce((suma, p) => suma + (Number(p.ilosc) || 0), 0);

  return (
    <>
      <div className="fl odstep-g">
        {dane.seria ? `Do wpisu — seria ${dane.seria}` : 'Do wpisu'}
      </div>
      {dane.zbywca_nazwa && (
        <div className="male wyciszony" style={{ marginBottom: 8 }}>
          Zbywca: {dane.zbywca_nazwa}
        </div>
      )}
      <table className="tbl">
        <thead>
          <tr><th>Kto</th><th className="do-prawej">Akcje</th><th>Numery</th></tr>
        </thead>
        <tbody>
          {pozycje.map((p, i) => (
            <tr key={i}>
              <td style={{ fontWeight: 500 }}>{kto(p)}</td>
              <td className="do-prawej mono">{fmt.liczba(p.ilosc)}</td>
              <td className="mono przyciemnione">{opiszZakresy(p.zakresy)}</td>
            </tr>
          ))}
        </tbody>
        {pozycje.length > 1 && (
          <tfoot>
            <tr>
              <td>Razem</td>
              <td className="do-prawej mono">{fmt.liczba(razem)}</td>
              <td />
            </tr>
          </tfoot>
        )}
      </table>
    </>
  );
}

/**
 * Zmiana rodzaju wpisu przy sprawie już założonej — zwykle sprawa z portalu: klient wybiera jedną z trzech
 * grup, a czynność prawną kwalifikuje pracownik po przeczytaniu załącznika. Podstawa (rodzaj i data
 * dokumentu) to krok 2 kreatora wpisu (A-006) — tu tylko typ.
 */
function ModalTypuWpisu({ sprawa, typy, odswiez, przyZamknieciu }) {
  const [typ, ustawTyp] = useState(sprawa.typ_zdarzenia);
  const [zapisywanie, ustawZapisywanie] = useState(false);
  const [blad, ustawBlad] = useState(null);
  async function zapisz() {
    ustawZapisywanie(true);
    ustawBlad(null);
    try {
      await API.patch(`/api/psa/sprawy/${sprawa.id}`, { akcja: 'zmien-typ', typ_zdarzenia: typ });
      przyZamknieciu();
      odswiez();
    } catch (e) {
      ustawBlad(e.message);
      ustawZapisywanie(false);
    }
  }
  return (
    <Modal
      tytul="Rodzaj wpisu"
      przyZamknieciu={przyZamknieciu}
      stopka={(
        <>
          <button type="button" className="btn" onClick={przyZamknieciu}>Anuluj</button>
          <button type="button" className="btn btn-glowny" disabled={zapisywanie || typ === sprawa.typ_zdarzenia} onClick={zapisz}>
            {zapisywanie ? 'Zapisywanie…' : 'Zmień rodzaj wpisu'}
          </button>
        </>
      )}
    >
      <Komunikat odmiana="blad" tresc={blad} />
      <Pole etykieta="Rodzaj wpisu" wymagane>
        <select value={typ} onChange={(z) => ustawTyp(z.target.value)}>
          {typy.filter((t) => !t.z_urzedu).map((t) => <option key={t.kod} value={t.kod}>{nazwaCzynnosci(t.kod, t.nazwa)}</option>)}
        </select>
      </Pole>
    </Modal>
  );
}

/* ─────────────────────────────────────────────────────
   EKRAN SPRAWY
   ───────────────────────────────────────────────────── */
function EkranSprawy({ sprawaId, emisjaPoczatkowa, osobaPoczatkowa, zakresPoczatkowy }) {
  const { dane, ladowanie, blad, odswiez } = useDane(`/api/psa/sprawy/${sprawaId}`);
  const meta = useDane('/api/psa/meta');
  // Ustawiane od razu po udanym wpisie (patrz KreatorWpisu) - ukrywa akcje
  // i panel powiadomienia dotyczace stanu „weryfikacja”, zanim jeszcze
  // odswiezymy dane sprawy. Odswiezenia CELOWO NIE wywolujemy od razu:
  // zrobiloby to zniknac ekran podsumowania wpisu (widoczny tylko, gdy
  // sprawa.stan==='weryfikacja').
  const [wlasnieWpisano, ustawWlasnieWpisano] = useState(false);
  // D-098: sprawa z portalu (stan „nowa”) przechodzi w weryfikację przy otwarciu — robi to `KreatorWpisu`.
  const [wystawianieZadania, ustawWystawianieZadania] = useState(false);
  const [zmianaTypu, ustawZmianeTypu] = useState(false);

  // B-003: `Spinner` tylko przy pierwszym wczytaniu. Odświeżenie (np. po „Wyślij powiadomienie”) zostawia
  // poprzednie dane na ekranie — `KreatorWpisu` się nie odmontowuje i nie traci kroku ani checklisty.
  if (!dane || !meta.dane) return <Spinner />;
  if (blad) return <Komunikat odmiana="blad" tresc={blad.message} />;

  const { sprawa, spolka, zadajacy, dokumenty, wydane_dokumenty } = dane;
  const definicjaTypu = meta.dane.typy_zdarzen.find((t) => t.kod === sprawa.typ_zdarzenia);
  const zakonczona = ['wpisana', 'odmowa', 'anulowana'].includes(sprawa.stan);

  return (
    <KolumnaSprawy>
      <div className="okruszki">
        <button onClick={() => idz('/sprawy')}>Sprawy</button> →{' '}
        <button onClick={() => idz(`/spolki/${sprawa.spolka_id}`)}>{spolka.nazwa}</button> → sprawa #{sprawa.id}
      </div>

      <div className="pasek-gorny">
        <div>
          <div className="tytul-strony">{nazwaCzynnosci(sprawa.typ_zdarzenia, sprawa.typ_nazwa)}</div>
          <div className="podtytul-strony">
            {spolka.nazwa} · wpłynęła {fmt.data(sprawa.data_wplywu)} · {sprawa.zrodlo === 'z_urzedu' ? 'z urzędu' : sprawa.zrodlo}
            {zadajacy ? ` · żądający: ${zadajacy.oznaczenie}` : ''}
            {sprawa.zadajacy_rola ? ` (${OPISY_ROL_ZADAJACEGO[sprawa.zadajacy_rola] || sprawa.zadajacy_rola})` : ''}
          </div>
          <div className="row-g" style={{ marginTop: 8 }}>
            <Pigulka odmiana={ODMIANY_STANU_SPRAWY[sprawa.stan]}>{NAZWY_STANU_SPRAWY[sprawa.stan]}</Pigulka>
            {!zakonczona && !wlasnieWpisano && <ZnacznikTerminu termin={sprawa.termin} />}
            {/* Z-202/P-014: sygnal, nie blokada - sprawa idzie dalej normalnie. */}
            <ZnacznikPrzegladuAml wymaga={sprawa.zadajacy_wymaga_przegladu_aml} />
            {sprawa.zadajacy_osoba_id && <ZnacznikKontaktuOsoby osobaId={sprawa.zadajacy_osoba_id} />}
          </div>
        </div>
      </div>

      {sprawa.notatka && (
        <Komunikat odmiana="info" tytul="Notatki" tresc={sprawa.notatka.split('\n').slice(-1)[0].replace(/^\[.*?\]\s*/, '')} />
      )}
      {sprawa.stan === 'odmowa' && (
        <Komunikat
          odmiana="blad"
          tytul={`Przyczyna odmowy — ${OPISY_PRZYCZYN_ODMOWY_WPISU[sprawa.powod_odmowy_kod] || 'nieustalona'}`}
          tresc={sprawa.powod_odmowy}
        />
      )}

      {!wlasnieWpisano && (
        <PasekAkcjiSprawy
          sprawa={sprawa}
          odswiez={odswiez}
          zakonczona={zakonczona}
          przyZmianieTypu={() => ustawZmianeTypu(true)}
          przyZadaniu={() => ustawWystawianieZadania(true)}
        />
      )}

      {!zakonczona && zmianaTypu && (
        <ModalTypuWpisu sprawa={sprawa} typy={meta.dane.typy_zdarzen} odswiez={odswiez} przyZamknieciu={() => ustawZmianeTypu(false)} />
      )}

      {/* D-097: jeden kreator wpisu dla każdego typu — także sprawa z portalu i wznowiona z kolejki. */}
      {!zakonczona && ['nowa', 'weryfikacja'].includes(sprawa.stan) && (
        <KreatorWpisu
          key={sprawa.typ_zdarzenia}
          spolkaId={sprawa.spolka_id}
          typ={sprawa.typ_zdarzenia}
          sprawa={sprawa}
          definicjaTypu={definicjaTypu}
          odswiezSprawe={odswiez}
          naWpisano={() => ustawWlasnieWpisano(true)}
          poczatek={poczatekWpisu(sprawa.typ_zdarzenia, { emisja: emisjaPoczatkowa, osoba: osobaPoczatkowa, zakres: zakresPoczatkowy })}
        />
      )}

      <PanelDokumentow sprawaId={sprawa.id} dokumenty={dokumenty} odswiez={odswiez} />

      {wystawianieZadania && (
        <ModalWystawDokumentu
          bazowyUrl={`/api/psa/sprawy/${sprawa.id}`}
          kontekstNazwa="sprawy"
          przyZamknieciu={() => {
            ustawWystawianieZadania(false);
            odswiez();
          }}
        />
      )}

      {wydane_dokumenty.length > 0 && (
        <Sekcja tytul="Wydane dokumenty" licznik={wydane_dokumenty.length}>
          <table className="tbl" style={{ margin: '0 24px', width: 'calc(100% - 48px)' }}>
            <thead><tr><th>Typ</th><th>Kanał</th><th>Wysłano</th><th>Autor</th><th></th></tr></thead>
            <tbody>
              {wydane_dokumenty.map((w) => (
                <tr key={w.id}>
                  <td>{w.typ}</td>
                  <td className="przyciemnione">{w.kanal}</td>
                  <td>{w.wyslano ? `${fmt.dataCzas(w.wyslano)}${stanTrybuTestowego() ? ' · testowa — niewysłana' : ''}` : <span className="przyciemnione">nie wysłano</span>}</td>
                  <td className="przyciemnione">{w.autor}</td>
                  <td>
                    {w.szablon_kod && (
                      <a href={`/api/psa/sprawy/${sprawa.id}/wydane/${w.id}/plik`}>Pobierz .docx</a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ height: 16 }} />
        </Sekcja>
      )}

      {sprawa.stan === 'wstrzymana' && (
        <Karta>
          <Pusto tytul="Sprawa wstrzymana" opis="Wznów sprawę po usunięciu przeszkody, żeby wrócić do kreatora." />
        </Karta>
      )}
    </KolumnaSprawy>
  );
}

window.EkranKolejkiSpraw = EkranKolejkiSpraw;
window.EkranSprawy = EkranSprawy;
