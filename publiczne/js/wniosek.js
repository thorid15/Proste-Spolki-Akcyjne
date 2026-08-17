/* wniosek.js — formularz wniosku o prowadzenie rejestru, portal klienta (etap 3C).
   Krok „Spółka i umowa" lustrzy krok 1 kreatora wewnętrznego
   (publiczne/js/spolki.js: EkranNowejSpolki) na tyle, na ile dane są takie
   same — dane spółki (z importem z KRS) i reprezentant w mianowniku
   (odmianę liczy backend przy generowaniu projektu umowy, etap 3E).
   Krok „Akcjonariusze" (etap 3D) zbiera dane do PRZYSZŁEJ kartoteki
   (server/trasy/portal.js: psa_wnioski_akcjonariusze) — te wiersze NIE są
   jeszcze prawdziwymi osobami w kartotece wspólnej, dopóki kancelaria nie
   zweryfikuje wniosku (etap 3F). Każda pozycja zapisuje się osobno
   (POST przy dodaniu, PUT przy „Zapisz”, DELETE przy „Usuń”) — inaczej niż
   krok „Spółka”, który zapisuje się jednym PUT całości. */

const KROKI_WNIOSKU = ['Spółka i umowa', 'Akcjonariusze', 'Weryfikacja'];

const PUSTY_AKCJONARIUSZ_WNIOSKU = {
  typ: 'fizyczna',
  nazwisko: '', imie: '', nazwa: '',
  pesel: '', data_urodzenia: '', plec: '',
  nip: '', regon: '', numer_w_rejestrze: '', nazwa_rejestru: 'KRS',
  kod_pocztowy: '', miejscowosc: '', ulica: '', nr_domu: '', nr_lokalu: '',
  adres_doreczen: '', adres_edoreczen: '', email: '', telefon: '',
  zgoda_email: 0,
};

/** Jedna proponowana pozycja akcjonariatu w kroku „Akcjonariusze” wniosku klienta. */
function PozycjaAkcjonariuszaWniosku({ pozycja, edytowalne, przyZapisie, przyUsunieciu }) {
  const [dane, ustawDane] = useState({ ...PUSTY_AKCJONARIUSZ_WNIOSKU, ...pozycja });
  const [zapisywanie, ustawZapisywanie] = useState(false);
  const [usuwanie, ustawUsuwanie] = useState(false);
  const [blad, ustawBlad] = useState(null);
  const [komunikat, ustawKomunikat] = useState(null);

  const pole = (klucz) => ({
    value: dane[klucz] ?? '',
    onChange: (z) => ustawDane((p) => ({ ...p, [klucz]: z.target.value })),
    disabled: !edytowalne,
  });

  // Etap 2.8 / 3D: autouzupelnienie daty urodzenia i plci z PESEL,
  // jednorazowe (uzupelnia tylko puste pola).
  const pesel = dane.typ === 'fizyczna' ? parsujPesel(dane.pesel) : null;
  useEffect(() => {
    if (!pesel) return;
    ustawDane((p) => ({
      ...p,
      data_urodzenia: p.data_urodzenia || pesel.data_urodzenia,
      plec: p.plec || pesel.plec,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dane.pesel]);

  async function zapisz() {
    ustawZapisywanie(true);
    ustawBlad(null);
    ustawKomunikat(null);
    try {
      const wynik = await API.put(`/api/psa/portal/wniosek/akcjonariusze/${pozycja.id}`, dane);
      ustawDane(wynik.akcjonariusz);
      przyZapisie(wynik.akcjonariusz);
      ustawKomunikat('Zapisano.');
    } catch (e) {
      ustawBlad(e instanceof BladApi ? e.message : 'Nie udało się zapisać pozycji.');
    } finally {
      ustawZapisywanie(false);
    }
  }

  async function usun() {
    if (!window.confirm('Usunąć tę pozycję z wniosku?')) return;
    ustawUsuwanie(true);
    ustawBlad(null);
    try {
      await API.delete(`/api/psa/portal/wniosek/akcjonariusze/${pozycja.id}`);
      przyUsunieciu(pozycja.id);
    } catch (e) {
      ustawBlad(e instanceof BladApi ? e.message : 'Nie udało się usunąć pozycji.');
      ustawUsuwanie(false);
    }
  }

  const zgoda = Boolean(Number(dane.zgoda_email));

  return (
    <Karta>
      <Komunikat odmiana="blad" tresc={blad} />

      <Pole etykieta="Rodzaj podmiotu" wymagane>
        <select value={dane.typ} onChange={(z) => ustawDane((p) => ({ ...p, typ: z.target.value }))} disabled={!edytowalne}>
          <option value="fizyczna">Osoba fizyczna</option>
          <option value="prawna">Osoba prawna lub jednostka organizacyjna</option>
        </select>
      </Pole>

      {dane.typ === 'fizyczna' ? (
        <>
          <div className="siatka-2">
            <Pole etykieta="Nazwisko" wymagane><input type="text" {...pole('nazwisko')} /></Pole>
            <Pole etykieta="Imię"><input type="text" {...pole('imie')} /></Pole>
          </div>
          <div className="siatka-2">
            <Pole etykieta="PESEL" podpowiedz="Data urodzenia i płeć uzupełnią się automatycznie po wpisaniu 11 cyfr — można je potem nadpisać.">
              <input type="text" {...pole('pesel')} maxLength={11} />
            </Pole>
            <Pole etykieta="Data urodzenia">
              <PoleDaty
                wartosc={dane.data_urodzenia || ''}
                przyZmianie={(v) => ustawDane((p) => ({ ...p, data_urodzenia: v }))}
                wylaczone={!edytowalne}
              />
            </Pole>
          </div>
          {pesel && !pesel.poprawnaSumaKontrolna && (
            <Komunikat
              odmiana="uwaga"
              tresc="Suma kontrolna numeru PESEL się nie zgadza — sprawdź numer. Zapis nie jest blokowany."
            />
          )}
          <Pole etykieta="Płeć">
            <select value={dane.plec || ''} onChange={(z) => ustawDane((p) => ({ ...p, plec: z.target.value }))} disabled={!edytowalne}>
              <option value="">— nie podano —</option>
              <option value="mezczyzna">mężczyzna</option>
              <option value="kobieta">kobieta</option>
            </select>
          </Pole>
        </>
      ) : (
        <>
          <Pole etykieta="Nazwa" wymagane><input type="text" {...pole('nazwa')} /></Pole>
          <div className="siatka-2">
            <Pole etykieta="Numer we właściwym rejestrze"><input type="text" {...pole('numer_w_rejestrze')} /></Pole>
            <Pole etykieta="Nazwa rejestru"><input type="text" {...pole('nazwa_rejestru')} /></Pole>
          </div>
          <div className="siatka-2">
            <Pole etykieta="NIP"><input type="text" {...pole('nip')} /></Pole>
            <Pole etykieta="REGON"><input type="text" {...pole('regon')} /></Pole>
          </div>
        </>
      )}

      <div className="rozdzielacz" />
      <div className="siatka-3">
        <Pole etykieta="Kod pocztowy"><input type="text" {...pole('kod_pocztowy')} /></Pole>
        <Pole etykieta="Miejscowość"><input type="text" {...pole('miejscowosc')} /></Pole>
        <Pole etykieta="Ulica"><input type="text" {...pole('ulica')} /></Pole>
      </div>
      <div className="siatka-2">
        <Pole etykieta="Nr domu"><input type="text" {...pole('nr_domu')} /></Pole>
        <Pole etykieta="Nr lokalu"><input type="text" {...pole('nr_lokalu')} /></Pole>
      </div>
      <Pole etykieta="Adres do doręczeń" podpowiedz="Jeśli inny niż adres zamieszkania lub siedziby.">
        <input type="text" {...pole('adres_doreczen')} />
      </Pole>

      <div className="siatka-2">
        <Pole etykieta="E-mail"><input type="text" {...pole('email')} /></Pole>
        <Pole etykieta="Telefon"><input type="text" {...pole('telefon')} /></Pole>
      </div>

      <label className="chk" style={{ padding: '8px 0' }}>
        <input
          type="checkbox"
          checked={zgoda}
          onChange={(z) => ustawDane((p) => ({ ...p, zgoda_email: z.target.checked ? 1 : 0 }))}
          disabled={!edytowalne}
        />
        <span className="chk-tresc">
          Wyrażam zgodę na komunikację elektroniczną w sprawach tego rejestru i na wpisanie poniższego adresu
          do doręczeń elektronicznych do rejestru akcjonariuszy (art. 300<sup>33</sup> § 1 pkt 5 KSH). Bez tej
          zgody adres do doręczeń elektronicznych NIE zostanie wpisany do rejestru — pozostają dotychczasowe
          zasady doręczeń.
        </span>
      </label>
      {zgoda && !dane.adres_edoreczen && (
        <Komunikat
          odmiana="uwaga"
          tresc="Zaznaczono zgodę, ale nie podano adresu do doręczeń elektronicznych — uzupełnij pole niżej albo cofnij zgodę."
        />
      )}
      <Pole etykieta="Adres do doręczeń elektronicznych">
        <input type="text" {...pole('adres_edoreczen')} placeholder="AE:PL-…" />
      </Pole>

      {edytowalne && (
        <div className="row-g" style={{ justifyContent: 'flex-end', paddingTop: 8 }}>
          {komunikat && <span className="podpowiedz">{komunikat}</span>}
          <button className="btn btn-maly btn-sygnal" onClick={usun} disabled={usuwanie || zapisywanie}>
            {usuwanie ? 'Usuwanie…' : 'Usuń'}
          </button>
          <button className="btn btn-maly btn-glowny" onClick={zapisz} disabled={zapisywanie || usuwanie}>
            {zapisywanie ? 'Zapisywanie…' : 'Zapisz'}
          </button>
        </div>
      )}
    </Karta>
  );
}

function EkranWniosku() {
  const [krok, ustawKrok] = useState(0);
  const [dane, ustawDane] = useState(null);
  const [ladowanie, ustawLadowanie] = useState(true);
  const [zapisywanie, ustawZapisywanie] = useState(false);
  const [blad, ustawBlad] = useState(null);
  const [komunikatZapisu, ustawKomunikatZapisu] = useState(null);
  const [pobieranieKrs, ustawPobieranieKrs] = useState(false);
  const [komunikatKrs, ustawKomunikatKrs] = useState(null);
  const [pokazKorekteOdmiany, ustawPokazKorekteOdmiany] = useState(false);
  const [akcjonariusze, ustawAkcjonariusze] = useState([]);
  const [dodawanieAkcjonariusza, ustawDodawanieAkcjonariusza] = useState(false);
  const [bladAkcjonariuszy, ustawBladAkcjonariuszy] = useState(null);

  useEffect(() => {
    Promise.all([
      API.get('/api/psa/portal/wniosek'),
      API.get('/api/psa/portal/wniosek/akcjonariusze'),
    ])
      .then(([w, a]) => {
        ustawDane(w.wniosek);
        ustawAkcjonariusze(a.akcjonariusze);
      })
      .catch((e) => ustawBlad(e instanceof BladApi ? e.message : 'Nie udało się wczytać wniosku.'))
      .finally(() => ustawLadowanie(false));
  }, []);

  const edytowalneAkcjonariusze = Boolean(dane) && ['w_przygotowaniu', 'do_uzupelnienia'].includes(dane.status);

  async function dodajAkcjonariusza() {
    ustawDodawanieAkcjonariusza(true);
    ustawBladAkcjonariuszy(null);
    try {
      const wynik = await API.post('/api/psa/portal/wniosek/akcjonariusze', {});
      ustawAkcjonariusze((p) => [...p, wynik.akcjonariusz]);
    } catch (e) {
      ustawBladAkcjonariuszy(e instanceof BladApi ? e.message : 'Nie udało się dodać pozycji.');
    } finally {
      ustawDodawanieAkcjonariusza(false);
    }
  }

  function poZapisieAkcjonariusza(zapisany) {
    ustawAkcjonariusze((p) => p.map((a) => (a.id === zapisany.id ? zapisany : a)));
  }

  function poUsunieciuAkcjonariusza(id) {
    ustawAkcjonariusze((p) => p.filter((a) => a.id !== id));
  }

  const pole = (klucz) => ({
    value: (dane && dane[klucz]) ?? '',
    onChange: (z) => ustawDane((p) => ({ ...p, [klucz]: z.target.value })),
  });

  async function zapisz() {
    ustawZapisywanie(true);
    ustawBlad(null);
    ustawKomunikatZapisu(null);
    try {
      const wynik = await API.put('/api/psa/portal/wniosek', dane);
      ustawDane(wynik.wniosek);
      ustawKomunikatZapisu('Zapisano.');
    } catch (e) {
      ustawBlad(e instanceof BladApi ? e.message : 'Nie udało się zapisać wniosku.');
    } finally {
      ustawZapisywanie(false);
    }
  }

  async function pobierzZKrs() {
    const numer = String((dane && dane.krs) || '').replace(/\D/g, '');
    ustawPobieranieKrs(true);
    ustawKomunikatKrs(null);
    try {
      const wynik = await API.get(`/api/psa/portal/wniosek/z-krs/${numer}`);
      if (!wynik.znaleziono) {
        ustawKomunikatKrs({ odmiana: 'uwaga', tresc: wynik.komunikat });
      } else if (wynik.dopuszczalna === false) {
        ustawKomunikatKrs({ odmiana: 'blad', tresc: wynik.komunikat });
      } else {
        const { sklad_organu, ...reszta } = wynik.dane;
        const pobrane = Object.fromEntries(Object.entries(reszta).filter(([, v]) => v !== null && v !== ''));
        ustawDane((p) => ({ ...p, ...pobrane }));
        ustawKomunikatKrs({
          odmiana: (wynik.ostrzezenia || []).length ? 'uwaga' : 'ok',
          tresc: (wynik.ostrzezenia || []).length
            ? wynik.ostrzezenia.join(' ')
            : 'Dane pobrane z rejestru przedsiębiorców. Sprawdź je przed zapisaniem.',
        });
      }
    } catch (e) {
      ustawKomunikatKrs({ odmiana: 'uwaga', tresc: `${e.message} Uzupełnij dane ręcznie.` });
    } finally {
      ustawPobieranieKrs(false);
    }
  }

  if (ladowanie) return <Spinner />;
  if (!dane) return <Komunikat odmiana="blad" tresc={blad || 'Nie udało się wczytać wniosku.'} />;

  return (
    <div className="pion" style={{ gap: 16 }}>
      <Kroki kroki={KROKI_WNIOSKU} biezacy={krok} />
      <Komunikat odmiana="blad" tresc={blad} />

      <Karta>
        {krok === 0 && (
          <>
            <div className="card-h">Dane spółki</div>
            <Pole
              etykieta="Numer KRS"
              podpowiedz="Dziesięć cyfr. Pobierzemy dane z otwartego rejestru przedsiębiorców; przy niepowodzeniu uzupełnij je ręcznie."
            >
              <div className="row-g">
                <input type="text" {...pole('krs')} maxLength={10} placeholder="0000123456" />
                <button
                  className="btn"
                  onClick={pobierzZKrs}
                  disabled={pobieranieKrs || String((dane && dane.krs) || '').replace(/\D/g, '').length !== 10}
                >
                  {pobieranieKrs ? 'Pobieranie…' : 'Pobierz z KRS'}
                </button>
              </div>
            </Pole>
            {komunikatKrs && <Komunikat odmiana={komunikatKrs.odmiana} tresc={komunikatKrs.tresc} />}

            <Pole etykieta="Firma (nazwa) spółki" wymagane>
              <input type="text" {...pole('nazwa')} />
            </Pole>
            <Pole
              etykieta="Organ zarządzający"
              podpowiedz="P.S.A. może mieć zarząd albo (struktura monistyczna) radę dyrektorów — decyduje umowa spółki."
            >
              <select {...pole('organ_rodzaj')}>
                <option value="">— nie ustalono —</option>
                <option value="zarzad">Zarząd</option>
                <option value="rada_dyrektorow">Rada Dyrektorów</option>
              </select>
            </Pole>
            <div className="siatka-2">
              <Pole etykieta="NIP"><input type="text" {...pole('nip')} /></Pole>
              <Pole etykieta="REGON"><input type="text" {...pole('regon')} /></Pole>
            </div>
            <div className="siatka-3">
              <Pole etykieta="Kod pocztowy"><input type="text" {...pole('kod_pocztowy')} /></Pole>
              <Pole etykieta="Miejscowość"><input type="text" {...pole('miejscowosc')} /></Pole>
              <Pole
                etykieta="Siedziba w miejscowniku"
                podpowiedz='„z siedzibą w …” — np. „Warszawie”.'
              >
                <input type="text" {...pole('siedziba_miejscownik')} placeholder="np. Warszawie" />
              </Pole>
            </div>
            <div className="siatka-3">
              <Pole etykieta="Ulica"><input type="text" {...pole('ulica')} /></Pole>
              <Pole etykieta="Nr domu"><input type="text" {...pole('nr_domu')} /></Pole>
              <Pole etykieta="Nr lokalu"><input type="text" {...pole('nr_lokalu')} /></Pole>
            </div>
            <div className="siatka-2">
              <Pole etykieta="Sąd rejestrowy"><input type="text" {...pole('sad_rejestrowy')} /></Pole>
              <Pole etykieta="Wydział"><input type="text" {...pole('wydzial')} /></Pole>
            </div>
            <div className="siatka-3">
              <Pole etykieta="Telefon"><input type="text" {...pole('telefon')} /></Pole>
              <Pole etykieta="E-mail"><input type="text" {...pole('email')} /></Pole>
              <Pole etykieta="Adres do doręczeń elektronicznych">
                <input type="text" {...pole('adres_edorecze')} placeholder="AE:PL-…" />
              </Pole>
            </div>
            <div className="siatka-3">
              <Pole etykieta="Data rejestracji w KRS">
                <PoleDaty wartosc={dane.data_utworzenia_spolki || ''} przyZmianie={(v) => ustawDane((p) => ({ ...p, data_utworzenia_spolki: v }))} />
              </Pole>
              <Pole etykieta="Data ostatniego wpisu do KRS">
                <PoleDaty wartosc={dane.data_ostatniego_wpisu_krs || ''} przyZmianie={(v) => ustawDane((p) => ({ ...p, data_ostatniego_wpisu_krs: v }))} />
              </Pole>
              <Pole etykieta="Kapitał akcyjny">
                <PoleKwoty grosze={dane.kapital_akcyjny_grosze} przyZmianie={(v) => ustawDane((p) => ({ ...p, kapital_akcyjny_grosze: v }))} />
              </Pole>
            </div>
            <Pole
              etykieta="Data zawarcia umowy spółki"
              podpowiedz="Data aktu notarialnego zawiązania spółki — przy spółce założonej w S24 data podpisania w systemie."
            >
              <PoleDaty wartosc={dane.data_zawarcia_umowy_spolki || ''} przyZmianie={(v) => ustawDane((p) => ({ ...p, data_zawarcia_umowy_spolki: v }))} />
            </Pole>

            <div className="rozdzielacz" />
            <div className="card-h">Reprezentant, który podpisze umowę</div>
            <Komunikat
              odmiana="info"
              tresc="Osoba, która w imieniu SPÓŁKI podpisze umowę o prowadzenie rejestru. Wpisz dane w mianowniku, tak jak w dokumencie tożsamości — formy gramatyczne do treści umowy dobiorą się automatycznie."
            />
            <div className="siatka-2">
              <Pole etykieta="Imię i nazwisko" podpowiedz='W mianowniku, np. „Jan Kowalski”.'>
                <input type="text" {...pole('reprezentant_imie_nazwisko')} placeholder="np. Jan Kowalski" />
              </Pole>
              <Pole etykieta="Płeć" podpowiedz="Do form gramatycznych w umowie (np. „działającego” / „działającą”).">
                <select {...pole('reprezentant_plec')}>
                  <option value="">— nie podano —</option>
                  <option value="mezczyzna">mężczyzna</option>
                  <option value="kobieta">kobieta</option>
                </select>
              </Pole>
            </div>
            <div className="siatka-2">
              <Pole etykieta="Funkcja" podpowiedz='W mianowniku, np. „Prezes Zarządu”.'>
                <input type="text" {...pole('reprezentant_funkcja')} placeholder="np. Prezes Zarządu" />
              </Pole>
              <Pole etykieta="Sposób reprezentacji">
                <input
                  type="text"
                  {...pole('reprezentant_reprezentacja')}
                  placeholder="np. uprawnionego do samodzielnej reprezentacji"
                />
              </Pole>
            </div>
            <div className="siatka-2">
              <Pole etykieta="Rodzice" podpowiedz='Imiona w mianowniku, np. „Piotr i Anna”.'>
                <input type="text" {...pole('reprezentant_rodzice')} placeholder="np. Piotr i Anna" />
              </Pole>
              <Pole etykieta="Dowód osobisty">
                <input type="text" {...pole('reprezentant_dowod')} />
              </Pole>
            </div>
            <div className="siatka-2">
              <Pole etykieta="PESEL"><input type="text" {...pole('reprezentant_pesel')} maxLength={11} /></Pole>
              <Pole etykieta="Adres zamieszkania"><input type="text" {...pole('reprezentant_adres')} /></Pole>
            </div>

            <button className="btn btn-maly" onClick={() => ustawPokazKorekteOdmiany((p) => !p)}>
              {pokazKorekteOdmiany ? 'Ukryj korektę odmiany' : 'Popraw automatyczną odmianę (nazwiska nietypowe, obcojęzyczne)'}
            </button>
            {pokazKorekteOdmiany && (
              <>
                <Komunikat
                  odmiana="uwaga"
                  tresc="Automat odmienia imię, nazwisko, funkcję i imiona rodziców na podstawie najczęstszych wzorców polskiej odmiany — to pomoc, nie wyrocznia. Wypełnione pole niżej NADPISUJE wynik automatu."
                />
                <div className="siatka-2">
                  <Pole etykieta="Imię i nazwisko w bierniku (korekta)">
                    <input type="text" {...pole('reprezentant_biernik_recznie')} placeholder="zostaw puste, by użyć automatu" />
                  </Pole>
                  <Pole etykieta="Funkcja w bierniku (korekta)">
                    <input type="text" {...pole('reprezentant_funkcja_biernik_recznie')} placeholder="zostaw puste, by użyć automatu" />
                  </Pole>
                </div>
                <Pole etykieta="Rodzice w dopełniaczu (korekta)">
                  <input type="text" {...pole('reprezentant_rodzice_recznie')} placeholder="zostaw puste, by użyć automatu" />
                </Pole>
              </>
            )}
          </>
        )}

        {krok === 1 && (
          <div className="pion" style={{ gap: 16 }}>
            <div className="card-h">Akcjonariusze</div>
            <Komunikat
              odmiana="info"
              tresc="Wpisz osoby, które mają zostać wpisane do rejestru jako akcjonariusze. Kancelaria porówna te dane z rejestrem KRS i skontaktuje się w razie rozbieżności, zanim rejestr zostanie otwarty."
            />
            {!edytowalneAkcjonariusze && dane.status && (
              <Komunikat
                odmiana="uwaga"
                tresc={`Wniosek ma status „${dane.status}” — lista akcjonariuszy jest już tylko do wglądu.`}
              />
            )}
            <Komunikat odmiana="blad" tresc={bladAkcjonariuszy} />

            {akcjonariusze.length === 0 && (
              <Pusto
                tytul="Brak akcjonariuszy"
                opis="Dodaj przynajmniej jedną osobę, która obejmie akcje w spółce."
              />
            )}

            {akcjonariusze.map((a) => (
              <PozycjaAkcjonariuszaWniosku
                key={a.id}
                pozycja={a}
                edytowalne={edytowalneAkcjonariusze}
                przyZapisie={poZapisieAkcjonariusza}
                przyUsunieciu={poUsunieciuAkcjonariusza}
              />
            ))}

            {edytowalneAkcjonariusze && (
              <button className="btn btn-maly" onClick={dodajAkcjonariusza} disabled={dodawanieAkcjonariusza}>
                {dodawanieAkcjonariusza ? 'Dodawanie…' : '+ Dodaj akcjonariusza'}
              </button>
            )}
          </div>
        )}

        {krok === 2 && (
          <Pusto
            tytul="Wkrótce"
            opis="Weryfikacja i złożenie wniosku będą dostępne po uzupełnieniu danych akcjonariuszy."
          />
        )}

        <div className="kreator-stopka">
          <button className="btn" onClick={() => ustawKrok((k) => Math.max(0, k - 1))} disabled={krok === 0}>
            Wstecz
          </button>
          <div className="kreator-stopka-prawa row-g">
            {komunikatZapisu && <span className="podpowiedz">{komunikatZapisu}</span>}
            <button className="btn" onClick={zapisz} disabled={zapisywanie}>
              {zapisywanie ? 'Zapisywanie…' : 'Zapisz'}
            </button>
            <button
              className="btn btn-glowny"
              onClick={() => ustawKrok((k) => Math.min(KROKI_WNIOSKU.length - 1, k + 1))}
              disabled={krok === KROKI_WNIOSKU.length - 1}
            >
              Dalej
            </button>
          </div>
        </div>
      </Karta>
    </div>
  );
}

window.EkranWniosku = EkranWniosku;
