/* ustawienia.js — Ustawienia (§ 5, tylko administrator, w menu konta): dane kancelarii, użytkownicy,
   „Sprawdź integralność rejestru” (U-20). */

function DaneKancelarii() {
  const { dane, blad, odswiez } = useDane('/api/psa/ustawienia');
  const [wartosci, ustawWartosci] = useState(null);
  const c = useCzynnosc();
  const [zapisano, ustawZapisano] = useState(false);
  useEffect(() => {
    if (dane) ustawWartosci(Object.fromEntries(dane.kancelaria.map((p) => [p.klucz, p.wartosc ?? ''])));
  }, [dane]);
  if (blad) return <Bledy blad={blad} />;
  if (!dane || !wartosci) return <Spinner />;
  const { pola } = bledyApi(c.blad);
  const zapisz = () => c.wykonaj(async () => { await API.put('/api/psa/ustawienia', wartosci); ustawZapisano(true); odswiez(); });
  return (
    <Karta tytul="Dane kancelarii">
      <div className="siatka-2">
        {dane.kancelaria.map((p) => (
          <Pole key={p.klucz} etykieta={p.etykieta} podpowiedz={p.podpowiedz} opcjonalne={!p.wymagane} blad={pola[p.klucz]}>
            <input type="text" value={wartosci[p.klucz]} onChange={(e) => { ustawZapisano(false); ustawWartosci({ ...wartosci, [p.klucz]: e.target.value }); }} />
          </Pole>
        ))}
      </div>
      {c.blad && !Object.keys(pola).length && <Bledy blad={c.blad} />}
      <div className="rzad">
        <button type="button" className="btn btn-glowny" onClick={zapisz} disabled={c.trwa}>Zapisz</button>
        {zapisano && <span className="stan-zapisu">Zapisano</span>}
      </div>
    </Karta>
  );
}

function Uzytkownicy({ biezacy }) {
  const { dane, blad, odswiez } = useDane('/api/psa/auth/uzytkownicy');
  const [nowy, ustawNowego] = useState(null);
  const [haslo, ustawHaslo] = useState(null);
  const c = useCzynnosc();
  const dodaj = () => c.wykonaj(async () => {
    const w = await API.post('/api/psa/auth/uzytkownicy', nowy);
    ustawHaslo({ kto: w.uzytkownik.imie, haslo: w.haslo_tymczasowe });
    ustawNowego(null);
    odswiez();
  });
  const zmien = (u, zmiany) => c.wykonaj(async () => { await API.patch(`/api/psa/auth/uzytkownicy/${u.id}`, zmiany); odswiez(); });
  const reset = (u) => c.wykonaj(async () => {
    const w = await API.post(`/api/psa/auth/uzytkownicy/${u.id}/reset-hasla`);
    ustawHaslo({ kto: u.imie, haslo: w.haslo_tymczasowe });
  });
  return (
    <Karta tytul="Użytkownicy" akcje={!nowy && <button type="button" className="btn btn-maly" onClick={() => ustawNowego({ imie: '', email: '', rola: 'pracownik' })}>Dodaj użytkownika</button>}>
      {haslo && haslo.haslo && <Komunikat odmiana="uwaga" tytul={`Hasło tymczasowe — ${haslo.kto}`} tresc={`${haslo.haslo} — przekaż je osobiście; po pierwszym logowaniu trzeba je zmienić.`} />}
      {nowy && (
        <div className="podsekcja">
          <div className="siatka-2">
            <Pole etykieta="Imię i nazwisko"><input type="text" value={nowy.imie} onChange={(e) => ustawNowego({ ...nowy, imie: e.target.value })} /></Pole>
            <Pole etykieta="E-mail"><input type="email" value={nowy.email} onChange={(e) => ustawNowego({ ...nowy, email: e.target.value })} /></Pole>
            <Pole etykieta="Rola">
              <select value={nowy.rola} onChange={(e) => ustawNowego({ ...nowy, rola: e.target.value })}>
                <option value="pracownik">pracownik</option>
                <option value="admin">administrator</option>
              </select>
            </Pole>
          </div>
          <div className="rzad">
            <button type="button" className="btn btn-glowny btn-maly" onClick={dodaj} disabled={c.trwa}>Dodaj</button>
            <button type="button" className="btn btn-maly" onClick={() => ustawNowego(null)}>Anuluj</button>
          </div>
        </div>
      )}
      <Bledy blad={blad || c.blad} />
      {dane && (
        <table className="tabela">
          <thead><tr><th>Użytkownik</th><th>E-mail</th><th>Rola</th><th>Konto</th><th><span className="sr-only">Czynności</span></th></tr></thead>
          <tbody>
            {dane.uzytkownicy.map((u) => (
              <tr key={u.id}>
                <td>{u.imie}</td>
                <td>{u.email}</td>
                <td>{u.rola === 'admin' ? 'administrator' : 'pracownik'}</td>
                <td>{u.aktywny ? 'aktywne' : 'wyłączone'}</td>
                <td>
                  {u.id !== biezacy.id && (
                    <span className="rzad">
                      <button type="button" className="btn btn-maly btn-cichy" onClick={() => zmien(u, { aktywny: !u.aktywny })}>{u.aktywny ? 'Wyłącz' : 'Włącz'}</button>
                      <button type="button" className="btn btn-maly btn-cichy" onClick={() => reset(u)}>Nowe hasło</button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Karta>
  );
}

function Integralnosc() {
  const [wynik, ustawWynik] = useState(null);
  const c = useCzynnosc();
  const sprawdz = () => c.wykonaj(async () => ustawWynik(await API.post('/api/psa/integralnosc')));
  return (
    <Karta tytul="Integralność rejestru">
      <p className="male drugorzedny">Sprawdza łańcuch skrótów wszystkich wpisów i zgodność stanu z wpisami.</p>
      <button type="button" className="btn" onClick={sprawdz} disabled={c.trwa}>{c.trwa ? 'Sprawdzanie…' : 'Sprawdź integralność rejestru'}</button>
      <Bledy blad={c.blad} />
      {wynik && (
        <Komunikat
          odmiana={wynik.ok ? 'rejestr' : 'blad'}
          tytul={wynik.ok ? 'Rejestr nienaruszony' : 'Wykryto niezgodność'}
          tresc={wynik.ok ? `Sprawdzono wpisów: ${wynik.sprawdzono}.` : wynik.blad.opis}
        />
      )}
    </Karta>
  );
}

function EkranUstawien({ uzytkownik }) {
  return (
    <>
      <DaneKancelarii />
      <Uzytkownicy biezacy={uzytkownik} />
      <Integralnosc />
    </>
  );
}

window.EkranUstawien = EkranUstawien;
