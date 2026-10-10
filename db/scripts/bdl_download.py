import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
 
# --- Usługa WFS mapy turystycznej BDL ---
WFS = ("https://mapserver.bdl.lasy.gov.pl/arcgis/services/"
       "WFS_BDL_mapa_turystyczna/MapServer/WFSServer")
PREFIKS = "WFS_BDL_mapa_turystyczna:"
 
# nazwa pliku wynikowego: nazwa warstwy w usłudze
WARSTWY = {
    "zanocuj_w_lesie": "Obszar_programu_Zanocuj_w_lesie",        # poligony programu
    "noclegi_powierzchniowe": "Powierzchniowa_baza_noclegowa",   # miejsca i pola biwakowe
    "noclegi_kubaturowe": "Kubaturowa_baza_noclegowa",           # schroniska, kwatery (budynki)
}
 
KATALOG = Path("data/bdl")
STRONA = 500          # ile obiektów w jednym zapytaniu
PROBY = 3             # ile razy ponawiać nieudane zapytanie
TIMEOUT = 180         # sekundy na jedno zapytanie
NAGLOWKI = {"User-Agent": "Trail-Strider (projekt studencki, Politechnika Gdanska)"}
 
 
def pobierz(parametry: dict) -> bytes:
    """Jedno zapytanie GetFeature; przy błędzie sieci ponawia z rosnącą przerwą."""
    url = WFS + "?" + urllib.parse.urlencode(
        {"service": "WFS", "version": "2.0.0", "request": "GetFeature", **parametry})
    for proba in range(1, PROBY + 1):
        try:
            zapytanie = urllib.request.Request(url, headers=NAGLOWKI)
            with urllib.request.urlopen(zapytanie, timeout=TIMEOUT) as odpowiedz:
                return odpowiedz.read()
        except (urllib.error.URLError, TimeoutError) as blad:
            if proba == PROBY:
                raise
            print(f"    błąd ({blad}), ponawiam za {5 * proba} s")
            time.sleep(5 * proba)
 
 
def liczba_na_serwerze(typ: str) -> int:
    """Ile obiektów ma warstwa według serwera (resultType=hits nie zwraca danych)."""
    xml = pobierz({"typeNames": PREFIKS + typ, "resultType": "hits"}).decode("utf-8", "replace")
    wynik = re.search(r'numberMatched="(\d+)"', xml)
    if not wynik:
        raise RuntimeError(f"Serwer nie podał liczby obiektów dla {typ}: {xml[:200]}")
    return int(wynik.group(1))
 
 
def klucz(obiekt: dict) -> str:
    """Identyfikator obiektu do wykrywania powtórek między stronami."""
    wlasciwosci = obiekt.get("properties") or {}
    return str(wlasciwosci.get("GmlID") or obiekt.get("id") or json.dumps(obiekt, sort_keys=True))
 
 
def pobierz_warstwe(typ: str) -> dict:
    """Pobiera całą warstwę strona po stronie i skleja w jeden FeatureCollection."""
    obiekty, widziane, crs, start = [], set(), None, 0
    while True:
        tresc = pobierz({"typeNames": PREFIKS + typ, "outputFormat": "GEOJSON",
                         "count": STRONA, "startIndex": start})
        try:
            strona = json.loads(tresc)
        except json.JSONDecodeError:
            raise RuntimeError(f"Serwer nie zwrócił GeoJSON dla {typ}: "
                               f"{tresc[:200].decode('utf-8', 'replace')}")
        crs = crs or strona.get("crs")
        nowe = [o for o in strona.get("features", []) if klucz(o) not in widziane]
        widziane.update(klucz(o) for o in nowe)
        obiekty.extend(nowe)
        # koniec: strona niepełna albo serwer zaczął zwracać to samo
        if len(strona.get("features", [])) < STRONA or not nowe:
            break
        start += STRONA
    kolekcja = {"type": "FeatureCollection", "features": obiekty}
    if crs:
        kolekcja["crs"] = crs
    return kolekcja
 
 
def main() -> int:
    KATALOG.mkdir(parents=True, exist_ok=True)
    pobrano = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    raport = {"zrodlo": "Bank Danych o Lasach, Lasy Państwowe (mapa turystyczna, WFS)",
              "url": WFS, "pobrano": pobrano, "warstwy": {}}
    zgodne = True
 
    for nazwa, typ in WARSTWY.items():
        t = time.perf_counter()
        oczekiwane = liczba_na_serwerze(typ)
        kolekcja = pobierz_warstwe(typ)
        liczba = len(kolekcja["features"])
        plik = KATALOG / f"{nazwa}.geojson"
        plik.write_text(json.dumps(kolekcja, ensure_ascii=False), encoding="utf-8")
        ok = liczba == oczekiwane
        zgodne = zgodne and ok
        raport["warstwy"][nazwa] = {"warstwa": typ, "plik": plik.name,
                                    "obiekty": liczba, "na_serwerze": oczekiwane}
        print(f"  {nazwa:24} {liczba:>6,} / {oczekiwane:,} na serwerze  "
              f"{time.perf_counter() - t:5.1f} s  {'OK' if ok else 'NIEZGODNE'}")
 
    (KATALOG / "pobranie.json").write_text(
        json.dumps(raport, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Zapisano {KATALOG}/ (stan danych na {pobrano})")
    if not zgodne:
        print("BŁĄD: liczba pobranych obiektów różni się od liczby na serwerze.")
        return 1
    return 0
 
 
if __name__ == "__main__":
    sys.exit(main())
