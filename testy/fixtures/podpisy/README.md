# Próbki podpisów (D-075, D-086)

Katalog na **prawdziwe** podpisane pliki do testu `testy/podpisy.test.js` — sprawdza tylko, czy plik
jest rozpoznany jako podpisany i czy zgadza się z oryginałem (D-086; resztę sprawdza pracownik).
Pusty katalog = test pominięty z komunikatem.

Nazwa pliku: `<dostawca>__<typ>.pdf` (np. `sigillum__qes.pdf`, `gov__pz.pdf`, `edowod__po.xml`);
opcjonalnie oryginał przed podpisem: `<dostawca>__oryginal.pdf` — test sprawdza, że pierwsza wersja
podpisanego pliku = oryginał (W3.4) i że sam oryginał jest odrzucany jako niepodpisany.

Plików z danymi osobowymi nie commitujemy — katalog `*.pdf` jest w `.gitignore`.
