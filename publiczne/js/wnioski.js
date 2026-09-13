/* wnioski.js — wniosek klienta po stronie kancelarii.

   Ekran prowadzi przez to samo, co klient wypełniał w portalu, tylko z drugiej
   strony biurka: dane spółki, akcjonariusze, komplet dokumentów, decyzja.
   Zakładki, karty podmiotów i typografia są TE SAME, co w portalu klienta —
   rozmowa o jednym wniosku toczy się po dwóch stronach tego samego ekranu,
   więc nie ma powodu, żeby każda strona wyglądała inaczej.

   Przebieg: klient składa wniosek (status `zlozony`) — i na tym koniec, żaden
   dokument jeszcze nie powstaje. Kancelaria sprawdza dane, w razie potrzeby
   poprawia je i dociąga z KRS, po czym WYSTAWIA komplet dokumentów, czyta go,
   poprawia treść, gdzie trzeba, i dopiero wtedy UDOSTĘPNIA klientowi do
   podpisu. Dawniej komplet powstawał sam w chwili złożenia wniosku, więc
   literówka klienta wędrowała wprost do umowy. */

const STAN_WNIOSKU = {
  w_przygotowaniu: { etykieta: 'w przygotowaniu', znacznik: 'neutralny' },
  zlozony: { etykieta: 'złożony — do sprawdzenia', znacznik: 'mosiadz' },
  do_uzupelnienia: { etykieta: 'odesłany do uzupełnienia', znacznik: 'bordo' },
  umowa_wygenerowana: { etykieta: 'dokumenty u klienta', znacznik: 'neutralny' },
  umowa_podpisana: { etykieta: 'podpisane — do przyjęcia', znacznik: 'zielony' },
  przyjety: { etykieta: 'przyjęty', znacznik: 'zielony' },
  odrzucony: { etykieta: 'odrzucony', znacznik: 'bordo' },
};

function ZnacznikWniosku({ status }) {
  const s = STAN_WNIOSKU[status] || { etykieta: status, znacznik: 'neutralny' };
  return <Znacznik odmiana={s.znacznik}>{s.etykieta}</Znacznik>;
}

function EkranWnioski() {
  const [filtrStatus, ustawFiltrStatus] = useState('');
  const { dane, ladowanie } = useDane(`/api/psa/wnioski${filtrStatus ? `?status=${filtrStatus}` : ''}`, [filtrStatus]);
  const wnioski = (dane && dane.wnioski) || [];

  return (
    <>
      <div className="pasek-narzedzi">
        <select value={filtrStatus} onChange={(z) => ustawFiltrStatus(z.target.value)}>
          <option value="">Wszystkie statusy</option>
          {Object.entries(STAN_WNIOSKU).map(([k, v]) => (
            <option key={k} value={k}>{v.etykieta}</option>
          ))}
        </select>
      </div>

      {ladowanie ? (
        <Spinner />
      ) : wnioski.length === 0 ? (
        <Karta>
          <Pusto tytul="Brak wniosków" opis="Wnioski trafiają tu, gdy klient założy je w portalu po otrzymaniu zaproszenia." />
        </Karta>
      ) : (
        <Karta scisla>
          <table className="tabela">
            <thead>
              <tr>
                <th>Zaktualizowano</th>
                <th>Spółka</th>
                <th>E-mail klienta</th>
                <th>Akcjonariusze</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {wnioski.map((w) => (
                <tr key={w.id} className="klikalna" onClick={() => idz(`/wnioski/${w.id}`)}>
                  <td className="wyciszony">{fmt.dataCzas(w.zaktualizowano || w.utworzono)}</td>
                  <td>{w.nazwa || '— nieuzupełniona —'}</td>
                  <td>{w.konto_email}</td>
                  <td>{w.liczba_akcjonariuszy}</td>
                  <td><ZnacznikWniosku status={w.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Karta>
      )}
    </>
  );
}

/* ─────────────────────────────────────────────────────
   OPISY DANYCH — te same słowa, które widzi klient
   ───────────────────────────────────────────────────── */

const OPIS_ADRESU_REJESTROWEGO_WNIOSKU = {
  zamieszkania: 'adres zamieszkania / siedziby',
  doreczen: 'inny adres do doręczeń',
  edoreczen: 'adres do e-Doręczeń',
};
const OPIS_ZGODY_EMAIL_WNIOSKU = {
  brak: 'bez zgody na e-mail',
  zadeklarowana: 'zgoda na e-mail zadeklarowana — czeka na oświadczenie',
  potwierdzona: 'zgoda na e-mail potwierdzona',
};
const OPIS_WSPOLWLASNOSCI_WNIOSKU = {
  laczna: 'współwłasność łączna',
  ulamkowa: 'współwłasność ułamkowa',
};
// Status PEP decyduje o WZMOŻONYCH środkach bezpieczeństwa finansowego
// (art. 46 ustawy o przeciwdziałaniu praniu pieniędzy), więc notariusz musi
// go zobaczyć, zanim wniosek przyjmie.
const OPIS_PEP_WNIOSKU = {
  tak: 'PEP — eksponowane stanowisko polityczne',
  rodzina: 'PEP — członek rodziny osoby na eksponowanym stanowisku',
  wspolpracownik: 'PEP — bliski współpracownik osoby na eksponowanym stanowisku',
};

/** Pola korekty danych spółki — pogrupowane tak, jak w formularzu klienta. */
const GRUPY_POL_SPOLKI = [
  {
    tytul: 'Spółka',
    pola: [
      ['nazwa', 'Firma (nazwa) spółki'], ['krs', 'Numer KRS'], ['nip', 'NIP'], ['regon', 'REGON'],
    ],
  },
  {
    tytul: 'Siedziba',
    pola: [
      ['kod_pocztowy', 'Kod pocztowy'], ['miejscowosc', 'Miejscowość'],
      ['ulica', 'Ulica'], ['nr_domu', 'Nr domu'], ['nr_lokalu', 'Nr lokalu'],
      ['sad_rejestrowy', 'Sąd rejestrowy'], ['wydzial', 'Wydział'],
    ],
  },
  {
    tytul: 'Kontakt',
    pola: [['telefon', 'Telefon'], ['email', 'E-mail'], ['adres_edorecze', 'Adres do e-Doręczeń']],
  },
  {
    tytul: 'Reprezentant podpisujący umowę',
    pola: [
      ['reprezentant_imie_nazwisko', 'Imię i nazwisko'],
      ['reprezentant_funkcja', 'Funkcja'],
      ['reprezentant_pesel', 'PESEL'],
      ['reprezentant_dowod', 'Dowód osobisty'],
      ['reprezentant_rodzice', 'Imiona rodziców'],
      ['reprezentant_adres', 'Adres zamieszkania'],
      ['reprezentant_email', 'E-mail'],
    ],
  },
];

const POLA_KOREKTY_AKCJONARIUSZA = [
  ['nazwisko', 'Nazwisko'], ['imie', 'Imię'], ['nazwa', 'Firma (nazwa)'],
  ['pesel', 'PESEL'], ['data_urodzenia', 'Data urodzenia'],
  ['numer_w_rejestrze', 'Numer w rejestrze'], ['nazwa_rejestru', 'Nazwa rejestru'],
  ['kod_pocztowy', 'Kod pocztowy'], ['miejscowosc', 'Miejscowość'], ['ulica', 'Ulica'],
  ['nr_domu', 'Nr domu'], ['nr_lokalu', 'Nr lokalu'],
  ['adres_doreczen', 'Inny adres do doręczeń'], ['adres_edoreczen', 'Adres do e-Doręczeń'],
  ['email', 'E-mail'], ['telefon', 'Telefon'],
  ['wspolwlasciciele', 'Pozostali współwłaściciele'],
];

function nazwaPozycji(a) {
  if (a.typ === 'prawna') return a.nazwa || '— podmiot bez nazwy —';
  return [a.imie, a.nazwisko].filter(Boolean).join(' ') || '— dane nieuzupełnione —';
}

/** Identyfikator ustawowy: PESEL albo data urodzenia; dla podmiotu numer w rejestrze. */
function identyfikatorPozycji(a) {
  if (a.typ === 'prawna') {
    if (a.numer_w_rejestrze) return `${a.nazwa_rejestru || 'rejestr'} ${a.numer_w_rejestrze}`;
    if (a.nip) return `NIP ${a.nip}`;
    return 'bez numeru w rejestrze';
  }
  if (a.pesel) return `PESEL ${a.pesel}`;
  if (a.data_urodzenia) return `ur. ${fmt.data(a.data_urodzenia)}`;
  return 'bez PESEL-u i daty urodzenia';
}

/** Adres tak, jak go podano — nie nazwa rubryki, tylko jej treść. */
function adresPozycji(a) {
  const linia = [
    [a.kod_pocztowy, a.miejscowosc].filter(Boolean).join(' ').trim(),
    [a.ulica, a.nr_domu, a.nr_lokalu && `m. ${a.nr_lokalu}`].filter(Boolean).join(' ').trim(),
  ].filter(Boolean).join(', ');
  if (linia) return linia;
  if (a.adres_doreczen) return `do doręczeń: ${a.adres_doreczen}`;
  if (a.adres_edoreczen) return `e-Doręczenia: ${a.adres_edoreczen}`;
  return 'brak adresu';
}

/* ─────────────────────────────────────────────────────
   PORÓWNANIE Z ODPISEM KRS
   ───────────────────────────────────────────────────── */

const POLA_POROWNANIA_KRS = [
  ['nazwa', 'Nazwa'], ['nip', 'NIP'], ['regon', 'REGON'],
  ['miejscowosc', 'Miejscowość'], ['ulica', 'Ulica'], ['nr_domu', 'Nr domu'],
  ['sad_rejestrowy', 'Sąd rejestrowy'],
];

function PorownanieZKrs({ wniosek, krs }) {
  if (!wniosek.krs) {
    return <Komunikat odmiana="info" tresc="Wniosek nie ma podanego numeru KRS — porównanie nie jest możliwe." />;
  }
  if (!krs) return <Spinner />;
  if (!krs.znaleziono) {
    return <Komunikat odmiana="uwaga" tresc={krs.komunikat || 'Nie udało się pobrać danych z KRS.'} />;
  }
  return (
    <table className="tabela">
      <thead><tr><th>Pole</th><th>Wniosek klienta</th><th>Odpis KRS</th></tr></thead>
      <tbody>
        {POLA_POROWNANIA_KRS.map(([klucz, etykieta]) => {
          const a = wniosek[klucz] || '';
          const bWartosc = (krs.dane && krs.dane[klucz]) || '';
          const rozbieznosc = a && bWartosc && String(a).trim().toLowerCase() !== String(bWartosc).trim().toLowerCase();
          return (
            <tr key={klucz}>
              <td className="wyciszony">{etykieta}</td>
              <td>{a || '—'}</td>
              <td className={rozbieznosc ? 'rozbieznosc-krs' : undefined}>
                {bWartosc || '—'}
                {rozbieznosc && <span className="rozbieznosc-znak" title="Wartość różni się od wniosku"> ⚠︎</span>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/* ─────────────────────────────────────────────────────
   KROK 1 — DANE SPÓŁKI
   ───────────────────────────────────────────────────── */

function KrokDaneSpolki({ wniosek, krs, zablokowane, odswiez }) {
  const [edycja, ustawEdycja] = useState(false);
  const [dane, ustawDane] = useState(wniosek);
  const [zapisywanie, ustawZapisywanie] = useState(false);
  const [pobieranieKrs, ustawPobieranieKrs] = useState(false);
  const [komunikat, ustawKomunikat] = useState(null);
  const [blad, ustawBlad] = useState(null);

  async function zapisz() {
    ustawZapisywanie(true);
    ustawBlad(null);
    try {
      await API.put(`/api/psa/wnioski/${wniosek.id}`, dane);
      ustawEdycja(false);
      odswiez();
    } catch (e) {
      ustawBlad(e instanceof BladApi ? e.message : 'Nie udało się zapisać korekty spółki.');
    } finally {
      ustawZapisywanie(false);
    }
  }

  /* Klient ma ten przycisk w portalu od początku; kancelaria musiała dotąd
     przepisywać dane z odpisu ręcznie — choć to ona odpowiada za ich
     zgodność z rejestrem przedsiębiorców. */
  async function pobierzZKrs() {
    ustawPobieranieKrs(true);
    ustawKomunikat(null);
    try {
      const wynik = await API.post(`/api/psa/wnioski/${wniosek.id}/z-krs`, {});
      if (!wynik.znaleziono) {
        ustawKomunikat({ odmiana: 'uwaga', tresc: wynik.komunikat || 'Nie odnaleziono spółki w KRS.' });
      } else {
        ustawKomunikat({
          odmiana: (wynik.ostrzezenia || []).length ? 'uwaga' : 'ok',
          tresc: (wynik.ostrzezenia || []).length
            ? wynik.ostrzezenia.join(' ')
            : `Dane pobrane z rejestru przedsiębiorców — nadpisano ${wynik.pobrane.length} pól.`,
        });
        ustawDane(wynik.wniosek);
        odswiez();
      }
    } catch (e) {
      ustawKomunikat({ odmiana: 'blad', tresc: e instanceof BladApi ? e.message : 'Nie udało się pobrać danych z KRS.' });
    } finally {
      ustawPobieranieKrs(false);
    }
  }

  const adres = [
    [wniosek.kod_pocztowy, wniosek.miejscowosc].filter(Boolean).join(' ').trim(),
    [wniosek.ulica, wniosek.nr_domu, wniosek.nr_lokalu && `m. ${wniosek.nr_lokalu}`].filter(Boolean).join(' ').trim(),
  ].filter(Boolean).join(', ');

  return (
    <div className="pion" style={{ gap: 16 }}>
      <Karta
        tytul="Dane spółki"
        akcje={!zablokowane && (
          edycja ? (
            <div className="row-g">
              <button className="btn btn-maly" onClick={() => { ustawDane(wniosek); ustawEdycja(false); }}>Anuluj</button>
              <button className="btn btn-maly btn-glowny" onClick={zapisz} disabled={zapisywanie}>
                {zapisywanie ? 'Zapisywanie…' : 'Zapisz'}
              </button>
            </div>
          ) : (
            <div className="row-g">
              <button className="btn btn-maly" onClick={pobierzZKrs} disabled={pobieranieKrs}>
                {pobieranieKrs ? 'Pobieranie…' : 'Pobierz z KRS'}
              </button>
              <button className="btn btn-maly" onClick={() => { ustawDane(wniosek); ustawEdycja(true); }}>
                Popraw dane
              </button>
            </div>
          )
        )}
      >
        {komunikat && <Komunikat odmiana={komunikat.odmiana} tresc={komunikat.tresc} />}
        <Komunikat odmiana="blad" tresc={blad} />

        {!edycja ? (
          <dl className="podsumowanie">
            <dt>Firma (nazwa)</dt>
            <dd>{wniosek.nazwa || <span className="brak">nie uzupełniono</span>}</dd>
            <dt>Numer KRS</dt>
            <dd className="kol-dane">{wniosek.krs || <span className="brak">nie uzupełniono</span>}</dd>
            <dt>NIP</dt>
            <dd className="kol-dane">{wniosek.nip || <span className="brak">nie uzupełniono</span>}</dd>
            <dt>REGON</dt>
            <dd className="kol-dane">{wniosek.regon || <span className="brak">nie uzupełniono</span>}</dd>
            <dt>Siedziba</dt>
            <dd>{adres || <span className="brak">nie uzupełniono</span>}</dd>
            <dt>Sąd rejestrowy</dt>
            <dd>{wniosek.sad_rejestrowy || <span className="brak">nie uzupełniono</span>}</dd>
            <dt>Reprezentant</dt>
            <dd>
              {wniosek.reprezentant_imie_nazwisko || <span className="brak">nie uzupełniono</span>}
              {wniosek.reprezentant_funkcja && (
                <span className="podsumowanie-dopisek">{wniosek.reprezentant_funkcja}</span>
              )}
            </dd>
            <dt>E-mail reprezentanta</dt>
            <dd>{wniosek.reprezentant_email || <span className="brak">nie uzupełniono</span>}</dd>
          </dl>
        ) : (
          GRUPY_POL_SPOLKI.map((grupa) => (
            <div key={grupa.tytul}>
              <div className="grupa-pol-tytul">{grupa.tytul}</div>
              <div className="siatka-2">
                {grupa.pola.map(([klucz, etykieta]) => (
                  <Pole key={klucz} etykieta={etykieta}>
                    <input
                      type="text"
                      value={dane[klucz] || ''}
                      onChange={(z) => ustawDane((p) => ({ ...p, [klucz]: z.target.value }))}
                    />
                  </Pole>
                ))}
              </div>
            </div>
          ))
        )}
      </Karta>

      <Karta tight tytul="Porównanie z odpisem KRS">
        <PorownanieZKrs wniosek={wniosek} krs={krs} />
      </Karta>
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   KROK 2 — AKCJONARIUSZE
   Lista jak w portalu klienta: widać wszystkich naraz, dane jednego otwiera
   się osobno. Kancelaria dostaje przy tym to, czego klient nie ma:
   weryfikację pozycji i dopasowanie do kartoteki wspólnej.
   ───────────────────────────────────────────────────── */

function SzczegolAkcjonariusza({ pozycja, wniosekId, zablokowane, braki, odswiez, przyZamknieciu }) {
  const [dane, ustawDane] = useState(pozycja);
  const [zapisywanie, ustawZapisywanie] = useState(false);
  const [blad, ustawBlad] = useState(null);

  async function zapisz() {
    ustawZapisywanie(true);
    ustawBlad(null);
    try {
      await API.put(`/api/psa/wnioski/${wniosekId}/akcjonariusze/${pozycja.id}`, dane);
      odswiez();
      przyZamknieciu();
    } catch (e) {
      ustawBlad(e instanceof BladApi ? e.message : 'Nie udało się zapisać korekty.');
      ustawZapisywanie(false);
    }
  }

  async function usun() {
    if (!window.confirm('Usunąć tę pozycję z wniosku?')) return;
    try {
      await API.delete(`/api/psa/wnioski/${wniosekId}/akcjonariusze/${pozycja.id}`);
      odswiez();
      przyZamknieciu();
    } catch (e) {
      ustawBlad(e instanceof BladApi ? e.message : 'Nie udało się usunąć pozycji.');
    }
  }

  async function ustawZweryfikowano(zweryfikowano, osobaId) {
    ustawBlad(null);
    try {
      await API.post(`/api/psa/wnioski/${wniosekId}/akcjonariusze/${pozycja.id}/zweryfikuj`, {
        zweryfikowano,
        osoba_id: osobaId ?? pozycja.osoba_id ?? null,
      });
      odswiez();
    } catch (e) {
      ustawBlad(e instanceof BladApi ? e.message : 'Nie udało się zapisać weryfikacji.');
    }
  }

  const pole = (klucz) => ({
    value: dane[klucz] || '',
    onChange: (z) => ustawDane((p) => ({ ...p, [klucz]: z.target.value })),
    disabled: zablokowane,
    autoComplete: 'off',
  });

  return (
    <>
      <KrokNaglowek tytul={nazwaPozycji(pozycja)} opis={identyfikatorPozycji(pozycja)} />
      <Komunikat odmiana="blad" tresc={blad} />

      {braki && braki.length > 0 && (
        <Komunikat odmiana="uwaga" tytul="Braki wobec art. 300³³ § 1 KSH" lista={braki} />
      )}

      <div className="podsumowanie-cechy" style={{ marginBottom: 'var(--od-16)' }}>
        <span>{pozycja.typ === 'prawna' ? 'osoba prawna' : 'osoba fizyczna'}</span>
        <span>
          do rejestru: {OPIS_ADRESU_REJESTROWEGO_WNIOSKU[pozycja.rodzaj_adresu_rejestrowego] || 'adres niewskazany'}
        </span>
        <span>{OPIS_ZGODY_EMAIL_WNIOSKU[pozycja.zgoda_email_status || 'brak']}</span>
        {OPIS_PEP_WNIOSKU[pozycja.pep] && (
          <span className="cecha-pep" title={pozycja.pep_opis || undefined}>
            {OPIS_PEP_WNIOSKU[pozycja.pep]}
            {pozycja.pep_opis ? ` — ${pozycja.pep_opis}` : ''}
          </span>
        )}
        {pozycja.wspolwlasnosc && pozycja.wspolwlasnosc !== 'brak' && (
          <span>
            {OPIS_WSPOLWLASNOSCI_WNIOSKU[pozycja.wspolwlasnosc]}
            {pozycja.wspolwlasnosc === 'ulamkowa' && pozycja.udzial_licznik
              ? ` ${pozycja.udzial_licznik}/${pozycja.udzial_mianownik}`
              : ''}
          </span>
        )}
      </div>

      <div className="siatka-2">
        {POLA_KOREKTY_AKCJONARIUSZA.map(([klucz, etykieta]) => (
          <Pole key={klucz} etykieta={etykieta}>
            <input type="text" {...pole(klucz)} />
          </Pole>
        ))}
      </div>

      {/* Klient wpisuje adresy, jakie akcjonariusz ma — KTÓRY z nich trafia do
          treści rejestru (art. 300³³ § 1 pkt 3 KSH dopuszcza jeden) wybiera
          kancelaria. To jedyne pole, którego formularz klienta nie ma. */}
      <Pole
        etykieta="Adres wpisywany do rejestru"
        podpowiedz="Do treści rejestru wchodzi dokładnie jeden adres — art. 300³³ § 1 pkt 3 KSH."
      >
        <select
          value={dane.rodzaj_adresu_rejestrowego || 'zamieszkania'}
          onChange={(z) => ustawDane((p) => ({ ...p, rodzaj_adresu_rejestrowego: z.target.value }))}
          disabled={zablokowane}
        >
          <option value="zamieszkania">Adres zamieszkania albo siedziby</option>
          <option value="doreczen">Inny adres do doręczeń</option>
          <option value="edoreczen">Adres do doręczeń elektronicznych</option>
        </select>
      </Pole>

      {!zablokowane && (
        <Pole
          etykieta="Dopasowanie do kartoteki wspólnej"
          podpowiedz="Puste = przy przyjęciu wniosku powstanie nowa osoba w kartotece."
        >
          <WyborOsoby
            wartosc={pozycja.osoba_id}
            przyZmianie={(id) => ustawZweryfikowano(1, id)}
            typFiltr={pozycja.typ}
          />
        </Pole>
      )}

      <NawigacjaKreatora
        wstecz={{ etykieta: 'Wróć do listy', przy: przyZamknieciu }}
        dalej={zablokowane
          ? null
          : { etykieta: zapisywanie ? 'Zapisywanie…' : 'Zapisz i wróć', przy: zapisz, wylaczony: zapisywanie }}
      />

      {!zablokowane && (
        <div className="akcja-niszczaca">
          <button
            className="btn btn-maly"
            onClick={() => ustawZweryfikowano(pozycja.zweryfikowano ? 0 : 1)}
          >
            {pozycja.zweryfikowano ? 'Cofnij weryfikację' : 'Oznacz jako zweryfikowaną'}
          </button>
          <button className="btn btn-maly btn-sygnal" onClick={usun}>Usuń akcjonariusza</button>
        </div>
      )}
    </>
  );
}

function KrokAkcjonariusze({ wniosek, akcjonariusze, brakiUstawowe, zablokowane, odswiez }) {
  const [otwarty, ustawOtwarty] = useState(null);
  const [dodawanie, ustawDodawanie] = useState(false);
  const [blad, ustawBlad] = useState(null);

  async function dopisz() {
    ustawDodawanie(true);
    ustawBlad(null);
    try {
      const wynik = await API.post(`/api/psa/wnioski/${wniosek.id}/akcjonariusze`, {});
      odswiez();
      ustawOtwarty(wynik.akcjonariusz.id);
    } catch (e) {
      ustawBlad(e instanceof BladApi ? e.message : 'Nie udało się dopisać osoby.');
    } finally {
      ustawDodawanie(false);
    }
  }

  const pozycja = akcjonariusze.find((a) => a.id === otwarty) || null;

  return (
    <Karta>
      {pozycja ? (
        <SzczegolAkcjonariusza
          key={pozycja.id}
          pozycja={pozycja}
          wniosekId={wniosek.id}
          zablokowane={zablokowane}
          braki={brakiUstawowe[pozycja.id]}
          odswiez={odswiez}
          przyZamknieciu={() => ustawOtwarty(null)}
        />
      ) : (
        <>
          <KrokNaglowek
            tytul="Akcjonariusze"
            opis="Każdą pozycję trzeba otworzyć, sprawdzić i zweryfikować — bez tego wniosku nie da się przyjąć."
          />
          <Komunikat odmiana="blad" tresc={blad} />

          {akcjonariusze.length === 0 ? (
            <Pusto
              ikona="osoby"
              tytul="Wniosek nie ma żadnego akcjonariusza"
              opis="Klient nie dopisał nikogo albo pozycje zostały usunięte. Dopisz osobę, jeśli wynika to z dokumentów."
            />
          ) : (
            <div className="lista-podmiotow">
              {akcjonariusze.map((a) => {
                const braki = (brakiUstawowe[a.id] || []).length;
                return (
                  <WierszPodmiotu
                    key={a.id}
                    ikona={a.typ === 'prawna' ? 'spolki' : 'osoby'}
                    tytul={nazwaPozycji(a)}
                    znacznik={a.zweryfikowano
                      ? 'zweryfikowana'
                      : braki > 0 ? `${braki} braków` : 'do weryfikacji'}
                    opis={[
                      identyfikatorPozycji(a),
                      adresPozycji(a),
                      OPIS_ZGODY_EMAIL_WNIOSKU[a.zgoda_email_status || 'brak'],
                      OPIS_PEP_WNIOSKU[a.pep],
                    ].filter(Boolean).join(' · ')}
                    przyKliknieciu={() => ustawOtwarty(a.id)}
                  />
                );
              })}
            </div>
          )}

          {!zablokowane && (
            <WierszDodania
              etykieta={dodawanie ? 'Dopisywanie…' : 'Dopisz osobę'}
              przyKliknieciu={dopisz}
              wylaczony={dodawanie}
            />
          )}
        </>
      )}
    </Karta>
  );
}

/* ─────────────────────────────────────────────────────
   KROK 3 — DOKUMENTY
   ───────────────────────────────────────────────────── */

function PodgladDokumentu({ wniosekId, dokument, przyZamknieciu }) {
  return (
    <Modal tytul={dokument.nazwa} przyZamknieciu={przyZamknieciu} szerokosc={900}>
      <iframe
        className="podglad-dokumentu"
        title={dokument.nazwa}
        src={`/api/psa/wnioski/${wniosekId}/dokumenty/${dokument.id}?podglad=1`}
      />
    </Modal>
  );
}

/**
 * Edytor treści JEDNEGO bloku. Blok jest najmniejszą całością, jaką dokument
 * daje się opisać: akapit, nagłówek, wiersz danych, punkt listy. Notariusz
 * poprawia TEKST, nie układ — dlatego nie ma tu ani krojów, ani wcięć, ani
 * niczego, czym dałoby się rozstroić dokument o skutkach prawnych.
 */
function BlokTresci({ blok, nazwaRodzaju, przyZmianie, przyUsunieciu, przyPrzesunieciu }) {
  const wiersz = (etykieta, wartosc, zmien, wiele = false) => (
    <Pole etykieta={etykieta}>
      {wiele
        ? <textarea rows={3} value={wartosc} onChange={(z) => zmien(z.target.value)} />
        : <input type="text" value={wartosc} onChange={(z) => zmien(z.target.value)} />}
    </Pole>
  );

  return (
    <div className="blok-tresci">
      <div className="blok-tresci-pasek">
        <span className="blok-tresci-rodzaj">{nazwaRodzaju}</span>
        <span className="row-g">
          <button className="btn btn-maly" onClick={() => przyPrzesunieciu(-1)} title="W górę">↑</button>
          <button className="btn btn-maly" onClick={() => przyPrzesunieciu(1)} title="W dół">↓</button>
          <button className="btn btn-maly btn-sygnal" onClick={przyUsunieciu}>Usuń</button>
        </span>
      </div>

      {blok.rodzaj === 'naglowek' && (
        <div className="siatka-2">
          {wiersz('Miejscowość', blok.miejscowosc, (v) => przyZmianie({ ...blok, miejscowosc: v }))}
          {wiersz('Data', blok.data, (v) => przyZmianie({ ...blok, data: v }))}
        </div>
      )}
      {blok.rodzaj === 'tytul' && (
        <>
          {wiersz('Tytuł', blok.tekst, (v) => przyZmianie({ ...blok, tekst: v }))}
          {wiersz('Podtytuł', blok.podtytul, (v) => przyZmianie({ ...blok, podtytul: v }))}
        </>
      )}
      {blok.rodzaj === 'sekcja' && wiersz('Nagłówek', blok.tekst, (v) => przyZmianie({ ...blok, tekst: v }))}
      {blok.rodzaj === 'akapit' && wiersz('Treść', blok.tekst, (v) => przyZmianie({ ...blok, tekst: v }), true)}
      {blok.rodzaj === 'punkt' && (
        <>
          {wiersz('Znacznik', blok.znacznik, (v) => przyZmianie({ ...blok, znacznik: v }))}
          {wiersz('Treść', blok.tekst, (v) => przyZmianie({ ...blok, tekst: v }), true)}
        </>
      )}
      {blok.rodzaj === 'pola' && (
        <Pole etykieta="Dane" podpowiedz="Jeden wiersz = jedna pozycja, w postaci „Etykieta: wartość”.">
          <textarea
            rows={Math.max(2, blok.pary.length)}
            value={blok.pary.map(([e, w]) => `${e}: ${w}`).join('\n')}
            onChange={(z) => przyZmianie({
              ...blok,
              pary: z.target.value.split('\n').map((linia) => {
                const rozdzial = linia.indexOf(':');
                return rozdzial === -1
                  ? [linia.trim(), '']
                  : [linia.slice(0, rozdzial).trim(), linia.slice(rozdzial + 1).trim()];
              }),
            })}
          />
        </Pole>
      )}
      {blok.rodzaj === 'doWypelnienia' && (
        <Pole etykieta="Pola do wypełnienia ręcznie" podpowiedz="Jedna etykieta w wierszu — pod każdą stanie linia na wpis.">
          <textarea
            rows={Math.max(2, blok.etykiety.length)}
            value={blok.etykiety.join('\n')}
            onChange={(z) => przyZmianie({ ...blok, etykiety: z.target.value.split('\n') })}
          />
        </Pole>
      )}
      {blok.rodzaj === 'opcja' && (
        <>
          {wiersz('Treść pozycji', blok.tekst, (v) => przyZmianie({ ...blok, tekst: v }), true)}
          <label className="chk">
            <input
              type="checkbox"
              checked={Boolean(blok.zaznaczona)}
              onChange={(z) => przyZmianie({ ...blok, zaznaczona: z.target.checked })}
            />
            <span className="chk-tresc">Kratka zaznaczona z góry</span>
          </label>
        </>
      )}
      {blok.rodzaj === 'podpis' && wiersz('Podpis pod linią', blok.opis, (v) => przyZmianie({ ...blok, opis: v }))}
      {blok.rodzaj === 'odstep' && (
        <Pole etykieta="Wysokość odstępu (w wierszach)">
          <input
            type="number" min="1" step="1"
            value={blok.ile}
            onChange={(z) => przyZmianie({ ...blok, ile: Number(z.target.value) || 1 })}
          />
        </Pole>
      )}
    </div>
  );
}

/**
 * Edycja treści dokumentu. Po zapisie PDF składa się od nowa i podmienia plik
 * W MIEJSCU — poprawiona wersja obowiązuje wszędzie: w portalu klienta,
 * w podglądzie kancelarii i w aktach spółki po przyjęciu wniosku.
 */
function EdytorDokumentu({ wniosekId, dokumentId, przyZamknieciu, przyZapisie }) {
  const [stan, ustawStan] = useState({ ladowanie: true, dokument: null, rodzaje: {} });
  const [bloki, ustawBloki] = useState([]);
  const [zapisywanie, ustawZapisywanie] = useState(false);
  const [blad, ustawBlad] = useState(null);

  useEffect(() => {
    API.get(`/api/psa/wnioski/${wniosekId}/dokumenty/${dokumentId}/tresc`)
      .then((d) => {
        ustawStan({ ladowanie: false, dokument: d.dokument, rodzaje: d.rodzaje });
        ustawBloki(d.dokument.bloki);
      })
      .catch((e) => {
        ustawBlad(e instanceof BladApi ? e.message : 'Nie udało się wczytać treści dokumentu.');
        ustawStan((p) => ({ ...p, ladowanie: false }));
      });
  }, [wniosekId, dokumentId]);

  function zmienBlok(i, nowy) {
    ustawBloki((p) => p.map((b, idx) => (idx === i ? nowy : b)));
  }
  function usunBlok(i) {
    ustawBloki((p) => p.filter((_, idx) => idx !== i));
  }
  function przesunBlok(i, kierunek) {
    ustawBloki((p) => {
      const cel = i + kierunek;
      if (cel < 0 || cel >= p.length) return p;
      const kopia = [...p];
      [kopia[i], kopia[cel]] = [kopia[cel], kopia[i]];
      return kopia;
    });
  }
  function dopiszAkapit() {
    ustawBloki((p) => [...p, { rodzaj: 'akapit', tekst: '' }]);
  }

  async function zapisz() {
    ustawZapisywanie(true);
    ustawBlad(null);
    try {
      const wynik = await API.put(`/api/psa/wnioski/${wniosekId}/dokumenty/${dokumentId}/tresc`, { bloki });
      przyZapisie(wynik.dokumenty);
      przyZamknieciu();
    } catch (e) {
      ustawBlad(e instanceof BladApi ? e.message : 'Nie udało się zapisać treści.');
      ustawZapisywanie(false);
    }
  }

  return (
    <Modal
      tytul={stan.dokument ? `Treść: ${stan.dokument.nazwa}` : 'Treść dokumentu'}
      przyZamknieciu={przyZamknieciu}
      szerokosc={860}
      stopka={
        <>
          <button className="btn" onClick={przyZamknieciu}>Anuluj</button>
          <button className="btn btn-glowny" onClick={zapisz} disabled={zapisywanie || stan.ladowanie}>
            {zapisywanie ? 'Składanie dokumentu…' : 'Zapisz i złóż od nowa'}
          </button>
        </>
      }
    >
      <Komunikat odmiana="blad" tresc={blad} />
      {stan.ladowanie ? (
        <Spinner />
      ) : (
        <>
          <Komunikat
            odmiana="info"
            tresc="Po zapisaniu dokument zostanie złożony od nowa z tej treści i zastąpi dotychczasowy plik — także ten, który widzi klient."
          />
          {stan.dokument && stan.dokument.brakujace.length > 0 && (
            <Komunikat
              odmiana="uwaga"
              tytul="Wzór nie miał czym wypełnić tych miejsc"
              tresc="W dokumencie stoi w nich kreska. Uzupełnij je tutaj albo popraw dane wniosku i wystaw komplet ponownie."
              lista={stan.dokument.brakujace}
            />
          )}
          <div className="edytor-blokow">
            {bloki.map((blok, i) => (
              <BlokTresci
                key={i}
                blok={blok}
                nazwaRodzaju={stan.rodzaje[blok.rodzaj] || blok.rodzaj}
                przyZmianie={(nowy) => zmienBlok(i, nowy)}
                przyUsunieciu={() => usunBlok(i)}
                przyPrzesunieciu={(kierunek) => przesunBlok(i, kierunek)}
              />
            ))}
          </div>
          <WierszDodania etykieta="Dopisz akapit na końcu" przyKliknieciu={dopiszAkapit} />
        </>
      )}
    </Modal>
  );
}

/** „1 puste miejsce", „3 puste miejsca", „5 pustych miejsc" — polska odmiana. */
function opisPustychMiejsc(ile) {
  const ostatnia = ile % 10;
  const dwieOstatnie = ile % 100;
  if (ile === 1) return '1 puste miejsce';
  if (ostatnia >= 2 && ostatnia <= 4 && !(dwieOstatnie >= 12 && dwieOstatnie <= 14)) {
    return `${ile} puste miejsca`;
  }
  return `${ile} pustych miejsc`;
}

function PozycjaDokumentuKancelarii({ wniosekId, dokument, dlaKogo, zablokowane, przyPodgladzie, przyEdycji }) {
  const podpisany = Boolean(dokument.podpis_nazwa_pliku);
  return (
    <div className={`dokument-pozycja ${podpisany ? 'dokument-pozycja-gotowa' : ''}`}>
      <div className="dokument-pozycja-glowna">
        <Ikona nazwa="dokument" rozmiar={17} />
        <button type="button" className="dokument-pozycja-nazwa jak-odnosnik" onClick={przyPodgladzie}>
          {dokument.nazwa}
          {/* Oświadczenia wystawia się PO JEDNYM NA AKCJONARIUSZA, więc sama
              nazwa dokumentu powtarza się na liście tyle razy, ilu ich jest.
              Bez wskazania osoby nie da się rozróżnić, który jest który. */}
          {dlaKogo && <span className="dokument-pozycja-dla">{dlaKogo}</span>}
        </button>
        <span className="dokument-pozycja-rozmiar">
          {Math.max(1, Math.round((dokument.rozmiar || 0) / 1024))} kB
        </span>
      </div>

      <div className="dokument-pozycja-podpis">
        {dokument.udostepniono
          ? <Znacznik odmiana="neutralny">u klienta</Znacznik>
          : <Znacznik odmiana="mosiadz">nieudostępniony</Znacznik>}
        {dokument.zmodyfikowano && <Znacznik odmiana="mosiadz">treść poprawiona</Znacznik>}
        {dokument.brakujace.length > 0 && (
          <Znacznik odmiana="bordo">{opisPustychMiejsc(dokument.brakujace.length)}</Znacznik>
        )}
        {podpisany ? (
          <>
            <Znacznik odmiana="zielony">podpisany</Znacznik>
            <a
              className="dokument-pozycja-skan"
              href={`/api/psa/wnioski/${wniosekId}/dokumenty/${dokument.id}?egzemplarz=podpisany`}
              target="_blank"
              rel="noopener"
            >
              {dokument.podpis_nazwa_pliku}
            </a>
          </>
        ) : (
          <span className="dokument-pozycja-czeka">czeka na podpisany skan</span>
        )}
        <span className="row-g" style={{ marginLeft: 'auto' }}>
          <button className="btn btn-maly" onClick={przyPodgladzie}>Podgląd</button>
          {dokument.edytowalny && !zablokowane && (
            <button className="btn btn-maly" onClick={przyEdycji}>Edytuj treść</button>
          )}
          <a
            className="btn btn-maly"
            href={`/api/psa/wnioski/${wniosekId}/dokumenty/${dokument.id}`}
            target="_blank"
            rel="noopener"
          >
            Pobierz
          </a>
        </span>
      </div>
    </div>
  );
}

function KrokDokumenty({ wniosek, akcjonariusze, dokumenty, ustawDokumenty, zablokowane, odswiez }) {
  const [praca, ustawPrace] = useState(null); // 'wystaw' | 'udostepnij'
  const [komunikat, ustawKomunikat] = useState(null);
  const [blad, ustawBlad] = useState(null);
  const [podglad, ustawPodglad] = useState(null);
  const [edycja, ustawEdycja] = useState(null);

  const wystawione = dokumenty.length > 0;
  const doUdostepnienia = dokumenty.filter((d) => !d.udostepniono).length;
  const podpisanych = dokumenty.filter((d) => d.podpis_nazwa_pliku).length;
  const pustychMiejsc = dokumenty.reduce((suma, d) => suma + d.brakujace.length, 0);

  async function wystaw() {
    if (wystawione && !window.confirm(
      'Wystawić komplet od nowa? Dotychczasowe dokumenty i odesłane przez klienta skany zostaną zastąpione.'
    )) return;
    ustawPrace('wystaw');
    ustawBlad(null);
    ustawKomunikat(null);
    try {
      const wynik = await API.post(`/api/psa/wnioski/${wniosek.id}/dokumenty/wystaw`, {});
      ustawDokumenty(wynik.dokumenty);
      ustawKomunikat({
        odmiana: 'ok',
        tresc: `Wystawiono ${wynik.dokumenty.length} dokumentów. Przeczytaj je i popraw treść, zanim udostępnisz je klientowi.`,
      });
      odswiez();
    } catch (e) {
      ustawBlad(e instanceof BladApi ? e.message : 'Nie udało się wystawić dokumentów.');
    } finally {
      ustawPrace(null);
    }
  }

  async function udostepnij() {
    ustawPrace('udostepnij');
    ustawBlad(null);
    ustawKomunikat(null);
    try {
      const wynik = await API.post(`/api/psa/wnioski/${wniosek.id}/dokumenty/udostepnij`, {});
      ustawDokumenty(wynik.dokumenty);
      ustawKomunikat({
        odmiana: wynik.email_wyslany ? 'ok' : 'uwaga',
        tresc: wynik.email_wyslany
          ? 'Dokumenty są w portalu klienta. Powiadomienie e-mail zostało wysłane.'
          : `Dokumenty są w portalu klienta, ale powiadomienia nie udało się wysłać: ${wynik.powod} Napisz do klienta innym kanałem.`,
      });
      odswiez();
    } catch (e) {
      ustawBlad(e instanceof BladApi ? e.message : 'Nie udało się udostępnić dokumentów.');
    } finally {
      ustawPrace(null);
    }
  }

  return (
    <Karta
      tytul="Komplet dokumentów do podpisu"
      akcje={!zablokowane && (
        <div className="row-g">
          <button className="btn btn-maly" onClick={wystaw} disabled={praca !== null}>
            {praca === 'wystaw' ? 'Wystawianie…' : wystawione ? 'Wystaw od nowa' : 'Wystaw komplet'}
          </button>
          {wystawione && doUdostepnienia > 0 && (
            <button className="btn btn-maly btn-glowny" onClick={udostepnij} disabled={praca !== null}>
              {praca === 'udostepnij' ? 'Udostępnianie…' : 'Udostępnij klientowi'}
            </button>
          )}
        </div>
      )}
    >
      {komunikat && <Komunikat odmiana={komunikat.odmiana} tresc={komunikat.tresc} />}
      <Komunikat odmiana="blad" tresc={blad} />

      {!wystawione ? (
        <Pusto
          ikona="dokument"
          tytul="Komplet nie został jeszcze wystawiony"
          opis="Sprawdź dane spółki i akcjonariuszy, a potem wystaw dokumenty. Klient zobaczy je dopiero po udostępnieniu."
        />
      ) : (
        <>
          <Metryka
            pozycje={[
              { etykieta: 'Dokumentów', wartosc: dokumenty.length, dane: true },
              { etykieta: 'Do udostępnienia', wartosc: doUdostepnienia, dane: true },
              { etykieta: 'Podpisanych', wartosc: `${podpisanych} / ${dokumenty.length}`, dane: true },
              pustychMiejsc > 0 ? { etykieta: 'Pustych miejsc', wartosc: pustychMiejsc, dane: true } : null,
            ]}
          />

          {doUdostepnienia > 0 && (
            <Komunikat
              odmiana="uwaga"
              tytul="Klient jeszcze tego nie widzi"
              tresc={`${doUdostepnienia} z ${dokumenty.length} pozycji czeka na udostępnienie. Przeczytaj je, popraw treść, gdzie trzeba, i dopiero wtedy wpuść komplet do portalu.`}
            />
          )}

          <div className="lista-dokumentow">
            {dokumenty.map((d) => (
              <PozycjaDokumentuKancelarii
                key={d.id}
                wniosekId={wniosek.id}
                dokument={d}
                dlaKogo={d.akcjonariusz_id
                  ? nazwaPozycji(akcjonariusze.find((a) => a.id === d.akcjonariusz_id) || {})
                  : null}
                zablokowane={zablokowane}
                przyPodgladzie={() => ustawPodglad(d)}
                przyEdycji={() => ustawEdycja(d)}
              />
            ))}
          </div>
        </>
      )}

      {podglad && (
        <PodgladDokumentu wniosekId={wniosek.id} dokument={podglad} przyZamknieciu={() => ustawPodglad(null)} />
      )}
      {edycja && (
        <EdytorDokumentu
          wniosekId={wniosek.id}
          dokumentId={edycja.id}
          przyZamknieciu={() => ustawEdycja(null)}
          przyZapisie={(lista) => ustawDokumenty(lista)}
        />
      )}
    </Karta>
  );
}

/* ─────────────────────────────────────────────────────
   KROK 4 — DECYZJA
   ───────────────────────────────────────────────────── */

function KrokDecyzja({ wniosek, akcjonariusze, zablokowane, odswiez }) {
  const [notatka, ustawNotatka] = useState('');
  const [pokazNotatke, ustawPokazNotatke] = useState(null); // 'do_uzupelnienia' | 'odrzuc' | null
  const [przetwarzanie, ustawPrzetwarzanie] = useState(false);
  const [blad, ustawBlad] = useState(null);

  const wszystkoZweryfikowane = akcjonariusze.length > 0 && akcjonariusze.every((a) => a.zweryfikowano);
  const niezweryfikowani = akcjonariusze.filter((a) => !a.zweryfikowano).length;

  async function wyslijNotatke(akcja) {
    if (!notatka.trim()) {
      ustawBlad('Podaj notatkę — klient musi wiedzieć, czego dotyczy decyzja.');
      return;
    }
    ustawPrzetwarzanie(true);
    ustawBlad(null);
    try {
      await API.post(`/api/psa/wnioski/${wniosek.id}/${akcja}`, { notatka });
      ustawPokazNotatke(null);
      ustawNotatka('');
      odswiez();
    } catch (e) {
      ustawBlad(e instanceof BladApi ? e.message : 'Nie udało się wykonać operacji.');
    } finally {
      ustawPrzetwarzanie(false);
    }
  }

  async function przyjmij() {
    if (!window.confirm('Przyjąć wniosek? Założy to spółkę i akcjonariuszy w kartotece — operacji nie da się cofnąć z tego ekranu.')) return;
    ustawPrzetwarzanie(true);
    ustawBlad(null);
    try {
      const wynik = await API.post(`/api/psa/wnioski/${wniosek.id}/przyjmij`, {});
      odswiez();
      if (wynik.spolka_id) {
        window.alert('Wniosek przyjęty. Spółka i akcjonariusze założeni w kartotece — dokończ otwarcie rejestru (emisja założycielska) w kokpicie spółki.');
      }
    } catch (e) {
      ustawBlad(e instanceof BladApi ? e.message : 'Nie udało się przyjąć wniosku.');
    } finally {
      ustawPrzetwarzanie(false);
    }
  }

  if (zablokowane) {
    return (
      <Karta tytul="Decyzja kancelarii">
        <Komunikat
          odmiana={wniosek.status === 'przyjety' ? 'ok' : 'blad'}
          tytul={wniosek.status === 'przyjety' ? 'Wniosek przyjęty' : 'Wniosek odrzucony'}
          tresc={wniosek.notatka_weryfikacji || 'Sprawa jest zamknięta — decyzji nie da się cofnąć z tego ekranu.'}
        />
      </Karta>
    );
  }

  const gotowyDoPrzyjecia = wniosek.status === 'umowa_podpisana' && wszystkoZweryfikowane;

  return (
    <Karta tytul="Decyzja kancelarii">
      <Komunikat odmiana="blad" tresc={blad} />

      <dl className="podsumowanie">
        <dt>Stan wniosku</dt>
        <dd>{(STAN_WNIOSKU[wniosek.status] || {}).etykieta || wniosek.status}</dd>
        <dt>Weryfikacja akcjonariuszy</dt>
        <dd>
          {akcjonariusze.length === 0
            ? <span className="brak">brak pozycji</span>
            : niezweryfikowani === 0
              ? `wszystkie ${akcjonariusze.length} pozycji zweryfikowane`
              : `${niezweryfikowani} z ${akcjonariusze.length} czeka na weryfikację`}
        </dd>
      </dl>

      {!gotowyDoPrzyjecia && (
        <Komunikat
          odmiana="info"
          tresc={wniosek.status !== 'umowa_podpisana'
            ? 'Przyjęcie wniosku wymaga, żeby klient odesłał podpisaną umowę o prowadzenie rejestru.'
            : 'Zweryfikuj wszystkie pozycje akcjonariuszy (krok „Akcjonariusze”), zanim przyjmiesz wniosek.'}
        />
      )}

      <div className="row-g" style={{ flexWrap: 'wrap' }}>
        <button className="btn" onClick={() => ustawPokazNotatke(pokazNotatke === 'do_uzupelnienia' ? null : 'do_uzupelnienia')}>
          Odeślij do uzupełnienia
        </button>
        <button className="btn btn-sygnal" onClick={() => ustawPokazNotatke(pokazNotatke === 'odrzuc' ? null : 'odrzuc')}>
          Odrzuć wniosek
        </button>
        <button className="btn btn-glowny" onClick={przyjmij} disabled={przetwarzanie || !gotowyDoPrzyjecia}>
          Przyjmij wniosek
        </button>
      </div>

      {pokazNotatke && (
        <div className="pion" style={{ gap: 8, marginTop: 'var(--od-16)' }}>
          <Pole
            etykieta={pokazNotatke === 'odrzuc' ? 'Powód odrzucenia' : 'Co klient ma poprawić'}
            wymagane
            podpowiedz="Notatkę zobaczy klient w portalu, nad formularzem wniosku."
          >
            <textarea rows={4} value={notatka} onChange={(z) => ustawNotatka(z.target.value)} />
          </Pole>
          <button
            className={`btn ${pokazNotatke === 'odrzuc' ? 'btn-sygnal' : 'btn-glowny'}`}
            style={{ alignSelf: 'flex-start' }}
            onClick={() => wyslijNotatke(pokazNotatke === 'odrzuc' ? 'odrzuc' : 'do-uzupelnienia')}
            disabled={przetwarzanie}
          >
            {przetwarzanie
              ? 'Zapisywanie…'
              : pokazNotatke === 'odrzuc' ? 'Potwierdź odrzucenie' : 'Odeślij do uzupełnienia'}
          </button>
        </div>
      )}
    </Karta>
  );
}

/* ─────────────────────────────────────────────────────
   EKRAN WNIOSKU
   ───────────────────────────────────────────────────── */

const ZAKLADKI_WNIOSKU = [
  { kod: 'spolka', nazwa: 'Dane spółki' },
  { kod: 'akcjonariusze', nazwa: 'Akcjonariusze' },
  { kod: 'dokumenty', nazwa: 'Dokumenty' },
  { kod: 'decyzja', nazwa: 'Decyzja' },
];

function EkranWniosekSzczegoly({ wniosekId }) {
  const { dane, ladowanie, odswiez } = useDane(`/api/psa/wnioski/${wniosekId}`);
  const [zakladka, ustawZakladke] = useState('spolka');
  // Lista dokumentów zmienia się częściej niż reszta wniosku (wystawienie,
  // poprawka treści, udostępnienie), więc żyje osobno — inaczej każda z tych
  // czynności ciągnęłaby ze sobą ponowne odpytanie KRS.
  const [dokumenty, ustawDokumenty] = useState(null);

  useEffect(() => {
    if (dane && dane.dokumenty) ustawDokumenty(dane.dokumenty);
  }, [dane]);

  if (ladowanie || !dane) return <Spinner />;
  const { wniosek, akcjonariusze, krs } = dane;
  const brakiUstawowe = dane.braki_ustawowe || {};
  const zablokowane = ['przyjety', 'odrzucony'].includes(wniosek.status);
  const lista = dokumenty || [];
  const niezweryfikowani = akcjonariusze.filter((a) => !a.zweryfikowano).length;

  return (
    <div className="pion" style={{ gap: 16 }}>
      <div className="okruszki bez-druku">
        <button onClick={() => idz('/wnioski')}>Wnioski</button>
        <Ikona nazwa="strzalkaPrawo" rozmiar={13} />
        <span>{wniosek.nazwa || `Wniosek #${wniosek.id}`}</span>
      </div>

      <NaglowekStrony
        tytul={wniosek.nazwa || `Wniosek #${wniosek.id}`}
        kontekst={<>Klient: {wniosek.konto_email}</>}
        akcje={<ZnacznikWniosku status={wniosek.status} />}
      />

      <Metryka
        pozycje={[
          { etykieta: 'KRS', wartosc: wniosek.krs, dane: true },
          { etykieta: 'Akcjonariusze', wartosc: akcjonariusze.length, dane: true },
          { etykieta: 'Dokumenty', wartosc: lista.length, dane: true },
          { etykieta: 'Zaktualizowano', wartosc: fmt.dataCzas(wniosek.zaktualizowano || wniosek.utworzono) },
        ]}
      />

      {wniosek.notatka_weryfikacji && (
        <Komunikat odmiana="uwaga" tytul="Ostatnia notatka kancelarii" tresc={wniosek.notatka_weryfikacji} />
      )}

      {wniosek.spolka_id && (
        <Komunikat
          odmiana="ok"
          tresc={<>Wniosek dowiązany do spółki w kartotece. <a href={`#/spolki/${wniosek.spolka_id}`}>Otwórz kokpit spółki</a>, żeby dokończyć otwarcie rejestru.</>}
        />
      )}

      <Zakladki
        zakladki={ZAKLADKI_WNIOSKU.map((z) => ({
          ...z,
          licznik: z.kod === 'akcjonariusze'
            ? (niezweryfikowani || null)
            : z.kod === 'dokumenty' ? (lista.filter((d) => !d.udostepniono).length || null) : null,
        }))}
        biezaca={zakladka}
        przyZmianie={ustawZakladke}
      />

      {zakladka === 'spolka' && (
        <KrokDaneSpolki wniosek={wniosek} krs={krs} zablokowane={zablokowane} odswiez={odswiez} />
      )}
      {zakladka === 'akcjonariusze' && (
        <KrokAkcjonariusze
          wniosek={wniosek}
          akcjonariusze={akcjonariusze}
          brakiUstawowe={brakiUstawowe}
          zablokowane={zablokowane}
          odswiez={odswiez}
        />
      )}
      {zakladka === 'dokumenty' && (
        <KrokDokumenty
          wniosek={wniosek}
          akcjonariusze={akcjonariusze}
          dokumenty={lista}
          ustawDokumenty={ustawDokumenty}
          zablokowane={zablokowane}
          odswiez={odswiez}
        />
      )}
      {zakladka === 'decyzja' && (
        <KrokDecyzja
          wniosek={wniosek}
          akcjonariusze={akcjonariusze}
          zablokowane={zablokowane}
          odswiez={odswiez}
        />
      )}
    </div>
  );
}

window.EkranWnioski = EkranWnioski;
window.EkranWniosekSzczegoly = EkranWniosekSzczegoly;
