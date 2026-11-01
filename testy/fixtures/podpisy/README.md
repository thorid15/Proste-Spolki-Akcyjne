# Próbki podpisów (Faza 2, D-075)

Katalog na **prawdziwe** podpisane pliki do testu walidatora (`testy/podpisy.test.js`).
Pusty katalog = test pominięty z komunikatem.

Do dostarczenia (Łukasz): po jednym pliku PDF podpisanym w mObywatelu u każdego z 4 dostawców
(Sigillum, SimplySign, mSzafir, Cencert), podpis zaufany (PZ), podpis osobisty (PO).

Nazwa pliku: `<dostawca>__<oczekiwany-typ>.pdf`, np. `sigillum__qes.pdf`, `gov__pz.pdf`,
`edowod__po.pdf`. Obok — opcjonalnie — oryginał przed podpisem: `<dostawca>__oryginal.pdf`
(sprawdza, czy dostawca zachowuje oryginał jako pierwszą rewizję — W3.4).

Test wymaga uruchomionej usługi DSS (`DSS_URL`); bez niej sprawdza tylko format i oryginał.
Plików z danymi osobowymi nie commitujemy — katalog `*.pdf` jest w `.gitignore`.
