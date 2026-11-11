/* wniosek-formularz.js — dane wniosku o prowadzenie rejestru (Nowa spółka 1/2), wspólne dla portalu
   i kancelarii (jeden schemat — `server/logika/wniosek.js`). Bez słownictwa prawniczego (§ 6). */

/** Błędy przy polach o ścieżce `prefiks.pole` → { pole: komunikat }. */
function bledyPod(pola, prefiks) {
  return Object.fromEntries(Object.entries(pola || {}).filter(([k]) => k.startsWith(`${prefiks}.`)).map(([k, v]) => [k.slice(prefiks.length + 1), v]));
}

function PoleTekstu({ etykieta, wartosc, przyZmianie, blad, opcjonalne, podpowiedz, typ = 'text', krs }) {
  return (
    <Pole etykieta={etykieta} blad={blad} opcjonalne={opcjonalne} podpowiedz={krs ? `W KRS: ${krs}` : podpowiedz}>
      <input type={typ} className={krs ? 'rozni-sie' : undefined} value={wartosc || ''} onChange={(e) => przyZmianie(e.target.value)} />
    </Pole>
  );
}

const NOWY_AKCJONARIUSZ = () => ({ typ: 'fizyczna', nazwa: '', pesel: '', data_urodzenia: '', numer_rejestru: '', adres: '', rodzaj_adresu: 'glowny', email: '', to_ja: false, zgoda_email: false });

/**
 * `dane`, `ustawDane` — dane wniosku; `przejecie` — { dotyczy, dotychczasowy_podmiot, data_przejecia, ustaw };
 * `kwoty` — brutto opłat za prowadzenie (grosze); `krs` — wartości z KRS różne od wpisanych (kancelaria).
 */
function FormularzWniosku({ dane, ustawDane, pola = {}, przejecie, kwoty, krs = {} }) {
  const s = dane.spolka;
  const r = dane.reprezentant;
  const zs = (k) => (v) => ustawDane({ ...dane, spolka: { ...s, [k]: v } });
  const zr = (k) => (v) => ustawDane({ ...dane, reprezentant: { ...r, [k]: v } });
  const akcj = dane.akcjonariusze || [];
  const ustawAkcj = (lista) => ustawDane({ ...dane, akcjonariusze: lista });
  const zl = (g) => fmt.zlote(g).replace(',00', '');
  return (
    <div className="formularz-wniosku">
      <Karta tytul="Spółka">
        <div className="siatka-2">
          <PoleTekstu etykieta="Firma" wartosc={s.nazwa} przyZmianie={zs('nazwa')} blad={pola['spolka.nazwa']} krs={krs.nazwa} />
          <PoleTekstu etykieta="Siedziba (miejscowość)" wartosc={s.siedziba} przyZmianie={zs('siedziba')} blad={pola['spolka.siedziba']} krs={krs.siedziba} />
          <PoleTekstu etykieta="Adres" wartosc={s.adres} przyZmianie={zs('adres')} blad={pola['spolka.adres']} krs={krs.adres} />
          <PoleTekstu etykieta="Sąd rejestrowy" wartosc={s.sad_rejestrowy} przyZmianie={zs('sad_rejestrowy')} blad={pola['spolka.sad_rejestrowy']} krs={krs.sad_rejestrowy} />
          <Pole etykieta="Data wpisu spółki do KRS" blad={pola['spolka.data_rejestracji']} podpowiedz={krs.data_rejestracji ? `W KRS: ${fmt.data(krs.data_rejestracji)}` : undefined}>
            <PoleDaty wartosc={s.data_rejestracji || ''} przyZmianie={zs('data_rejestracji')} max={fmt.dzisIso()} />
          </Pole>
          <PoleTekstu etykieta="NIP" opcjonalne wartosc={s.nip} przyZmianie={zs('nip')} blad={pola['spolka.nip']} krs={krs.nip} />
          <PoleTekstu etykieta="E-mail spółki" opcjonalne typ="email" podpowiedz="Na ten adres wyślemy pisma do spółki." wartosc={s.email} przyZmianie={zs('email')} blad={pola['spolka.email']} krs={krs.email} />
        </div>
      </Karta>

      <Karta tytul="Kto podpisuje umowę za spółkę">
        <div className="siatka-2">
          <PoleTekstu etykieta="Imię i nazwisko" wartosc={r.nazwa} przyZmianie={zr('nazwa')} blad={pola['reprezentant.nazwa']} />
          <PoleTekstu etykieta="Funkcja" opcjonalne podpowiedz="np. członek zarządu" wartosc={r.funkcja} przyZmianie={zr('funkcja')} />
          <PoleTekstu etykieta="PESEL" wartosc={r.pesel} przyZmianie={zr('pesel')} blad={pola['reprezentant.pesel']} podpowiedz="Bez PESEL — data urodzenia." />
          <Pole etykieta="Data urodzenia" opcjonalne blad={pola['reprezentant.data_urodzenia']}>
            <PoleDaty wartosc={r.data_urodzenia || ''} przyZmianie={zr('data_urodzenia')} max={fmt.dzisIso()} wylaczone={Boolean(r.pesel)} />
          </Pole>
          <PoleTekstu etykieta="Adres" wartosc={r.adres} przyZmianie={zr('adres')} blad={pola['reprezentant.adres']} />
          <PoleTekstu etykieta="E-mail" typ="email" wartosc={r.email} przyZmianie={zr('email')} blad={pola['reprezentant.email']} />
        </div>
        <Przelacznik
          wlaczony={Boolean(r.pep)}
          przyZmianie={(w) => ustawDane({ ...dane, reprezentant: { ...r, pep: w } })}
          etykieta="Zajmuję wysokie stanowisko publiczne albo jestem bliską osobą kogoś na takim stanowisku"
          opis="Np. poseł, minister, sędzia, prezes spółki państwowej — także członek rodziny albo bliski współpracownik takiej osoby."
          dzieci={<PoleTekstu etykieta="Jakie stanowisko" wartosc={r.pep_opis} przyZmianie={zr('pep_opis')} blad={pola['reprezentant.pep_opis']} />}
        />
      </Karta>

      <Karta tytul="Akcjonariusze">
        {pola.akcjonariusze && <p className="pole-blad">{pola.akcjonariusze}</p>}
        {akcj.map((a, i) => (
          <div className="element-listy" key={a.klucz || i}>
            <PolaOsoby osoba={a} przyZmianie={(o) => ustawAkcj(akcj.map((x, j) => (j === i ? o : x)))} bledy={bledyPod(pola, `akcjonariusze.${i}`)} />
            {a.typ !== 'prawna' && (
              <label className="chk">
                <input type="checkbox" checked={Boolean(a.to_ja)} onChange={(e) => ustawAkcj(akcj.map((x, j) => (j === i ? { ...x, to_ja: e.target.checked, zgoda_email: e.target.checked } : { ...x, to_ja: e.target.checked ? false : x.to_ja })))} />
                To ja (podpisuję umowę za spółkę)
              </label>
            )}
            {a.to_ja && (
              <label className="chk">
                <input type="checkbox" checked={Boolean(a.zgoda_email)} onChange={(e) => ustawAkcj(akcj.map((x, j) => (j === i ? { ...x, zgoda_email: e.target.checked } : x)))} />
                Zgadzam się na korespondencję e-mail (także powiadomienia z rejestru)
              </label>
            )}
            <button type="button" className="btn btn-maly btn-cichy" onClick={() => ustawAkcj(akcj.filter((_, j) => j !== i))}>Usuń akcjonariusza</button>
          </div>
        ))}
        <button type="button" className="btn btn-maly" onClick={() => ustawAkcj([...akcj, NOWY_AKCJONARIUSZ()])}>+ Dodaj akcjonariusza</button>
      </Karta>

      <Karta tytul="Opłata za prowadzenie rejestru">
        <div className="rzad" role="group" aria-label="Opłata za prowadzenie rejestru">
          {[['roczna', `Raz w roku (${zl(kwoty.roczna)})`], ['miesieczna', `Co miesiąc (${zl(kwoty.miesieczna)})`]].map(([v, n]) => (
            <button key={v} type="button" className={`btn ${dane.platnosc === v ? 'btn-glowny' : ''}`} aria-pressed={dane.platnosc === v} onClick={() => ustawDane({ ...dane, platnosc: v })}>{n}</button>
          ))}
        </div>
      </Karta>

      {przejecie && przejecie.dotyczy && (
        <Karta tytul="Przeniesienie rejestru od innej firmy">
          <div className="siatka-2">
            <PoleTekstu etykieta="Kto dotąd prowadził rejestr" wartosc={przejecie.dotychczasowy_podmiot} przyZmianie={(v) => przejecie.ustaw({ dotychczasowy_podmiot: v })} blad={pola.dotychczasowy_podmiot} />
            <Pole etykieta="Od kiedy mamy prowadzić rejestr" opcjonalne podpowiedz="Jeśli jeszcze nie wiadomo — uzupełnimy później." blad={pola.data_przejecia}>
              <PoleDaty wartosc={przejecie.data_przejecia || ''} przyZmianie={(v) => przejecie.ustaw({ data_przejecia: v })} />
            </Pole>
          </div>
        </Karta>
      )}
    </div>
  );
}

/** Autozapis danych wniosku (0,6 s po zmianie); `teraz()` — przed „Dalej”. */
function useZapisWniosku(adres, wartosci, przyZapisie) {
  const [stan, ustawStan] = useState({ stan: 'spoczynek', blad: null });
  const ostatnia = useRef(JSON.stringify(wartosci));
  const czekajacy = useRef(null);
  const zapisz = useCallback(async (w) => {
    const tekst = JSON.stringify(w);
    if (tekst === ostatnia.current) return true;
    ustawStan({ stan: 'zapisywanie', blad: null });
    try {
      const p = await API.put(adres, w);
      ostatnia.current = tekst;
      ustawStan({ stan: 'zapisano', blad: null });
      przyZapisie(p);
      return true;
    } catch (e) {
      ustawStan({ stan: 'blad', blad: e.message });
      return false;
    }
  }, [adres, przyZapisie]);
  useEffect(() => {
    if (JSON.stringify(wartosci) === ostatnia.current) return undefined;
    clearTimeout(czekajacy.current);
    czekajacy.current = setTimeout(() => zapisz(wartosci), 600);
    return () => clearTimeout(czekajacy.current);
  }, [wartosci, zapisz]);
  return { ...stan, teraz: () => { clearTimeout(czekajacy.current); return zapisz(wartosci); } };
}

const STANY_DOKUMENTU = {
  brak: 'do wgrania', do_podpisu: 'do podpisu', do_sprawdzenia: 'sprawdzamy', potwierdzony: 'podpisany', odrzucony: 'odrzucony', wgrany: 'wgrany',
};
const ODMIANY_DOKUMENTU = { do_sprawdzenia: 'mosiadz', potwierdzony: 'rejestr', odrzucony: 'sygnal' };

Object.assign(window, { FormularzWniosku, useZapisWniosku, bledyPod, STANY_DOKUMENTU, ODMIANY_DOKUMENTU });
