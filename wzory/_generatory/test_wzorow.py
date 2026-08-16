# -*- coding: utf-8 -*-
"""Test spójności wzorów PSA. Uruchomienie: python3 test_wzorow.py

Sprawdza:
  T1  każdy klucz użyty we wzorze jest zadeklarowany w slownik.py
  T2  brak kluczy ze starej konwencji (mapa MIGRACJA)
  T3  każdy placeholder jest osobnym, nierozbitym runem w .docx
  T4  sekcje powtarzalne są domknięte i sparowane
  T5  klucze sekcyjne występują wyłącznie wewnątrz swojej sekcji
  T6  po podstawieniu danych testowych w pliku nie zostaje ani jedno '{{'
"""
import os, re, sys, glob
from docx import Document
from slownik import PROSTE, SEKCJE, W_SEKCJACH, ZNANE, MIGRACJA
import dane_testowe

WZORY = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PH = re.compile(r'\{\{([#/]?)([a-z0-9_]+)\}\}')
bledy = []


def akapity(doc):
    for p in doc.paragraphs:
        yield p
    for tb in doc.tables:
        for r in tb.rows:
            for c in r.cells:
                for p in c.paragraphs:
                    yield p


def sprawdz(sciezka):
    nazwa = os.path.basename(sciezka)
    doc = Document(sciezka)
    tekst_calosc = []
    otwarte = []
    for p in akapity(doc):
        t = p.text
        tekst_calosc.append(t)

        # T3 — placeholder rozbity na kilka runów
        for r in p.runs:
            if r.text.count('{{') != r.text.count('}}'):
                bledy.append('%s T3 rozbity placeholder w runie: %r' % (nazwa, r.text))
        for m in PH.finditer(t):
            if not any(rr.text == m.group(0) for rr in p.runs):
                if m.group(0) not in ''.join(rr.text for rr in p.runs if PH.fullmatch(rr.text)):
                    bledy.append('%s T3 placeholder nie jest osobnym runem: %s' % (nazwa, m.group(0)))

        for znak, klucz in PH.findall(t):
            if znak == '#':
                otwarte.append(klucz)
            elif znak == '/':
                if not otwarte or otwarte[-1] != klucz:
                    bledy.append('%s T4 niesparowana sekcja: {{/%s}}' % (nazwa, klucz))
                else:
                    otwarte.pop()
            else:
                # T1 / T2
                if klucz in MIGRACJA:
                    bledy.append('%s T2 stary klucz: {{%s}} -> %s' % (nazwa, klucz, MIGRACJA[klucz]))
                elif klucz not in ZNANE:
                    bledy.append('%s T1 klucz spoza slownik.py: {{%s}}' % (nazwa, klucz))
                # T5
                elif klucz in W_SEKCJACH:
                    wlasciwa = [s for s, ks in SEKCJE.items() if klucz in ks]
                    if not any(w in otwarte for w in wlasciwa):
                        bledy.append('%s T5 klucz sekcyjny poza sekcją %s: {{%s}}'
                                     % (nazwa, '/'.join(wlasciwa), klucz))
    if otwarte:
        bledy.append('%s T4 sekcje niedomknięte: %s' % (nazwa, otwarte))
    return '\n'.join(tekst_calosc)


def podstaw(tekst, dane):
    """Uproszczony renderer wyłącznie na potrzeby testu T6."""
    for sekcja, elementy in dane.get('_sekcje', {}).items():
        wzor = re.compile(r'\{\{#%s\}\}(.*?)\{\{/%s\}\}' % (sekcja, sekcja), re.S)

        def zamien(m, el=elementy):
            szablon = m.group(1)
            out = []
            for e in el:
                frag = szablon
                for k, v in e.items():
                    frag = frag.replace('{{%s}}' % k, str(v))
                out.append(frag)
            return ''.join(out)
        tekst = wzor.sub(zamien, tekst)
    for k, v in dane.items():
        if k != '_sekcje':
            tekst = tekst.replace('{{%s}}' % k, str(v))
    return tekst


pliki = sorted(glob.glob(os.path.join(WZORY, '*.docx')))
print('Wzorów do sprawdzenia: %d\n' % len(pliki))
for f in pliki:
    tekst = sprawdz(f)
    wynik = podstaw(tekst, dane_testowe.DANE)
    zostalo = sorted(set(re.findall(r'\{\{[a-z0-9_#/]+\}\}', wynik)))
    if zostalo:
        bledy.append('%s T6 niepodstawione: %s' % (os.path.basename(f), ', '.join(zostalo)))

if bledy:
    print('BŁĘDY (%d):' % len(bledy))
    for b in bledy:
        print('  -', b)
    sys.exit(1)
print('WSZYSTKIE TESTY PRZESZŁY (T1-T6)')
