/* portal.js — portal klienta (sekcja 8 i 9 specyfikacji), aplikacja osobna
   od SPA kancelaryjnej: własny punkt wejścia (`/portal`), własna sesja w
   ciasteczku `psa_sesja_portal` (nigdy nie miesza się z sesją pracownika).

   Świadome zawężenie wobec sekcji 9 — patrz komentarz na górze
   `server/trasy/portal.js`: krok „co się zmienia” (wybór z pełnej wspólnej
   kartoteki) zostaje po stronie kancelarii. Portal zbiera typ zdarzenia,
   opis i dokumenty; resztę kreatora prowadzi pracownik w kokpicie sprawy. */

/* `useState`/`useEffect`/`useCallback` sa juz zdeklarowane globalnie przez
   rdzen.js (ladowany wczesniej w portal.html) - w przegladarce kazdy tag
   <script> dzieli to samo leksykalne srodowisko najwyzszego poziomu, wiec
   ponowna deklaracja `const` rzucalaby "already declared". */

/* ─────────────────────────────────────────────────────
   SESJA PORTALOWA
   ───────────────────────────────────────────────────── */
function usePortalSesja() {
  const [stan, ustawStan] = useState({ ladowanie: true, zalogowany: false, konto: null });

  const odswiez = useCallback(() => {
    return API.get('/api/psa/portal/whoami')
      .then((d) => ustawStan({ ladowanie: false, zalogowany: d.zalogowany, konto: d.konto }))
      .catch(() => ustawStan({ ladowanie: false, zalogowany: false, konto: null }));
  }, []);

  useEffect(() => {
    odswiez();
  }, [odswiez]);

  return { ...stan, odswiez };
}

function EkranLoginPortal({ przyZalogowaniu }) {
  const [email, ustawEmail] = useState('');
  const [haslo, ustawHaslo] = useState('');
  const [wysylanie, ustawWysylanie] = useState(false);
  const [blad, ustawBlad] = useState(null);

  async function zaloguj(zdarzenie) {
    zdarzenie.preventDefault();
    if (!email.trim() || !haslo) return;
    ustawWysylanie(true);
    ustawBlad(null);
    try {
      await API.post('/api/psa/portal/login', { email: email.trim(), haslo });
      przyZalogowaniu();
    } catch (e) {
      ustawBlad(e instanceof BladApi ? e.message : 'Nie udało się zalogować.');
    } finally {
      ustawWysylanie(false);
    }
  }

  return (
    <div className="ekran-logowania">
      <form className="card" style={{ width: 400, maxWidth: '92vw' }} onSubmit={zaloguj}>
        <div className="card-h" style={{ marginBottom: 4 }}>Portal klienta</div>
        <div className="podtytul-strony" style={{ marginBottom: 22 }}>
          Rejestr akcjonariuszy P.S.A. — Kancelaria Notarialna Łukasza Kozona
        </div>

        <Komunikat odmiana="blad" tresc={blad} />

        <Pole etykieta="E-mail" wymagane>
          <input type="email" autoFocus value={email} onChange={(z) => ustawEmail(z.target.value)} autoComplete="username" />
        </Pole>
        <Pole etykieta="Hasło" wymagane>
          <input type="password" value={haslo} onChange={(z) => ustawHaslo(z.target.value)} autoComplete="current-password" />
        </Pole>

        <button className="btn btn-primary" type="submit" disabled={wysylanie || !email.trim() || !haslo} style={{ width: '100%', marginTop: 8 }}>
          {wysylanie ? 'Logowanie…' : 'Zaloguj się'}
        </button>
        <div className="podpowiedz" style={{ marginTop: 14, textAlign: 'center' }}>
          Dostęp do portalu zakłada kancelaria po weryfikacji tożsamości. Nie ma tu samodzielnej rejestracji.
        </div>
        <div style={{ textAlign: 'center', marginTop: 10 }}>
          <button type="button" className="btn btn-sm btn-cichy" onClick={() => idz('/zglos-sie')}>
            Nie masz jeszcze konta? Zgłoś zainteresowanie
          </button>
        </div>
      </form>
    </div>
  );
}

/* Etap 3A — publiczny, niezalogowany formularz pierwszego kontaktu. Zbiera
   WYŁĄCZNIE dane kontaktowe (bez PESEL, bez adresu) — to lead do oceny przez
   kancelarię, nie wniosek. Kancelaria odpowiada zaproszeniem (etap 3B), po
   którym dopiero zaczyna się właściwy wniosek o prowadzenie rejestru. */
function EkranZgloszenieWstepne() {
  const [email, ustawEmail] = useState('');
  const [telefon, ustawTelefon] = useState('');
  const [nazwaSpolki, ustawNazwaSpolki] = useState('');
  const [opis, ustawOpis] = useState('');
  const [wysylanie, ustawWysylanie] = useState(false);
  const [blad, ustawBlad] = useState(null);
  const [gotowe, ustawGotowe] = useState(false);

  async function wyslij(zdarzenie) {
    zdarzenie.preventDefault();
    if (!email.trim()) return;
    ustawWysylanie(true);
    ustawBlad(null);
    try {
      await API.post('/api/psa/portal/zgloszenia', {
        email: email.trim(),
        telefon: telefon.trim() || undefined,
        nazwa_spolki: nazwaSpolki.trim() || undefined,
        opis: opis.trim() || undefined,
      });
      ustawGotowe(true);
    } catch (e) {
      ustawBlad(e instanceof BladApi ? e.message : 'Nie udało się wysłać zgłoszenia.');
    } finally {
      ustawWysylanie(false);
    }
  }

  if (gotowe) {
    return (
      <div className="ekran-logowania">
        <div className="card" style={{ width: 440, maxWidth: '92vw' }}>
          <Pusto
            tytul="Dziękujemy za zgłoszenie"
            opis="Kancelaria skontaktuje się z Tobą, żeby ustalić szczegóły i przesłać zaproszenie do złożenia właściwego wniosku o prowadzenie rejestru akcjonariuszy."
            akcja={<button className="btn" onClick={() => idz('/')}>Wróć do logowania</button>}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="ekran-logowania">
      <form className="card" style={{ width: 440, maxWidth: '92vw' }} onSubmit={wyslij}>
        <div className="card-h" style={{ marginBottom: 4 }}>Zgłoś zainteresowanie</div>
        <div className="podtytul-strony" style={{ marginBottom: 22 }}>
          Prowadzenie rejestru akcjonariuszy — Kancelaria Notarialna Łukasza Kozona
        </div>

        <Komunikat odmiana="blad" tresc={blad} />

        <Pole etykieta="E-mail" wymagane>
          <input type="email" autoFocus value={email} onChange={(z) => ustawEmail(z.target.value)} autoComplete="email" />
        </Pole>
        <Pole etykieta="Telefon">
          <input type="tel" value={telefon} onChange={(z) => ustawTelefon(z.target.value)} autoComplete="tel" />
        </Pole>
        <Pole etykieta="Nazwa spółki" podpowiedz="Jeśli już istnieje i jest wpisana do KRS.">
          <input type="text" value={nazwaSpolki} onChange={(z) => ustawNazwaSpolki(z.target.value)} />
        </Pole>
        <Pole etykieta="Krótki opis" podpowiedz="Kilka zdań — na tym etapie nie zbieramy danych osobowych ani PESEL.">
          <textarea rows={3} value={opis} onChange={(z) => ustawOpis(z.target.value)} />
        </Pole>

        <button className="btn btn-primary" type="submit" disabled={wysylanie || !email.trim()} style={{ width: '100%', marginTop: 8 }}>
          {wysylanie ? 'Wysyłanie…' : 'Wyślij zgłoszenie'}
        </button>
        <div style={{ textAlign: 'center', marginTop: 10 }}>
          <button type="button" className="btn btn-sm btn-cichy" onClick={() => idz('/')}>← Wróć do logowania</button>
        </div>
      </form>
    </div>
  );
}

/* Etap 3B — publiczny, niezalogowany ekran wymiany tokenu z maila
   zapraszającego na hasło. Po sukcesie backend od razu zakłada sesję
   portalową (ciasteczko), więc wystarczy wrócić na „/” — świeże
   `usePortalSesja()` samo ją odkryje. */
function EkranAktywacjaKonta({ token }) {
  const [email, ustawEmail] = useState(null);
  const [sprawdzanie, ustawSprawdzanie] = useState(true);
  const [bladTokenu, ustawBladTokenu] = useState(null);
  const [haslo, ustawHaslo] = useState('');
  const [powtorzHaslo, ustawPowtorzHaslo] = useState('');
  const [wysylanie, ustawWysylanie] = useState(false);
  const [blad, ustawBlad] = useState(null);

  useEffect(() => {
    API.get(`/api/psa/portal/aktywacja/${token}`)
      .then((d) => ustawEmail(d.email))
      .catch((e) => ustawBladTokenu(e instanceof BladApi ? e.message : 'Link aktywacyjny jest nieprawidłowy albo wygasł.'))
      .finally(() => ustawSprawdzanie(false));
  }, [token]);

  async function aktywuj(zdarzenie) {
    zdarzenie.preventDefault();
    if (haslo !== powtorzHaslo) {
      ustawBlad('Hasła nie są takie same.');
      return;
    }
    ustawWysylanie(true);
    ustawBlad(null);
    try {
      await API.post(`/api/psa/portal/aktywacja/${token}`, { haslo });
      idz('/');
    } catch (e) {
      ustawBlad(e instanceof BladApi ? e.message : 'Nie udało się aktywować konta.');
    } finally {
      ustawWysylanie(false);
    }
  }

  if (sprawdzanie) return <div className="ekran-logowania"><Spinner /></div>;

  if (bladTokenu) {
    return (
      <div className="ekran-logowania">
        <div className="card" style={{ width: 440, maxWidth: '92vw' }}>
          <Pusto
            tytul="Link jest nieważny"
            opis={bladTokenu}
            akcja={<button className="btn" onClick={() => idz('/')}>Wróć do logowania</button>}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="ekran-logowania">
      <form className="card" style={{ width: 400, maxWidth: '92vw' }} onSubmit={aktywuj}>
        <div className="card-h" style={{ marginBottom: 4 }}>Aktywacja konta</div>
        <div className="podtytul-strony" style={{ marginBottom: 22 }}>{email}</div>

        <Komunikat odmiana="blad" tresc={blad} />

        <Pole etykieta="Hasło" wymagane podpowiedz="Co najmniej 10 znaków, litera i cyfra.">
          <input type="password" autoFocus value={haslo} onChange={(z) => ustawHaslo(z.target.value)} autoComplete="new-password" />
        </Pole>
        <Pole etykieta="Powtórz hasło" wymagane>
          <input type="password" value={powtorzHaslo} onChange={(z) => ustawPowtorzHaslo(z.target.value)} autoComplete="new-password" />
        </Pole>

        <button className="btn btn-primary" type="submit" disabled={wysylanie || !haslo || !powtorzHaslo} style={{ width: '100%', marginTop: 8 }}>
          {wysylanie ? 'Aktywowanie…' : 'Aktywuj konto'}
        </button>
      </form>
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   UKŁAD
   ───────────────────────────────────────────────────── */
const KARTY_NAWIGACJI = [
  { sciezka: '/', nazwa: 'Moje spółki' },
  { sciezka: '/sprawy', nazwa: 'Moje zgłoszenia' },
];

const ETYKIETA_ROLI_KONTA = {
  spolka: 'konto spółki',
  akcjonariusz: 'konto akcjonariusza',
  // Etap 3B: zaproszone, ale wniosek jeszcze nie zlozony/przyjety.
  wnioskodawca: 'konto wnioskodawcy',
};

function PortalLayout({ sciezka, waski, konto, przyWylogowaniu, children }) {
  const [wylogowywanie, ustawWylogowywanie] = useState(false);

  async function wyloguj() {
    ustawWylogowywanie(true);
    try {
      await API.post('/api/psa/portal/logout');
    } finally {
      przyWylogowaniu();
    }
  }

  return (
    <div className="pion" style={{ minHeight: '100vh' }}>
      <header className="portal-topbar pasek-gorny bez-druku" style={{ padding: '14px 28px' }}>
        <div>
          <div className="tytul-strony" style={{ fontSize: 17 }}>Portal klienta — Rejestr akcjonariuszy P.S.A.</div>
          <div className="podpowiedz">{konto.email} · {ETYKIETA_ROLI_KONTA[konto.rola] || konto.rola}</div>
        </div>
        <div className="row-g">
          {KARTY_NAWIGACJI.map((k) => (
            <button
              key={k.sciezka}
              className={`btn btn-sm ${sciezka === k.sciezka ? 'btn-primary' : ''}`}
              onClick={() => idz(k.sciezka)}
            >
              {k.nazwa}
            </button>
          ))}
          <button className="btn btn-sm" onClick={wyloguj} disabled={wylogowywanie}>Wyloguj się</button>
        </div>
      </header>
      <main className={`tresc ${waski ? 'tresc-waska' : ''}`}>{children}</main>
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   MOJE SPÓŁKI / AKCJE
   ───────────────────────────────────────────────────── */
function EkranMoje() {
  const { dane, ladowanie } = useDane('/api/psa/portal/moje');
  if (ladowanie) return <Spinner />;
  if (!dane) return null;

  if (dane.spolki.length === 0) {
    return <Pusto tytul="Brak powiązanych spółek" opis="To konto nie jest jeszcze powiązane z żadną spółką w rejestrze." />;
  }

  return (
    <div className="pion" style={{ gap: 16 }}>
      {dane.spolki.map((s) => {
        const spolkaId = dane.rola === 'spolka' ? s.id : s.spolka_id;
        const nazwa = s.nazwa;
        return (
          <Karta key={spolkaId} tytul={nazwa}>
            {dane.rola === 'akcjonariusz' && (
              <div className="pion" style={{ gap: 6, marginBottom: 14 }}>
                <div className="podpowiedz">Posiadane akcje — razem {fmt.liczba(s.razem_akcji)}</div>
                {s.pozycje.map((p, i) => (
                  <div key={i} className="row-b">
                    <span>Seria {p.seria}</span>
                    <span className="mono przyciemnione">{p.numery}</span>
                    <span>{fmt.liczba(p.ilosc)}</span>
                  </div>
                ))}
              </div>
            )}
            {s.krs && <div className="podpowiedz" style={{ marginBottom: 14 }}>KRS {s.krs}</div>}
            <div className="row-g">
              <button className="btn" onClick={() => idz(`/rejestr/${spolkaId}`)}>Podgląd rejestru</button>
              <button className="btn" onClick={() => idz(`/zgloszenie/${spolkaId}`)}>Zgłoś zmianę</button>
              <button className="btn" onClick={() => idz(`/informacja/${spolkaId}`)}>Informacja z rejestru</button>
            </div>
          </Karta>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   PODGLĄD REJESTRU (z maskowaniem — art. 300(35) KSH)
   ───────────────────────────────────────────────────── */
function EkranRejestrPortal({ spolkaId }) {
  const [dataStan, ustawDataStan] = useState(fmt.dzisIso());
  const { dane, ladowanie, blad } = useDane(`/api/psa/portal/rejestr/${spolkaId}?data=${dataStan}`, [dataStan]);

  return (
    <div className="pion" style={{ gap: 16 }}>
      <button className="btn btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => idz('/')}>← Moje spółki</button>

      {blad && <Komunikat odmiana="blad" tresc={blad.message} />}
      {ladowanie && <Spinner />}

      {dane && (
        <>
          <Karta tytul={dane.spolka.nazwa}>
            <div className="row-g" style={{ marginBottom: 4 }}>
              <label className="fl" style={{ margin: 0 }}>Stan na dzień</label>
              <PoleDaty wartosc={dataStan} przyZmianie={(v) => v && ustawDataStan(v)} />
            </div>
          </Karta>

          <Karta tight tytul={`Akcjonariat — razem ${fmt.liczba(dane.razem_akcji)} akcji`}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Akcjonariusz</th>
                  <th>Seria</th>
                  <th className="prawo">Ilość</th>
                  <th>Numery</th>
                  <th className="prawo">Udział</th>
                  <th>Obciążenia</th>
                </tr>
              </thead>
              <tbody>
                {dane.akcjonariusze.length === 0 && (
                  <tr><td colSpan={6} className="przyciemnione">Brak wpisanych akcjonariuszy.</td></tr>
                )}
                {dane.akcjonariusze.map((a, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 500 }}>
                      {a.osoba ? a.osoba.oznaczenie : 'nieznany'}
                      {a.osoba && a.osoba.zamaskowane && <span className="podpowiedz"> (dane częściowo zamaskowane)</span>}
                    </td>
                    <td>{a.seria}</td>
                    <td className="prawo">{fmt.liczba(a.ilosc)}</td>
                    <td className="mono">{a.numery}</td>
                    <td className="prawo">{fmt.procent(a.procent)}</td>
                    <td>{a.obciazenia.length > 0 ? <Znacznik odmiana="bordo">{a.obciazenia.length}</Znacznik> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Karta>

          {dane.emisje.length > 0 && (
            <Karta tight tytul="Emisje">
              <table className="tbl">
                <thead><tr><th>Seria</th><th className="prawo">Ilość</th><th>Numery</th><th>Status</th></tr></thead>
                <tbody>
                  {dane.emisje.map((e) => (
                    <tr key={e.klucz}>
                      <td>{e.seria}</td>
                      <td className="prawo">{fmt.liczba(e.ilosc)}</td>
                      <td className="mono">{e.zakres}</td>
                      <td>{e.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Karta>
          )}
        </>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   ZGŁOSZENIE ŻĄDANIA (kroki 1—2 kreatora)
   ───────────────────────────────────────────────────── */
function EkranZgloszeniePortal({ spolkaId }) {
  const { dane: meta, ladowanie: metaLadowanie } = useDane('/api/psa/meta');
  const [typ, ustawTyp] = useState('');
  const [opis, ustawOpis] = useState('');
  const [pliki, ustawPliki] = useState([]);
  const [wysylanie, ustawWysylanie] = useState(false);
  const [blad, ustawBlad] = useState(null);
  const [gotowe, ustawGotowe] = useState(false);

  if (metaLadowanie) return <Spinner />;
  if (!meta) return null;

  const typyDostepne = meta.typy_zdarzen.filter((t) => meta.typy_w_kreatorze.includes(t.kod) && !t.z_urzedu);

  async function zglos() {
    if (!typ || !opis.trim()) return;
    ustawWysylanie(true);
    ustawBlad(null);
    try {
      const wynik = await API.post('/api/psa/portal/zadania', { spolka_id: spolkaId, typ_zdarzenia: typ, opis: opis.trim() });
      if (pliki.length > 0) {
        const formularz = new FormData();
        formularz.append('typ_dokumentu', 'inny');
        for (const plik of pliki) formularz.append('pliki', plik);
        await fetch(`/api/psa/portal/zadania/${wynik.sprawa.id}/dokumenty`, { method: 'POST', body: formularz });
      }
      ustawGotowe(true);
    } catch (e) {
      ustawBlad(e instanceof BladApi ? e.message : 'Nie udało się złożyć zgłoszenia.');
    } finally {
      ustawWysylanie(false);
    }
  }

  if (gotowe) {
    return (
      <Karta>
        <Pusto
          tytul="Zgłoszenie przyjęte"
          opis="Kancelaria rozpatrzy je i skontaktuje się w razie potrzeby uzupełnienia dokumentów. Status widoczny jest w zakładce „Moje zgłoszenia”."
          akcja={<button className="btn btn-primary" onClick={() => idz('/sprawy')}>Zobacz moje zgłoszenia</button>}
        />
      </Karta>
    );
  }

  return (
    <div className="pion" style={{ gap: 16 }}>
      <button className="btn btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => idz('/')}>← Moje spółki</button>
      <Karta tytul="Zgłoś zmianę w rejestrze">
        <Komunikat odmiana="blad" tresc={blad} />
        <Pole etykieta="Czego dotyczy zgłoszenie" wymagane>
          <select value={typ} onChange={(z) => ustawTyp(z.target.value)}>
            <option value="">— wybierz —</option>
            {typyDostepne.map((t) => (
              <option key={t.kod} value={t.kod}>{t.nazwa}</option>
            ))}
          </select>
        </Pole>
        <Pole etykieta="Opis zgłoszenia" wymagane podpowiedz="Opisz, co się wydarzyło — kancelaria przygotuje wpis na tej podstawie i skontaktuje się w razie pytań.">
          <textarea rows={4} value={opis} onChange={(z) => ustawOpis(z.target.value)} />
        </Pole>
        <Pole etykieta="Dokumenty" podpowiedz="PDF, JPG, PNG, DOC/DOCX — maks. 20 MB na plik.">
          <input type="file" multiple onChange={(z) => ustawPliki([...z.target.files])} />
        </Pole>
        <button
          className="btn btn-primary"
          disabled={wysylanie || !typ || !opis.trim()}
          onClick={zglos}
          style={{ marginTop: 8 }}
        >
          {wysylanie ? 'Wysyłanie…' : 'Złóż zgłoszenie'}
        </button>
      </Karta>
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   STATUS ZGŁOSZEŃ
   ───────────────────────────────────────────────────── */
const ZNACZNIK_STANU = {
  nowa: 'neutralny', weryfikacja: 'lupek', wstrzymana: 'oliwka',
  wpisana: 'zielony', odmowa: 'bordo', anulowana: 'neutralny',
};

/* Ten sam pasek starzenia co w kolejce spraw kancelarii (faza 3.1) —
   spójność wizualna dla tego samego pojęcia po obu stronach portalu. */
function kolorPaskaTerminuPortal(termin) {
  if (!termin) return 'transparent';
  if (termin.po_terminie) return 'var(--burgundy-2)';
  if (termin.pilny) return 'var(--burgundy)';
  if (termin.zamrozony) return 'var(--olive)';
  return 'transparent';
}

function EkranSprawyPortal() {
  const { dane, ladowanie } = useDane('/api/psa/portal/zadania');
  if (ladowanie) return <Spinner />;
  if (!dane) return null;

  if (dane.sprawy.length === 0) {
    return <Pusto tytul="Brak zgłoszeń" opis="Nie złożono jeszcze żadnego zgłoszenia przez portal." />;
  }

  return (
    <Karta tight tytul="Moje zgłoszenia">
      <table className="tbl">
        <thead>
          <tr>
            <th className="wiersz-kolejki-pasek-glowka" />
            <th>Spółka</th><th>Rodzaj</th><th>Zgłoszono</th><th>Stan</th><th>Termin</th>
          </tr>
        </thead>
        <tbody>
          {dane.sprawy.map((s) => (
            <tr key={s.id}>
              <td
                className="wiersz-kolejki-pasek"
                style={{ background: kolorPaskaTerminuPortal(s.termin) }}
                aria-hidden="true"
              />
              <td>{s.spolka_nazwa}</td>
              <td>{s.typ_nazwa}</td>
              <td>{fmt.dataCzas(s.data_wplywu)}</td>
              <td><Znacznik odmiana={ZNACZNIK_STANU[s.stan] || 'neutralny'}>{s.stan}</Znacznik></td>
              <td className="przyciemnione">
                {s.stan === 'wpisana' || s.stan === 'odmowa' || s.stan === 'anulowana'
                  ? '—'
                  : s.termin && s.termin.dni_pozostale != null ? `${s.termin.dni_pozostale} dni` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Karta>
  );
}

/* ─────────────────────────────────────────────────────
   INFORMACJA Z REJESTRU
   ───────────────────────────────────────────────────── */
function EkranInformacjaPortal({ spolkaId }) {
  const [data, ustawData] = useState(fmt.dzisIso());
  const [pobieranie, ustawPobieranie] = useState(false);
  const [blad, ustawBlad] = useState(null);

  async function pobierz() {
    ustawPobieranie(true);
    ustawBlad(null);
    try {
      const wynik = await API.post('/api/psa/portal/informacja', { spolka_id: spolkaId, data });
      const blob = new Blob([wynik.tresc_html], { type: 'text/html' });
      window.open(URL.createObjectURL(blob), '_blank');
    } catch (e) {
      ustawBlad(e instanceof BladApi ? e.message : 'Nie udało się przygotować informacji.');
    } finally {
      ustawPobieranie(false);
    }
  }

  return (
    <div className="pion" style={{ gap: 16 }}>
      <button className="btn btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => idz('/')}>← Moje spółki</button>
      <Karta tytul="Informacja z rejestru" >
        <div className="podstawa-prawna" style={{ marginBottom: 14 }}>
          Art. 300(35) Kodeksu spółek handlowych — informacja z rejestru akcjonariuszy na wskazany dzień,
          w zakresie odpowiadającym roli konta.
        </div>
        <Komunikat odmiana="blad" tresc={blad} />
        <Pole etykieta="Stan na dzień" wymagane>
          <PoleDaty wartosc={data} przyZmianie={(v) => v && ustawData(v)} />
        </Pole>
        <button className="btn btn-glowny" onClick={pobierz} disabled={pobieranie}>
          {pobieranie ? 'Przygotowywanie…' : 'Otwórz informację'}
        </button>
      </Karta>
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   APLIKACJA
   ───────────────────────────────────────────────────── */
function AplikacjaPortal() {
  const trasa = useTrasa();
  const { segmenty, sciezka } = trasa;

  // Etap 3A/3B: jedyne trasy publiczne portalu — MUSZĄ wyprzedzić bramkę
  // sesji poniżej, inaczej niezalogowany gość zawsze wyląduje na ekranie
  // logowania (konto z aktywacji NIE MA jeszcze ważnej sesji w tym momencie).
  if (segmenty[0] === 'zglos-sie') return <EkranZgloszenieWstepne />;
  if (segmenty[0] === 'aktywuj' && segmenty[1]) return <EkranAktywacjaKonta token={segmenty[1]} />;

  return <AplikacjaPortalZSesja segmenty={segmenty} sciezka={sciezka} />;
}

function AplikacjaPortalZSesja({ segmenty, sciezka }) {
  const sesja = usePortalSesja();

  if (sesja.ladowanie) return <Spinner />;
  if (!sesja.zalogowany) return <EkranLoginPortal przyZalogowaniu={() => sesja.odswiez()} />;

  function ekran() {
    // Etap 3B: konto zaproszone (rola 'wnioskodawca') nie ma jeszcze ani
    // spółki, ani statusu akcjonariusza — `EkranMoje` (poniżej) dla niego
    // nie ma sensu. Właściwy wniosek (dane spółki, akcjonariusze) to etap 3C;
    // do tego czasu zostaje przy tym miejscu-trzymaczu.
    if (sesja.konto.rola === 'wnioskodawca') {
      return (
        <Karta tytul="Wniosek o prowadzenie rejestru">
          <Pusto
            tytul="Konto aktywowane"
            opis="Formularz wniosku (dane spółki i akcjonariuszy) pojawi się tutaj wkrótce. Kancelaria już wie o aktywacji Twojego konta."
          />
        </Karta>
      );
    }
    if (segmenty.length === 0) return <EkranMoje />;
    if (segmenty[0] === 'sprawy') return <EkranSprawyPortal />;
    if (segmenty[0] === 'rejestr' && segmenty[1]) return <EkranRejestrPortal spolkaId={Number(segmenty[1])} />;
    if (segmenty[0] === 'zgloszenie' && segmenty[1]) return <EkranZgloszeniePortal spolkaId={Number(segmenty[1])} />;
    if (segmenty[0] === 'informacja' && segmenty[1]) return <EkranInformacjaPortal spolkaId={Number(segmenty[1])} />;
    return (
      <Karta>
        <Pusto tytul="Nie ma takiej strony" akcja={<button className="btn btn-primary" onClick={() => idz('/')}>Wróć</button>} />
      </Karta>
    );
  }

  // Te same proporcje treści co w aplikacji kancelaryjnej (faza 3.2/3.3):
  // formularze (zgłoszenie, informacja) węższe niż listy/rejestr.
  const waski = segmenty[0] === 'zgloszenie' || segmenty[0] === 'informacja';

  return (
    <PortalLayout
      sciezka={sciezka === '/' ? '/' : `/${segmenty[0]}`}
      waski={waski}
      konto={sesja.konto}
      przyWylogowaniu={() => sesja.odswiez()}
    >
      {ekran()}
    </PortalLayout>
  );
}

ReactDOM.createRoot(document.getElementById('korzen')).render(<AplikacjaPortal />);
