# Znaki graficzne

## `notariat.png` — znak „Notariat Rzeczypospolitej Polskiej"

Plik dostarczony przez kancelarię. Względem oryginału zmieniły się dwie
rzeczy, obie dotyczą TŁA, nie znaku: przycięty został biały margines wokół
znaku (594 × 261 → 498 × 220), a białe tło zostało zamienione na
przezroczystość. Sam znak jest nietknięty — stoi teraz na tle strony,
zamiast siedzieć na białym prostokącie, który na kremowym tle stopki
odcinał się jak naklejka. Kolor brzegów wraca przy tym do wartości sprzed
zmieszania z bielą (`odwrotność premultiplikacji`), więc na tle innym niż
białe nie zostaje jasna obwódka.

Zapisany bezstratnie w PNG, bo to płaskie plamy koloru, na których JPEG
zostawia widoczne obwódki.

Używany w dwóch miejscach:

- `publiczne/js/ui-rejestr.js` — stopka obu aplikacji (`ZNAK_NOTARIATU`),
- `server/logika/informacja-dokument.js` — główka informacji z rejestru.

Oba miejsca mają zapas na wypadek, gdyby pliku zabrakło: stopka nie pokazuje
wtedy nic, wydruk wraca do ramki z nazwą znaku. Żadne z nich nie rysuje
godła samodzielnie — znaków samorządu notarialnego się nie odtwarza ani nie
generuje. Gdyby znak trzeba było wymienić, wystarczy podmienić ten plik.

## Znak izby notarialnej (opcjonalny)

Nagłówek wydruku umie pokazać obok drugi znak — izby notarialnej — ale
domyślnie tego nie robi: rejestr prowadzi KANCELARIA (art. 300³¹ § 1 KSH),
nie izba, a dwa znaki obok siebie sugerowałyby, że dokument pochodzi od
samorządu. Włącza to pole `pokaz_znak_izby` w danych kancelarii.
