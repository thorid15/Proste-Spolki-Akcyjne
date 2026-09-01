# Znaki graficzne

## `notariat.png` — znak „Notariat Rzeczypospolitej Polskiej"

Plik dostarczony przez kancelarię. Względem oryginału przycięty został
wyłącznie biały margines wokół znaku (594 × 261 → 498 × 220); sam znak jest
nietknięty. Zapisany bezstratnie w PNG, bo to płaskie plamy koloru, na
których JPEG zostawia widoczne obwódki.

Używany w dwóch miejscach:

- `publiczne/js/ui-rejestr.js` — stopka obu aplikacji (`ZNAK_NOTARIATU`),
- `publiczne/js/wydruk.js` — nagłówek informacji z rejestru (`LOGO_NOTARIAT`).

Oba miejsca mają zapas na wypadek, gdyby pliku zabrakło: stopka nie pokazuje
wtedy nic, wydruk wraca do ramki z nazwą znaku. Żadne z nich nie rysuje
godła samodzielnie — znaków samorządu notarialnego się nie odtwarza ani nie
generuje. Gdyby znak trzeba było wymienić, wystarczy podmienić ten plik.

## Znak izby notarialnej (opcjonalny)

Nagłówek wydruku umie pokazać obok drugi znak — izby notarialnej — ale
domyślnie tego nie robi: rejestr prowadzi KANCELARIA (art. 300³¹ § 1 KSH),
nie izba, a dwa znaki obok siebie sugerowałyby, że dokument pochodzi od
samorządu. Włącza to pole `pokaz_znak_izby` w danych kancelarii.
