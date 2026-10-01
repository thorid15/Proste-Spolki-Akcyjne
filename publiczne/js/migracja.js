/* migracja.js — „stan otwarcia": ręczne wprowadzenie historycznego stanu
   akcjonariatu dla spółek migrowanych z Rejestrów Notarialnych (sekcja 14,
   sprint 4: „2 spółki — ręcznie przez kreator „stan otwarcia", z datami
   historycznymi; import niepotrzebny").

   Świadomie NIE korzysta z workflow spraw: to nie jest bieżąca czynność
   odpłatna z biegnącym terminem 7 dni ani checklistą AML, tylko odtworzenie
   już zaszłego stanu faktycznego. Idzie więc przez tę samą bezpośrednią
   ścieżkę zapisu co sprint 1 (`POST /api/psa/spolki/:id/zdarzenia`), z
   krokami 3 kreatora (`KrokEmisja`, `KrokObjecie`) ponownie użytymi 1:1 -
   te same pola, ta sama walidacja, bez duplikowania formularza. */

function EkranMigracji({ spolkaId }) {
  const { dane: spolkaPoczatkowa, ladowanie } = useDane(`/api/psa/spolki/${spolkaId}`);
  const [spolkaRobocza, ustawSpolkeRobocza] = useState(null);
  const [krok, ustawKrok] = useState(1);
  // D-R01/D-R08 pkt 5: jedyny wyjątek od systemowej daty wpisu — przy
  // przejęciu rejestru z KRN datą wpisu jest historyczna data rejestracji
  // w KRN (kolumna DR), z godziną, jeżeli KRN ją podaje.
  const [dataKrn, ustawDateKrn] = useState('');
  const [godzinaKrn, ustawGodzineKrn] = useState('');
  const [daneEmisja, ustawDaneEmisja] = useState({});
  const [daneObjecie, ustawDaneObjecie] = useState({});
  const [zapisywanie, ustawZapisywanie] = useState(false);
  const [blad, ustawBlad] = useState(null);
  const [zdarzeniaZapisane, ustawZdarzeniaZapisane] = useState([]);

  useEffect(() => {
    if (spolkaPoczatkowa && !spolkaRobocza) ustawSpolkeRobocza(spolkaPoczatkowa);
  }, [spolkaPoczatkowa]); // eslint-disable-line react-hooks/exhaustive-deps

  if (ladowanie || !spolkaRobocza) return <Spinner />;

  async function zapiszZdarzenieBezposrednio(typ, dane) {
    ustawZapisywanie(true);
    ustawBlad(null);
    try {
      const podglad = await API.post(`/api/psa/spolki/${spolkaId}/zdarzenia/podglad`, {
        typ,
        migracja_krn: { data_rejestracji: godzinaKrn ? `${dataKrn}T${godzinaKrn}` : dataKrn },
        dane,
      });
      if (!podglad.dopuszczalne) {
        ustawBlad((podglad.bledy || []).join(' ') || 'Nie udało się przygotować wpisu.');
        return null;
      }
      const wynik = await API.post(`/api/psa/spolki/${spolkaId}/zdarzenia`, {
        typ,
        migracja_krn: { data_rejestracji: godzinaKrn ? `${dataKrn}T${godzinaKrn}` : dataKrn },
        dane,
      });
      const swieza = await API.get(`/api/psa/spolki/${spolkaId}`);
      ustawSpolkeRobocza(swieza);
      ustawZdarzeniaZapisane((p) => [...p, wynik.zdarzenie]);
      return wynik;
    } catch (e) {
      ustawBlad(e.message);
      return null;
    } finally {
      ustawZapisywanie(false);
    }
  }

  async function zapiszEmisje() {
    let dane;
    try {
      dane = zbudujDaneZdarzenia('emisja', daneEmisja);
    } catch (e) {
      ustawBlad(e.message);
      return;
    }
    if (!dane.seria || !dane.ilosc) {
      ustawBlad('Podaj oznaczenie serii i liczbę akcji.');
      return;
    }
    const wynik = await zapiszZdarzenieBezposrednio('emisja', dane);
    if (wynik) ustawKrok(2);
  }

  async function zapiszObjecie() {
    let dane;
    try {
      dane = zbudujDaneZdarzenia('objecie', daneObjecie);
    } catch (e) {
      ustawBlad(e.message);
      return;
    }
    if (!dane.emisja_zdarzenie_id || !dane.pozycje || dane.pozycje.length === 0) {
      ustawBlad('Wskaż emisję i przynajmniej jednego obejmującego.');
      return;
    }
    const wynik = await zapiszZdarzenieBezposrednio('objecie', dane);
    if (wynik) ustawKrok(3);
  }

  if (krok === 3) {
    return (
      <Karta>
        <Komunikat
          odmiana="ok"
          tytul="Stan otwarcia wprowadzony"
          tresc={`Zapisano ${zdarzeniaZapisane.length} zdarzenia z datą rejestracji w KRN ${fmt.data(dataKrn)}${godzinaKrn ? `, godz. ${godzinaKrn}` : ''}. Rejestr spółki „${spolkaRobocza.spolka.nazwa}” jest gotowy do dalszego prowadzenia na bieżąco.`}
        />
        <div className="kreator-stopka">
          <button className="btn" onClick={() => { ustawKrok(1); ustawDaneEmisja({}); ustawZdarzeniaZapisane([]); }}>
            Dodaj kolejną emisję (np. druga seria)
          </button>
          <button className="btn btn-glowny" onClick={() => idz(`/spolki/${spolkaId}`)}>
            Przejdź do kokpitu spółki
          </button>
        </div>
      </Karta>
    );
  }

  return (
    <>
      <div className="okruszki bez-druku">
        <button onClick={() => idz('/spolki')}>Spółki</button> →{' '}
        <button onClick={() => idz(`/spolki/${spolkaId}`)}>{spolkaRobocza.spolka.nazwa}</button> → Migracja stanu otwarcia
      </div>

      <div className="pasek-gorny">
        <div>
          <div className="tytul-strony">Migracja — stan otwarcia</div>
          <div className="podtytul-strony">
            Ręczne wprowadzenie stanu akcjonariatu przeniesionego z innego rejestru (np. Rejestrów
            Notarialnych), z datami historycznymi. Ta ścieżka NIE zakłada sprawy ani opłaty za
            wpis — to odtworzenie już zaszłego stanu, nie bieżąca czynność.
          </div>
        </div>
      </div>

      <Komunikat
        odmiana="uwaga"
        tresc="Wprowadź najpierw emisję (pulę wyemitowanych akcji), potem przypisz je aktualnym akcjonariuszom w kroku „Objęcie”. Jako datę wpisu podaj datę i godzinę rejestracji z KRN (kolumna DR) — stan otwarcia można wprowadzać tylko do rejestru bez zwykłych wpisów."
      />
      <Komunikat odmiana="blad" tresc={blad} />

      <Karta tytul={krok === 1 ? '1. Emisja — pula wyemitowanych akcji' : '2. Objęcie — kto obecnie posiada akcje'}>
        <Pole etykieta="Data rejestracji w KRN (data wpisu)" wymagane>
          <PoleDaty wartosc={dataKrn} max={fmt.dzisIso()} przyZmianie={(v) => v && ustawDateKrn(v)} />
        </Pole>
        <Pole etykieta="Godzina rejestracji w KRN" podpowiedz="Jeżeli KRN ją podaje (GG:MM).">
          <input type="time" value={godzinaKrn} onChange={(e) => ustawGodzineKrn(e.target.value)} />
        </Pole>

        {krok === 1 && <KrokEmisja dane={daneEmisja} ustawDane={ustawDaneEmisja} />}
        {krok === 2 && <KrokObjecie dane={daneObjecie} ustawDane={ustawDaneObjecie} spolka={spolkaRobocza} />}

        <div className="kreator-stopka">
          {krok === 2 && (
            <button className="btn" onClick={() => ustawKrok(1)} disabled={zapisywanie}>Wstecz</button>
          )}
          <button
            className="btn btn-glowny"
            onClick={krok === 1 ? zapiszEmisje : zapiszObjecie}
            disabled={zapisywanie || !dataKrn}
          >
            {zapisywanie ? 'Zapisywanie…' : krok === 1 ? 'Zapisz emisję i przejdź dalej' : 'Zapisz objęcie i zakończ'}
          </button>
        </div>
      </Karta>
    </>
  );
}

window.EkranMigracji = EkranMigracji;
