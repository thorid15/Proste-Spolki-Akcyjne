# -*- coding: utf-8 -*-
from _naglowek import *

d = nowy_dokument()
naglowek_pisma(d)
blok_adresata(d, 'Osoba żądająca wpisu')
tytul_pisma(d, 'WEZWANIE DO USUNIĘCIA PRZESZKODY DOKONANIA WPISU',
            'art. §§300^34 § 1 zdanie drugie Kodeksu spółek handlowych')

p = akapit(d, 'just', po=6)
pisz(p, 'W związku z żądaniem dokonania wpisu w rejestrze akcjonariuszy ' + SPOLKA_DOPELNIACZ +
        ', otrzymanym w dniu {{zadanie_data_wplywu}} i dotyczącym: {{wpis_opis}} — stwierdzam przeszkodę '
        'uniemożliwiającą dokonanie wpisu.')

sekcja(d, 'Stwierdzona przeszkoda')
p = akapit(d, 'left', po=0)
pisz(p, '{{#przeszkody}}')
p = akapit(d, 'just', po=3, wciecie=0.75, wysuniecie=-0.5)
pisz(p, '— {{przeszkoda_opis}}')
p = akapit(d, 'left', po=6)
pisz(p, '{{/przeszkody}}')

sekcja(d, 'Sposób i termin usunięcia przeszkody')
p = akapit(d, 'just', po=6)
pisz(p, 'Wzywam do usunięcia przeszkody w terminie do dnia {{termin_usuniecia}} przez: {{sposob_usuniecia}}.')

sekcja(d, 'Pouczenie')
punkt(d, '1.', POUCZENIE_CIEZAR, wciecie=0.75)
punkt(d, '2.', 'Termin siedmiu dni na dokonanie wpisu biegnie od dnia usunięcia przeszkody '
               '(art. §§300^34 § 1 zdanie drugie Kodeksu spółek handlowych).', wciecie=0.75)
punkt(d, '3.', 'Nieusunięcie przeszkody skutkuje niedokonaniem wpisu. O niedokonaniu wpisu osoba żądająca '
               'wpisu zostanie zawiadomiona z podaniem przyczyn (art. §§300^34 § 7 zdanie drugie '
               'Kodeksu spółek handlowych).', wciecie=0.75)

podpis_podmiotu(d)
zapisz(d, '06-Wezwanie-do-usuniecia-przeszkody-WZOR.docx')
