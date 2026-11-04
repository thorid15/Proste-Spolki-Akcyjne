/* ─────────────────────────────────────────────────────
   D-097 — jeden kreator wpisu dla wszystkich typów, w przebiegu zbycia (D-091):
   „Co” → „Podstawa” → „Sprawdzenie i wpis”. Sprawa zakłada się w tle po „Podstawie”
   (start terminu 7 dni); krok 3 działa na sprawie. Ten sam kreator otwiera sprawę
   z portalu i sprawę wznowioną z kolejki (zamiast osobnego okna podstawy — A-006).
   Różni się tylko krok 1 (formularz typu: `KROKI_TRESCI` w kreator.js, zbycie — `WPIS_ZBYCIA`)
   i domyślne wartości kroku 2 (`wpis-zbycia-logika.js`: rodzaj dokumentu, charakter i osoba żądającego).
   ───────────────────────────────────────────────────── */

/** Wkład typu do kreatora: formularz kroku 1, gotowość, dane dla API, pola dodatkowe kroków 2–3. */
function wkladWpisu(typ) {
  if (typ === 'przeniesienie') return WPIS_ZBYCIA;
  return {
    startowe: {},
    Co: KROKI_TRESCI[typ] || null,
    etykietaDaty: 'Data dokumentu',
    gotowe: (stan, dane) => coGotowe(typ, dane),
    dane: (stan, dane) => zbudujDaneZdarzenia(typ, dane),
  };
}

/** Formularz kroku 1 zapisany w szkicu sprawy (`_formularz` przy podglądzie); szkic innego typu — od początku. */
function szkicWpisu(sprawa) {
  try {
    const s = sprawa && sprawa.dane_wejsciowe_json ? JSON.parse(sprawa.dane_wejsciowe_json) : null;
    const f = s && s.dane && s.dane._formularz;
    if (!f || (s.dane._typ && s.dane._typ !== sprawa.typ_zdarzenia)) return null;
    return f;
  } catch (e) {
    return null;
  }
}

function startoweDane(typ, sprawa, poczatek) {
  const f = { ...wkladWpisu(typ).startowe, ...(poczatek || {}) };
  if (sprawa && typ === 'przeniesienie') {
    if (sprawa.zadajacy_rola === 'zbywca' && !f.zbywca_osoba_id) f.zbywca_osoba_id = sprawa.zadajacy_osoba_id;
    if (sprawa.zadajacy_rola === 'nabywca' && !f.nabywca_osoba_id) f.nabywca_osoba_id = sprawa.zadajacy_osoba_id;
  }
  return f;
}

const ROLE_ZADAJACEGO = Object.entries(OPISY_ROL_ZADAJACEGO);
const OPISY_RODZAJOW_PODSTAWY = Object.fromEntries(RODZAJE_DOKUMENTU_PODSTAWY);
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * `sprawa` — brak: kroki 1–2 i założenie sprawy (potem ekran sprawy, krok 3); jest: wszystkie kroki,
 * stan „nowa” (portal) przechodzi w „weryfikację” sam (D-098). `zPodstawySprawy` — EMISJA → OBJĘCIE:
 * ta sama podstawa (dokument, żądający, data wpływu) bez przepisywania.
 */
function KreatorWpisu({ spolkaId, typ, sprawa = null, odswiezSprawe, definicjaTypu, poczatek = null, zPodstawySprawy = null, naWpisano }) {
  const stanSpolki = useDane(`/api/psa/spolki/${spolkaId}`);
  const zrodlowa = useDane(zPodstawySprawy ? `/api/psa/sprawy/${zPodstawySprawy}` : null);
  const dzialajace = useDane('/api/psa/auth/osoby-dzialajace');
  const listWKolejce = useListPowiadomieniaWKolejce(sprawa ? sprawa.id : null, [sprawa && sprawa.zaktualizowano]);
  const wklad = wkladWpisu(typ);
  const szkic = szkicWpisu(sprawa);
  const [dane, ustawDane] = useState(() => szkic || startoweDane(typ, sprawa, poczatek));
  const [krok, ustawKrok] = useState(szkic ? 3 : 1);
  const [p, ustawP] = useState(() => ({
    dokument_data: (sprawa && sprawa.dokument_data) || '', dokument_rodzaj: (sprawa && sprawa.dokument_rodzaj) || null,
    data_wplywu: '', zadajacy_rola: null, zadajacy_osoba_id: undefined, zadajacy_opis: '', notatka: '',
  }));
  const [przeniesiona, ustawPrzeniesiona] = useState(false);
  const [wiecej, ustawWiecej] = useState(false);
  const [plik, ustawPlik] = useState(null);
  const [blad, ustawBlad] = useState(null);
  const [pracuje, ustawPracuje] = useState(false);
  const [podglad, ustawPodglad] = useState(null);
  const [odhaczone, ustawOdhaczone] = useState({});
  const [notatkaWatpliwosci, ustawNotatkeWatpliwosci] = useState('');
  const [dzialajacyId, ustawDzialajacyId] = useState(null);
  const [wynik, ustawWynik] = useState(null);
  const klucz = useRef(crypto.randomUUID());
  const zmienP = (zmiany) => ustawP((x) => ({ ...x, ...zmiany }));
  const stan = stanSpolki.dane;
  const zUrzedu = Boolean(definicjaTypu && definicjaTypu.z_urzedu);

  useEffect(() => {
    if (sprawa && sprawa.stan === 'nowa') API.patch(`/api/psa/sprawy/${sprawa.id}`, { akcja: 'weryfikuj' }).then(odswiezSprawe).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sprawa && sprawa.id]);

  useEffect(() => {
    const s = zrodlowa.dane && zrodlowa.dane.sprawa;
    if (!s || przeniesiona) return;
    zmienP({
      dokument_data: s.dokument_data || '', dokument_rodzaj: s.dokument_rodzaj || null, data_wplywu: String(s.data_wplywu || '').slice(0, 10),
      zadajacy_rola: s.zadajacy_rola || null, zadajacy_osoba_id: s.zadajacy_osoba_id || undefined, zadajacy_opis: s.zadajacy_rola === 'inna' ? (s.zadajacy_opis || '') : '',
    });
    ustawPrzeniesiona(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zrodlowa.dane]);

  // Wartości domyślne kroku 2 (A-005, A-013, D-097) — liczone z typu i kroku 1, dopóki ktoś ich nie zmieni.
  const rodzaj = p.dokument_rodzaj || domyslnyRodzajDokumentu(typ, stan);
  const rola = p.zadajacy_rola || domyslnyCharakterZadajacego(typ) || 'spolka';
  const zadajacyZKroku1 = osobaWCharakterze(typ, rola, dane, stan);
  const zadajacyId = p.zadajacy_osoba_id !== undefined ? p.zadajacy_osoba_id : zadajacyZKroku1;
  const dataWplywu = p.data_wplywu || fmt.dzisIso();

  function daneDoWpisu(zFormularzem) {
    const d = wklad.dane(stan, dane);
    return zFormularzem ? { ...d, _formularz: dane, _typ: typ } : d;
  }

  async function przelicz() {
    ustawBlad(null);
    try {
      ustawPodglad(await API.post(`/api/psa/sprawy/${sprawa.id}/podglad`, { dane: daneDoWpisu(true) }));
    } catch (e) {
      ustawPodglad(null);
      ustawBlad(e.message);
    }
  }
  const sygnaturaDanych = JSON.stringify(dane);
  useEffect(() => { if (krok === 3 && sprawa && stan) przelicz(); }, [krok, stan && 1, sygnaturaDanych]); // eslint-disable-line react-hooks/exhaustive-deps

  const daneDokumentu = DATA_ISO.test(String(p.dokument_data));
  const zadajacyKompletny = zUrzedu || Boolean(sprawa) || rola === 'spolka'
    || (Boolean(zadajacyId) && (rola !== 'inna' || Boolean(p.zadajacy_opis.trim())));
  const krok2Gotowy = (daneDokumentu || zUrzedu) && zadajacyKompletny;

  async function dalejZPodstawy() {
    ustawPracuje(true);
    ustawBlad(null);
    const dokument = daneDokumentu ? { dokument_rodzaj: rodzaj, dokument_data: p.dokument_data } : { dokument_rodzaj: null, dokument_data: null };
    try {
      if (!sprawa) {
        const odp = await API.post('/api/psa/sprawy', {
          spolka_id: spolkaId, typ_zdarzenia: typ, zrodlo: zUrzedu ? 'z_urzedu' : 'papier',
          // D-096: spółka jako żądający — bez osoby z kartoteki, opis = firma spółki (jak żądanie z portalu).
          zadajacy_osoba_id: zUrzedu || rola === 'spolka' ? null : zadajacyId,
          zadajacy_rola: zUrzedu ? null : rola,
          zadajacy_opis: zUrzedu ? null : rola === 'spolka' ? stan.spolka.nazwa : rola === 'inna' ? p.zadajacy_opis : null,
          data_wplywu: dataWplywu, ...dokument, notatka: p.notatka || null, klucz_idempotencji: klucz.current,
        });
        const id = odp.sprawa.id;
        if (plik) {
          // A-005: plik dziedziczy rodzaj dokumentu podstawy — bez drugiego wyboru z tej samej listy.
          const fd = new FormData();
          fd.append('typ_dokumentu', rodzaj);
          fd.append('pliki', plik);
          await fetch(`/api/psa/sprawy/${id}/dokumenty`, { method: 'POST', body: fd });
        }
        if (odp.sprawa.stan === 'nowa') await API.patch(`/api/psa/sprawy/${id}`, { akcja: 'weryfikuj' });
        await API.post(`/api/psa/sprawy/${id}/podglad`, { dane: daneDoWpisu(true) }).catch(() => {});
        idz(`/sprawy/${id}`);
        return;
      }
      if (daneDokumentu) await API.patch(`/api/psa/sprawy/${sprawa.id}`, { akcja: 'podstawa', ...dokument });
      ustawKrok(3);
      if (odswiezSprawe) odswiezSprawe();
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
      ustawWynik(await API.post(`/api/psa/sprawy/${sprawa.id}/wpisz`, { dane: daneDoWpisu(false), ...(dzialajacyId ? { dzialajacy_id: dzialajacyId } : {}) }));
      if (naWpisano) naWpisano();
    } catch (e) {
      if (e.bledy) ustawPodglad((x) => ({ ...(x || {}), dopuszczalne: false, bledy: e.bledy, ostrzezenia: e.ostrzezenia }));
      else ustawBlad(e.message);
    } finally {
      ustawPracuje(false);
    }
  }

  async function wstrzymajZWatpliwosci() {
    ustawPracuje(true);
    try {
      await API.patch(`/api/psa/sprawy/${sprawa.id}`, { akcja: 'wstrzymaj', powod: `Uzasadnione wątpliwości: ${notatkaWatpliwosci}` });
      if (odswiezSprawe) odswiezSprawe();
    } catch (e) {
      ustawBlad(e.message);
    } finally {
      ustawPracuje(false);
    }
  }

  if (stanSpolki.ladowanie || !stan) return <Spinner />;
  const nazwa = nazwaCzynnosci(typ, definicjaTypu ? definicjaTypu.nazwa : typ);

  if (wynik) {
    const emisja = typ === 'emisja';
    return (
      <Karta>
        <Komunikat odmiana="ok" tytul={`${nazwa} — wpis dokonany`} tresc={`Skrót zdarzenia w łańcuchu: ${wynik.zdarzenie.hash_skrocony}…`} />
        {/* Po emisji „nieobjęte akcje” to normalny stan, nie uwaga — prowadzimy wprost do objęcia z tą samą podstawą. */}
        {emisja
          ? <Komunikat odmiana="uwaga" tytul="Akcje czekają na objęcie" tresc="Wyemitowane akcje nie mają jeszcze akcjonariusza. Wpisz teraz, kto je obejmuje." />
          : <Komunikat odmiana="uwaga" tytul="Do sprawdzenia:" lista={wynik.ostrzezenia} />}
        <PasekAkcji akcje={[
          emisja && { etykieta: 'Wpisz, kto objął akcje', glowna: true, przyKlik: () => idz(`/spolki/${spolkaId}/zdarzenie?typ=objecie&emisja=${wynik.zdarzenie.id}&zpodstawy=${sprawa.id}`) },
          { etykieta: 'Wróć do kokpitu spółki', glowna: !emisja, przyKlik: () => idz(`/spolki/${spolkaId}`) },
        ]} />
      </Karta>
    );
  }

  const Co = wklad.Co;
  const checklista = (definicjaTypu && definicjaTypu.checklista) || [];
  const zwykle = checklista.filter((x) => !x.watpliwosci);
  const pozycjaWatpliwosci = checklista.find((x) => x.watpliwosci);
  const sawatpliwosci = Boolean(pozycjaWatpliwosci && odhaczone[pozycjaWatpliwosci.kod]);
  const wymaganeOdhaczone = zwykle.filter((x) => x.wymagana).every((x) => odhaczone[x.kod]);
  const mozeWpisac = sprawa && podglad && podglad.dopuszczalne && wymaganeOdhaczone && !sprawa.blokada_wpisu;
  // Osoba działająca ustala się sama (domyślna pracownika albo jedyny notariusz); wybór tylko, gdy nie da się jednoznacznie.
  const osobyDzialajace = dzialajace.dane ? dzialajace.dane.osoby.filter((o) => o.aktywny) : [];
  const wyborDzialajacego = dzialajace.dane && !dzialajace.dane.moja_domyslna_id && osobyDzialajace.length > 1;
  const powiadomienie = Boolean(definicjaTypu && definicjaTypu.wymaga_powiadomienia === true);

  return (
    <>
      <Kroki kroki={krokiWpisu(typ)} biezacy={krok - 1} />
      <Karta>
        <Komunikat odmiana="blad" tresc={blad} />

        {krok === 1 && (
          <div className="pion" style={{ gap: 'var(--od-12)' }}>
            {Co ? <Co dane={dane} ustawDane={ustawDane} spolka={stan} /> : <Komunikat odmiana="blad" tresc={`Brak formularza dla typu „${typ}”.`} />}
            <PasekAkcji akcje={[{ etykieta: 'Dalej', przyKlik: () => ustawKrok(2), glowna: true, wylaczona: !wklad.gotowe(stan, dane) }]} />
          </div>
        )}

        {krok === 2 && (
          <div className="pion" style={{ gap: 'var(--od-12)' }}>
            {przeniesiona && <Komunikat odmiana="ok" tresc="Podstawa przeniesiona ze sprawy, z której przyszedłeś — ten sam dokument i ten sam żądający. Popraw, jeśli ten wpis ma inną podstawę." />}
            {zUrzedu && <Komunikat odmiana="info" tresc="To zdarzenie wpisuje się wyłącznie z urzędu — bez żądającego (art. 300(34) § 2 KSH)." />}
            <Pole etykieta={wklad.etykietaDaty} wymagane={!zUrzedu} podpowiedz={`Podstawa wpisu: ${OPISY_RODZAJOW_PODSTAWY[rodzaj] || rodzaj} (art. 300(34) § 4 KSH).`}>
              <PoleDaty wartosc={p.dokument_data} max={fmt.dzisIso()} przyZmianie={(v) => zmienP({ dokument_data: v || '' })} />
            </Pole>
            {!sprawa && (
              <Pole etykieta="Dokument (plik)" podpowiedz="Opcjonalnie — możesz dołączyć później w „Dokumentach” sprawy.">
                <input type="file" aria-label="Dokument (plik)" accept=".pdf,.xml,.xades,.jpg,.jpeg,.png,.doc,.docx" onChange={(z) => ustawPlik(z.target.files[0] || null)} />
              </Pole>
            )}
            {sprawa ? (
              <div className="przyciemnione">
                Żądający wpisu: {sprawa.zrodlo === 'z_urzedu' ? 'z urzędu' : `według sprawy (${OPISY_ROL_ZADAJACEGO[sprawa.zadajacy_rola] || sprawa.zadajacy_rola || '—'})`}.
              </div>
            ) : !zUrzedu && (
              <>
                <Pole etykieta="W jakim charakterze" wymagane podpowiedz="art. 300(34) § 1 KSH — domyślnie z rodzaju wpisu.">
                  <select value={rola} onChange={(z) => zmienP({ zadajacy_rola: z.target.value, zadajacy_osoba_id: undefined })}>
                    {ROLE_ZADAJACEGO.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
                  </select>
                </Pole>
                {rola === 'spolka' ? (
                  <Pole etykieta="Żądający wpisu" podpowiedz="Spółka — dane z rejestru spółek, bez kartoteki (D-096).">
                    <div className="pole-echo"><strong>{stan.spolka.nazwa}</strong> — spółka</div>
                  </Pole>
                ) : (
                  <Pole
                    etykieta="Żądający wpisu" wymagane
                    podpowiedz={zadajacyZKroku1 && zadajacyId === zadajacyZKroku1 ? 'Podstawiony z kroku 1 — zmień, jeśli żąda kto inny.' : 'Osoba mająca interes prawny — art. 300(34) § 1 KSH.'}
                  >
                    <WyborZKartoteki wartosc={zadajacyId} przyZmianie={(id) => zmienP({ zadajacy_osoba_id: id })} />
                    <ZnacznikKontaktuOsoby osobaId={zadajacyId} />
                  </Pole>
                )}
                {rola === 'inna' && (
                  <Pole etykieta="Interes prawny żądającego" wymagane podpowiedz="Katalog nie jest zamknięty, ale interes prawny trzeba wykazać — art. 300(34) § 1 KSH.">
                    <input type="text" value={p.zadajacy_opis} onChange={(z) => zmienP({ zadajacy_opis: z.target.value })} />
                  </Pole>
                )}
              </>
            )}
            {wklad.Podstawa && <wklad.Podstawa dane={dane} ustawDane={ustawDane} />}
            {wiecej ? (
              <>
                <Pole etykieta="Rodzaj dokumentu stanowiącego podstawę" podpowiedz="Trafia na pismo jako podstawa wpisu.">
                  <select value={rodzaj} onChange={(z) => zmienP({ dokument_rodzaj: z.target.value })}>
                    {RODZAJE_DOKUMENTU_PODSTAWY.map(([k, o]) => <option key={k} value={k}>{o}</option>)}
                  </select>
                </Pole>
                {!sprawa && (
                  <>
                    <Pole etykieta="Data wpływu" podpowiedz="Domyślnie dziś — zmień przy wpływie papierowym z wcześniejszą datą.">
                      <PoleDaty wartosc={dataWplywu} max={fmt.dzisIso()} przyZmianie={(v) => v && zmienP({ data_wplywu: v })} skroty />
                    </Pole>
                    <Pole etykieta="Notatka (opcjonalnie)" podpowiedz="Wewnętrzna — np. numer aktu notarialnego. Nie trafia na pismo.">
                      <textarea value={p.notatka} onChange={(z) => zmienP({ notatka: z.target.value })} style={{ minHeight: 60 }} />
                    </Pole>
                  </>
                )}
              </>
            ) : (
              <div>
                <button type="button" className="btn btn-sm" onClick={() => ustawWiecej(true)}>
                  {sprawa ? 'Zmień rodzaj dokumentu' : 'Rodzaj dokumentu, data wpływu, notatka'}
                </button>
              </div>
            )}
            <PasekAkcji akcje={[
              { etykieta: 'Wstecz', przyKlik: () => ustawKrok(1) },
              { etykieta: pracuje ? 'Zapisywanie…' : 'Dalej', przyKlik: dalejZPodstawy, glowna: true, wylaczona: pracuje || !krok2Gotowy },
            ]} />
          </div>
        )}

        {krok === 3 && sprawa && (
          <div className="pion" style={{ gap: 'var(--od-12)' }}>
            {!podglad ? (blad ? null : <Spinner />) : (
              <>
                <Wyniki bledy={podglad.bledy} ostrzezenia={podglad.ostrzezenia} />
                <PrzydzialDoPotwierdzenia dane={podglad.dane} />
              </>
            )}
            {wklad.Warunki && <wklad.Warunki dane={dane} ustawDane={ustawDane} spolka={stan} sprawa={sprawa} />}
            {powiadomienie && (
              <PanelPowiadomienia sprawa={sprawa} odswiez={odswiezSprawe} domyslnyOdbiorca={odbiorcaPowiadomienia(typ, dane, stan)} />
            )}
            {zwykle.length > 0 && (
              <>
                <div className="fl">Checklista weryfikacji</div>
                <div className="checklista">
                  {zwykle.map((x) => (
                    <label key={x.kod} className="chk">
                      <input type="checkbox" checked={Boolean(odhaczone[x.kod])} onChange={(z) => ustawOdhaczone((o) => ({ ...o, [x.kod]: z.target.checked }))} />
                      <span className="chk-tresc">
                        {x.tresc}{!x.wymagana && <span className="przyciemnione"> (jeśli dotyczy)</span>}
                        {x.podstawa && <div className="podstawa-prawna">{x.podstawa}</div>}
                      </span>
                    </label>
                  ))}
                </div>
              </>
            )}
            {/* „Uzasadnione wątpliwości” to zgłoszenie przeszkody, nie kolejne potwierdzenie — osobno, pod checklistą. */}
            {pozycjaWatpliwosci && (
              <div className="komunikat komunikat-uwaga">
                <label className="chk chk-watpliwosci">
                  <input type="checkbox" checked={sawatpliwosci} onChange={(z) => ustawOdhaczone((o) => ({ ...o, [pozycjaWatpliwosci.kod]: z.target.checked }))} />
                  <span className="chk-tresc">
                    Mam wątpliwości — wstrzymaj wpis
                    <div className="podstawa-prawna">{pozycjaWatpliwosci.tresc}{pozycjaWatpliwosci.podstawa ? ` (${pozycjaWatpliwosci.podstawa})` : ''}</div>
                  </span>
                </label>
              </div>
            )}
            {sawatpliwosci && (
              <Pole etykieta="Notatka o uzasadnionych wątpliwościach" wymagane podpowiedz="Sprawa zostanie wstrzymana do wyjaśnienia.">
                <textarea value={notatkaWatpliwosci} onChange={(z) => ustawNotatkeWatpliwosci(z.target.value)} />
              </Pole>
            )}
            {!sawatpliwosci && wyborDzialajacego && (
              <Pole etykieta="Osoba działająca przy wpisie" podpowiedz="Tylko do audytu — nie trafia na dokumenty.">
                <select value={dzialajacyId ?? ''} onChange={(z) => ustawDzialajacyId(z.target.value === '' ? null : Number(z.target.value))}>
                  <option value="">— wybierz —</option>
                  {osobyDzialajace.map((o) => <option key={o.id} value={o.id}>{o.imie} {o.nazwisko} ({o.funkcja === 'notariusz' ? 'notariusz' : 'zastępca notarialny'})</option>)}
                </select>
              </Pole>
            )}
            {sprawa.blokada_wpisu && <div className="podpowiedz">{przyczynaBlokadyWpisu(sprawa, listWKolejce)}{listWKolejce && <> <a href="#/listy">Listy do wysyłki</a></>}</div>}
            {!sawatpliwosci && <p className="zdanie-nieodwracalne">Wpisu nie można cofnąć — możliwe jest tylko sprostowanie.</p>}
            <PasekAkcji akcje={[
              { etykieta: 'Wstecz', przyKlik: () => ustawKrok(2) },
              sawatpliwosci
                ? { etykieta: pracuje ? 'Wstrzymywanie…' : 'Wstrzymaj sprawę (wątpliwości)', przyKlik: wstrzymajZWatpliwosci, glowna: true, niebezpieczna: true, wylaczona: pracuje || !notatkaWatpliwosci.trim() }
                : { etykieta: pracuje ? 'Zapisywanie…' : 'Dokonaj wpisu', przyKlik: dokonajWpisu, glowna: true, wylaczona: pracuje || !mozeWpisac },
            ]} />
          </div>
        )}
      </Karta>
    </>
  );
}

/** Wybór rodzaju wpisu (kafelki) — wejście bez typu z adresu. */
function WyborRodzajuWpisu({ spolkaId, meta }) {
  return (
    <Karta>
      <div className="card-h">Co się wydarzyło?</div>
      {Object.entries(NAZWY_GRUP).map(([grupa, nazwaGrupy]) => {
        const typyGrupy = meta.typy_zdarzen.filter((t) => t.grupa === grupa && meta.typy_w_kreatorze.includes(t.kod));
        if (typyGrupy.length === 0) return null;
        return (
          <div key={grupa} style={{ marginBottom: 24 }}>
            <div className="fl">{nazwaGrupy}</div>
            <div className="kafelki-wyboru">
              {typyGrupy.map((t) => (
                <button key={t.kod} type="button" className="kafelek-wyboru" onClick={() => idz(`/spolki/${spolkaId}/zdarzenie?typ=${t.kod}`)}>
                  <Ikona nazwa={IKONY_ZDARZEN[t.kod] || 'zdarzenie'} rozmiar={20} />
                  <span className="kafelek-wyboru-tytul">{t.opis_zdarzeniem}</span>
                  <span className="kafelek-wyboru-opis">{t.podpowiedz || t.nazwa}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </Karta>
  );
}

/** `#/spolki/:id/zdarzenie[?typ=…]` — nowy wpis z kokpitu spółki (każdy typ, także zbycie). */
function EkranNowegoWpisu({ spolkaId, typ, emisja, osoba, zakres, zPodstawySprawy }) {
  const meta = useDane('/api/psa/meta');
  const spolka = useDane(`/api/psa/spolki/${spolkaId}`);
  if (meta.ladowanie || spolka.ladowanie) return <Spinner />;
  if (meta.blad || spolka.blad) return <Komunikat odmiana="blad" tresc={(meta.blad || spolka.blad).message} />;
  const definicja = typ ? meta.dane.typy_zdarzen.find((t) => t.kod === typ) || null : null;
  return (
    <KolumnaSprawy>
      <div className="okruszki">
        <button onClick={() => idz('/spolki')}>Spółki</button> →{' '}
        <button onClick={() => idz(`/spolki/${spolkaId}`)}>{spolka.dane.spolka.nazwa}</button> → nowy wpis
      </div>
      <div className="tytul-strony">{definicja ? nazwaCzynnosci(definicja.kod, definicja.nazwa) : 'Nowy wpis'}</div>
      {definicja
        ? <KreatorWpisu key={`${typ}-${zPodstawySprawy || ''}`} spolkaId={spolkaId} typ={typ} definicjaTypu={definicja} poczatek={poczatekWpisu(typ, { emisja, osoba, zakres })} zPodstawySprawy={zPodstawySprawy} />
        : <WyborRodzajuWpisu spolkaId={spolkaId} meta={meta.dane} />}
    </KolumnaSprawy>
  );
}

window.KreatorWpisu = KreatorWpisu;
window.EkranNowegoWpisu = EkranNowegoWpisu;
