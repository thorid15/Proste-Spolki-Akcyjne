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
  nowa: 'neutralny', weryfikacja: 'lupek', wstrzymana: 'oliwka',
  wpisana: 'zielony', odmowa: 'bordo', anulowana: 'neutralny',
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

/** Widok sprawy — pełniejszy niż pigułka w kolejce: nazywa oba zegary wprost. */
function ZnacznikTerminu({ termin }) {
  if (termin.zamrozony) return <Znacznik odmiana="oliwka">termin zawieszony</Znacznik>;
  if (termin.po_terminie) return <Znacznik odmiana="bordo">po terminie ustawowym</Znacznik>;
  if (termin.po_celu) {
    return (
      <Znacznik odmiana="oliwka">
        po celu wewnętrznym · do terminu ustawowego {termin.dni_pozostale} dz.
      </Znacznik>
    );
  }
  return (
    <Znacznik odmiana="neutralny">
      do celu {termin.dni_do_celu} dz. · do terminu ustawowego {termin.dni_pozostale} dz.
    </Znacznik>
  );
}

/* Starzenie sprawy niesie teraz pigułka terminu w wierszu (`TerminPigulka`
   z pulpit.js) — mosiądz dla pilnych, czerwień wyłącznie po terminie.
   Pasek przy krawędzi wiersza zniknął razem z tabelą kolejki. */

/* ─────────────────────────────────────────────────────
   KOLEJKA
   ───────────────────────────────────────────────────── */
function EkranKolejkiSpraw({ spolkaId }) {
  const [pokazZakonczone, ustawPokazZakonczone] = useState(false);
  const [szukaj, ustawSzukaj] = useState('');
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
                tytul={s.typ_nazwa}
                podtytul={`${s.spolka_nazwa} · ${s.zrodlo === 'z_urzedu' ? 'z urzędu' : s.zrodlo}`}
                przyKlik={() => idz(`/sprawy/${s.id}`)}
                prawo={
                  <>
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
function PanelDokumentow({ sprawaId, dokumenty, odswiez }) {
  const [typDokumentu, ustawTypDokumentu] = useState('inny');
  const [wysylanie, ustawWysylanie] = useState(false);
  const [blad, ustawBlad] = useState(null);

  async function wgraj(zdarzenie) {
    const pliki = [...zdarzenie.target.files];
    if (pliki.length === 0) return;
    ustawWysylanie(true);
    ustawBlad(null);
    try {
      const formularz = new FormData();
      formularz.append('typ_dokumentu', typDokumentu);
      for (const plik of pliki) formularz.append('pliki', plik);
      const odp = await fetch(`/api/psa/sprawy/${sprawaId}/dokumenty`, { method: 'POST', body: formularz });
      if (!odp.ok) {
        const tresc = await odp.json();
        throw new Error(tresc.blad || `Błąd ${odp.status}`);
      }
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
          <div className="przyciemnione" style={{ marginBottom: 14 }}>Brak wgranych dokumentów.</div>
        ) : (
          <table className="tbl" style={{ marginBottom: 14 }}>
            <thead><tr><th>Plik</th><th>Typ</th><th>Wgrał</th><th>Data</th></tr></thead>
            <tbody>
              {dokumenty.map((d) => (
                <tr key={d.id}>
                  <td>
                    <a href={`/api/psa/sprawy/${sprawaId}/dokumenty/${d.id}`} target="_blank" rel="noreferrer">
                      {d.nazwa_pliku}
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
          <select value={typDokumentu} onChange={(z) => ustawTypDokumentu(z.target.value)} style={{ width: 'auto' }}>
            <option value="umowa_zbycia">umowa zbycia</option>
            <option value="uchwala">uchwała</option>
            <option value="zgoda">zgoda</option>
            <option value="postanowienie">postanowienie</option>
            <option value="pelnomocnictwo">pełnomocnictwo</option>
            <option value="inny">inny</option>
          </select>
          <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" disabled={wysylanie} onChange={wgraj} />
          {wysylanie && <span className="przyciemnione">Wysyłanie…</span>}
        </div>
      </div>
    </Sekcja>
  );
}

/* ─────────────────────────────────────────────────────
   AKCJE WORKFLOW (wstrzymaj / wznów / odmów / anuluj)
   ───────────────────────────────────────────────────── */
function ModalPowod({ tytul, etykieta, przyZamknieciu, przyZapisie }) {
  const [powod, ustawPowod] = useState('');
  return (
    <Modal
      tytul={tytul}
      przyZamknieciu={przyZamknieciu}
      stopka={
        <>
          <button className="btn" onClick={przyZamknieciu}>Anuluj</button>
          <button className="btn btn-primary" disabled={!powod.trim()} onClick={() => przyZapisie(powod.trim())}>
            Potwierdź
          </button>
        </>
      }
    >
      <Pole etykieta={etykieta} wymagane>
        <textarea value={powod} onChange={(z) => ustawPowod(z.target.value)} autoFocus />
      </Pole>
    </Modal>
  );
}

function AkcjeSprawy({ sprawa, odswiez }) {
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

  if (['wpisana', 'odmowa', 'anulowana'].includes(sprawa.stan)) return null;

  return (
    <div className="row-g bez-druku" style={{ flexWrap: 'wrap' }}>
      <Komunikat odmiana="blad" tresc={bladAkcji} />
      {sprawa.stan === 'weryfikacja' && (
        <button className="btn btn-sm" onClick={() => ustawModal('wstrzymaj')}>Wstrzymaj</button>
      )}
      {sprawa.stan === 'wstrzymana' && (
        <button className="btn btn-sm btn-primary" onClick={() => wykonaj('wznow')}>Wznów</button>
      )}
      {['weryfikacja', 'wstrzymana'].includes(sprawa.stan) && (
        <button className="btn btn-sm btn-danger" onClick={() => ustawModal('odmow')}>Odmów wpisu</button>
      )}
      <button className="btn btn-sm" onClick={() => ustawModal('anuluj')}>Anuluj sprawę</button>

      {modal === 'wstrzymaj' && (
        <ModalPowod
          tytul="Wstrzymanie sprawy"
          etykieta="Przeszkoda uniemożliwiająca wpis"
          przyZamknieciu={() => ustawModal(null)}
          przyZapisie={(powod) => wykonaj('wstrzymaj', { powod })}
        />
      )}
      {modal === 'odmow' && (
        <ModalPowod
          tytul="Odmowa wpisu"
          etykieta="Przyczyna odmowy (art. 300(34) § 7 zd. 2 KSH)"
          przyZamknieciu={() => ustawModal(null)}
          przyZapisie={(powod_odmowy) => wykonaj('odmow', { powod_odmowy })}
        />
      )}
      {modal === 'anuluj' && (
        <ModalPowod
          tytul="Anulowanie sprawy"
          etykieta="Powód anulowania"
          przyZamknieciu={() => ustawModal(null)}
          przyZapisie={(powod) => wykonaj('anuluj', { powod })}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   POWIADOMIENIE / ZGODA (art. 300(34) § 3 KSH)
   ───────────────────────────────────────────────────── */
function PanelPowiadomienia({ sprawa, spolka, odswiez }) {
  const [osobaId, ustawOsobeId] = useState(null);
  const [wysylanie, ustawWysylanie] = useState(false);
  const [forma, ustawForme] = useState('');
  const [blad, ustawBlad] = useState(null);

  async function wyslij() {
    if (!osobaId) return;
    ustawWysylanie(true);
    ustawBlad(null);
    try {
      const odp = await API.post(`/api/psa/sprawy/${sprawa.id}/powiadomienie`, { osoba_id: osobaId });
      if (!odp.wysylka.wyslano) ustawBlad(odp.wysylka.powod);
      odswiez();
    } catch (e) {
      ustawBlad(e.message);
    } finally {
      ustawWysylanie(false);
    }
  }

  async function odnotujZgode() {
    if (!forma) return;
    ustawWysylanie(true);
    ustawBlad(null);
    try {
      await API.post(`/api/psa/sprawy/${sprawa.id}/zgoda`, { forma });
      odswiez();
    } catch (e) {
      ustawBlad(e.message);
    } finally {
      ustawWysylanie(false);
    }
  }

  const meta = useDane('/api/psa/meta');

  return (
    <Karta tytul="Uprzednie powiadomienie (art. 300(34) § 3 KSH)">
      <Komunikat
        odmiana="uwaga"
        tresc="Przed wpisem należy powiadomić osobę, której uprawnienia mają być wykreślone, zmienione lub obciążone — chyba że wyraziła zgodę."
      />
      {sprawa.powiadomienie_wyslano && (
        <Komunikat odmiana="ok" tresc={`Powiadomienie wysłano ${fmt.dataCzas(sprawa.powiadomienie_wyslano)}.`} />
      )}
      {sprawa.zgoda_forma && (
        <Komunikat odmiana="ok" tresc={`Odnotowano zgodę (${sprawa.zgoda_forma}) z dnia ${fmt.data(sprawa.zgoda_data)}.`} />
      )}
      <Komunikat odmiana="blad" tresc={blad} />

      <div className="siatka-2">
        <div>
          <Pole etykieta="Wyślij powiadomienie">
            <WyborOsoby wartosc={osobaId} przyZmianie={ustawOsobeId} />
          </Pole>
          <button className="btn btn-sm" disabled={!osobaId || wysylanie} onClick={wyslij}>
            {wysylanie ? 'Wysyłanie…' : 'Wyślij powiadomienie'}
          </button>
        </div>
        <div>
          <Pole etykieta="Albo odnotuj zgodę (opisz, w jaki sposób ją uzyskano)">
            <input
              type="text"
              value={forma}
              onChange={(z) => ustawForme(z.target.value)}
              placeholder="np. oświadczenie e-mail z dnia…"
            />
          </Pole>
          <button className="btn btn-sm" disabled={!forma.trim() || wysylanie} onClick={odnotujZgode}>
            Odnotuj zgodę
          </button>
        </div>
      </div>
    </Karta>
  );
}

/* ─────────────────────────────────────────────────────
   KROKI 3–4 OSADZONE — wspólne dla nowej i wznawianej sprawy
   ───────────────────────────────────────────────────── */
function KreatorSprawy({ sprawa, spolka, definicjaTypu, odswiezSprawe, naWpisano }) {
  const draft = sprawa.dane_wejsciowe_json ? JSON.parse(sprawa.dane_wejsciowe_json) : null;

  const [krok, ustawKrok] = useState(2);
  const [dataZdarzenia, ustawDateZdarzenia] = useState((draft && draft.data_zdarzenia) || sprawa.data_wplywu.slice(0, 10));
  const [dane, ustawDane] = useState((draft && draft.dane) || {});
  const [odhaczone, ustawOdhaczone] = useState({});
  const [notatkaWatpliwosci, ustawNotatkeWatpliwosci] = useState('');
  const [podglad, ustawPodglad] = useState(null);
  const [ladowaniePodgladu, ustawLadowaniePodgladu] = useState(false);
  const [zapisywanie, ustawZapisywanie] = useState(false);
  const [wynik, ustawWynik] = useState(null);
  const [bladLokalny, ustawBladLokalny] = useState(null);

  function budujDane() {
    return zbudujDaneZdarzenia(sprawa.typ_zdarzenia, dane);
  }

  async function wczytajPodglad() {
    ustawLadowaniePodgladu(true);
    ustawBladLokalny(null);
    try {
      const odpowiedz = await API.post(`/api/psa/sprawy/${sprawa.id}/podglad`, {
        data_zdarzenia: dataZdarzenia,
        dane: budujDane(),
      });
      ustawPodglad(odpowiedz);
    } catch (e) {
      ustawBladLokalny(e.message);
      ustawPodglad(null);
    } finally {
      ustawLadowaniePodgladu(false);
    }
  }

  async function dokonajWpisu() {
    ustawZapisywanie(true);
    ustawBladLokalny(null);
    try {
      const odpowiedz = await API.post(`/api/psa/sprawy/${sprawa.id}/wpisz`, {
        data_zdarzenia: dataZdarzenia,
        dane: budujDane(),
      });
      ustawWynik(odpowiedz);
      // Sprawa jest juz „wpisana” w bazie - ukrywamy w rodzicu akcje i panel
      // powiadomienia (dotycza stanu „weryfikacja”), zeby nie sugerowac
      // czynnosci, ktorych serwer i tak juz nie wykona. Danych sprawy
      // NIE odswiezamy tutaj - zrobiloby to zniknac ten ekran podsumowania
      // (renderowany tylko, gdy sprawa.stan==='weryfikacja').
      if (naWpisano) naWpisano();
    } catch (e) {
      ustawPodglad((p) => ({ ...(p || {}), dopuszczalne: false, bledy: e.bledy, ostrzezenia: e.ostrzezenia }));
    } finally {
      ustawZapisywanie(false);
    }
  }

  async function wstrzymajZWatpliwosci() {
    ustawZapisywanie(true);
    try {
      await API.patch(`/api/psa/sprawy/${sprawa.id}`, { akcja: 'wstrzymaj', powod: `Uzasadnione wątpliwości: ${notatkaWatpliwosci}` });
      odswiezSprawe();
    } catch (e) {
      ustawBladLokalny(e.message);
    } finally {
      ustawZapisywanie(false);
    }
  }

  function idzDoKroku(nowy) {
    ustawBladLokalny(null);
    if (nowy === 3) {
      try {
        budujDane();
      } catch (e) {
        ustawBladLokalny(e.message);
        return;
      }
      ustawKrok(3);
      wczytajPodglad();
      return;
    }
    ustawKrok(nowy);
  }

  if (wynik) {
    return (
      <div style={{ maxWidth: 'var(--tresc-waska)' }}>
        <Karta>
          <Komunikat
            odmiana="ok"
            tytul={`${definicjaTypu.nazwa} — zdarzenie zapisane w rejestrze`}
            tresc={`Skrót zdarzenia w łańcuchu: ${wynik.zdarzenie.hash_skrocony}…`}
          />
          <Komunikat odmiana="uwaga" tytul="Do sprawdzenia:" lista={wynik.ostrzezenia} />
          {wynik.powiadomienia && wynik.powiadomienia.length > 0 && (
            <Komunikat
              odmiana="info"
              tytul="Zawiadomienie o wpisie"
              lista={wynik.powiadomienia.map((p) =>
                p.blad
                  ? p.blad
                  : `${p.odbiorca}: ${p.wyslano ? 'wysłano e-mailem' : `nie wysłano — ${p.powod}`}`
              )}
            />
          )}
          <div className="kreator-stopka">
            <button className="btn btn-primary" onClick={() => idz(`/spolki/${sprawa.spolka_id}`)}>
              Wróć do kokpitu spółki
            </button>
          </div>
        </Karta>
      </div>
    );
  }

  const checklista = definicjaTypu ? definicjaTypu.checklista : [];
  const wymagane = checklista.filter((p) => p.wymagana && !p.watpliwosci);
  const wszystkoOdhaczone = wymagane.every((p) => odhaczone[p.kod]);
  const sawatpliwosci = checklista.some((p) => p.watpliwosci && odhaczone[p.kod]);
  const mozeWpisac =
    podglad && podglad.dopuszczalne && wszystkoOdhaczone && (!sawatpliwosci || notatkaWatpliwosci.trim());
  const KrokTresci = KROKI_TRESCI[sprawa.typ_zdarzenia];

  return (
    <div style={{ maxWidth: 'var(--tresc-waska)' }}>
      <Kroki kroki={['Podstawa', 'Co się zmienia', 'Weryfikacja i podgląd']} biezacy={krok - 1} />
      <Karta>
      {krok === 2 && (
        <>
          <div className="card-h">Co się zmienia</div>
          <Pole etykieta="Data zdarzenia" wymagane podpowiedz="Data z dokumentu.">
            <PoleDaty wartosc={dataZdarzenia} max={fmt.dzisIso()} przyZmianie={(v) => v && ustawDateZdarzenia(v)} skroty />
          </Pole>
          {KrokTresci ? (
            <KrokTresci dane={dane} ustawDane={ustawDane} spolka={spolka} />
          ) : (
            <Komunikat odmiana="blad" tresc={`Brak formularza dla typu „${sprawa.typ_zdarzenia}”.`} />
          )}
          {sprawa.typ_zdarzenia !== 'emisja' && (
            <div className="podstawa-prawna odstep-g">
              Numery akcji przydziela aplikacja — podajesz wyłącznie ilość. Wyliczony zakres
              zobaczysz do potwierdzenia w następnym kroku.
            </div>
          )}
        </>
      )}

      {krok === 3 && (
        <>
          <div className="card-h">Weryfikacja i podgląd</div>
          {ladowaniePodgladu ? (
            <Spinner />
          ) : !podglad ? (
            <Komunikat odmiana="blad" tresc="Nie udało się przygotować podglądu." />
          ) : (
            <>
              <Wyniki bledy={podglad.bledy} ostrzezenia={podglad.ostrzezenia} />

              {podglad.dane && podglad.dane.zamiast === undefined && podglad.dopuszczalne && (
                <Komunikat odmiana="ok" tresc="Treść gotowa do wpisu." />
              )}

              <div className="rozdzielacz" />
              <div className="fl">Checklista weryfikacji</div>
              <div className="checklista">
                {checklista.map((p) => (
                  <label key={p.kod} className={`chk ${p.watpliwosci ? 'chk-watpliwosci' : ''}`}>
                    <input
                      type="checkbox"
                      checked={Boolean(odhaczone[p.kod])}
                      onChange={(z) => ustawOdhaczone((o) => ({ ...o, [p.kod]: z.target.checked }))}
                    />
                    <span className="chk-tresc">
                      {p.tresc}
                      {!p.wymagana && !p.watpliwosci && <span className="przyciemnione"> (jeśli dotyczy)</span>}
                      {p.podstawa && <div className="podstawa-prawna">{p.podstawa}</div>}
                    </span>
                  </label>
                ))}
              </div>

              {sawatpliwosci && (
                <Pole etykieta="Notatka o uzasadnionych wątpliwościach" wymagane podpowiedz="Wymagana. Sprawa zostanie wstrzymana do wyjaśnienia.">
                  <textarea value={notatkaWatpliwosci} onChange={(z) => ustawNotatkeWatpliwosci(z.target.value)} />
                </Pole>
              )}

              {!wszystkoOdhaczone && !sawatpliwosci && (
                <div className="podstawa-prawna">
                  Przycisk „Dokonaj wpisu” pozostaje nieaktywny do czasu odhaczenia całej checklisty.
                </div>
              )}
            </>
          )}
        </>
      )}

      <Komunikat odmiana="blad" tresc={bladLokalny} />

      <div className="kreator-stopka">
        <button className="btn" onClick={() => idzDoKroku(krok - 1)} disabled={krok === 2}>
          Wstecz
        </button>
        <div className="kreator-stopka-prawa">
          {krok === 2 ? (
            <button className="btn btn-primary" onClick={() => idzDoKroku(3)}>Dalej</button>
          ) : sawatpliwosci ? (
            <button className="btn btn-danger btn-lg" disabled={!notatkaWatpliwosci.trim() || zapisywanie} onClick={wstrzymajZWatpliwosci}>
              {zapisywanie ? 'Wstrzymywanie…' : 'Wstrzymaj sprawę (wątpliwości)'}
            </button>
          ) : (
            <>
              <button className="btn" onClick={wczytajPodglad} disabled={ladowaniePodgladu}>Przelicz podgląd</button>
              <button className="btn btn-primary btn-lg" disabled={!mozeWpisac || zapisywanie} onClick={dokonajWpisu}>
                {zapisywanie ? 'Zapisywanie…' : 'Dokonaj wpisu'}
              </button>
            </>
          )}
        </div>
      </div>
      </Karta>
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   EKRAN SPRAWY
   ───────────────────────────────────────────────────── */
function EkranSprawy({ sprawaId }) {
  const { dane, ladowanie, blad, odswiez } = useDane(`/api/psa/sprawy/${sprawaId}`);
  const meta = useDane('/api/psa/meta');
  // Ustawiane od razu po udanym wpisie (patrz KreatorSprawy) - ukrywa akcje
  // i panel powiadomienia dotyczace stanu „weryfikacja”, zanim jeszcze
  // odswiezymy dane sprawy. Odswiezenia CELOWO NIE wywolujemy od razu:
  // zrobiloby to zniknac ekran podsumowania wpisu (widoczny tylko, gdy
  // sprawa.stan==='weryfikacja').
  const [wlasnieWpisano, ustawWlasnieWpisano] = useState(false);
  // Krok 3/4 kreatora potrzebuje "bogatego" widoku spółki (emisje, bilans,
  // akcjonariusze, obciążenia, uprawnienia, ograniczenia) — ten sam kształt,
  // co kokpit spółki. Endpoint sprawy zwraca tylko surowy rekord spółki.
  const spolkaBogata = useDane(dane ? `/api/psa/spolki/${dane.sprawa.spolka_id}` : null, [dane && dane.sprawa.id]);

  if (ladowanie || meta.ladowanie || !dane || spolkaBogata.ladowanie) return <Spinner />;
  if (blad) return <Komunikat odmiana="blad" tresc={blad.message} />;
  if (spolkaBogata.blad) return <Komunikat odmiana="blad" tresc={spolkaBogata.blad.message} />;

  const { sprawa, spolka, zadajacy, dokumenty, wydane_dokumenty } = dane;
  const definicjaTypu = meta.dane.typy_zdarzen.find((t) => t.kod === sprawa.typ_zdarzenia);
  const zakonczona = ['wpisana', 'odmowa', 'anulowana'].includes(sprawa.stan);

  return (
    <>
      <div className="okruszki">
        <button onClick={() => idz('/sprawy')}>Sprawy</button> →{' '}
        <button onClick={() => idz(`/spolki/${sprawa.spolka_id}`)}>{spolka.nazwa}</button> → sprawa #{sprawa.id}
      </div>

      <div className="pasek-gorny">
        <div>
          <div className="tytul-strony">{sprawa.typ_nazwa}</div>
          <div className="podtytul-strony">
            {spolka.nazwa} · wpłynęła {fmt.data(sprawa.data_wplywu)} · {sprawa.zrodlo === 'z_urzedu' ? 'z urzędu' : sprawa.zrodlo}
            {zadajacy ? ` · żądający: ${zadajacy.oznaczenie}` : ''}
            {sprawa.zadajacy_rola ? ` (${OPISY_ROL_ZADAJACEGO[sprawa.zadajacy_rola] || sprawa.zadajacy_rola})` : ''}
          </div>
          <div className="row-g" style={{ marginTop: 10 }}>
            <Znacznik odmiana={ODMIANY_STANU_SPRAWY[sprawa.stan]}>{NAZWY_STANU_SPRAWY[sprawa.stan]}</Znacznik>
            {!zakonczona && !wlasnieWpisano && <ZnacznikTerminu termin={sprawa.termin} />}
          </div>
        </div>
      </div>

      {sprawa.notatka && (
        <Komunikat odmiana="info" tytul="Notatki" tresc={sprawa.notatka.split('\n').slice(-1)[0].replace(/^\[.*?\]\s*/, '')} />
      )}
      {sprawa.stan === 'odmowa' && (
        <Komunikat odmiana="blad" tytul="Przyczyna odmowy" tresc={sprawa.powod_odmowy} />
      )}

      {!wlasnieWpisano && <AkcjeSprawy sprawa={sprawa} odswiez={odswiez} />}

      {!wlasnieWpisano && definicjaTypu && definicjaTypu.wymaga_powiadomienia === true && !zakonczona && (
        <PanelPowiadomienia sprawa={sprawa} spolka={spolka} odswiez={odswiez} />
      )}

      <PanelDokumentow sprawaId={sprawa.id} dokumenty={dokumenty} odswiez={odswiez} />

      {wydane_dokumenty.length > 0 && (
        <Sekcja tytul="Wydane dokumenty" licznik={wydane_dokumenty.length}>
          <table className="tbl" style={{ margin: '0 24px', width: 'calc(100% - 48px)' }}>
            <thead><tr><th>Typ</th><th>Kanał</th><th>Wysłano</th><th>Autor</th></tr></thead>
            <tbody>
              {wydane_dokumenty.map((w) => (
                <tr key={w.id}>
                  <td>{w.typ}</td>
                  <td className="przyciemnione">{w.kanal}</td>
                  <td>{w.wyslano ? fmt.dataCzas(w.wyslano) : <span className="przyciemnione">nie wysłano</span>}</td>
                  <td className="przyciemnione">{w.autor}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ height: 16 }} />
        </Sekcja>
      )}

      {!zakonczona && sprawa.stan === 'weryfikacja' && (
        <KreatorSprawy
            sprawa={sprawa}
            spolka={spolkaBogata.dane}
            definicjaTypu={definicjaTypu}
            odswiezSprawe={odswiez}
            naWpisano={() => ustawWlasnieWpisano(true)}
          />
      )}
      {sprawa.stan === 'wstrzymana' && (
        <Karta>
          <Pusto tytul="Sprawa wstrzymana" opis="Wznów sprawę po usunięciu przeszkody, żeby wrócić do kreatora." />
        </Karta>
      )}
      {sprawa.stan === 'nowa' && (
        <Karta>
          <Pusto tytul="Sprawa czeka na weryfikację" opis="Przenieś sprawę do weryfikacji, żeby przejść do kreatora." />
        </Karta>
      )}
    </>
  );
}

window.EkranKolejkiSpraw = EkranKolejkiSpraw;
window.EkranSprawy = EkranSprawy;
