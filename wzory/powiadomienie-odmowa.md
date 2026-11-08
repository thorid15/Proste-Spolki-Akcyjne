{{#jesli odmowa_umowy}}Wnioskodawca{{/jesli}}{{#jesli !odmowa_umowy}}Osoba żądająca wpisu{{/jesli}} \
**{{adresat_nazwa}}** \
{{adresat_adres}}
{{#jesli sprawa_znak}}

Sprawa nr {{sprawa_znak}}
{{/jesli}}
{{#jesli !odmowa_umowy}}

# Powiadomienie o odmowie wpisu

## *art. 300³⁴ § 7 zdanie drugie Kodeksu spółek handlowych*

Jako podmiot prowadzący rejestr akcjonariuszy spółki {{spolka_firma}}, siedziba: {{spolka_siedziba}}, wpisanej do rejestru przedsiębiorców Krajowego Rejestru Sądowego prowadzonego przez {{spolka_sad}} pod numerem KRS {{spolka_krs}}, zawiadamiam, że nie dokonano wpisu żądanego w dniu {{data_wplywu}}, dotyczącego:

{{#lista zmiany}}
- {{opis}}
{{/lista}}

### Przyczyny niedokonania wpisu

{{przyczyna}}

### Pouczenie

1. Niedokonanie wpisu nie zamyka drogi do ponownego złożenia żądania po ustaniu przyczyn wskazanych powyżej.
2. Podmiot prowadzący rejestr akcjonariuszy nie rozstrzyga sporów o prawo do akcji. W razie sporu podstawę wpisu może stanowić orzeczenie sądu.
3. Wobec spółki za akcjonariusza uważa się tylko tę osobę, która jest wpisana do rejestru akcjonariuszy.
{{/jesli}}
{{#jesli odmowa_umowy}}

# Powiadomienie o odmowie zawarcia umowy o prowadzenie rejestru akcjonariuszy

## *art. 108a ustawy — Prawo o notariacie*

Zawiadamiam, że odmawiam zawarcia umowy o prowadzenie rejestru akcjonariuszy spółki {{spolka_firma}} (KRS {{spolka_krs}}), o którą wniesiono w dniu {{data_wniosku}}.

### Przyczyny odmowy

{{przyczyna}}
{{/jesli}}

[podpis: {{podpisujacy_funkcja}} {{podpisujacy}}, podmiot prowadzący rejestr akcjonariuszy]
