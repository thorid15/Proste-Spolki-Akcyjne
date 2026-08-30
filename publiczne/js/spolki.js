/* spolki.js — lista spółek i rejestracja nowej spółki (sesja 6, faza 3).

   Kreator ma cztery kroki i dotyka logiki domenowej TYLKO tam, gdzie sesja to
   wprost dopuszcza: pola rozszerzonego importu KRS i ograniczeń z umowy
   spółki (server/logika/kreator.js, migracja v6). Krok 4 zapisuje spółkę
   (`POST /api/psa/spolki`, jeśli jeszcze nie istnieje z poprzedniej próby),
   a potem KOMPLET zdarzeń założycielskich jednym wywołaniem
   `POST /:id/otworz-rejestr` — atomowo, patrz `rejestr.otworzRejestr`. */

const PUSTA_SPOLKA = {
  krs: '', nip: '', regon: '', nazwa: '', forma_prawna: 'PROSTA SPÓŁKA AKCYJNA',
  kraj: 'Polska', kod_pocztowy: '', miejscowosc: '',
  ulica: '', nr_domu: '', nr_lokalu: '',
  sad_rejestrowy: '', wydzial: '', telefon: '', email: '', www: '',
  data_utworzenia_spolki: '', adres_edorecze: '',
  // Data zawarcia UMOWY SPÓŁKI (akt założycielski / akt notarialny, przy S24
  // — data podpisania w systemie) — etap 2.5 poprawek. Różna od daty
  // rejestracji w KRS powyżej i od daty umowy o prowadzenie rejestru niżej;
  // podstawa autouzupełnienia „data emisji” serii założycielskiej.
  data_zawarcia_umowy_spolki: '',
  kapital_akcyjny_grosze: null,
  status: 'aktywna', opis: '', uwagi: '',
  organ_rodzaj: '',
  data_uchwaly_wyboru: '', data_umowy: '', data_otwarcia_rejestru: '',
  // Stroną umowy po stronie podmiotu prowadzącego rejestr zawsze jest
  // kancelaria (etap 2.1 poprawek) — bez wyboru w kreatorze.
  umowe_zawarl: 'notariusz', umowe_zawarl_imie_nazwisko: '', dodatkowe_informacje_umowa_spolki: '',
  zakaz_glosu_zastawnika_umowa: '', ograniczenie_dziedziczenia_umowa: '',
  // Umowa jako fakt już zaistniały (etap 2.2) — sposób zawarcia; data
  // zawarcia to już istniejące `data_umowy` powyżej. Załącznik trzymany
  // osobno w stanie kreatora (plik, nie pole tekstowe) — patrz `umowaZalacznik`.
  umowa_sposob_zawarcia: '',
  // Reprezentant — wszystkie dane w mianowniku, tak jak w dokumencie
  // tożsamości. Pisma nie odmieniają ich przez przypadki, tylko opisują
  // etykietą („imiona rodziców:", „działający jako:").
  reprezentant_imie_nazwisko: '', reprezentant_rodzice: '',
  reprezentant_dowod: '', reprezentant_pesel: '', reprezentant_adres: '',
  reprezentant_funkcja: '', reprezentant_reprezentacja: '', reprezentant_email: '',
};

const PUSTA_EMISJA_ZALOZYCIELSKA = {
  // Cena emisyjna NIE jest tu wspolna dla calej emisji (etap 2.6 poprawek) -
  // rozne osoby moga wnosic rozne kwoty za akcje w tej samej emisji
  // zalozycielskiej (np. rozne aporty); cena zyje przy kazdej pozycji
  // akcjonariatu nizej.
  seria: '', nr_pierwszy: 1, ilosc: '',
  data_emisji: '', data_wpisu_krs: '', rodzaj_akcji: 'zwykla', tytul: '', obowiazki_wobec_spolki: '',
  podstawa_prawna: '',
};

const PUSTA_ZGODA_SPOLKI = {
  wymaga_zgody_spolki: false,
  // Doslowny cytat klauzuli - przydatny nawet zanim szczegoly nizej sa znane
  // (etap 2.7 poprawek).
  tresc_postanowienia: '',
  zgoda_termin_wskazania_dni: '',
  zgoda_cena_opis: '',
  zgoda_termin_zaplaty_dni: '',
  prawo_pierwszenstwa: false,
};

const KROKI_REJESTRACJI = ['Spółka', 'Umowa o prowadzenie rejestru', 'Pierwsza emisja i akcjonariat', 'Weryfikacja'];

/* Checklista otwarcia rejestru — sesja 6, faza 3, sekcja 3 (krok 4). Nie jest
   powiązana z katalogiem typów zdarzeń (nie ma zdarzenia „otwarcie
   rejestru") — to samodzielna lista dla tego jednego kreatora. */
const CHECKLISTA_OTWARCIA = [
  { kod: 'forma', tresc: 'Forma prawna potwierdzona jako prosta spółka akcyjna.' },
  { kod: 'wpis_krs', tresc: 'Spółka wpisana do KRS, data wpisu ustalona.' },
  { kod: 'uchwala', tresc: 'Uchwała akcjonariuszy o wyborze podmiotu prowadzącego rejestr, skan wgrany.' },
  { kod: 'umowa', tresc: 'Umowa o prowadzenie rejestru podpisana, skan wgrany, wskazany podpisujący.' },
  { kod: 'jedna_umowa', tresc: 'Spółka nie ma innej aktywnej umowy o prowadzenie rejestru.' },
  { kod: 'dane_z_umowy', tresc: 'Dane z umowy spółki przeniesione: seria, numery, uprzywilejowanie, cena emisyjna, wkłady.' },
  { kod: 'ograniczenia', tresc: 'Ograniczenia w rozporządzaniu akcją wprowadzone.' },
  { kod: 'bilans', tresc: 'Bilans akcji zgadza się z liczbą wyemitowanych.' },
  { kod: 'zakres_danych', tresc: 'Umowa spółki nie wymaga ujawniania danych, których system nie obsługuje.' },
  { kod: 'aml', tresc: 'Ustalono zakres AML wobec osób podlegających wpisowi.' },
];

/** Jedna pozycja akcjonariatu w kroku 3 — osoba, ilość, pokrycie, ewentualny wkład pracą/usługami. */
function PozycjaZalozycielska({ pozycja, ustawPozycje, usun, mozna_usunac, wyklucz }) {
  const [wkladNiepieniezny, ustawWkladNiepieniezny] = useState(
    Boolean(pozycja.rodzaj_swiadczenia || pozycja.czas_swiadczenia)
  );

  return (
    <Karta>
      <div className="siatka-2">
        <Pole etykieta="Obejmujący akcje" wymagane>
          <WyborZKartoteki
            wartosc={pozycja.osoba_id}
            wyklucz={wyklucz}
            przyZmianie={(id) => ustawPozycje({ ...pozycja, osoba_id: id })}
          />
        </Pole>
        <Pole etykieta="Liczba akcji" wymagane>
          <PoleLiczbowe
            wartosc={pozycja.ilosc ?? ''}
            sufiks="akcji"
            przyZmianie={(v) => ustawPozycje({ ...pozycja, ilosc: v })}
          />
        </Pole>
      </div>
      <div className="siatka-2">
        <Pole etykieta="Wzmianka o pokryciu" podpowiedz="art. 300(33) § 1 pkt 9 KSH — zostaw puste, jeśli nieustalone.">
          <select
            value={pozycja.pokryta || ''}
            onChange={(z) => ustawPozycje({ ...pozycja, pokryta: z.target.value })}
          >
            <option value="">— nieustalone —</option>
            <option value="tak">pokryta w całości</option>
            <option value="czesciowo">pokryta częściowo</option>
            <option value="nie">niepokryta</option>
          </select>
        </Pole>
        {!wkladNiepieniezny && (
          <Pole
            etykieta="Cena emisyjna (za akcję)"
            podpowiedz="Kwota wniesiona za jedną akcję przez TEGO akcjonariusza — może się różnić między akcjonariuszami. Do kontroli spójności z kapitałem akcyjnym (krok 1)."
          >
            <PoleKwoty
              grosze={pozycja.cena_emisyjna_grosze ?? null}
              przyZmianie={(v) => ustawPozycje({ ...pozycja, cena_emisyjna_grosze: v })}
            />
          </Pole>
        )}
      </div>
      {!wkladNiepieniezny ? (
        <button className="btn btn-maly" onClick={() => ustawWkladNiepieniezny(true)}>
          Wkład w postaci pracy lub usług
        </button>
      ) : (
        <div className="siatka-2">
          <Pole etykieta="Rodzaj świadczenia" podpowiedz="art. 300(9) § 1 KSH — np. świadczenie usług programistycznych.">
            <input
              type="text"
              value={pozycja.rodzaj_swiadczenia || ''}
              onChange={(z) => ustawPozycje({ ...pozycja, rodzaj_swiadczenia: z.target.value })}
            />
          </Pole>
          <Pole etykieta="Czas świadczenia">
            <input
              type="text"
              value={pozycja.czas_swiadczenia || ''}
              onChange={(z) => ustawPozycje({ ...pozycja, czas_swiadczenia: z.target.value })}
              placeholder="np. 24 miesiące od dnia objęcia"
            />
          </Pole>
        </div>
      )}
      <Pole etykieta="Uprawnienia szczególne" podpowiedz="Opcjonalne — zapisze się jako osobny wpis przypisany temu akcjonariuszowi.">
        <textarea
          value={pozycja.uprawnienia_szczegolne || ''}
          onChange={(z) => ustawPozycje({ ...pozycja, uprawnienia_szczegolne: z.target.value })}
        />
      </Pole>
      {mozna_usunac && (
        <button className="btn btn-maly btn-sygnal" onClick={usun}>Usuń</button>
      )}
    </Karta>
  );
}

function EkranNowejSpolki() {
  const [krok, ustawKrok] = useState(0);
  const [dane, ustawDane] = useState(PUSTA_SPOLKA);
  const [surowyJson, ustawSurowyJson] = useState(null);
  const [pokazJson, ustawPokazJson] = useState(false);
  const [skladOrganu, ustawSkladOrganu] = useState([]);
  const [pobieranie, ustawPobieranie] = useState(false);
  const [komunikatKrs, ustawKomunikatKrs] = useState(null);
  const [pobranoZKrsBezAde, ustawPobranoZKrsBezAde] = useState(false);
  const [sadZaproponowany, ustawSadZaproponowany] = useState(false);
  const [umowaZalacznik, ustawUmowaZalacznik] = useState(null);

  const [emisja, ustawEmisje] = useState(PUSTA_EMISJA_ZALOZYCIELSKA);
  const [pozycje, ustawPozycjeState] = useState([{}]);
  const [zgoda, ustawZgode] = useState(PUSTA_ZGODA_SPOLKI);

  // Etap 2.5: data emisji założycielskiej = data zawarcia umowy spółki
  // (krok 1) — autouzupełnienie JEDNORAZOWE, użytkownik może nadpisać.
  // „Data wpisu emisji do KRS” NIE ma tu osobnego stanu — dla emisji
  // założycielskiej zawsze i wyłącznie mirroruje „datę rejestracji w KRS”
  // (pole w kroku 3 jest read-only, patrz niżej), bo emisja pierwotna
  // rejestruje się razem ze spółką, nie osobno.
  useEffect(() => {
    if (dane.data_zawarcia_umowy_spolki && !emisja.data_emisji) {
      ustawEmisje((p) => ({ ...p, data_emisji: dane.data_zawarcia_umowy_spolki }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dane.data_zawarcia_umowy_spolki]);

  useEffect(() => {
    if (dane.data_zawarcia_umowy_spolki && !emisja.podstawa_prawna) {
      ustawEmisje((p) => ({ ...p, podstawa_prawna: `umowa spółki z dnia ${fmt.data(dane.data_zawarcia_umowy_spolki)}` }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dane.data_zawarcia_umowy_spolki]);

  const [odhaczone, ustawOdhaczone] = useState({});
  const [spolkaId, ustawSpolkaId] = useState(null);
  const [zapisywanie, ustawZapisywanie] = useState(false);
  const [blad, ustawBlad] = useState(null);

  const pole = (klucz) => ({
    value: dane[klucz] ?? '',
    onChange: (z) => ustawDane((p) => ({ ...p, [klucz]: z.target.value })),
  });

  async function pobierzZKrs() {
    const numer = String(dane.krs || '').replace(/\D/g, '');
    ustawPobieranie(true);
    ustawKomunikatKrs(null);
    try {
      const wynik = await API.get(`/api/psa/spolki/z-krs/${numer}`);
      ustawSurowyJson(wynik.surowa || null);
      if (!wynik.znaleziono) {
        ustawKomunikatKrs({ odmiana: 'uwaga', tresc: wynik.komunikat });
      } else if (wynik.dopuszczalna === false) {
        ustawKomunikatKrs({ odmiana: 'blad', tresc: wynik.komunikat });
      } else {
        const { sklad_organu, ...reszta } = wynik.dane;
        const pobrane = Object.fromEntries(
          Object.entries(reszta).filter(([, v]) => v !== null && v !== '')
        );
        ustawDane((p) => ({ ...p, ...pobrane }));
        ustawSkladOrganu(sklad_organu || []);
        ustawPobranoZKrsBezAde(!wynik.dane.adres_edorecze);
        ustawSadZaproponowany(Boolean(wynik.sad_rejestrowy_propozycja));
        ustawKomunikatKrs({
          odmiana: (wynik.ostrzezenia || []).length ? 'uwaga' : 'ok',
          tresc: (wynik.ostrzezenia || []).length
            ? wynik.ostrzezenia.join(' ')
            : 'Dane pobrane z rejestru przedsiębiorców. Sprawdź je przed zapisaniem, zwłaszcza sąd rejestrowy — API KRS go nie zwraca, uzupełnij ręcznie.',
        });
        ustawPokazJson(true);
      }
    } catch (e) {
      ustawKomunikatKrs({ odmiana: 'uwaga', tresc: `${e.message} Uzupełnij dane ręcznie.` });
    } finally {
      ustawPobieranie(false);
    }
  }

  function ustawPozycje(i, nowa) {
    ustawPozycjeState((p) => p.map((x, j) => (j === i ? nowa : x)));
  }
  function dodajPozycje() {
    ustawPozycjeState((p) => [...p, {}]);
  }
  function usunPozycje(i) {
    ustawPozycjeState((p) => p.filter((_, j) => j !== i));
  }

  const ileAkcji = Number(emisja.ilosc) || 0;
  const sumaObjeta = pozycje.reduce((s, p) => s + (Number(p.ilosc) || 0), 0);
  const przekroczonyBilans = ileAkcji > 0 && sumaObjeta > ileAkcji;

  // Kontrola spojnosci (etap 2.6): cena emisyjna jest teraz per akcjonariusz
  // (moze sie roznic - np. rozne aporty), nie jedna wspolna cena emisji.
  // Wklad praca/uslugami (art. 300(9) § 1 KSH) nie ma ceny - wylaczony z sumy.
  const pozycjeWyceniane = pozycje.filter((p) => !p.rodzaj_swiadczenia && !p.czas_swiadczenia);
  const sumaWkladowGrosze = pozycjeWyceniane.reduce(
    (s, p) => s + (Number(p.ilosc) || 0) * (Number(p.cena_emisyjna_grosze) || 0),
    0
  );
  const wszystkieWycenione =
    pozycjeWyceniane.length > 0 &&
    pozycjeWyceniane.every((p) => p.cena_emisyjna_grosze != null && p.cena_emisyjna_grosze !== '');
  const kapitalNiezgodny =
    wszystkieWycenione &&
    dane.kapital_akcyjny_grosze != null &&
    sumaWkladowGrosze !== Number(dane.kapital_akcyjny_grosze);

  // Niekompletnosc NIE blokuje juz kreatora (etap 2.7 poprawek) - postanowienie
  // niekompletne jest bezskuteczne, ale to sprawdza sie dopiero przy
  // faktycznym zbyciu akcji (server/logika/walidacje.js), nie przy zakladaniu
  // spolki. Flaga zostaje wylacznie do miekkiego komunikatu informacyjnego.
  const zgodaNiekompletna =
    zgoda.wymaga_zgody_spolki &&
    (!zgoda.zgoda_termin_wskazania_dni || !zgoda.zgoda_cena_opis.trim() || !zgoda.zgoda_termin_zaplaty_dni);

  const mozeDalejZ0 = Boolean(dane.nazwa && dane.nazwa.trim());
  const mozeDalejZ2 =
    Boolean(emisja.seria && emisja.data_emisji) &&
    ileAkcji > 0 &&
    !przekroczonyBilans &&
    pozycje.length > 0 &&
    pozycje.every((p) => p.osoba_id && Number(p.ilosc) > 0);

  const wszystkoOdhaczone = CHECKLISTA_OTWARCIA.every((p) => odhaczone[p.kod]);

  async function otworzRejestr() {
    ustawZapisywanie(true);
    ustawBlad(null);
    try {
      let id = spolkaId;
      if (!id) {
        const wynikSpolki = await API.post('/api/psa/spolki', dane);
        id = wynikSpolki.spolka.id;
        ustawSpolkaId(id);
      }

      if (umowaZalacznik) {
        const formularz = new FormData();
        formularz.append('plik', umowaZalacznik);
        const odpZalacznika = await fetch(`/api/psa/spolki/${id}/umowa-zalacznik`, { method: 'POST', body: formularz });
        if (!odpZalacznika.ok) {
          const tresc = await odpZalacznika.json().catch(() => ({}));
          throw new Error(tresc.blad || `Nie udało się wgrać załącznika umowy (błąd ${odpZalacznika.status}).`);
        }
      }

      const dataOtwarcia = emisja.data_emisji || dane.data_umowy;
      const zdarzenia = [
        {
          typ: 'emisja',
          klucz_tymczasowy: 'emisja-1',
          data_zdarzenia: emisja.data_emisji,
          dane: {
            seria: emisja.seria,
            nr_pierwszy: emisja.nr_pierwszy || 1,
            ilosc: ileAkcji,
            // Bez wspolnej ceny emisyjnej - patrz cena_emisyjna_grosze przy
            // kazdej pozycji akcjonariatu nizej (etap 2.6 poprawek).
            // Emisja zalozycielska rejestruje sie razem ze spolka - zawsze
            // mirroruje date rejestracji w KRS (krok 1), pole w kroku 3 jest
            // read-only (etap 2.5 poprawek).
            data_wpisu_krs: dane.data_utworzenia_spolki || null,
            rodzaj_akcji: emisja.rodzaj_akcji,
            tytul: emisja.tytul,
            podstawa_prawna: emisja.podstawa_prawna || null,
            obowiazki_wobec_spolki: emisja.obowiazki_wobec_spolki,
          },
        },
        {
          typ: 'objecie',
          data_zdarzenia: dataOtwarcia,
          dane: {
            emisja_zdarzenie_id: { __odwolanie_do_partii: 'emisja-1' },
            pozycje: pozycje.map((p) => ({
              osoba_id: p.osoba_id,
              ilosc: Number(p.ilosc),
              pokryta: p.pokryta || null,
              cena_emisyjna_grosze: p.cena_emisyjna_grosze ?? null,
              rodzaj_swiadczenia: p.rodzaj_swiadczenia || null,
              czas_swiadczenia: p.czas_swiadczenia || null,
            })),
          },
        },
      ];

      if (zgoda.wymaga_zgody_spolki || zgoda.prawo_pierwszenstwa) {
        zdarzenia.push({
          typ: 'ograniczenie',
          data_zdarzenia: dataOtwarcia,
          dane: {
            zakres: 'wszystkie',
            wymaga_zgody_spolki: zgoda.wymaga_zgody_spolki,
            tresc_postanowienia: zgoda.wymaga_zgody_spolki ? zgoda.tresc_postanowienia || null : null,
            zgoda_termin_wskazania_dni: zgoda.wymaga_zgody_spolki ? zgoda.zgoda_termin_wskazania_dni || null : null,
            zgoda_cena_opis: zgoda.wymaga_zgody_spolki ? zgoda.zgoda_cena_opis || null : null,
            zgoda_termin_zaplaty_dni: zgoda.wymaga_zgody_spolki ? zgoda.zgoda_termin_zaplaty_dni || null : null,
            prawo_pierwszenstwa: zgoda.prawo_pierwszenstwa,
            opis: 'Ograniczenie ustanowione umową spółki, odnotowane przy otwarciu rejestru.',
          },
        });
      }

      for (const p of pozycje) {
        if (p.uprawnienia_szczegolne && p.uprawnienia_szczegolne.trim()) {
          zdarzenia.push({
            typ: 'uprawnienie',
            data_zdarzenia: dataOtwarcia,
            dane: {
              rodzaj: 'uprawnienie',
              zakres: 'akcjonariusz',
              osoba_id: p.osoba_id,
              tresc: p.uprawnienia_szczegolne.trim(),
            },
          });
        }
      }

      await API.post(`/api/psa/spolki/${id}/otworz-rejestr`, { zdarzenia });
      idz(`/spolki/${id}`);
    } catch (e) {
      const szczegoly = e.dane && Array.isArray(e.dane.bledy) ? e.dane.bledy : null;
      ustawBlad(szczegoly && szczegoly.length ? szczegoly.join(' ') : e.message);
    } finally {
      ustawZapisywanie(false);
    }
  }

  return (
    <>
      <div className="okruszki">
        <button onClick={() => idz('/spolki')}>Spółki</button> → nowa spółka
      </div>
      <div className="pasek-gorny">
        <div>
          <div className="tytul-strony">Nowa spółka</div>
          <div className="podtytul-strony">
            Rejestr prowadzimy wyłącznie dla prostych spółek akcyjnych — art. 300(31) § 1 KSH.
            Spółka w chwili powstania ma już akcje — kreator odzwierciedla to od razu.
          </div>
        </div>
      </div>

      <Kroki kroki={KROKI_REJESTRACJI} biezacy={krok} />
      <Komunikat odmiana="blad" tresc={blad} />

      <Karta>
        {krok === 0 && (
          <>
            <Pole
              etykieta="Numer KRS"
              podpowiedz="Dziesięć cyfr. Dane pobierzemy z otwartego API rejestru przedsiębiorców; przy niepowodzeniu uzupełnisz je ręcznie — awaria API nie blokuje rejestracji."
            >
              <div className="row-g">
                <input type="text" {...pole('krs')} maxLength={10} placeholder="0000123456" />
                <button
                  className="btn"
                  onClick={pobierzZKrs}
                  disabled={pobieranie || String(dane.krs || '').replace(/\D/g, '').length !== 10}
                >
                  {pobieranie ? 'Pobieranie…' : 'Pobierz z KRS'}
                </button>
              </div>
            </Pole>

            {komunikatKrs && <Komunikat odmiana={komunikatKrs.odmiana} tresc={komunikatKrs.tresc} />}

            {surowyJson && (
              <Pole etykieta="Surowa odpowiedź API KRS" podpowiedz="Sprawdź na żywych danych, że mapowanie poniższych pól jest poprawne — zwłaszcza kapitał akcyjny i adres do doręczeń elektronicznych.">
                <button className="btn btn-maly" onClick={() => ustawPokazJson((p) => !p)}>
                  {pokazJson ? 'Ukryj surowy JSON' : 'Pokaż surowy JSON'}
                </button>
                {pokazJson && (
                  <pre className="dane" style={{ maxHeight: 320, overflow: 'auto', padding: 12, background: 'var(--karta)', border: '1px solid var(--linia)', borderRadius: 'var(--r-sm)', marginTop: 8 }}>
                    {JSON.stringify(surowyJson, null, 2)}
                  </pre>
                )}
              </Pole>
            )}

            <Pole etykieta="Firma (nazwa) spółki" wymagane>
              <input type="text" {...pole('nazwa')} />
            </Pole>
            <Pole
              etykieta="Forma prawna"
              podpowiedz="Notariusz nie może prowadzić rejestru akcjonariuszy S.A. ani S.K.A."
              wymagane
            >
              <input type="text" {...pole('forma_prawna')} />
            </Pole>
            <Pole
              etykieta="Organ zarządzający"
              podpowiedz="P.S.A. może mieć zarząd albo (struktura monistyczna) radę dyrektorów — decyduje umowa spółki. Widoczne na pismach jako adresat po stronie spółki."
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
            <div className="siatka-2">
              <Pole etykieta="Kod pocztowy"><input type="text" {...pole('kod_pocztowy')} /></Pole>
              <Pole etykieta="Miejscowość"><input type="text" {...pole('miejscowosc')} /></Pole>
            </div>
            <div className="siatka-3">
              <Pole etykieta="Ulica"><input type="text" {...pole('ulica')} /></Pole>
              <Pole etykieta="Nr domu"><input type="text" {...pole('nr_domu')} /></Pole>
              <Pole etykieta="Nr lokalu"><input type="text" {...pole('nr_lokalu')} /></Pole>
            </div>
            <div className="siatka-2">
              <Pole
                etykieta="Sąd rejestrowy"
                podpowiedz={sadZaproponowany ? 'Zaproponowano na podstawie siedziby spółki — sprawdź przed zapisaniem.' : undefined}
              >
                <input type="text" {...pole('sad_rejestrowy')} />
              </Pole>
              <Pole etykieta="Wydział"><input type="text" {...pole('wydzial')} /></Pole>
            </div>
            <div className="siatka-3">
              <Pole etykieta="Telefon"><input type="text" {...pole('telefon')} /></Pole>
              <Pole etykieta="E-mail"><input type="text" {...pole('email')} /></Pole>
              <Pole
                etykieta="Adres do doręczeń elektronicznych"
                podpowiedz={pobranoZKrsBezAde ? 'Brak w KRS — uzupełnij ręcznie. ADE często nie jest ujawniony w KRS, tylko w bazie adresów elektronicznych.' : undefined}
              >
                <input type="text" {...pole('adres_edorecze')} placeholder="AE:PL-…" />
              </Pole>
            </div>
            <div className="siatka-2">
              <Pole etykieta="Data rejestracji w KRS">
                <PoleDaty wartosc={dane.data_utworzenia_spolki} przyZmianie={(v) => ustawDane((p) => ({ ...p, data_utworzenia_spolki: v }))} />
              </Pole>
              <Pole etykieta="Kapitał akcyjny">
                <PoleKwoty grosze={dane.kapital_akcyjny_grosze} przyZmianie={(v) => ustawDane((p) => ({ ...p, kapital_akcyjny_grosze: v }))} />
              </Pole>
            </div>
            <Pole
              etykieta="Data zawarcia umowy spółki"
              podpowiedz="Data aktu notarialnego zawiązania spółki — przy spółce zakładanej w S24 data podpisania w systemie. Różna od daty rejestracji w KRS powyżej. Uzupełnia „datę emisji” pierwszej emisji w kroku 3."
            >
              <PoleDaty
                wartosc={dane.data_zawarcia_umowy_spolki}
                przyZmianie={(v) => ustawDane((p) => ({ ...p, data_zawarcia_umowy_spolki: v }))}
              />
            </Pole>

            {skladOrganu.length > 0 && (
              <Pole etykieta="Skład organu reprezentującego" podpowiedz="Wyłącznie informacyjne — rejestr akcjonariuszy nie prowadzi własnej ewidencji osób w organach spółki.">
                <div className="lista-wierszy">
                  {skladOrganu.map((o, i) => (
                    <div key={i} className="wiersz-podtytul">
                      {[o.imiona, o.nazwisko].filter(Boolean).join(' ')}
                      {o.funkcja ? ` — ${o.funkcja}` : ''}
                    </div>
                  ))}
                </div>
              </Pole>
            )}
          </>
        )}

        {krok === 1 && (
          <>
            <div className="card-h">Umowa o prowadzenie rejestru</div>
            <div className="siatka-3">
              <Pole etykieta="Data uchwały o wyborze" podpowiedz="art. 300(32) § 1 KSH">
                <PoleDaty wartosc={dane.data_uchwaly_wyboru} przyZmianie={(v) => ustawDane((p) => ({ ...p, data_uchwaly_wyboru: v }))} />
              </Pole>
              <Pole etykieta="Data umowy o prowadzenie rejestru">
                <PoleDaty wartosc={dane.data_umowy} przyZmianie={(v) => ustawDane((p) => ({ ...p, data_umowy: v }))} />
              </Pole>
              <Pole etykieta="Data otwarcia rejestru">
                <PoleDaty wartosc={dane.data_otwarcia_rejestru} przyZmianie={(v) => ustawDane((p) => ({ ...p, data_otwarcia_rejestru: v }))} />
              </Pole>
            </div>
            <div className="siatka-2">
              <Pole etykieta="Sposób zawarcia umowy" wymagane>
                <select {...pole('umowa_sposob_zawarcia')}>
                  <option value="">— wybierz —</option>
                  <option value="pisemna">pisemna</option>
                  <option value="elektroniczna_kwalifikowany">elektroniczna, z podpisem kwalifikowanym</option>
                </select>
              </Pole>
              <Pole etykieta="Skan / plik umowy (PDF)" podpowiedz="Załącznik do już zawartej umowy.">
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(z) => ustawUmowaZalacznik(z.target.files[0] || null)}
                />
                {umowaZalacznik && <div className="podpowiedz">{umowaZalacznik.name}</div>}
              </Pole>
            </div>

            <div className="rozdzielacz" />
            <div className="card-h">Reprezentant spółki, który podpisał umowę</div>
            <Komunikat
              odmiana="info"
              tresc="Osoba, która w imieniu SPÓŁKI podpisała już zawartą umowę o prowadzenie rejestru. Wpisz dane dokładnie tak, jak widnieją w dokumencie tożsamości — pisma używają ich w tej samej postaci."
            />
            <div className="siatka-2">
              <Pole etykieta="Imię i nazwisko">
                <input type="text" {...pole('reprezentant_imie_nazwisko')} placeholder="np. Jan Kowalski" />
              </Pole>
              <Pole etykieta="Funkcja">
                <input type="text" {...pole('reprezentant_funkcja')} placeholder="np. Prezes Zarządu" />
              </Pole>
            </div>
            <div className="siatka-2">
              <Pole etykieta="Sposób reprezentacji">
                <input type="text" {...pole('reprezentant_reprezentacja')} placeholder="np. samodzielnie" />
              </Pole>
              <Pole etykieta="Imiona rodziców">
                <input type="text" {...pole('reprezentant_rodzice')} placeholder="np. Piotr i Anna" />
              </Pole>
            </div>
            <div className="siatka-2">
              <Pole etykieta="Dowód osobisty">
                <input type="text" {...pole('reprezentant_dowod')} />
              </Pole>
              <Pole etykieta="PESEL"><input type="text" {...pole('reprezentant_pesel')} maxLength={11} /></Pole>
            </div>
            <div className="siatka-2">
              <Pole etykieta="Adres zamieszkania"><input type="text" {...pole('reprezentant_adres')} /></Pole>
              <Pole etykieta="Adres e-mail" podpowiedz="Korespondencja w sprawie umowy o prowadzenie rejestru.">
                <input type="email" {...pole('reprezentant_email')} />
              </Pole>
            </div>

            <div className="rozdzielacz" />
            <div className="card-h">Ograniczenia z umowy spółki</div>
            <Komunikat
              odmiana="info"
              tresc="Dane o ograniczeniach z umowy spółki (art. 300(34) § 6 KSH) służą przyszłej kontroli przy zbyciu akcji. Uzupełnij, co wiesz teraz — resztę można dopisać później, przed pierwszym zbyciem."
            />

            <label className="chk">
              <input
                type="checkbox"
                checked={zgoda.wymaga_zgody_spolki}
                onChange={(z) => ustawZgode((p) => ({ ...p, wymaga_zgody_spolki: z.target.checked }))}
              />
              <span className="chk-tresc">
                Zbycie akcji wymaga zgody spółki
                <div className="podstawa-prawna">art. 300(39) § 1, 3 KSH</div>
              </span>
            </label>
            {zgoda.wymaga_zgody_spolki && (
              <>
                <Pole
                  etykieta="Treść postanowienia umowy spółki"
                  podpowiedz="Dosłowny cytat klauzuli — przydatny przy zbyciu akcji, nawet zanim szczegóły niżej zostaną ustalone."
                >
                  <textarea
                    value={zgoda.tresc_postanowienia}
                    onChange={(z) => ustawZgode((p) => ({ ...p, tresc_postanowienia: z.target.value }))}
                  />
                </Pole>
                <Sekcja tytul="Szczegóły postanowienia (termin, cena, zapłata) — opcjonalne teraz">
                  <div className="siatka-3">
                    <Pole etykieta="Termin wskazania innego nabywcy (dni)" podpowiedz="Nie dłuższy niż miesiąc (art. 300(39) § 3 KSH).">
                      <PoleLiczbowe sufiks="dni" max={31} wartosc={zgoda.zgoda_termin_wskazania_dni} przyZmianie={(v) => ustawZgode((p) => ({ ...p, zgoda_termin_wskazania_dni: v }))} />
                    </Pole>
                    <Pole etykieta="Termin zapłaty (dni)">
                      <PoleLiczbowe sufiks="dni" wartosc={zgoda.zgoda_termin_zaplaty_dni} przyZmianie={(v) => ustawZgode((p) => ({ ...p, zgoda_termin_zaplaty_dni: v }))} />
                    </Pole>
                    <Pole etykieta="Sposób ustalenia ceny">
                      <input type="text" value={zgoda.zgoda_cena_opis} onChange={(z) => ustawZgode((p) => ({ ...p, zgoda_cena_opis: z.target.value }))} />
                    </Pole>
                  </div>
                </Sekcja>
                {zgodaNiekompletna && (
                  <Komunikat
                    odmiana="info"
                    tresc="Postanowienie jest na razie bezskuteczne bez kompletu tych trzech pól (art. 300(39) KSH) — można je uzupełnić później, przed pierwszym wpisem zbycia akcji tej spółki."
                  />
                )}
              </>
            )}

            <Sekcja tytul="Postanowienia umowy spółki" domyslnieOtwarta>
              <label className="chk">
                <input
                  type="checkbox"
                  checked={zgoda.prawo_pierwszenstwa}
                  onChange={(z) => ustawZgode((p) => ({ ...p, prawo_pierwszenstwa: z.target.checked }))}
                />
                <span className="chk-tresc">
                  Pozostałym akcjonariuszom przysługuje prawo pierwszeństwa
                  <div className="podstawa-prawna">art. 300(42) KSH</div>
                </span>
              </label>

              <Pole etykieta="Zakaz prawa głosu zastawnika lub użytkownika" podpowiedz="art. 300(23) § 2 KSH">
                <select {...pole('zakaz_glosu_zastawnika_umowa')}>
                  <option value="">umowa spółki nie ogranicza</option>
                  <option value="zakazane">umowa spółki zakazuje wprost</option>
                  <option value="wymaga_zgody_organu">umowa spółki uzależnia od zgody organu</option>
                </select>
              </Pole>
              <Pole etykieta="Ograniczenie podziału akcji między spadkobierców" podpowiedz="art. 300(41) § 3 KSH — treść klauzuli, zostaw puste jeśli umowa spółki nie ogranicza.">
                <textarea {...pole('ograniczenie_dziedziczenia_umowa')} />
              </Pole>
            </Sekcja>

            <Pole etykieta="Dodatkowe informacje ujawniane w rejestrze" podpowiedz="art. 300(33) § 2 KSH">
              <textarea {...pole('dodatkowe_informacje_umowa_spolki')} />
            </Pole>
          </>
        )}

        {krok === 2 && (
          <>
            <div className="card-h">Pierwsza emisja</div>
            <div className="siatka-3">
              <Pole etykieta="Oznaczenie serii" wymagane>
                <input type="text" value={emisja.seria} onChange={(z) => ustawEmisje((p) => ({ ...p, seria: z.target.value }))} placeholder="A" />
              </Pole>
              <Pole etykieta="Liczba akcji" wymagane>
                <PoleLiczbowe sufiks="akcji" wartosc={emisja.ilosc} przyZmianie={(v) => ustawEmisje((p) => ({ ...p, ilosc: v }))} />
              </Pole>
              <Pole etykieta="Numer pierwszej akcji" podpowiedz="Domyślnie 1.">
                <PoleLiczbowe wartosc={emisja.nr_pierwszy} przyZmianie={(v) => ustawEmisje((p) => ({ ...p, nr_pierwszy: v || 1 }))} />
              </Pole>
            </div>
            <div className="siatka-3">
              <Pole
                etykieta="Data emisji"
                wymagane
                podpowiedz="Przy emisji założycielskiej to data zawarcia umowy spółki (krok 1) — uzupełniona automatycznie, można nadpisać."
              >
                <PoleDaty wartosc={emisja.data_emisji} przyZmianie={(v) => ustawEmisje((p) => ({ ...p, data_emisji: v }))} />
              </Pole>
              <Pole
                etykieta="Data wpisu emisji do KRS"
                podpowiedz="Emisja założycielska rejestruje się razem ze spółką — to zawsze data rejestracji w KRS z kroku 1. Bez tej daty nie można dokonać wpisu akcji do rejestru akcjonariuszy (art. 300(30) § 2 KSH)."
              >
                <PoleDaty wartosc={dane.data_utworzenia_spolki} wylaczone />
              </Pole>
              <Pole etykieta="Rodzaj akcji" podpowiedz="art. 300(33) § 1 pkt 4 KSH">
                <select value={emisja.rodzaj_akcji} onChange={(z) => ustawEmisje((p) => ({ ...p, rodzaj_akcji: z.target.value }))}>
                  <option value="zwykla">zwykła</option>
                  <option value="uprzywilejowana">uprzywilejowana</option>
                  <option value="zalozycielska">założycielska</option>
                  <option value="niema">niema</option>
                </select>
              </Pole>
            </div>
            <Pole etykieta="Tytuł emisji"><input type="text" value={emisja.tytul} onChange={(z) => ustawEmisje((p) => ({ ...p, tytul: z.target.value }))} placeholder="Emisja założycielska" /></Pole>
            <Pole etykieta="Podstawa emisji" podpowiedz='Np. „umowa spółki z dnia 04.07.2024” — uzupełniona automatycznie, można nadpisać.'>
              <input type="text" value={emisja.podstawa_prawna} onChange={(z) => ustawEmisje((p) => ({ ...p, podstawa_prawna: z.target.value }))} />
            </Pole>
            <Pole etykieta="Obowiązki wobec spółki związane z akcją" podpowiedz="art. 300(33) § 1 pkt 11 KSH — opcjonalne.">
              <textarea value={emisja.obowiazki_wobec_spolki} onChange={(z) => ustawEmisje((p) => ({ ...p, obowiazki_wobec_spolki: z.target.value }))} />
            </Pole>

            <div className="rozdzielacz" />
            <div className="card-h">Akcjonariat</div>
            {pozycje.map((p, i) => (
              <PozycjaZalozycielska
                key={i}
                pozycja={p}
                ustawPozycje={(nowa) => ustawPozycje(i, nowa)}
                usun={() => usunPozycje(i)}
                mozna_usunac={pozycje.length > 1}
                wyklucz={pozycje.filter((_, j) => j !== i).map((x) => x.osoba_id).filter(Boolean)}
              />
            ))}
            <button className="btn btn-maly" onClick={dodajPozycje}>+ Dodaj akcjonariusza</button>

            <Komunikat
              odmiana={przekroczonyBilans ? 'blad' : 'info'}
              tresc={
                `Objęto ${fmt.liczba(sumaObjeta)} z ${fmt.liczba(ileAkcji)} wyemitowanych akcji.` +
                (przekroczonyBilans ? ' To więcej niż wyemitowano — zmniejsz którąś z pozycji.' : '') +
                (!przekroczonyBilans && sumaObjeta < ileAkcji && ileAkcji > 0 ? ' Reszta zostanie zapisana jako nieobjęta.' : '')
              }
            />
            {pozycjeWyceniane.length > 0 && sumaWkladowGrosze > 0 && (
              <Komunikat
                odmiana={kapitalNiezgodny ? 'uwaga' : 'info'}
                tresc={
                  `Suma wkładów pieniężnych i aportowych: ${fmt.zlote(sumaWkladowGrosze)}` +
                  (dane.kapital_akcyjny_grosze != null ? ` — kapitał akcyjny z KRS: ${fmt.zlote(dane.kapital_akcyjny_grosze)}.` : '.') +
                  (kapitalNiezgodny ? ' Kwoty się różnią — sprawdź przed otwarciem rejestru.' : '') +
                  (!wszystkieWycenione ? ' Nie wszystkie pozycje mają wpisaną cenę emisyjną — suma jest niepełna.' : '')
                }
              />
            )}
          </>
        )}

        {krok === 3 && (
          <>
            <div className="card-h">Weryfikacja przed otwarciem rejestru</div>
            <div className="checklista">
              {CHECKLISTA_OTWARCIA.map((p) => (
                <label key={p.kod} className="chk">
                  <input
                    type="checkbox"
                    checked={Boolean(odhaczone[p.kod])}
                    onChange={(z) => ustawOdhaczone((o) => ({ ...o, [p.kod]: z.target.checked }))}
                  />
                  <span className="chk-tresc">{p.tresc}</span>
                </label>
              ))}
            </div>
            <Komunikat
              odmiana="info"
              tresc={`${dane.nazwa || '(bez nazwy)'} — seria ${emisja.seria || '?'}, ${fmt.liczba(ileAkcji)} akcji, ${pozycje.length} ${fmt.odmien(pozycje.length, 'akcjonariusz', 'akcjonariuszy', 'akcjonariuszy')}.`}
            />
            {!wszystkoOdhaczone && (
              <div className="podstawa-prawna">Przycisk „Otwórz rejestr” pozostaje nieaktywny do czasu odhaczenia całej checklisty.</div>
            )}
          </>
        )}

        <div className="kreator-stopka">
          <button
            className="btn"
            onClick={() => (krok === 0 ? idz('/spolki') : ustawKrok((k) => k - 1))}
          >
            {krok === 0 ? 'Anuluj' : 'Wstecz'}
          </button>
          <div className="kreator-stopka-prawa">
            {krok < KROKI_REJESTRACJI.length - 1 ? (
              <button
                className="btn btn-glowny"
                disabled={(krok === 0 && !mozeDalejZ0) || (krok === 2 && !mozeDalejZ2)}
                onClick={() => ustawKrok((k) => k + 1)}
              >
                Dalej
              </button>
            ) : (
              <button className="btn btn-glowny btn-duzy" onClick={otworzRejestr} disabled={!wszystkoOdhaczone || zapisywanie}>
                {zapisywanie ? 'Otwieranie rejestru…' : 'Otwórz rejestr'}
              </button>
            )}
          </div>
        </div>
      </Karta>
    </>
  );
}

function EkranSpolek() {
  const [szukaj, ustawSzukaj] = useState('');
  const [zapytanie, ustawZapytanie] = useState('');
  const [status, ustawStatus] = useState('wszystkie');
  const [strona, ustawStrone] = useState(1);
  const { dane, ladowanie } = useDane(`/api/psa/spolki?q=${encodeURIComponent(zapytanie)}`);

  useEffect(() => {
    const uchwyt = setTimeout(() => ustawZapytanie(szukaj), 250);
    return () => clearTimeout(uchwyt);
  }, [szukaj]);

  const spolki = (dane && dane.spolki) || [];

  // Filtrowanie i stronicowanie po stronie klienta: endpoint zwraca komplet,
  // a przy 500 rejestrach lista i tak mieści się w jednym zapytaniu.
  const widoczne = spolki.filter((s) => status === 'wszystkie' || s.status === status);
  const NA_STRONE = 12;
  const stron = Math.max(Math.ceil(widoczne.length / NA_STRONE), 1);
  const biezaca = Math.min(strona, stron);
  const wycinek = widoczne.slice((biezaca - 1) * NA_STRONE, biezaca * NA_STRONE);

  return (
    <>
      <div className="pasek-narzedzi">
        <Szukajka
          wartosc={szukaj}
          przyZmianie={(v) => { ustawSzukaj(v); ustawStrone(1); }}
          placeholder="Szukaj po nazwie, numerze KRS lub NIP…"
        />
        <select value={status} onChange={(z) => { ustawStatus(z.target.value); ustawStrone(1); }}>
          <option value="wszystkie">Status: wszystkie</option>
          <option value="aktywna">aktywna</option>
          <option value="w_likwidacji">w likwidacji</option>
          <option value="zawieszona">zawieszona</option>
          <option value="wykreslona">wykreślona</option>
        </select>
        <span className="podstawa-prawna" style={{ marginLeft: 'auto' }}>
          {widoczne.length === spolki.length
            ? `${fmt.liczba(spolki.length)} ${fmt.odmien(spolki.length, 'rejestr', 'rejestry', 'rejestrów')}`
            : `${fmt.liczba(widoczne.length)} z ${fmt.liczba(spolki.length)}`}
        </span>
        <button className="btn btn-glowny" onClick={() => idz('/spolki/nowa')}>
          <Ikona nazwa="plus" rozmiar={16} /> Dodaj spółkę
        </button>
      </div>

      {ladowanie ? (
        <Spinner />
      ) : widoczne.length === 0 ? (
        <Karta>
          <Pusto
            ikona="spolki"
            tytul={zapytanie || status !== 'wszystkie' ? 'Nic nie pasuje do filtrów' : 'Nie prowadzisz jeszcze żadnego rejestru'}
            opis={
              zapytanie || status !== 'wszystkie'
                ? 'Zmień frazę wyszukiwania albo status, żeby zobaczyć więcej.'
                : 'Dodaj spółkę, żeby otworzyć dla niej rejestr akcjonariuszy.'
            }
            akcja={
              zapytanie || status !== 'wszystkie' ? (
                <button className="btn" onClick={() => { ustawSzukaj(''); ustawStatus('wszystkie'); }}>
                  Wyczyść filtry
                </button>
              ) : (
                <button className="btn btn-glowny" onClick={() => idz('/spolki/nowa')}>
                  <Ikona nazwa="plus" rozmiar={16} /> Dodaj spółkę
                </button>
              )
            }
          />
        </Karta>
      ) : (
        <Karta scisla>
          <table className="tabela">
            <thead>
              <tr>
                <th>Spółka</th>
                <th>Status</th>
                <th className="do-prawej">Serie</th>
                <th className="do-prawej">Akcjonariusze</th>
                <th className="do-prawej">Akcje</th>
                <th>Ostatnie zdarzenie</th>
                <th className="kol-strzalka" />
              </tr>
            </thead>
            <tbody>
              {wycinek.map((s) => (
                <tr key={s.id} className="klikalna" onClick={() => idz(`/spolki/${s.id}`)}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{s.nazwa}</div>
                    <div className="wiersz-podtytul">
                      {s.krs ? `KRS ${s.krs}` : 'bez numeru KRS'}
                      {s.miejscowosc ? ` · ${s.miejscowosc}` : ''}
                    </div>
                  </td>
                  <td><StatusSpolki status={s.status} /></td>
                  <td className="do-prawej">{fmt.liczba(s.liczba_emisji)}</td>
                  <td className="do-prawej">{fmt.liczba(s.liczba_akcjonariuszy)}</td>
                  <td className="do-prawej">{fmt.liczba(s.liczba_akcji)}</td>
                  <td className="kol-dane wyciszony">{fmt.data(s.ostatnie_zdarzenie)}</td>
                  <td className="kol-strzalka"><Ikona nazwa="strzalkaPrawo" rozmiar={15} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <Stronicowanie
            strona={biezaca}
            stron={stron}
            odPozycji={(biezaca - 1) * NA_STRONE + 1}
            doPozycji={Math.min(biezaca * NA_STRONE, widoczne.length)}
            razem={widoczne.length}
            przyZmianie={ustawStrone}
          />
        </Karta>
      )}
    </>
  );
}


window.EkranSpolek = EkranSpolek;
window.EkranNowejSpolki = EkranNowejSpolki;
