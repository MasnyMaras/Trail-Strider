import json
import os
import sys
import time
from pathlib import Path
 
import psycopg
from dotenv import load_dotenv
from psycopg import sql
from psycopg.types.json import Jsonb
 
KATALOG = Path("data/bdl")
SCHEMAT = "bdl"       # osobno od danych OSM (schemat public)
SRID = 3857           # ten sam układ co tabele OSM (db/osm2pgsql/generic.lua)
 
# plik bez rozszerzenia = nazwa tabeli: typ geometrii
TABELE = {
    "zanocuj_w_lesie": "MultiPolygon",
    "noclegi_powierzchniowe": "Point",
    "noclegi_kubaturowe": "Point",
}
 
# GeoJSON (EPSG:4326) -> geometria w układzie bazy
GEOM = "ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326), {srid})"
 
 
def zaladuj(conn: psycopg.Connection, nazwa: str, typ: str, opis: str) -> tuple[int, int, int]:
    """Tworzy tabelę bdl.<nazwa> i wstawia obiekty. Zwraca (wstawione, bez geometrii, naprawione)."""
    kolekcja = json.loads((KATALOG / f"{nazwa}.geojson").read_text(encoding="utf-8"))
    tabela = sql.Identifier(SCHEMAT, nazwa)
    geom = sql.SQL(GEOM).format(srid=sql.Literal(SRID))
    if typ == "MultiPolygon":
        geom = sql.SQL("ST_Multi({})").format(geom)     # Polygon i MultiPolygon -> jeden typ
 
    conn.execute(sql.SQL("DROP TABLE IF EXISTS {}").format(tabela))
    conn.execute(sql.SQL("""
        CREATE TABLE {} (
            id    integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            props jsonb NOT NULL,                       -- wszystkie atrybuty z BDL
            geom  geometry({}, {}) NOT NULL
        )""").format(tabela, sql.SQL(typ), sql.Literal(SRID)))
 
    wiersze = [(Jsonb(o.get("properties") or {}), json.dumps(o["geometry"]))
               for o in kolekcja["features"] if o.get("geometry")]
    bez_geometrii = len(kolekcja["features"]) - len(wiersze)
    with conn.cursor() as cur:
        cur.executemany(
            sql.SQL("INSERT INTO {} (props, geom) VALUES (%s, {})").format(tabela, geom), wiersze)
 
    # poligony z błędami (np. samoprzecięcia) psują zapytania przestrzenne - naprawiamy
    naprawione = 0
    if typ == "MultiPolygon":
        naprawione = conn.execute(
            sql.SQL("SELECT count(*) FROM {} WHERE NOT ST_IsValid(geom)").format(tabela)).fetchone()[0]
        conn.execute(sql.SQL("""
            UPDATE {} SET geom = ST_Multi(ST_CollectionExtract(ST_MakeValid(geom), 3))
            WHERE NOT ST_IsValid(geom)""").format(tabela))
 
    conn.execute(sql.SQL("CREATE INDEX {} ON {} USING gist (geom)").format(
        sql.Identifier(f"{nazwa}_geom_idx"), tabela))
    conn.execute(sql.SQL("COMMENT ON TABLE {} IS {}").format(tabela, sql.Literal(opis)))
    conn.execute(sql.SQL("ANALYZE {}").format(tabela))
    return len(wiersze), bez_geometrii, naprawione
 
 
def main() -> int:
    raport_plik = KATALOG / "pobranie.json"
    brak = [n for n in TABELE if not (KATALOG / f"{n}.geojson").exists()]
    if brak or not raport_plik.exists():
        print(f"Brak plików w {KATALOG}/ - najpierw uruchom: python db/scripts/bdl_download.py")
        return 1
    raport = json.loads(raport_plik.read_text(encoding="utf-8"))
 
    # --- Połączenie z bazą: dane logowania z .env (hasło nie jest w kodzie) ---
    load_dotenv()
    with psycopg.connect(
        host="127.0.0.1", port=5432,
        user=os.environ["POSTGRES_USER"],
        password=os.environ["POSTGRES_PASSWORD"],
        dbname=os.environ["POSTGRES_DB"],
    ) as conn:
        conn.execute(sql.SQL("CREATE SCHEMA IF NOT EXISTS {}").format(sql.Identifier(SCHEMAT)))
        for nazwa, typ in TABELE.items():
            t = time.perf_counter()
            warstwa = raport["warstwy"][nazwa]["warstwa"]
            opis = f"{raport['zrodlo']}; warstwa {warstwa}; pobrano {raport['pobrano']}"
            wstawione, bez_geometrii, naprawione = zaladuj(conn, nazwa, typ, opis)
            print(f"  {SCHEMAT}.{nazwa:24} {wstawione:>6,} wierszy  "
                  f"bez geometrii {bez_geometrii}  naprawione {naprawione}  "
                  f"{time.perf_counter() - t:5.1f} s")
    print(f"Załadowano do schematu {SCHEMAT} (stan danych na {raport['pobrano']})")
    return 0
 
 
if __name__ == "__main__":
    sys.exit(main())
