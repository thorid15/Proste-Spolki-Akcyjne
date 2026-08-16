# -*- coding: utf-8 -*-
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wspolne import *
WYJSCIE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def zapisz(d, nazwa):
    d.save(os.path.join(WYJSCIE, nazwa))
    print('ok', nazwa)
