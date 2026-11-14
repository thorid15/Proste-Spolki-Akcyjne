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

/** Sekcje formularza — kreatory pokazują je krok po kroku (portal: 4 kroki, kancelaria: 2 pierwsze z 4). */
const SEKCJE_WNIOSKU = ['spolka', 'platnosc', 'przejecie', 'reprezentant', 'akcjonariusze'];

/**
 * `dane`, `ustawDane` — dane wniosku; `przejecie` — { dotyczy, dotychczasowy_podmiot, data_przejecia, ustaw };
 * `kwoty` — brutto opłat za prowadzenie (grosze); `krs` — wartości z KRS różne od wpisanych (kancelaria);
 * `sekcje` — które części pokazać (domyślnie wszystkie).
 */
function FormularzWniosku({ dane, ustawDane, pola = {}, przejecie, kwoty, krs = {}, sekcje = SEKCJE_WNIOSKU, kancelaria = false }) {
  // Portal mówi do klienta („To ja”), kancelaria — o kliencie.
  const T = kancelaria
    ? { pep: 'Zajmuje wysokie stanowisko publiczne albo jest bliską osobą kogoś na takim stanowisku', toJa: 'To osoba podpisująca umowę za spółkę', zgoda: 'Zgodziła się na korespondencję e-mail (także powiadomienia z rejestru)' }
    : { pep: 'Zajmuję wysokie stanowisko publiczne albo jestem bliską osobą kogoś na takim stanowisku', toJa: 'To ja (podpisuję umowę za spółkę)', zgoda: 'Zgadzam się na korespondencję e-mail (także powiadomienia z rejestru)' };
  const jest = (k) => sekcje.includes(k);
  const s = dane.spolka;
  const r = dane.reprezentant;
  const zs = (k) => (v) => ustawDane({ ...dane, spolka: { ...s, [k]: v } });
  const zr = (k) => (v) => ustawDane({ ...dane, reprezentant: { ...r, [k]: v } });
  const akcj = dane.akcjonariusze || [];
  const ustawAkcj = (lista) => ustawDane({ ...dane, akcjonariusze: lista });
  const zl = (g) => fmt.zlote(g).replace(',00', '');
  return (
    <div className="formularz-wniosku">
      {jest('spolka') && <Karta tytul="Spółka">
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
      </Karta>}

      {jest('reprezentant') && <Karta tytul="Kto podpisuje umowę za spółkę">
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
          etykieta={T.pep}
          opis="Np. poseł, minister, sędzia, prezes spółki państwowej — także członek rodziny albo bliski współpracownik takiej osoby."
          dzieci={<PoleTekstu etykieta="Jakie stanowisko" wartosc={r.pep_opis} przyZmianie={zr('pep_opis')} blad={pola['reprezentant.pep_opis']} />}
        />
      </Karta>}

      {jest('akcjonariusze') && <Karta tytul="Akcjonariusze">
        {pola.akcjonariusze && <p className="pole-blad">{pola.akcjonariusze}</p>}
        {akcj.map((a, i) => (
          <div className="element-listy" key={a.klucz || i}>
            <PolaOsoby osoba={a} przyZmianie={(o) => ustawAkcj(akcj.map((x, j) => (j === i ? o : x)))} bledy={bledyPod(pola, `akcjonariusze.${i}`)} />
            {a.typ !== 'prawna' && (
              <label className="chk">
                <input
                  type="checkbox"
                  checked={Boolean(a.to_ja)}
                  onChange={(e) => ustawAkcj(akcj.map((x, j) => {
                    if (j !== i) return { ...x, to_ja: e.target.checked ? false : x.to_ja };
                    // Ta sama osoba co podpisujący umowę — jej dane przepisują się same (puste pola zostają do uzupełnienia).
                    const zReprezentanta = e.target.checked ? Object.fromEntries(['nazwa', 'pesel', 'data_urodzenia', 'adres', 'email'].filter((k) => r[k]).map((k) => [k, r[k]])) : {};
                    return { ...x, ...zReprezentanta, to_ja: e.target.checked, zgoda_email: e.target.checked };
                  }))}
                />
                {T.toJa}
              </label>
            )}
            {a.to_ja && (
              <label className="chk">
                <input type="checkbox" checked={Boolean(a.zgoda_email)} onChange={(e) => ustawAkcj(akcj.map((x, j) => (j === i ? { ...x, zgoda_email: e.target.checked } : x)))} />
                {T.zgoda}
              </label>
            )}
            <button type="button" className="btn btn-maly btn-cichy" onClick={() => ustawAkcj(akcj.filter((_, j) => j !== i))}>Usuń akcjonariusza</button>
          </div>
        ))}
        <button type="button" className="btn btn-maly" onClick={() => ustawAkcj([...akcj, NOWY_AKCJONARIUSZ()])}>+ Dodaj akcjonariusza</button>
      </Karta>}

      {jest('platnosc') && <Karta tytul="Opłata za prowadzenie rejestru">
        <div className="rzad" role="group" aria-label="Opłata za prowadzenie rejestru">
          {[['roczna', `Raz w roku (${zl(kwoty.roczna)})`], ['miesieczna', `Co miesiąc (${zl(kwoty.miesieczna)})`]].map(([v, n]) => (
            <button key={v} type="button" className={`btn ${dane.platnosc === v ? 'btn-glowny' : ''}`} aria-pressed={dane.platnosc === v} onClick={() => ustawDane({ ...dane, platnosc: v })}>{n}</button>
          ))}
        </div>
      </Karta>}

      {jest('przejecie') && przejecie && przejecie.dotyczy && (
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

/** Krok kreatora portalu, do którego należy błąd o ścieżce pola (0 Spółka, 1 Reprezentant, 2 Akcjonariusze). */
function krokBledu(pole) {
  const p = String(pole || '');
  if (p.startsWith('reprezentant')) return 1;
  if (p.startsWith('akcjonariusze')) return 2;
  return 0;
}

/** Podsumowanie danych wniosku — tylko do odczytu (portal: ostatni krok przed złożeniem). */
function PodsumowanieWniosku({ dane, kwoty, przejecie }) {
  const s = dane.spolka;
  const r = dane.reprezentant;
  const akcj = dane.akcjonariusze || [];
  const id = (o) => (o.typ === 'prawna' ? o.numer_rejestru && `KRS ${o.numer_rejestru}` : o.pesel ? `PESEL ${o.pesel}` : o.data_urodzenia && `ur. ${fmt.data(o.data_urodzenia)}`);
  return (
    <>
      <Karta tytul="Spółka">
        <ListaDanych pary={[
          ['Firma', s.nazwa], ['Siedziba', s.siedziba], ['Adres', s.adres], ['Sąd rejestrowy', s.sad_rejestrowy],
          ['Data wpisu do KRS', s.data_rejestracji ? fmt.data(s.data_rejestracji) : ''], ['NIP', s.nip], ['E-mail spółki', s.email],
          ['Opłata za prowadzenie', dane.platnosc === 'miesieczna' ? `co miesiąc (${fmt.zlote(kwoty.miesieczna)})` : `raz w roku (${fmt.zlote(kwoty.roczna)})`],
          przejecie && przejecie.dotyczy && ['Przeniesienie rejestru', `${przejecie.dotychczasowy_podmiot || '—'}${przejecie.data_przejecia ? `, od ${fmt.data(przejecie.data_przejecia)}` : ''}`],
        ].filter(Boolean)}
        />
      </Karta>
      <Karta tytul="Kto podpisuje umowę za spółkę">
        <ListaDanych pary={[['Imię i nazwisko', r.nazwa], ['Funkcja', r.funkcja], ['Identyfikator', id({ ...r, typ: 'fizyczna' })], ['Adres', r.adres], ['E-mail', r.email], ['Wysokie stanowisko publiczne', r.pep ? `tak — ${r.pep_opis || ''}` : 'nie']]} />
      </Karta>
      <Karta tytul={`Akcjonariusze (${akcj.length})`}>
        {!akcj.length ? <p className="male drugorzedny">Nie dodano akcjonariuszy.</p> : (
          <ul>{akcj.map((a, i) => <li key={a.klucz || i}><strong>{a.nazwa || '—'}</strong> <span className="male drugorzedny">{[id(a), a.adres, a.email, a.to_ja && 'to ja'].filter(Boolean).join(' · ')}</span></li>)}</ul>
        )}
      </Karta>
    </>
  );
}

Object.assign(window, { SEKCJE_WNIOSKU, krokBledu, PodsumowanieWniosku, FormularzWniosku, useZapisWniosku, bledyPod, STANY_DOKUMENTU, ODMIANY_DOKUMENTU });
