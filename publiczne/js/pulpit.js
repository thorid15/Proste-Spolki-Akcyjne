/* pulpit.js — Pulpit (§ 5): jedna lista „Do zrobienia” według pilności; wiersz otwiera ekran,
   który go załatwia. */

const IKONY_POZYCJI = { sprawa: 'zegar', plik: 'dokument', pismo: 'koperta' };

function EkranPulpitu() {
  const { dane, blad } = useDane('/api/psa/pulpit');
  return (
    <Karta tytul="Do zrobienia">
      {blad && <Bledy blad={blad} />}
      {!dane && !blad && <Spinner />}
      {dane && !dane.length && <Pusto tytul="Nic pilnego" opis="Brak spraw z bliskim terminem i pism do wysłania." />}
      {dane && dane.length > 0 && (
        <ul className="do-zrobienia">
          {dane.map((p, i) => (
            <li key={i}>
              <a href={`#${p.sciezka}`} className={`do-zrobienia-poz ${p.pilnosc <= 0 ? 'pilne' : ''}`}>
                <Ikona nazwa={IKONY_POZYCJI[p.rodzaj] || 'strzalkaPrawo'} rozmiar={16} />
                <span><strong>{p.tytul}</strong> <span className="drugorzedny">— {p.opis}</span></span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </Karta>
  );
}

window.EkranPulpitu = EkranPulpitu;
