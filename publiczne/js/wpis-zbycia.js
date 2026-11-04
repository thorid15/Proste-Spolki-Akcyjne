/* ─────────────────────────────────────────────────────
   Zbycie akcji (D-091) w jednym kreatorze wpisu (D-097, `kreator-wpisu.js`):
   tu tylko części właściwe zbyciu — krok „Co się zbywa”, tytuł przejścia w „Podstawie”
   i pola warunkowe w „Sprawdzeniu i wpisie”. Logika (dobór numerów, widoczność pól):
   `wpis-zbycia-logika.js`.
   ───────────────────────────────────────────────────── */

const FORMULARZ_ZBYCIA = {
  zbywca_osoba_id: null, ilosc: '', nabywca_osoba_id: null, reczne_numery: false, emisja_klucz: null, zakresy_tekst: '',
  tytul_prawny: 'sprzedaż', zgoda_spolki: false, zgoda_spolki_niepelne_pokrycie: false, pierwszenstwo_wyczerpane: false,
};

/** Dobór akcji zbywcy z bieżącego formularza (null, dopóki nie ma zbywcy i liczby). */
function doborZbycia(stan, f) {
  return stan && f.zbywca_osoba_id && Number(f.ilosc) > 0
    ? dobierzAkcje(stan, f.zbywca_osoba_id, f.ilosc, { emisjaKlucz: f.emisja_klucz }) : null;
}

/** Krok 1 „Co się zbywa” — zbywca z rejestru, liczba, numery z doboru, nabywca z kartoteki. */
function CoZbycie({ dane: f, ustawDane, spolka: stan }) {
  const [nowyNabywca, ustawNowyNabywca] = useState(false);
  const zmien = (zmiany) => ustawDane({ ...f, ...zmiany });
  const zbywcy = zbywcyZRejestru(stan);
  const zbywca = zbywcy.find((z) => Number(z.osoba_id) === Number(f.zbywca_osoba_id)) || null;
  const dobor = doborZbycia(stan, f);
  const serieZbywcy = [...new Set((stan.akcjonariusze || []).filter((a) => Number(a.osoba_id) === Number(f.zbywca_osoba_id)).map((a) => a.emisja_klucz))];
  return (
    <>
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
      {/* A-019: nowy nabywca tym samym formularzem co w kartotece (`PanelOsoby` → „Dodaj do kartoteki”). */}
      {!f.nabywca_osoba_id && (
        <div><button type="button" className="btn btn-sm" onClick={() => ustawNowyNabywca(true)}>Nowy nabywca (spoza kartoteki)</button></div>
      )}
      {nowyNabywca && (
        <PanelOsoby
          osoba={null}
          przyZamknieciu={() => ustawNowyNabywca(false)}
          przyZapisie={(o) => { ustawNowyNabywca(false); zmien({ nabywca_osoba_id: o.id }); }}
          przyWyborzeIstniejacej={(o) => { ustawNowyNabywca(false); zmien({ nabywca_osoba_id: o.id }); }}
        />
      )}
    </>
  );
}

/** Krok 2 — tytuł przejścia akcji (pole właściwe zbyciu). */
function PodstawaZbycia({ dane: f, ustawDane }) {
  return (
    <Pole etykieta="Tytuł przejścia akcji">
      <select value={f.tytul_prawny} onChange={(z) => ustawDane({ ...f, tytul_prawny: z.target.value })}>
        {['sprzedaż', 'darowizna', 'dziedziczenie', 'wniesienie aportem', 'inne przejście'].map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
    </Pole>
  );
}

/** Krok 3 — pola tylko wtedy, gdy rejestr tego wymaga (art. 300(34) § 6, art. 300(40) § 1, art. 300(42) KSH). */
function WarunkiZbycia({ dane: f, ustawDane, spolka: stan, sprawa }) {
  const zmien = (zmiany) => ustawDane({ ...f, ...zmiany });
  const dobor = doborZbycia(stan, f);
  const widoczne = (k) => poleWidoczne('przeniesienie', k, { stan, sprawa, dane: f, dobor });
  return (
    <>
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
    </>
  );
}

/** Wkład zbycia do kreatora wpisu (D-097). */
const WPIS_ZBYCIA = {
  startowe: FORMULARZ_ZBYCIA,
  Co: CoZbycie,
  Podstawa: PodstawaZbycia,
  Warunki: WarunkiZbycia,
  etykietaDaty: 'Data umowy zbycia',
  gotowe: (stan, f) => {
    const dobor = doborZbycia(stan, f);
    return Boolean(f.zbywca_osoba_id && Number(f.ilosc) > 0 && f.nabywca_osoba_id && dobor && dobor.brakuje === 0);
  },
  dane: (stan, f) => zbudujDaneZdarzenia('przeniesienie', daneZdarzenia(stan, f)),
};
