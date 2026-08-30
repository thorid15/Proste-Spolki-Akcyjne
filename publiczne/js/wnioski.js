/* wnioski.js — weryfikacja wniosku klienta przez kancelarię (etap 3F).
   Kolejka od statusu „umowa_podpisana” (gotowe do przeglądu) do „przyjęty”
   (zakłada realną spółkę i materializuje akcjonariuszy do kartoteki wspólnej)
   albo „do_uzupełnienia”/„odrzucony”. Samo otwarcie rejestru z emisją
   założycielską zostaje w ISTNIEJĄCYM kreatorze wewnętrznym (spolki.js) —
   ten ekran kończy się na założeniu spółki i akcjonariuszy w kartotece. */

const STAN_WNIOSKU = {
  w_przygotowaniu: { etykieta: 'w przygotowaniu', znacznik: 'neutralny' },
  zlozony: { etykieta: 'złożony', znacznik: 'neutralny' },
  do_uzupelnienia: { etykieta: 'do uzupełnienia', znacznik: 'bordo' },
  umowa_wygenerowana: { etykieta: 'umowa wygenerowana', znacznik: 'neutralny' },
  umowa_podpisana: { etykieta: 'umowa podpisana — do weryfikacji', znacznik: 'zielony' },
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

/** Grid pol do recznej korekty danych spolki - lzejszy niz pelny formularz kreatora klienta. */
const POLA_KOREKTY_SPOLKI = [
  ['nazwa', 'Nazwa'], ['krs', 'KRS'], ['nip', 'NIP'], ['regon', 'REGON'],
  ['kod_pocztowy', 'Kod pocztowy'], ['miejscowosc', 'Miejscowość'],
  ['ulica', 'Ulica'], ['nr_domu', 'Nr domu'], ['nr_lokalu', 'Nr lokalu'],
  ['sad_rejestrowy', 'Sąd rejestrowy'], ['wydzial', 'Wydział'],
  ['telefon', 'Telefon'], ['email', 'E-mail'], ['adres_edorecze', 'Adres do e-doręczeń'],
  ['reprezentant_imie_nazwisko', 'Reprezentant — imię i nazwisko'],
  ['reprezentant_funkcja', 'Reprezentant — funkcja'],
  ['reprezentant_pesel', 'Reprezentant — PESEL'],
  ['reprezentant_adres', 'Reprezentant — adres'],
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
  // Klient wpisuje adresy, jakie ma — KTÓRY z nich trafia do treści rejestru
  // (art. 300³³ § 1 pkt 3 KSH dopuszcza tylko jeden) wybiera tu kancelaria,
  // stąd specjalny <select>, patrz render niżej.
  ['rodzaj_adresu_rejestrowego', 'Adres wpisywany do rejestru'],
];

/** Opisy pól ustawowych — te same, co widzi klient w portalu. */
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

function PorownanieZKrs({ wniosek, krs }) {
  if (!wniosek.krs) {
    return <Komunikat odmiana="info" tresc="Wniosek nie ma podanego numeru KRS — porównanie nie jest możliwe." />;
  }
  if (!krs) return <Spinner />;
  if (!krs.znaleziono) {
    return <Komunikat odmiana="uwaga" tresc={krs.komunikat || 'Nie udało się pobrać danych z KRS.'} />;
  }
  const POLA = [
    ['nazwa', 'Nazwa'], ['nip', 'NIP'], ['regon', 'REGON'],
    ['miejscowosc', 'Miejscowość'], ['ulica', 'Ulica'], ['nr_domu', 'Nr domu'],
    ['sad_rejestrowy', 'Sąd rejestrowy'],
  ];
  return (
    <table className="tabela">
      <thead><tr><th>Pole</th><th>Wniosek klienta</th><th>Odpis KRS</th></tr></thead>
      <tbody>
        {POLA.map(([klucz, etykieta]) => {
          const a = wniosek[klucz] || '';
          const b = (krs.dane && krs.dane[klucz]) || '';
          const rozbieznosc = a && b && String(a).trim().toLowerCase() !== String(b).trim().toLowerCase();
          return (
            <tr key={klucz}>
              <td className="wyciszony">{etykieta}</td>
              <td>{a || '—'}</td>
              <td style={rozbieznosc ? { color: 'var(--kolor-sygnal, #a33)', fontWeight: 600 } : undefined}>
                {b || '—'}{rozbieznosc && ' ⚠︎'}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
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

function PozycjaAkcjonariuszaWeryfikacja({ pozycja, wniosekId, zablokowane, odswiez, braki }) {
  const [edycja, ustawEdycja] = useState(false);
  const [dane, ustawDane] = useState(pozycja);
  const [zapisywanie, ustawZapisywanie] = useState(false);
  const [blad, ustawBlad] = useState(null);

  async function zapiszKorekte() {
    ustawZapisywanie(true);
    ustawBlad(null);
    try {
      await API.put(`/api/psa/wnioski/${wniosekId}/akcjonariusze/${pozycja.id}`, dane);
      ustawEdycja(false);
      odswiez();
    } catch (e) {
      ustawBlad(e instanceof BladApi ? e.message : 'Nie udało się zapisać korekty.');
    } finally {
      ustawZapisywanie(false);
    }
  }

  async function usun() {
    if (!window.confirm('Usunąć tę pozycję z wniosku?')) return;
    try {
      await API.delete(`/api/psa/wnioski/${wniosekId}/akcjonariusze/${pozycja.id}`);
      odswiez();
    } catch (e) {
      window.alert(e instanceof BladApi ? e.message : 'Nie udało się usunąć pozycji.');
    }
  }

  async function ustawZweryfikowano(zweryfikowano, osobaId) {
    try {
      await API.post(`/api/psa/wnioski/${wniosekId}/akcjonariusze/${pozycja.id}/zweryfikuj`, {
        zweryfikowano,
        osoba_id: osobaId ?? pozycja.osoba_id ?? null,
      });
      odswiez();
    } catch (e) {
      window.alert(e instanceof BladApi ? e.message : 'Nie udało się zapisać weryfikacji.');
    }
  }

  const nazwa = pozycja.typ === 'prawna' ? pozycja.nazwa : [pozycja.imie, pozycja.nazwisko].filter(Boolean).join(' ');

  return (
    <Karta scisla>
      <Komunikat odmiana="blad" tresc={blad} />
      <div className="rzad-rozdzielony">
        <div>
          <div style={{ fontWeight: 600 }}>{nazwa || '— dane nieuzupełnione —'}</div>
          <div className="podsumowanie-cechy">
            <span>{pozycja.typ === 'prawna' ? 'osoba prawna' : 'osoba fizyczna'}</span>
            <span>{identyfikatorPozycji(pozycja)}</span>
            <span>
              {OPIS_ADRESU_REJESTROWEGO_WNIOSKU[pozycja.rodzaj_adresu_rejestrowego] || 'adres niewskazany'}
            </span>
            <span>{OPIS_ZGODY_EMAIL_WNIOSKU[pozycja.zgoda_email_status || 'brak']}</span>
            {pozycja.wspolwlasnosc && pozycja.wspolwlasnosc !== 'brak' && (
              <span>
                {OPIS_WSPOLWLASNOSCI_WNIOSKU[pozycja.wspolwlasnosc]}
                {pozycja.wspolwlasnosc === 'ulamkowa' && pozycja.udzial_licznik
                  ? ` ${pozycja.udzial_licznik}/${pozycja.udzial_mianownik}`
                  : ''}
              </span>
            )}
          </div>
        </div>
        <Znacznik odmiana={pozycja.zweryfikowano ? 'zielony' : 'neutralny'}>
          {pozycja.zweryfikowano ? 'zweryfikowano' : 'do weryfikacji'}
        </Znacznik>
      </div>

      {braki && braki.length > 0 && (
        <Komunikat
          odmiana="uwaga"
          tytul="Braki wobec art. 300³³ § 1 KSH"
          lista={braki}
        />
      )}

      {!edycja ? (
        <div className="siatka-3" style={{ marginTop: 10 }}>
          <div className="podpowiedz">{pozycja.miejscowosc || '—'}, {pozycja.ulica || '—'} {pozycja.nr_domu || ''}</div>
          <div className="podpowiedz">{pozycja.email || '—'}</div>
          <div className="podpowiedz">{pozycja.telefon || '—'}</div>
        </div>
      ) : (
        <div className="siatka-2" style={{ marginTop: 10 }}>
          {POLA_KOREKTY_AKCJONARIUSZA.map(([klucz, etykieta]) =>
            klucz === 'rodzaj_adresu_rejestrowego' ? (
              <Pole key={klucz} etykieta={etykieta}>
                <select
                  value={dane[klucz] || 'zamieszkania'}
                  onChange={(z) => ustawDane((p) => ({ ...p, [klucz]: z.target.value }))}
                >
                  <option value="zamieszkania">Adres zamieszkania albo siedziby</option>
                  <option value="doreczen">Inny adres do doręczeń</option>
                  <option value="edoreczen">Adres do doręczeń elektronicznych</option>
                </select>
              </Pole>
            ) : (
              <Pole key={klucz} etykieta={etykieta}>
                <input
                  type="text"
                  value={dane[klucz] || ''}
                  onChange={(z) => ustawDane((p) => ({ ...p, [klucz]: z.target.value }))}
                />
              </Pole>
            )
          )}
        </div>
      )}

      {!zablokowane && (
        <div style={{ marginTop: 10 }}>
          <div className="podpowiedz" style={{ marginBottom: 4 }}>Dopasowanie do kartoteki wspólnej (puste = powstanie nowa osoba):</div>
          <WyborOsoby
            wartosc={pozycja.osoba_id}
            przyZmianie={(id) => ustawZweryfikowano(true, id)}
            typFiltr={pozycja.typ}
          />
        </div>
      )}

      <div className="row-g" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
        {!zablokowane && !edycja && (
          <button className="btn btn-maly" onClick={() => { ustawDane(pozycja); ustawEdycja(true); }}>Popraw dane</button>
        )}
        {!zablokowane && edycja && (
          <>
            <button className="btn btn-maly" onClick={() => ustawEdycja(false)}>Anuluj</button>
            <button className="btn btn-maly btn-glowny" onClick={zapiszKorekte} disabled={zapisywanie}>
              {zapisywanie ? 'Zapisywanie…' : 'Zapisz korektę'}
            </button>
          </>
        )}
        {!zablokowane && (
          <>
            <button className="btn btn-maly btn-sygnal" onClick={usun}>Usuń</button>
            <button
              className="btn btn-maly btn-glowny"
              onClick={() => ustawZweryfikowano(pozycja.zweryfikowano ? 0 : 1)}
            >
              {pozycja.zweryfikowano ? 'Cofnij weryfikację' : 'Zweryfikowano'}
            </button>
          </>
        )}
      </div>
    </Karta>
  );
}

function EkranWniosekSzczegoly({ wniosekId }) {
  const { dane, ladowanie, odswiez } = useDane(`/api/psa/wnioski/${wniosekId}`);
  // Braki wobec art. 300(33) § 1 KSH liczy serwer (logika/akcjonariusz.js)
  // - front ich nie powtarza, tylko pokazuje przy właściwej pozycji.
  const brakiUstawowe = (dane && dane.braki_ustawowe) || {};
  const [edycjaSpolki, ustawEdycjaSpolki] = useState(false);
  const [daneSpolki, ustawDaneSpolki] = useState(null);
  const [zapisywanieSpolki, ustawZapisywanieSpolki] = useState(false);
  const [dodawanie, ustawDodawanie] = useState(false);
  const [notatka, ustawNotatka] = useState('');
  const [pokazNotatke, ustawPokazNotatke] = useState(null); // 'do_uzupelnienia' | 'odrzuc' | null
  const [przetwarzanie, ustawPrzetwarzanie] = useState(false);
  const [blad, ustawBlad] = useState(null);

  if (ladowanie || !dane) return <Spinner />;
  const { wniosek, akcjonariusze, krs } = dane;
  const zablokowane = ['przyjety', 'odrzucony'].includes(wniosek.status);

  async function zapiszKorekteSpolki() {
    ustawZapisywanieSpolki(true);
    try {
      await API.put(`/api/psa/wnioski/${wniosek.id}`, daneSpolki);
      ustawEdycjaSpolki(false);
      odswiez();
    } catch (e) {
      window.alert(e instanceof BladApi ? e.message : 'Nie udało się zapisać korekty spółki.');
    } finally {
      ustawZapisywanieSpolki(false);
    }
  }

  async function dopiszOsobe() {
    ustawDodawanie(true);
    try {
      await API.post(`/api/psa/wnioski/${wniosek.id}/akcjonariusze`, {});
      odswiez();
    } catch (e) {
      window.alert(e instanceof BladApi ? e.message : 'Nie udało się dopisać osoby.');
    } finally {
      ustawDodawanie(false);
    }
  }

  async function wyslijNotatke(akcja) {
    if (!notatka.trim()) {
      window.alert('Podaj notatkę.');
      return;
    }
    ustawPrzetwarzanie(true);
    try {
      await API.post(`/api/psa/wnioski/${wniosek.id}/${akcja}`, { notatka });
      ustawPokazNotatke(null);
      ustawNotatka('');
      odswiez();
    } catch (e) {
      window.alert(e instanceof BladApi ? e.message : 'Nie udało się wykonać operacji.');
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

  const wszystkoZweryfikowane = akcjonariusze.length > 0 && akcjonariusze.every((a) => a.zweryfikowano);

  return (
    <div className="pion" style={{ gap: 16 }}>
      <div className="okruszki bez-druku">
        <button onClick={() => idz('/wnioski')}>Wnioski</button>
        <Ikona nazwa="strzalkaPrawo" rozmiar={13} />
        <span>{wniosek.nazwa || `Wniosek #${wniosek.id}`}</span>
      </div>

      <div className="rzad-rozdzielony">
        <h1 className="tytul-ekranu">{wniosek.nazwa || `Wniosek #${wniosek.id}`}</h1>
        <ZnacznikWniosku status={wniosek.status} />
      </div>
      <div className="podpowiedz">Klient: {wniosek.konto_email}</div>

      {wniosek.notatka_weryfikacji && (
        <Komunikat odmiana="uwaga" tytul="Ostatnia notatka kancelarii" tresc={wniosek.notatka_weryfikacji} />
      )}
      <Komunikat odmiana="blad" tresc={blad} />

      {wniosek.spolka_id && (
        <Komunikat
          odmiana="ok"
          tresc={<>Wniosek dowiązany do spółki w kartotece. <a href={`#/spolki/${wniosek.spolka_id}`}>Otwórz kokpit spółki</a>, żeby dokończyć otwarcie rejestru.</>}
        />
      )}

      <Karta tytul="Dane spółki" akcje={!zablokowane && (
        edycjaSpolki ? (
          <div className="row-g">
            <button className="btn btn-maly" onClick={() => ustawEdycjaSpolki(false)}>Anuluj</button>
            <button className="btn btn-maly btn-glowny" onClick={zapiszKorekteSpolki} disabled={zapisywanieSpolki}>
              {zapisywanieSpolki ? 'Zapisywanie…' : 'Zapisz korektę'}
            </button>
          </div>
        ) : (
          <button className="btn btn-maly" onClick={() => { ustawDaneSpolki(wniosek); ustawEdycjaSpolki(true); }}>Popraw dane</button>
        )
      )}>
        {!edycjaSpolki ? (
          <div className="siatka-3">
            <div><div className="wyciszony">Nazwa</div>{wniosek.nazwa || '—'}</div>
            <div><div className="wyciszony">KRS</div>{wniosek.krs || '—'}</div>
            <div><div className="wyciszony">NIP</div>{wniosek.nip || '—'}</div>
            <div><div className="wyciszony">Siedziba</div>{wniosek.miejscowosc || '—'}</div>
            <div><div className="wyciszony">Sąd rejestrowy</div>{wniosek.sad_rejestrowy || '—'}</div>
            <div><div className="wyciszony">Reprezentant</div>{wniosek.reprezentant_imie_nazwisko || '—'}</div>
          </div>
        ) : (
          <div className="siatka-2">
            {POLA_KOREKTY_SPOLKI.map(([klucz, etykieta]) => (
              <Pole key={klucz} etykieta={etykieta}>
                <input
                  type="text"
                  value={daneSpolki[klucz] || ''}
                  onChange={(z) => ustawDaneSpolki((p) => ({ ...p, [klucz]: z.target.value }))}
                />
              </Pole>
            ))}
          </div>
        )}
      </Karta>

      <Karta tytul="Porównanie z odpisem KRS">
        <PorownanieZKrs wniosek={wniosek} krs={krs} />
      </Karta>

      <Karta tytul={`Akcjonariusze (${akcjonariusze.length})`}>
        <div className="pion" style={{ gap: 12 }}>
          {akcjonariusze.length === 0 && <div className="podpowiedz">— brak zgłoszonych akcjonariuszy —</div>}
          {akcjonariusze.map((a) => (
            <PozycjaAkcjonariuszaWeryfikacja
              key={a.id}
              pozycja={a}
              wniosekId={wniosek.id}
              zablokowane={zablokowane}
              odswiez={odswiez}
              braki={brakiUstawowe[a.id]}
            />
          ))}
          {!zablokowane && (
            <button className="btn btn-maly" onClick={dopiszOsobe} disabled={dodawanie}>
              {dodawanie ? 'Dopisywanie…' : '+ Dopisz osobę'}
            </button>
          )}
        </div>
      </Karta>

      {!zablokowane && (
        <Karta tytul="Decyzja kancelarii">
          <div className="row-g" style={{ flexWrap: 'wrap' }}>
            <button className="btn" onClick={() => ustawPokazNotatke(pokazNotatke === 'do_uzupelnienia' ? null : 'do_uzupelnienia')}>
              Odeślij do uzupełnienia
            </button>
            <button className="btn btn-sygnal" onClick={() => ustawPokazNotatke(pokazNotatke === 'odrzuc' ? null : 'odrzuc')}>
              Odrzuć
            </button>
            <button
              className="btn btn-glowny"
              onClick={przyjmij}
              disabled={przetwarzanie || wniosek.status !== 'umowa_podpisana' || !wszystkoZweryfikowane}
            >
              Przyjmij wniosek
            </button>
          </div>
          {wniosek.status !== 'umowa_podpisana' && (
            <div className="podpowiedz" style={{ marginTop: 6 }}>
              Przyjęcie wymaga statusu „umowa podpisana” (obecnie: {STAN_WNIOSKU[wniosek.status]?.etykieta || wniosek.status}).
            </div>
          )}
          {wniosek.status === 'umowa_podpisana' && !wszystkoZweryfikowane && (
            <div className="podpowiedz" style={{ marginTop: 6 }}>
              Zweryfikuj wszystkie pozycje akcjonariuszy przed przyjęciem wniosku.
            </div>
          )}
          {pokazNotatke && (
            <div className="pion" style={{ gap: 8, marginTop: 10 }}>
              <textarea
                placeholder="Notatka dla klienta / do wewnętrznej ewidencji…"
                value={notatka}
                onChange={(z) => ustawNotatka(z.target.value)}
                style={{ minHeight: 70 }}
              />
              <button
                className="btn btn-glowny"
                style={{ alignSelf: 'flex-start' }}
                onClick={() => wyslijNotatke(pokazNotatke === 'odrzuc' ? 'odrzuc' : 'do-uzupelnienia')}
                disabled={przetwarzanie}
              >
                {przetwarzanie ? 'Zapisywanie…' : pokazNotatke === 'odrzuc' ? 'Potwierdź odrzucenie' : 'Potwierdź odesłanie do uzupełnienia'}
              </button>
            </div>
          )}
        </Karta>
      )}
    </div>
  );
}

window.EkranWnioski = EkranWnioski;
window.EkranWniosekSzczegoly = EkranWniosekSzczegoly;
