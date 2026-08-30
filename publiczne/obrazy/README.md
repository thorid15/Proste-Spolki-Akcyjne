# Obrazy wstawiane do dokumentów

Katalog na pliki graficzne, których aplikacja **nie generuje** — dostarcza
je kancelaria. Serwer udostępnia go statycznie pod `/obrazy/...`.

## `notariat.svg` — znak „Notariat Rzeczypospolitej Polskiej"

Nagłówek raportu i informacji z rejestru (`publiczne/js/wydruk.js`) szuka
znaku samorządu pod ścieżką:

    publiczne/obrazy/notariat.svg

Wystarczy wgrać tu plik i odświeżyć stronę — nic więcej nie trzeba zmieniać
w kodzie. Dopóki pliku nie ma (albo gdy się nie wczyta), nagłówek pokazuje
ramkę z nazwą znaku, tak jak dotychczas.

Zalecenia:

- format **SVG** (ostry na wydruku w każdej skali) albo **PNG** z tłem
  przezroczystym, co najmniej 300 × 300 px;
- proporcja zbliżona do kwadratu — nagłówek rezerwuje na znak kwadratowe
  pole (`.raport-logo` w `publiczne/style/rejestr.css`);
- przy PNG trzeba zmienić rozszerzenie w stałej `LOGO_NOTARIAT`
  (`publiczne/js/wydruk.js`).

Znaków samorządu notarialnego **nie odtwarzamy ani nie pobieramy z sieci** —
plik musi pochodzić z oficjalnego źródła, którym dysponuje kancelaria.
