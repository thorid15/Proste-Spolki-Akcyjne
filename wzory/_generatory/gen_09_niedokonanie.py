# -*- coding: utf-8 -*-
from _naglowek import *

d = nowy_dokument()
naglowek_pisma(d)
blok_adresata(d, 'Osoba żądająca wpisu')
tytul_pisma(d, 'ZAWIADOMIENIE O NIEDOKONANIU WPISU',
            'art. §§300^34 § 7 zdanie drugie Kodeksu spółek handlowych')

p = akapit(d, 'just', po=6)
pisz(p, 'Jako podmiot prowadzący rejestr akcjonariuszy ' + SPOLKA_DOPELNIACZ +
        ', zawiadamiam, że nie dokonano wpisu żądanego w dniu {{zadanie_data_wplywu}}, '
        'dotyczącego: {{wpis_opis}}.')

sekcja(d, 'Przyczyny niedokonania wpisu')
p = akapit(d, 'left', po=0)
pisz(p, '{{#przyczyny}}')
p = akapit(d, 'just', po=3, wciecie=0.75, wysuniecie=-0.5)
pisz(p, '— {{przyczyna_opis}}')
p = akapit(d, 'left', po=6)
pisz(p, '{{/przyczyny}}')

sekcja(d, 'Pouczenie')
punkt(d, '1.', 'Niedokonanie wpisu nie zamyka drogi do ponownego złożenia żądania po ustaniu przyczyn '
               'wskazanych powyżej.', wciecie=0.75)
punkt(d, '2.', POUCZENIE_SPOR, wciecie=0.75)
punkt(d, '3.', POUCZENIE_LEGITYMACJA, wciecie=0.75)

podpis_podmiotu(d)
zapisz(d, '09-Zawiadomienie-o-niedokonaniu-wpisu-WZOR.docx')
