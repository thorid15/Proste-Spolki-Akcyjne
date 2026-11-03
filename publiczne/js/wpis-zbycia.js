/* ─────────────────────────────────────────────────────
   R4 zad. 15 (D-091) — nowy przebieg wpisu zbycia akcji:
   „Co się zbywa” → „Podstawa” → „Sprawdzenie i wpis”.
   Logika (dobór numerów, widoczność pól): `wpis-zbycia-logika.js`.
   ───────────────────────────────────────────────────── */

const FORMULARZ_ZBYCIA = {
  zbywca_osoba_id: null, ilosc: '', nabywca_osoba_id: null, reczne_numery: false, emisja_klucz: null, zakresy_tekst: '',
  dokument_data: '', zadajacy_rola: 'nabywca', zadajacy_osoba_id: null, tytul_prawny: 'sprzedaż',
  zgoda_spolki: false, zgoda_spolki_niepelne_pokrycie: false, pierwszenstwo_wyczerpane: false,
};

/** Formularz zapisany w szkicu sprawy (`_formularz` przy podglądzie) albo dane startowe. */
function formularzStartowy(sprawa, poczatek) {
  try {
    const szkic = sprawa && sprawa.dane_wejsciowe_json ? JSON.parse(sprawa.dane_wejsciowe_json) : null;
    if (szkic && szkic.dane && szkic.dane._formularz) return { ...FORMULARZ_ZBYCIA, ...szkic.dane._formularz };
  } catch (e) { /* stary szkic — od początku */ }
  const f = { ...FORMULARZ_ZBYCIA, ...(poczatek || {}) };
  if (sprawa && sprawa.zadajacy_rola === 'zbywca' && !f.zbywca_osoba_id) f.zbywca_osoba_id = sprawa.zadajacy_osoba_id;
  if (sprawa && sprawa.zadajacy_rola === 'nabywca' && !f.nabywca_osoba_id) f.nabywca_osoba_id = sprawa.zadajacy_osoba_id;
  if (sprawa && sprawa.dokument_data) f.dokument_data = sprawa.dokument_data;
  return f;
}

/** Nowy nabywca z minimum danych (art. 300(33) § 1 pkt 5 KSH, D-076: PESEL albo data urodzenia). */
function NowyNabywca({ przyZapisie, przyAnulowaniu }) {
  const [o, ustawO] = useState({ typ: 'fizyczna', imie: '', nazwisko: '', nazwa: '', numer_w_rejestrze: '', pesel: '', data_urodzenia: '', kod_pocztowy: '', miejscowosc: '', ulica: '', nr_domu: '', nr_lokalu: '' });
  const [blad, ustawBlad] = useState(null);
  const [zapis, ustawZapis] = useState(false);
  const pole = (k) => ({ value: o[k], onChange: (z) => ustawO({ ...o, [k]: z.target.value }) });
  async function zapisz() {
    ustawZapis(true);
    ustawBlad(null);
    try {
      const dane = Object.fromEntries(Object.entries({ ...o, kraj: 'Polska', zgoda_email_status: 'brak' }).filter(([, v]) => v !== ''));
      const odp = await API.post('/api/psa/osoby', dane);
      przyZapisie(odp.osoba);
    } catch (e) {
      ustawBlad(e.message);
      ustawZapis(false);
    }
  }
  const fizyczna = o.typ === 'fizyczna';
  return (
    <div className="karta nowy-nabywca">
      <div className="fl">Nowy nabywca — minimum danych do rejestru</div>
      <Komunikat odmiana="blad" tresc={blad} />
      <div className="row-g">
        <label className="chk"><input type="radio" checked={fizyczna} onChange={() => ustawO({ ...o, typ: 'fizyczna' })} /> osoba fizyczna</label>
        <label className="chk"><input type="radio" checked={!fizyczna} onChange={() => ustawO({ ...o, typ: 'prawna' })} /> osoba prawna</label>
      </div>
      {fizyczna ? (
        <div className="siatka-2">
          <Pole etykieta="Imię" wymagane><input {...pole('imie')} /></Pole>
          <Pole etykieta="Nazwisko" wymagane><input {...pole('nazwisko')} /></Pole>
          <Pole etykieta="PESEL" podpowiedz="Albo data urodzenia (D-076)."><input {...pole('pesel')} inputMode="numeric" /></Pole>
          <Pole etykieta="Data urodzenia"><PoleDaty wartosc={o.data_urodzenia} przyZmianie={(v) => ustawO({ ...o, data_urodzenia: v || '' })} /></Pole>
        </div>
      ) : (
        <div className="siatka-2">
          <Pole etykieta="Firma (nazwa)" wymagane><input {...pole('nazwa')} /></Pole>
          <Pole etykieta="Numer KRS"><input {...pole('numer_w_rejestrze')} inputMode="numeric" /></Pole>
        </div>
      )}
      <div className="siatka-2">
        <Pole etykieta="Kod pocztowy" wymagane><input {...pole('kod_pocztowy')} placeholder="00-000" /></Pole>
        <Pole etykieta="Miejscowość" wymagane><input {...pole('miejscowosc')} /></Pole>
        <Pole etykieta="Ulica"><input {...pole('ulica')} /></Pole>
        <Pole etykieta="Nr domu / lokalu" wymagane>
          <span className="row-g"><input {...pole('nr_domu')} style={{ width: '6rem' }} /><input {...pole('nr_lokalu')} style={{ width: '6rem' }} /></span>
        </Pole>
      </div>
      <PasekAkcji akcje={[
        { etykieta: 'Anuluj', przyKlik: przyAnulowaniu },
        { etykieta: zapis ? 'Zapisywanie…' : 'Zapisz w kartotece', przyKlik: zapisz, glowna: true, wylaczona: zapis },
      ]} />
    </div>
  );
}

/**
 * Kreator zbycia. Bez `sprawa` — kroki 1–2 i założenie sprawy (potem ekran sprawy, krok 3).
 * Ze `sprawa` — wszystkie kroki; stan „nowa” przechodzi w „weryfikację” sam (bez osobnego kroku).
 */
function KreatorZbycia({ spolkaId, sprawa = null, odswiezSprawe, definicjaTypu = null, poczatek = null }) {
  const stanSpolki = useDane(`/api/psa/spolki/${spolkaId}`);
  const [f, ustawF] = useState(() => formularzStartowy(sprawa, poczatek));
  const maSzkic = Boolean(sprawa && sprawa.dane_wejsciowe_json && String(sprawa.dane_wejsciowe_json).includes('_formularz'));
  const [krok, ustawKrok] = useState(maSzkic ? 3 : 1);
  const [nowyNabywca, ustawNowyNabywca] = useState(false);
  const [plik, ustawPlik] = useState(null);
  const [blad, ustawBlad] = useState(null);
  const [pracuje, ustawPracuje] = useState(false);
  const [podglad, ustawPodglad] = useState(null);
  const [odhaczone, ustawOdhaczone] = useState({});
  const [wynik, ustawWynik] = useState(null);
  const klucz = useRef(crypto.randomUUID());
  const zmien = (zmiany) => ustawF((p) => ({ ...p, ...zmiany }));

  useEffect(() => {
    if (sprawa && sprawa.stan === 'nowa') API.patch(`/api/psa/sprawy/${sprawa.id}`, { akcja: 'weryfikuj' }).then(odswiezSprawe).catch(() => {});
  }, [sprawa && sprawa.id]);

  const stan = stanSpolki.dane;
  const zbywcy = stan ? zbywcyZRejestru(stan) : [];
  const zbywca = zbywcy.find((z) => Number(z.osoba_id) === Number(f.zbywca_osoba_id)) || null;
  const dobor = stan && f.zbywca_osoba_id && Number(f.ilosc) > 0
    ? dobierzAkcje(stan, f.zbywca_osoba_id, f.ilosc, { emisjaKlucz: f.emisja_klucz }) : null;
  const kontekst = { stan, sprawa, dane: f, dobor };
  const widoczne = (k) => Boolean(stan) && poleWidoczne('przeniesienie', k, kontekst);
  const serieZbywcy = stan ? [...new Set((stan.akcjonariusze || []).filter((a) => Number(a.osoba_id) === Number(f.zbywca_osoba_id)).map((a) => a.emisja_klucz))] : [];

  function daneDoWpisu(zFormularzem) {
    const dane = zbudujDaneZdarzenia('przeniesienie', daneZdarzenia(stan, f));
    return zFormularzem ? { ...dane, _formularz: f } : dane;
  }

  async function przelicz() {
    try {
      ustawPodglad(await API.post(`/api/psa/sprawy/${sprawa.id}/podglad`, { dane: daneDoWpisu(true) }));
    } catch (e) {
      ustawBlad(e.message);
    }
  }

  useEffect(() => { if (krok === 3 && sprawa && stan) przelicz(); }, [krok, stan && 1, f.zgoda_spolki, f.zgoda_spolki_niepelne_pokrycie, f.pierwszenstwo_wyczerpane]);

  const krok1Gotowy = f.zbywca_osoba_id && Number(f.ilosc) > 0 && f.nabywca_osoba_id && dobor && dobor.brakuje === 0;
  const krok2Gotowy = /^\d{4}-\d{2}-\d{2}$/.test(String(f.dokument_data)) && (f.zadajacy_rola !== 'spolka' || f.zadajacy_osoba_id);

  async function dalejZPodstawy() {
    ustawPracuje(true);
    ustawBlad(null);
    try {
      if (!sprawa) {
        const zadajacy = f.zadajacy_rola === 'zbywca' ? f.zbywca_osoba_id : f.zadajacy_rola === 'nabywca' ? f.nabywca_osoba_id : f.zadajacy_osoba_id;
        const odp = await API.post('/api/psa/sprawy', {
          spolka_id: spolkaId, typ_zdarzenia: 'przeniesienie', zrodlo: 'papier', zadajacy_osoba_id: zadajacy, zadajacy_rola: f.zadajacy_rola,
          data_wplywu: fmt.dzisIso(), dokument_rodzaj: 'umowa_zbycia', dokument_data: f.dokument_data, klucz_idempotencji: klucz.current,
        });
        const id = odp.sprawa.id;
        if (plik) {
          const fd = new FormData();
          fd.append('typ_dokumentu', 'umowa_zbycia');
          fd.append('pliki', plik);
          await fetch(`/api/psa/sprawy/${id}/dokumenty`, { method: 'POST', body: fd });
        }
        if (odp.sprawa.stan === 'nowa') await API.patch(`/api/psa/sprawy/${id}`, { akcja: 'weryfikuj' });
        await API.post(`/api/psa/sprawy/${id}/podglad`, { dane: daneDoWpisu(true) });
        idz(`/sprawy/${id}`);
        return;
      }
      await API.patch(`/api/psa/sprawy/${sprawa.id}`, { akcja: 'podstawa', dokument_rodzaj: 'umowa_zbycia', dokument_data: f.dokument_data });
      ustawKrok(3);
      odswiezSprawe && odswiezSprawe();
    } catch (e) {
      ustawBlad(e.message);
    } finally {
      ustawPracuje(false);
    }
  }

  async function dokonajWpisu() {
    ustawPracuje(true);
    ustawBlad(null);
    try {
      ustawWynik(await API.post(`/api/psa/sprawy/${sprawa.id}/wpisz`, { dane: daneDoWpisu(false) }));
    } catch (e) {
      ustawBlad(e.message);
    } finally {
      ustawPracuje(false);
    }
  }

  if (stanSpolki.ladowanie) return <Spinner />;
  if (wynik) {
    return (
      <Karta>
        <Komunikat odmiana="ok" tytul="Zbycie akcji — wpis dokonany" tresc={`Skrót zdarzenia w łańcuchu: ${wynik.zdarzenie.hash_skrocony}…`} />
        <Komunikat odmiana="uwaga" tytul="Do sprawdzenia:" lista={wynik.ostrzezenia} />
        <PasekAkcji akcje={[{ etykieta: 'Wróć do kokpitu spółki', przyKlik: () => idz(`/spolki/${spolkaId}`), glowna: true }]} />
      </Karta>
    );
  }

  const checklista = (definicjaTypu && definicjaTypu.checklista || []).filter((p) => !p.watpliwosci);
  const wymaganeOdhaczone = checklista.filter((p) => p.wymagana).every((p) => odhaczone[p.kod]);
  const mozeWpisac = sprawa && podglad && podglad.dopuszczalne && wymaganeOdhaczone && !sprawa.blokada_wpisu;

  return (
    <>
      <Kroki kroki={definicjaWpisu.przeniesienie.kroki} biezacy={krok - 1} />
      <Karta>
        <Komunikat odmiana="blad" tresc={blad} />

        {krok === 1 && (
          <div className="pion" style={{ gap: 'var(--od-12)' }}>
            <Pole etykieta="Zbywca" wymagane podpowiedz="Akcjonariusz tej spółki.">
              <select value={f.zbywca_osoba_id || ''} onChange={(z) => zmien({ zbywca_osoba_id: Number(z.target.value) || null, emisja_klucz: null })}>
                <option value="">— wybierz akcjonariusza —</option>
                {zbywcy.map((z) => <option key={z.osoba_id} value={z.osoba_id}>{z.oznaczenie} — {fmt.liczba(z.ilosc)} akcji</option>)}
              </select>
              {zbywca && <ZnacznikKontaktu osoba={zbywca.osoba} />}
            </Pole>
            <Pole etykieta="Liczba zbywanych akcji" wymagane>
              <input type="number" min="1" value={f.ilosc} onChange={(z) => zmien({ ilosc: z.target.value })} style={{ maxWidth: '12rem' }} />
            </Pole>
            {dobor && (
              <Komunikat
                odmiana={dobor.brakuje ? 'blad' : 'info'}
                tresc={dobor.brakuje
                  ? `W serii ${dobor.seria} zbywca ma ${fmt.liczba(dobor.dostepne)} akcji — jeden wpis dotyczy jednej serii.${dobor.inneSerie.length ? ` Akcje serii ${dobor.inneSerie.join(', ')} wpisz kolejną sprawą albo wybierz serię ręcznie.` : ''}`
                  : `Akcje serii ${dobor.seria}, numery ${dobor.zakresyTekst} (dobrane automatycznie).`}
              />
            )}
            {f.zbywca_osoba_id && (
              f.reczne_numery ? (
                <div className="siatka-2">
                  <Pole etykieta="Seria">
                    <select value={f.emisja_klucz ?? (dobor ? dobor.emisja_klucz : '')} onChange={(z) => zmien({ emisja_klucz: Number(z.target.value) })}>
                      {serieZbywcy.map((k) => <option key={k} value={k}>{((stan.emisje || []).find((e) => e.klucz === k) || {}).seria || k}</option>)}
                    </select>
                  </Pole>
                  <Pole etykieta="Numery akcji" podpowiedz="Np. „1-100, 150”."><input value={f.zakresy_tekst} onChange={(z) => zmien({ zakresy_tekst: z.target.value })} /></Pole>
                </div>
              ) : (
                <div><button type="button" className="btn btn-sm" onClick={() => zmien({ reczne_numery: true, zakresy_tekst: dobor ? dobor.zakresyTekst : '' })}>Wybierz numery ręcznie</button></div>
              )
            )}
            <Pole etykieta="Nabywca" wymagane>
              <WyborZKartoteki wartosc={f.nabywca_osoba_id} wyklucz={[Number(f.zbywca_osoba_id)].filter(Boolean)} przyZmianie={(id) => zmien({ nabywca_osoba_id: id })} />
              <ZnacznikKontaktuOsoby osobaId={f.nabywca_osoba_id} />
            </Pole>
            {!nowyNabywca ? (
              <div><button type="button" className="btn btn-sm" onClick={() => ustawNowyNabywca(true)}>Nowy nabywca (spoza kartoteki)</button></div>
            ) : (
              <NowyNabywca przyAnulowaniu={() => ustawNowyNabywca(false)} przyZapisie={(o) => { zmien({ nabywca_osoba_id: o.id }); ustawNowyNabywca(false); }} />
            )}
            <PasekAkcji akcje={[{ etykieta: 'Dalej', przyKlik: () => ustawKrok(2), glowna: true, wylaczona: !krok1Gotowy }]} />
          </div>
        )}

        {krok === 2 && (
          <div className="pion" style={{ gap: 'var(--od-12)' }}>
            <Pole etykieta="Data umowy zbycia" wymagane>
              <PoleDaty wartosc={f.dokument_data} przyZmianie={(v) => zmien({ dokument_data: v || '' })} />
            </Pole>
            {!sprawa && (
              <Pole etykieta="Umowa (plik)" podpowiedz="Możesz dołączyć później w „Dokumentach” sprawy.">
                <input type="file" accept=".pdf,.xml,.xades,.jpg,.jpeg,.png" onChange={(z) => ustawPlik(z.target.files[0] || null)} />
              </Pole>
            )}
            {sprawa ? (
              <div className="przyciemnione">Żądający wpisu: według sprawy ({OPISY_ROL_ZADAJACEGO[sprawa.zadajacy_rola] || sprawa.zadajacy_rola || '—'}).</div>
            ) : (
              <Pole etykieta="Kto żąda wpisu" podpowiedz="art. 300(34) § 1 KSH">
                <div className="row-g" style={{ flexWrap: 'wrap' }}>
                  {[['nabywca', 'nabywca'], ['zbywca', 'zbywca'], ['spolka', 'spółka']].map(([k, n]) => (
                    <label key={k} className="chk"><input type="radio" checked={f.zadajacy_rola === k} onChange={() => zmien({ zadajacy_rola: k })} /> {n}</label>
                  ))}
                </div>
                {f.zadajacy_rola === 'spolka' && (
                  <WyborZKartoteki wartosc={f.zadajacy_osoba_id} typFiltr="prawna" przyZmianie={(id) => zmien({ zadajacy_osoba_id: id })} />
                )}
              </Pole>
            )}
            <Pole etykieta="Tytuł przejścia akcji">
              <select value={f.tytul_prawny} onChange={(z) => zmien({ tytul_prawny: z.target.value })}>
                {['sprzedaż', 'darowizna', 'dziedziczenie', 'wniesienie aportem', 'inne przejście'].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Pole>
            <PasekAkcji akcje={[
              { etykieta: 'Wstecz', przyKlik: () => ustawKrok(1) },
              { etykieta: pracuje ? 'Zapisywanie…' : 'Dalej', przyKlik: dalejZPodstawy, glowna: true, wylaczona: pracuje || !krok2Gotowy },
            ]} />
          </div>
        )}

        {krok === 3 && sprawa && (
          <div className="pion" style={{ gap: 'var(--od-12)' }}>
            {!podglad ? <Spinner /> : (
              <>
                <Wyniki bledy={podglad.bledy} ostrzezenia={podglad.ostrzezenia} />
                <PrzydzialDoPotwierdzenia dane={podglad.dane} />
              </>
            )}
            {dobor && dobor.obciazone && <Komunikat odmiana="uwaga" tresc="Dobrano akcje obciążone (zastaw, użytkowanie albo zajęcie) — wolnych zabrakło." />}
            {widoczne('zgoda_spolki') && (
              <label className="chk">
                <input type="checkbox" checked={f.zgoda_spolki} onChange={(z) => zmien({ zgoda_spolki: z.target.checked })} />
                <span className="chk-tresc">Uzyskano zgodę spółki na rozporządzenie akcjami<div className="podstawa-prawna">Ograniczenie w rejestrze — art. 300(34) § 6 KSH.</div></span>
              </label>
            )}
            {widoczne('zgoda_spolki_niepelne_pokrycie') && (
              <>
                <label className="chk">
                  <input type="checkbox" checked={f.zgoda_spolki_niepelne_pokrycie} onChange={(z) => zmien({ zgoda_spolki_niepelne_pokrycie: z.target.checked })} />
                  <span className="chk-tresc">Uzyskano zgodę spółki na zbycie akcji nie w pełni pokrytych<div className="podstawa-prawna">art. 300⁴⁰ § 1 KSH</div></span>
                </label>
                <Komunikat odmiana="uwaga" tresc="Nabywca akcji nie w pełni pokrytej odpowiada wobec spółki solidarnie ze zbywcą za wniesienie pozostałej części wkładu (art. 300⁴⁰ § 3 KSH)." />
              </>
            )}
            {widoczne('pierwszenstwo_wyczerpane') && (
              <label className="chk">
                <input type="checkbox" checked={f.pierwszenstwo_wyczerpane} onChange={(z) => zmien({ pierwszenstwo_wyczerpane: z.target.checked })} />
                <span className="chk-tresc">Prawo pierwszeństwa nabycia akcji zostało wyczerpane</span>
              </label>
            )}

            <PanelPowiadomienia sprawa={sprawa} odswiez={odswiezSprawe} domyslnyOdbiorca={f.zbywca_osoba_id} />

            {checklista.length > 0 && (
              <>
                <div className="fl">Checklista weryfikacji</div>
                <div className="checklista">
                  {checklista.map((p) => (
                    <label key={p.kod} className="chk">
                      <input type="checkbox" checked={Boolean(odhaczone[p.kod])} onChange={(z) => ustawOdhaczone((o) => ({ ...o, [p.kod]: z.target.checked }))} />
                      <span className="chk-tresc">{p.tresc}{!p.wymagana && <span className="przyciemnione"> (jeśli dotyczy)</span>}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
            {sprawa.blokada_wpisu && <div className="podpowiedz">{sprawa.blokada_wpisu.przyczyna}</div>}
            <p className="zdanie-nieodwracalne">Wpisu nie można cofnąć — możliwe jest tylko sprostowanie.</p>
            <PasekAkcji akcje={[
              { etykieta: 'Wstecz', przyKlik: () => ustawKrok(2) },
              { etykieta: pracuje ? 'Zapisywanie…' : 'Dokonaj wpisu', przyKlik: dokonajWpisu, glowna: true, wylaczona: pracuje || !mozeWpisac },
            ]} />
          </div>
        )}
      </Karta>
    </>
  );
}

/** Nowe zbycie z kokpitu spółki — kroki 1–2 bez sprawy; sprawa powstaje po „Podstawie”. */
function EkranNowegoZbycia({ spolkaId, osobaPoczatkowa, emisjaPoczatkowa }) {
  const spolka = useDane(`/api/psa/spolki/${spolkaId}`);
  const poczatek = {
    ...(osobaPoczatkowa ? { zbywca_osoba_id: Number(osobaPoczatkowa) } : {}),
    ...(emisjaPoczatkowa ? { emisja_klucz: Number(emisjaPoczatkowa) } : {}),
  };
  return (
    <KolumnaSprawy>
      <div className="okruszki">
        <button onClick={() => idz(`/spolki/${spolkaId}`)}>{(spolka.dane && spolka.dane.spolka && spolka.dane.spolka.nazwa) || 'Spółka'}</button> → nowy wpis
      </div>
      <div className="tytul-strony">Zbycie akcji</div>
      <KreatorZbycia spolkaId={spolkaId} poczatek={poczatek} />
    </KolumnaSprawy>
  );
}

window.KreatorZbycia = KreatorZbycia;
window.EkranNowegoZbycia = EkranNowegoZbycia;
