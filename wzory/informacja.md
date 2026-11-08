# Informacja z rejestru akcjonariuszy

## nr {{numer}} · stan na {{stan_na}}

### Spółka

{{spolka_firma}} \
siedziba: {{spolka_siedziba}}, adres: {{spolka_adres}} \
{{spolka_sad}}, KRS {{spolka_krs}} \
data rejestracji spółki: {{spolka_data_rejestracji}}

### Akcje

| Seria | Numery | Liczba | Rodzaj i uprawnienia szczególne | Data rejestracji emisji |
|---|---|--:|---|---|
{{#lista serie}}| {{seria}} | {{numery}} | {{liczba}} | {{rodzaj}} | {{data_emisji}} |
{{/lista}}
{{#jesli umorzone}}

Numery umorzone: {{#lista umorzone}}seria {{seria}}: {{numery}}{{#jesli dalej}}; {{/jesli}}{{/lista}}.
{{/jesli}}

### Akcjonariusze

| Akcjonariusz | Seria | Numery | Liczba | Data wpisu | Pokryte w całości |
|---|---|---|--:|---|---|
{{#lista akcjonariusze}}| {{opis}} | {{seria}} | {{numery}} | {{liczba}} | {{data_wpisu}} | {{pokryte}} |
{{/lista}}
{{#jesli obciazenia}}

### Obciążenia, ograniczenia, obowiązki

| Numery | Treść | Uprawniony | Prawo głosu | Data wpisu |
|---|---|---|---|---|
{{#lista obciazenia}}| {{numery}} | {{tresc}} | {{uprawniony}} | {{prawo_glosu}} | {{data_wpisu}} |
{{/lista}}
{{/jesli}}
