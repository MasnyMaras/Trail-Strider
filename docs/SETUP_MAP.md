# SETUP – trzy regiony i lokalna mapa (Trail-Strider)

Instrukcja ma dwie części:
- **Część 1 (kroki 16–24): dane.** Do bazy z Małopolską dochodzą województwo pomorskie i okręg Maramureș
  (Rumunia) – trzy niezależne regiony projektu.
- **Część 2 (kroki 25–31): lokalna mapa.** Mapa w aplikacji działa bez internetu i bez zewnętrznych serwerów.
  Kafle mapy powstają z tych samych plików OSM co baza (program **Planetiler**), a przeglądarce podaje je lokalny
  serwer kafli **Martin** (usługa `martin` w `compose.yaml`). Styl mapy, czcionki i ikonki są w repozytorium (`map/`).

Dokładny opis działania jest na końcu („Jak to działa”).

**Zasady:**
- Każdy krok: **Sprawdź przed → Wykonaj → Sprawdź po.**
- Wynik musi się zgadzać z tabelą „Wymagane”. Jeśli nie – **zatrzymaj się** i zgłoś, nie idź dalej.
- Wszystkie komendy wykonujesz w `~/Trail-Strider`.
- Instrukcja zakłada wykonane kroki 0–15 z `docs/SETUP.md`.


---

## Zanim zaczniesz: aktualizacja repozytorium

⚠️ **Do kroku 28 uruchamiaj tylko bazę** (`docker compose up -d db`). Nie uruchamiaj `docker compose up -d`
ani `docker compose up -d frontend`:
- frontend zależy teraz od usługi `martin`, więc razem z nim startuje Martin – a przed krokami 26–27 nie ma on
  czego podawać (mapa jest pusta),
- Martin korzysta z folderu `data/tiles`. Jeśli folder jeszcze nie istnieje, Docker tworzy go sam jako **root**,
  a wtedy Planetiler (krok 26) nie zapisze do niego kafli.

**Wykonaj:**
```bash
cd ~/Trail-Strider
docker compose stop
git pull
docker compose up -d db
```

**Sprawdź po:**
```bash
docker compose ps
ls map
```

**Wymagane:**
| komenda | musi pokazać |
|---|---|
| `docker compose ps` | tylko `trail-strider-db-1`, status `Up ... (healthy)` |
| `ls map` | `fonts  martin.yaml  sprites  styles` |

**Od którego kroku zaczynasz:**
| Twoja sytuacja | zacznij od |
|---|---|
| w bazie jest tylko Małopolska (kroki 0–15 z `docs/SETUP.md`) | krok 16 |
| do bazy zaimportowałeś **całą Rumunię** (wcześniejsza wersja SETUP) | krok 16 – przeczytaj uwagi w krokach 16, 18, 22b i 23b |
| część 1 masz już wykonaną (3 regiony w bazie, Maramureș wycięty, krok 22c zgodny) | krok 25 |


---

# CZĘŚĆ 1. Dane: województwo pomorskie i Maramureș (kroki 16–24)

Do bazy dochodzą dwa regiony obok Małopolski:
- **województwo pomorskie** – plik z Geofabrik,
- **Maramureș (Rumunia)** – obszar administracyjny: okręg (rum. *județ*) Maramureș, w OSM relacja **72481**,
  `admin_level=4` (ten sam poziom co województwo). Geofabrik udostępnia tylko całą Rumunię, więc okręg
  wycinamy sami narzędziem **osmium**.

Zasady tej części:
- **Wszystkie trzy pliki są z tego samego dnia (`261001`, stan OSM z 1.10.2026).** osm2pgsql przyjmuje kilka plików
  w jednym imporcie tylko wtedy, gdy dane pochodzą z tego samego momentu i są posortowane (sprawdzamy to w kroku 19).
- **Import OSM usuwa i tworzy od nowa tabele OSM** w schemacie `public` (`points`, `lines`, `polygons`, `routes`,
  `boundaries`, `osm2pgsql_properties`). Dlatego importujemy **wszystkie regiony jedną komendą**. Dodanie regionu
  w przyszłości = ponowny import wszystkich plików.
- Schematów `bdl` i `app` import nie rusza. Dane Lasów Państwowych (krok 13) obejmują całą Polskę, więc **kroku 13
  nie powtarzamy**. Powtarzamy kroki 14 i 15.

ℹ️ Po tej części liczby z kroków 10, 14 i 15 przestają obowiązywać – obowiązują liczby z tej części.

**Co musi być spełnione przed tą częścią:**
- kroki 0–15 z `docs/SETUP.md` wykonane, wyniki zgodne z tabelami „Wymagane”,
- baza działa (`docker compose up -d db`),
- ok. 5 GB wolnego miejsca na dysku i dostęp do internetu (pobieranie ok. 650 MB),
- DBeaver zamknięty (krok 22).

Wszystkie komendy wykonujesz w `~/Trail-Strider`.


---

## Krok 16. Stan przed rozbudową

Same odczyty – nic nie zmieniają.

**Wykonaj:**
```bash
git status --short
docker compose ps db
df -h /
ls -l data
```
```bash
docker compose exec db psql -U osm -d osm -P pager=off \
  -c "\dn" \
  -c "SELECT pg_size_pretty(pg_database_size('osm'));" \
  -c "SELECT property, value FROM osm2pgsql_properties ORDER BY 1;" \
  -c "SELECT (SELECT count(*) FROM points) AS points, (SELECT count(*) FROM lines) AS lines, (SELECT count(*) FROM polygons) AS polygons, (SELECT count(*) FROM routes) AS routes, (SELECT count(*) FROM boundaries) AS boundaries;" \
  -c "SELECT tags->>'name' AS nazwa FROM boundaries WHERE tags->>'admin_level' = '4' ORDER BY 1;" \
  -c "SELECT (SELECT count(*) FROM bdl.zanocuj_w_lesie) AS zanocuj, (SELECT count(*) FROM bdl.noclegi_powierzchniowe) AS powierzchniowe, (SELECT count(*) FROM bdl.noclegi_kubaturowe) AS kubaturowe;" \
  -c "SELECT wojewodztwo, count(*) AS punkty, count(*) FILTER (WHERE super) AS super FROM bdl.zanocuj_punkty GROUP BY 1;" \
  -c "SELECT zrodlo, count(*) FROM app.noclegi GROUP BY 1 ORDER BY 1;"
```
Widoki (np. utworzone w DBeaverze) zbudowane na tabelach OSM zablokowałyby import:
```bash
docker compose exec db psql -U osm -d osm -P pager=off -c "SELECT DISTINCT v.relnamespace::regnamespace AS schemat, v.relname AS obiekt FROM pg_depend d JOIN pg_rewrite r ON r.oid = d.objid JOIN pg_class v ON v.oid = r.ev_class WHERE d.refobjid IN ('points'::regclass, 'lines'::regclass, 'polygons'::regclass, 'routes'::regclass, 'boundaries'::regclass) AND v.oid <> d.refobjid;"
```
Czy Geofabrik ma pliki z 1.10.2026 (`--spider` = tylko pytanie do serwera, bez pobierania):
```bash
wget --spider https://download.geofabrik.de/europe/poland/malopolskie-261001.osm.pbf 2>&1 | grep -E 'HTTP|Length'
wget --spider https://download.geofabrik.de/europe/poland/pomorskie-261001.osm.pbf 2>&1 | grep -E 'HTTP|Length'
wget --spider https://download.geofabrik.de/europe/romania-261001.osm.pbf 2>&1 | grep -E 'HTTP|Length'
```

**Wymagane:**
| komenda | musi pokazać |
|---|---|
| `git status --short` | pusto |
| `docker compose ps db` | `trail-strider-db-1`, status `Up ... (healthy)` |
| `df -h /` | `Avail` co najmniej **5G** |
| `ls -l data` | `bdl`, `malopolskie-261001.osm.pbf` i `.md5` (jeśli ich nie masz – nie szkodzi, krok 18 pobiera je od nowa) |
| `\dn` | `app`, `bdl`, `public`, `tiger`, `topology` |
| rozmiar bazy | ok. `1340 MB` |
| `osm2pgsql_properties` | 13 wierszy, m.in. `import_timestamp 2026-10-01T20:18:59Z`, `replication_base_url .../malopolskie-updates`, `replication_timestamp 2026-10-01T20:22:06Z` |
| liczby OSM | `points 1071381`, `lines 938950`, `polygons 2179021`, `routes 2986`, `boundaries 3889` |
| `admin_level = 4` | 7 nazw: `Metropolia katowicka`, `Prešovský kraj`, `województwo małopolskie`, `województwo podkarpackie`, `województwo śląskie`, `województwo świętokrzyskie`, `Žilinský kraj` |
| bdl | `zanocuj 1237`, `powierzchniowe 325`, `kubaturowe 191` |
| zanocuj_punkty | `województwo małopolskie 309`, super `190` |
| noclegi | `lp 516`, `osm 3251`, `zanocuj 309` |
| widoki | `(0 rows)` |
| `wget --spider` | 3× `200 OK`; `Length: 202209422`, `117803802`, `329454991` |

ℹ️ Liczby LP mogą się u Ciebie różnić o 1 (`kubaturowe 192`, `lp 517`) – serwer Lasów nie udostępnia wersji
z datą, więc liczba zależy od dnia, w którym wykonałeś krok 13. To normalne.

ℹ️ Jeśli krok 15 wykonałeś już z nowszą wersją `noclegi.sql` (usuwa duplikaty biwaków i noclegi spoza regionów),
liczby w noclegach będą mniejsze niż `lp 516`, `osm 3251`, `zanocuj 309`.

❌ Jakikolwiek widok w wyniku albo `404 Not Found` – zatrzymaj się i zgłoś.

ℹ️ **Jeśli wcześniej zaimportowałeś do bazy całą Rumunię** (wcześniejsza wersja SETUP): rozmiar bazy, liczby OSM,
`admin_level = 4`, `zanocuj_punkty` i noclegi będą u Ciebie inne – to normalne. Muszą się zgadzać: `git status`,
`\dn`, bdl, widoki `(0 rows)` i `wget --spider`. Import z kroku 22 zastąpi całą zawartość tabel OSM,
więc z Rumunii zostanie w bazie tylko okręg Maramureș.


---

## Krok 17. Kopia schematu `bdl`

Zabezpieczenie na wypadek konieczności odbudowy bazy: stanu `bdl` z dnia Twojego kroku 13 nie da się pobrać
ponownie (serwer Lasów nie ma wersji z datą). `pg_dump` zapisuje schemat (tabele + dane) do jednego pliku.
Kopię zapisujemy najpierw w kontenerze (`-f`), potem kopiujemy na dysk – przy zapisie strumieniem (`>`) archiwum
nie ma spisu położeń danych i bywa problematyczne przy przywracaniu.

**Sprawdź przed:**
```bash
ls -l data
```
**Wymagane:** brak pliku `kopia_bdl.dump`.

**Wykonaj:**
```bash
docker compose exec db pg_dump -U osm -d osm -n bdl -Fc -f /tmp/kopia_bdl.dump
docker compose exec db pg_restore --list /tmp/kopia_bdl.dump | grep 'TABLE DATA'
docker compose cp db:/tmp/kopia_bdl.dump data/kopia_bdl.dump
```
- `-n bdl` – tylko schemat `bdl`; `-Fc` – format skompresowany dla `pg_restore`,
- `pg_restore --list` – nic nie przywraca, tylko wypisuje spis zawartości kopii (sprawdzenie, że plik jest czytelny),
- `docker compose cp` – kopiuje plik z kontenera usługi `db` do `data/` (poza gitem).

**Sprawdź po:**
```bash
docker compose exec db ls -l /tmp/kopia_bdl.dump
ls -l data/kopia_bdl.dump
git status --short
```

**Wymagane:**
| komenda | musi pokazać |
|---|---|
| `pg_restore --list ... \| grep` | 4 linie `TABLE DATA bdl ...`: `noclegi_kubaturowe`, `noclegi_powierzchniowe`, `zanocuj_punkty`, `zanocuj_w_lesie` |
| oba `ls -l` | **ten sam rozmiar** (u mnie `11385364`) |
| `git status --short` | pusto |

ℹ️ Godziny przy obu plikach różnią się o 1 h – kontener działa w czasie UTC. Przywracanie z kopii tylko po
zgłoszeniu problemu.


---

## Krok 18. Pobranie danych OSM (trzy regiony)

Pobieramy wszystkie trzy pliki naraz, z tego samego dnia. Jeśli masz plik Małopolski z kroku 8, usuń go
i pobierz ponownie razem z pozostałymi – stan jest wtedy jednoznaczny (plik jest identyczny, sprawdza to `md5sum`).
`wget` nie nadpisuje istniejących plików (zapisałby kopię `.1`), dlatego najpierw `rm`.

ℹ️ **Jeśli masz już wszystkie trzy pliki z `261001`** (np. z wcześniejszej wersji SETUP): wykonaj tylko
**Sprawdź po**. Jeśli `md5sum` pokazuje 3× `OK`, pomiń **Wykonaj** i przejdź do kroku 19.

**Sprawdź przed:**
```bash
ls -l data
```
**Wymagane:** `bdl`, `kopia_bdl.dump` oraz ewentualnie `malopolskie-261001.osm.pbf` i `.md5`.

**Wykonaj:**
```bash
rm -f data/malopolskie-261001.osm.pbf data/malopolskie-261001.osm.pbf.md5
wget -P data https://download.geofabrik.de/europe/poland/malopolskie-261001.osm.pbf
wget -P data https://download.geofabrik.de/europe/poland/malopolskie-261001.osm.pbf.md5
wget -P data https://download.geofabrik.de/europe/poland/pomorskie-261001.osm.pbf
wget -P data https://download.geofabrik.de/europe/poland/pomorskie-261001.osm.pbf.md5
wget -P data https://download.geofabrik.de/europe/romania-261001.osm.pbf
wget -P data https://download.geofabrik.de/europe/romania-261001.osm.pbf.md5
```
- `rm -f` – usuwa pliki Małopolski, jeśli są (bez błędu, jeśli ich nie ma),

**Sprawdź po:**
```bash
cd data && md5sum -c malopolskie-261001.osm.pbf.md5 pomorskie-261001.osm.pbf.md5 romania-261001.osm.pbf.md5; cd ..
ls -l data
git status --short
```

**Wymagane:**
| komenda | musi pokazać |
|---|---|
| `md5sum -c ...` | `malopolskie-261001.osm.pbf: OK`, `pomorskie-261001.osm.pbf: OK`, `romania-261001.osm.pbf: OK` |
| `ls -l data` | `malopolskie-261001.osm.pbf` **202209422** (`.md5` **61**), `pomorskie-261001.osm.pbf` **117803802** (`.md5` **59**), `romania-261001.osm.pbf` **329454991** (`.md5` **57**), `bdl`, `kopia_bdl.dump` |
| `git status --short` | pusto |

ℹ️ Daty przy plikach w `ls -l` (`Oct 2`) to moment wygenerowania pliku przez Geofabrik, a nie data danych.

❌ `FAILED` – usuń ten plik i pobierz go ponownie.


---

## Krok 19. osmium – instalacja i sprawdzenie plików

**osmium-tool** – program wiersza poleceń do plików OSM (podgląd, wycinanie, łączenie); ten sam autor co
osm2pgsql, Geofabrik tworzy nim swoje pliki. Instalujemy dokładną wersję z repozytorium Ubuntu.

**Sprawdź przed:**
```bash
which osmium
apt-cache policy osmium-tool | head -3
```

**Wymagane:**
| komenda | musi pokazać |
|---|---|
| `which osmium` | pusto |
| `apt-cache policy ...` | `Installed: (none)`, `Candidate: 1.16.0-1build1` |

❌ Inny `Candidate` – nie instaluj, zgłoś.

**Wykonaj:**
```bash
sudo apt-get install osmium-tool=1.16.0-1build1
```
apt doinstaluje `libboost-program-options1.83.0` i zapyta o potwierdzenie (`Y`).

**Sprawdź po:**
```bash
osmium --version | head -2
for f in data/malopolskie-261001.osm.pbf data/pomorskie-261001.osm.pbf data/romania-261001.osm.pbf; do
  echo "$f $(osmium fileinfo -g header.option.timestamp $f) $(osmium fileinfo -g header.option.sorting $f)"
done
```
- `osmium fileinfo -g ...` – czyta jedną wartość z **nagłówka** pliku (krótki opis na początku PBF),
- pętla `for` wypisuje dla każdego pliku: nazwę, znacznik czasu danych, sposób sortowania.

**Wymagane:**
| komenda | musi pokazać |
|---|---|
| `osmium --version` | `osmium version 1.16.0`, `libosmium version 2.20.0` |
| pętla | 3 linie, każda zakończona `2026-10-01T20:22:06Z Type_then_ID` |

❌ Różne znaczniki czasu – zatrzymaj się (osm2pgsql nie przyjmie plików z różnych momentów).


---

## Krok 20. Obrys okręgu Maramureș

Wykrojnikiem do cięcia jest granica okręgu z OSM. Relacja okręgu wymienia jako członków także **76 gmin**
(rola `subarea`). Plik obrysu musi zawierać **tylko granicę okręgu**: kilka nakładających się wielokątów daje
w `osmium extract` wynik nieokreślony. Dlatego bierzemy relację bez członków, a potem tylko jej linie granicy.

### 20a. Relacja okręgu

**Wykonaj:**
```bash
osmium getid -f opl data/romania-261001.osm.pbf r72481 -o data/maramures-relation.opl
```
- `getid` – wyjmuje obiekty o podanych numerach; `r72481` = relacja 72481, bez członków,
- `-f opl` – format tekstowy OPL: jeden obiekt w jednej linii, pola oddzielone spacjami
  (pole 8 – tagi, zaczyna się od `T`; pole 9 – członkowie, zaczyna się od `M`, np. `w123@outer`).

**Sprawdź po:**
```bash
cut -d' ' -f8 data/maramures-relation.opl | tr ',' '\n' | grep -E '^(admin_level|boundary|name|type)='
cut -d' ' -f9 data/maramures-relation.opl | sed 's/^M//' | tr ',' '\n' | sed 's/[0-9]*@/ /' | sort | uniq -c
```

**Wymagane:**
| komenda | musi pokazać |
|---|---|
| tagi | `admin_level=4`, `boundary=administrative`, `name=Maramureș`, `type=boundary` |
| członkowie | `1 n admin_centre`, `76 r subarea`, `108 w outer` |

### 20b. Plik obrysu

**Wykonaj:**
```bash
cut -d' ' -f9 data/maramures-relation.opl | sed 's/^M//' | tr ',' '\n' | grep -E '^w[0-9]+@(outer|inner)$' | cut -d@ -f1 > data/maramures-ways.txt
osmium getid -r data/romania-261001.osm.pbf -i data/maramures-ways.txt -o data/maramures-ways.osm
osmium merge data/maramures-relation.opl data/maramures-ways.osm -o data/maramures-boundary.osm
```
- linia 1: numery linii granicy (rola `outer`/`inner`), po jednym w linii, np. `w12345`,
- linia 2: `-i` – numery z pliku, `-r` – dołącza punkty tych linii,
- linia 3: łączy relację i linie w jeden plik obrysu.

**Sprawdź po:**
```bash
wc -l data/maramures-ways.txt
osmium fileinfo -e data/maramures-boundary.osm | grep -E 'Bounding box:|Number of (nodes|ways|relations)'
```
`-e` – czyta cały plik i liczy obiekty (bez `-e` tylko nagłówek).

**Wymagane:**
| komenda | musi pokazać |
|---|---|
| `wc -l` | `108` |
| `Bounding box:` | `(22.9614811,47.3206191,25.0564361,48.0217884)` |
| liczby | `nodes 6474`, `ways 108`, `relations 1` |

Pliki pośrednie nie są już potrzebne:
```bash
rm data/maramures-relation.opl data/maramures-ways.txt data/maramures-ways.osm
```


---

## Krok 21. Wycięcie Maramureszu

**Wykonaj:**
```bash
osmium extract -p data/maramures-boundary.osm -s smart --set-bounds \
  --output-header=timestamp! --output-header=osmosis_replication_timestamp! \
  data/romania-261001.osm.pbf -o data/maramures-261001.osm.pbf
```
- `-p` – plik obrysu (krok 20),
- `-s smart` – obszary przecięte granicą (np. lasy) trafiają do pliku w całości; przy domyślnej strategii byłyby
  niekompletne i osm2pgsql by je pominął,
- `--set-bounds` – wpisuje do nagłówka prostokąt obrysu (jak w plikach z Geofabrik),
- `--output-header=...!` – kopiuje znaczniki czasu z nagłówka pliku Rumunii (domyślnie osmium ich nie przepisuje),
- trwa do minuty.

**Sprawdź po:**
```bash
osmium fileinfo -g header.boxes data/maramures-261001.osm.pbf
osmium fileinfo -e data/maramures-261001.osm.pbf | grep -E 'Bounding box:|timestamp=|Number of (nodes|ways|relations)'
ls -l data/maramures-261001.osm.pbf
md5sum data/maramures-261001.osm.pbf
```

**Wymagane:**
| komenda | musi pokazać |
|---|---|
| `header.boxes` | `(22.9614811,47.3206191,25.0564361,48.0217884)` |
| `timestamp=`, `osmosis_replication_timestamp=` | `2026-10-01T20:22:06Z` |
| `Bounding box:` (dane) | `(21.956811,45.60131,25.8310005,48.8891016)` |
| liczby | `nodes 1284605`, `ways 81862`, `relations 1788` |
| `ls -l` | `9136997` |
| `md5sum` | `4aab8436d5409509e1f03d3fb73d2707` |

ℹ️ Prostokąt danych jest większy niż obrys: długie obiekty (np. rzeki, duże obszary leśne), które mają choć jeden
punkt w okręgu, wchodzą do pliku w całości. Danych spoza okręgu jest niewiele (cały plik ma 9 MB).

ℹ️ md5 musi się zgadzać co do znaku – ta sama wersja osmium, ten sam plik Rumunii i ta sama komenda dają
identyczny plik.

❌ `No areas found`, `Invalid location` albo `Missing node` – obrys z kroku 20 jest błędny; zgłoś.

Plik obrysu nie jest już potrzebny (w razie potrzeby odtworzysz go krokiem 20):
```bash
rm data/maramures-boundary.osm
```


---

## Krok 22. Import trzech regionów do bazy

**Sprawdź przed:**
```bash
osmium fileinfo -e data/malopolskie-261001.osm.pbf | grep -E 'Number of (nodes|ways|relations)'
osmium fileinfo -e data/pomorskie-261001.osm.pbf | grep -E 'Number of (nodes|ways|relations)'
free -h
docker compose ps db
```
**Zamknij DBeaver** – otwarte połączenie czytające tabele OSM blokuje ich usunięcie i import zawiśnie.

**Wymagane:**
| komenda | musi pokazać |
|---|---|
| Małopolska | `nodes 24096182`, `ways 3142543`, `relations 30762` |
| pomorskie | `nodes 13102588`, `ways 1726298`, `relations 17261` |
| `free -h` | kolumna `available` co najmniej ok. **4Gi** |
| `docker compose ps db` | `Up ... (healthy)` |

Suma z trzech plików (z Maramureszem z kroku 21): **nodes 38483375, ways 4950703, relations 49811**.

**Wykonaj:**
```bash
time docker compose run --rm osm2pgsql -O flex -S /config/generic.lua \
  /data/malopolskie-261001.osm.pbf /data/pomorskie-261001.osm.pbf /data/maramures-261001.osm.pbf
```
Ta sama komenda co w kroku 10, z trzema plikami. Trwa ok. 2 minuty.

**Wymagane (końcówka wyniku):**
```
  Processed 38483375 nodes in ...
  Processed 4950703 ways in ...
  Processed 49774 relations in ...
...
osm2pgsql took ...s overall.
```
- `nodes` i `ways` = suma z trzech plików,
- `relations` o 37 mniej niż suma (49811) – obiekty obecne w kilku plikach (np. granica Polski) są zapisywane raz.

❌ Jakakolwiek linia z `ERROR` – zatrzymaj się i zgłoś.

### 22b. Sprawdź po

Te same komendy co w kroku 16:
```bash
docker compose exec db psql -U osm -d osm -P pager=off \
  -c "\dn" \
  -c "SELECT pg_size_pretty(pg_database_size('osm'));" \
  -c "SELECT property, value FROM osm2pgsql_properties ORDER BY 1;" \
  -c "SELECT (SELECT count(*) FROM points) AS points, (SELECT count(*) FROM lines) AS lines, (SELECT count(*) FROM polygons) AS polygons, (SELECT count(*) FROM routes) AS routes, (SELECT count(*) FROM boundaries) AS boundaries;" \
  -c "SELECT tags->>'name' AS nazwa FROM boundaries WHERE tags->>'admin_level' = '4' ORDER BY 1;" \
  -c "SELECT (SELECT count(*) FROM bdl.zanocuj_w_lesie) AS zanocuj, (SELECT count(*) FROM bdl.noclegi_powierzchniowe) AS powierzchniowe, (SELECT count(*) FROM bdl.noclegi_kubaturowe) AS kubaturowe;" \
  -c "SELECT wojewodztwo, count(*) AS punkty, count(*) FILTER (WHERE super) AS super FROM bdl.zanocuj_punkty GROUP BY 1;" \
  -c "SELECT zrodlo, count(*) FROM app.noclegi GROUP BY 1 ORDER BY 1;"
```

**Wymagane:**
| komenda | musi pokazać |
|---|---|
| `\dn` | bez zmian: `app`, `bdl`, `public`, `tiger`, `topology` |
| rozmiar bazy | ok. `2114 MB` |
| `osm2pgsql_properties` | 10 wierszy (bez `replication_*` – każdy plik ma inny adres aktualizacji; baza i tak nie jest aktualizowana przyrostowo), `import_timestamp 2026-10-01T20:18:59Z` |
| liczby OSM | `points 1714360`, `lines 1594542`, `polygons 3320749`, `routes 5429`, `boundaries 5818` |
| `admin_level = 4` | 22 nazwy: `Bistrița-Năsăud`, `Cluj`, `Maramureș`, `Metropolia katowicka`, `Prešovský kraj`, `Sălaj`, `Satu Mare`, `Suceava`, `województwo kujawsko-pomorskie`, `województwo małopolskie`, `województwo podkarpackie`, `województwo pomorskie`, `województwo śląskie`, `województwo świętokrzyskie`, `województwo warmińsko-mazurskie`, `województwo wielkopolskie`, `województwo zachodniopomorskie`, `Žilinský kraj`, `Закарпатська область`, `Івано-Франківська область`, `Калининградская область`, `Чернівецька область` |
| bdl | **bez zmian**: `1237`, `325`, `191` |
| zanocuj_punkty | **bez zmian**: `województwo małopolskie 309`, super `190` |
| noclegi | **bez zmian**: `lp 516`, `osm 3251`, `zanocuj 309` (stara kopia – odświeżamy w kroku 24) |

Trzy ostatnie wiersze potwierdzają, że import nie ruszył schematów `bdl` i `app`.

ℹ️ **Jeśli wcześniej zaimportowałeś całą Rumunię:** w `zanocuj_punkty` i `noclegi` zobaczysz swój stan sprzed
importu (np. także `województwo pomorskie 414`) – to normalne. `bdl` musi być bez zmian.
Sąsiednie regiony są w bazie, bo ich granice stykają się z naszymi; ich geometrie są niekompletne.

### 22c. Granice trzech regionów

Granice naszych regionów muszą być kompletne (krok 23 buduje z nich wielokąt). Test: powierzchnia z granicy.
```bash
docker compose exec db psql -U osm -d osm -P pager=off -c "SELECT tags->>'name' AS region, round(ST_Area(ST_Transform(ST_BuildArea(geom), 4326)::geography) / 1e6) AS km2 FROM boundaries WHERE tags->>'admin_level' = '4' AND tags->>'name' IN ('województwo małopolskie', 'województwo pomorskie', 'Maramureș') ORDER BY 1;"
```
- `ST_BuildArea` – składa linie granicy w wielokąt; `::geography` – powierzchnia na kuli ziemskiej w m²
  (EPSG:2180 obejmuje tylko Polskę).

**Wymagane:**
| region | km2 |
|---|---|
| `Maramureș` | `6304` |
| `województwo małopolskie` | `15184` |
| `województwo pomorskie` | `19545` |

ℹ️ Pomorskie wychodzi więcej niż oficjalne 18 323 km² – granica w OSM obejmuje też część wód zatoki.
Niekompletna granica dałaby wynik pusty albo mniejszy.


---

## Krok 23. Punkty „Zanocuj w lesie” – Małopolska i pomorskie

Skrypt z kroku 14, uruchomiony dla dwóch województw. Dla Maramureszu go nie uruchamiamy – dane LP i program
„Zanocuj w lesie” dotyczą tylko Polski.

**Sprawdź przed:**
```bash
docker compose exec db psql -U osm -d osm -P pager=off -c "SELECT count(*) FROM bdl.zanocuj_w_lesie;"
```
**Wymagane:** `1237`.

### 23a. Małopolska (test: wynik identyczny jak w kroku 14)

Dane Małopolski są te same co przed importem, więc wynik musi być identyczny – to dowód, że import trzech
plików niczego w Małopolsce nie zmienił.

**Wykonaj:**
```bash
docker compose exec -T db psql -U osm -d osm -v ON_ERROR_STOP=1 -f - < db/sql/zanocuj_punkty.sql
```

**Wymagane (końcówka wyniku):**
| tabelka | musi pokazać |
|---|---|
| `DELETE` / `INSERT` | `DELETE 309`, `INSERT 0 309` |
| podsumowanie | `województwo małopolskie`, `obszary 70`, `punkty 309`, `przy_sciezce 309`, `obszary_bez_sciezek 0`, `super 190`, `super_proc 61` |
| super punkty wg wody | `strumien 183`, `zbiornik 5`, `rzeka 2` |
| ostatnia linia | `COMMIT` |

❌ Inne liczby – zatrzymaj się i zgłoś.

### 23b. Pomorskie

**Wykonaj:**
```bash
docker compose exec -T db psql -U osm -d osm -v ON_ERROR_STOP=1 -v "wojewodztwo=województwo pomorskie" -f - < db/sql/zanocuj_punkty.sql
```

**Wymagane (końcówka wyniku):**
| tabelka | musi pokazać |
|---|---|
| `DELETE` / `INSERT` | `DELETE 0` (pierwsze liczenie), `INSERT 0 414` |
| podsumowanie | `województwo pomorskie`, `obszary 86`, `punkty 414`, `przy_sciezce 413`, `obszary_bez_sciezek 1`, `super 63`, `super_proc 15` |
| super punkty wg wody | `zbiornik 30`, `rzeka 21`, `strumien 12` |
| ostatnia linia | `COMMIT` |

ℹ️ Super punktów jest mniej niż w Małopolsce: Pomorze jest nizinne, przeważają jeziora, a górskich potoków brak.

ℹ️ Jeśli punkty pomorskie były już policzone wcześniej, zamiast `DELETE 0` zobaczysz `DELETE 414`.

**Sprawdź po:**
```bash
docker compose exec db psql -U osm -d osm -P pager=off -c "SELECT wojewodztwo, count(*) AS punkty, count(*) FILTER (WHERE super) AS super FROM bdl.zanocuj_punkty GROUP BY 1 ORDER BY 1;"
```

**Wymagane:**
| wojewodztwo | punkty | super |
|---|---|---|
| `województwo małopolskie` | `309` | `190` |
| `województwo pomorskie` | `414` | `63` |


---

## Krok 24. Wspólna tabela noclegów – przebudowa

Skrypt z kroku 15. Bierze noclegi z całej bazy (OSM, Lasy Państwowe, „Zanocuj w lesie”), usuwa duplikaty biwaków,
a na końcu usuwa noclegi leżące poza trzema regionami.

**Sprawdź przed:**
```bash
docker compose exec db psql -U osm -d osm -P pager=off -c "SELECT count(*) FROM bdl.zanocuj_punkty;"
```
**Wymagane:** `723` (309 + 414).

**Wykonaj:**
```bash
docker compose exec -T db psql -U osm -d osm -v ON_ERROR_STOP=1 -f - < db/sql/noclegi.sql
```

**Wymagane (końcówka wyniku):**
| tabelka | musi pokazać |
|---|---|
| `INSERT` / `DELETE` / `SELECT` | `INSERT 0 6721` (OSM), `INSERT 0 516` (LP), `DELETE 18` (duplikaty biwaków), `INSERT 0 723` (zanocuj), `SELECT 3` (obrysy trzech regionów), `DELETE 542` (noclegi spoza regionów) |
| podsumowanie | 11 wierszy; `lp`: `miejsce_biwakowe 61`, `kwatera 28`, `pole_namiotowe 1`; `osm`: `kwatera 4285`, `hotel 1594`, `pole_namiotowe 366`, `hostel 302`, `schronisko 46`, `chatka 21`, `miejsce_biwakowe 20`; `zanocuj`: `zanocuj_w_lesie 676` |
| ostatnia linia | `COMMIT` |

- `DELETE 18` – pole namiotowe albo miejsce biwakowe z OSM leżące bliżej niż 50 m od pola namiotowego albo miejsca
  biwakowego Lasów Państwowych jest usuwane jako duplikat (zostaje wpis Lasów),
- `DELETE 542` – noclegi poza województwem małopolskim, pomorskim i okręgiem Maramureș: dane Lasów Państwowych
  z reszty Polski, pas danych OSM za granicami regionów (pliki z Geofabrik mają zapas) i punkty „Zanocuj w lesie”
  z obszarów przecinających granicę województwa, leżące tuż za nią.

ℹ️ LP może się różnić o 1 (`INSERT 0 517`) – z tego samego powodu co w kroku 16; wtedy `DELETE 542` i liczby `lp`
mogą się różnić o 1.

**Sprawdź po – noclegi według regionów i w całej tabeli:**
```bash
docker compose exec db psql -U osm -d osm -P pager=off -c "WITH r AS MATERIALIZED (SELECT tags->>'name' AS region, ST_BuildArea(geom) AS g FROM boundaries WHERE tags->>'admin_level' = '4' AND tags->>'name' IN ('województwo małopolskie', 'województwo pomorskie', 'Maramureș')) SELECT r.region, n.zrodlo, count(*) FROM app.noclegi n JOIN r ON ST_Intersects(n.geom, r.g) GROUP BY 1, 2 ORDER BY 1, 2;"
docker compose exec db psql -U osm -d osm -P pager=off -c "SELECT zrodlo, count(*) FROM app.noclegi GROUP BY 1 ORDER BY 1;"
```
`MATERIALIZED` – wielokąty regionów są budowane raz, a nie osobno dla każdego noclegu.

**Wymagane:**
| region | zrodlo | count |
|---|---|---|
| `Maramureș` | `osm` | `293` |
| `województwo małopolskie` | `lp` | `31` |
| `województwo małopolskie` | `osm` | `3188` |
| `województwo małopolskie` | `zanocuj` | `296` |
| `województwo pomorskie` | `lp` | `59` |
| `województwo pomorskie` | `osm` | `3153` |
| `województwo pomorskie` | `zanocuj` | `380` |

Druga komenda (cała tabela): `lp 90`, `osm 6634`, `zanocuj 676` – to dokładnie sumy z regionów, czyli w `app.noclegi`
nie ma noclegów spoza regionów.

- Maramureș ma tylko `osm` (LP i „Zanocuj w lesie” to dane z Polski).


---

✅ **Dane gotowe.** W bazie są trzy regiony z danych OSM z 1.10.2026: Małopolska, pomorskie i okręg Maramureș.
Dalej: część 2 (mapa).

**Sprawdź na koniec:**
```bash
ls -l data
git status --short
```

**Wymagane:**
| komenda | musi pokazać |
|---|---|
| `ls -l data` | `bdl`, `kopia_bdl.dump`, `malopolskie-261001.osm.pbf` (+ `.md5`), `maramures-261001.osm.pbf`, `pomorskie-261001.osm.pbf` (+ `.md5`), `romania-261001.osm.pbf` (+ `.md5`) |
| `git status --short` | pusto |

ℹ️ `romania-261001.osm.pbf` na razie zostaw – usuwasz go w kroku 31, po zakończeniu części 2.
`kopia_bdl.dump` możesz zachować jako kopię zapasową albo usunąć (krok 31); nie zawiera punktów pomorskich z kroku 23.

ℹ️ Wyznaczanie tras we wszystkich trzech regionach wymaga pięciu kafli BRoutera – `docs/BROUTER.md`, krok 4.


---

# CZĘŚĆ 2. Lokalna mapa (kroki 25–31)

Kolejność: sprawdzenie plików mapy z repo → kafle (Planetiler) → obrysy regionów w bazie → Martin → test w przeglądarce.

**Co musi być spełnione przed tą częścią:**
- część 1 wykonana (krok 22c: trzy regiony, `6304`, `15184`, `19545`),
- działa tylko baza (`docker compose ps` – sam `trail-strider-db-1`),
- ok. 5 GB wolnego miejsca na dysku i dostęp do internetu (krok 26 pobiera ok. 1,4 GB danych dodatkowych).


---

## Krok 25. Pliki mapy z repozytorium

Folder `map/` jest w repozytorium: styl mapy, czcionki, ikonki i konfiguracja Martina. Niczego nie pobierasz –
sprawdzasz tylko, czy pliki są kompletne i niezmienione.

**Wykonaj:**
```bash
git ls-files map | wc -l
ls map map/sprites
ls -l map/fonts
sha256sum map/fonts/*
fc-scan --format "%{family[0]} | %{style[0]} | %{fontversion}\n" map/fonts/*.ttf
ls map/sprites/ofm | wc -l
sha256sum map/sprites/ofm/airport_11.svg
grep -n "openfreemap" map/styles/liberty.json
python3 -c "import json; s=json.load(open('map/styles/liberty.json')); print(list(s['sources']), s['sources']['openmaptiles']['url'], s['glyphs'], s['sprite'])"
python3 -c "import json; L=[l['id'] for l in json.load(open('map/styles/liberty.json'))['layers']]; i=L.index('region_mask'); print(len(L), L[i-1:i+3], L[-1])"
```
- `fc-scan` – odczytuje nazwę zapisaną wewnątrz pliku czcionki; pod tą nazwą Martin ją publikuje i tej nazwy szuka styl,
- `grep -n "openfreemap"` – w stylu nie może zostać żaden adres zewnętrzny,
- dwa skrypty Pythona – źródła danych w stylu, liczba warstw i miejsce warstw maski i obrysu regionu.

**Wymagane:**
| komenda | musi pokazać |
|---|---|
| `git ls-files map \| wc -l` | `271` |
| `ls map map/sprites` | `map`: `fonts  martin.yaml  sprites  styles`; `map/sprites`: `LICENSE.md  ofm` |
| `ls -l map/fonts` | `NotoSans-Bold.ttf` **838072**, `NotoSans-Italic.ttf` **845312**, `NotoSans-Regular.ttf` **825628**, `OFL.txt` **4374** |
| `sha256sum map/fonts/*` | sumy jak w bloku niżej |
| `fc-scan` | `Noto Sans \| Bold \| 132055`, `Noto Sans \| Italic \| 132055`, `Noto Sans \| Regular \| 132055` |
| `ls map/sprites/ofm \| wc -l` | `264` |
| `sha256sum ...airport_11.svg` | `3eb8c6ef7623297394c0c75789384f30a975227e7ad3ce8dab0c34aedbca3549` |
| `grep -n "openfreemap"` | nic |
| pierwszy `python3` | `['openmaptiles', 'map_mask', 'map_regions'] http://localhost:3000/malopolskie http://localhost:3000/font/{fontstack}/{range} http://localhost:3000/sprite/ofm` |
| drugi `python3` | `112 ['boundary_disputed', 'region_mask', 'region_outline', 'waterway_line_label'] label_country_1` |

Sumy czcionek:
```
3a08a47daa00cade516425c15c57615aef2fd418ec9811a7b9f465088f92cc05  map/fonts/NotoSans-Bold.ttf
126522ae1bb9cd92120287fc47dfc74ef981e73931d93e52c565fb7e09b2d74a  map/fonts/NotoSans-Italic.ttf
f5f552c8c5edb61fe6efb824baf4d4de47b1a8689ab4925ff43f7bd6a4ebece5  map/fonts/NotoSans-Regular.ttf
f2095b08bed08b23a6fe26112fcd679a2bee3f002eef077eb05d215ed1051bd8  map/fonts/OFL.txt
```

❌ Inne wartości albo `fc-scan: command not found` – zatrzymaj się i zgłoś.


---

## Krok 26. Kafle mapy (Planetiler)

**Planetiler** (program w Javie, uruchamiany z obrazu Dockera) zamienia plik PBF regionu na **kafle wektorowe**
w schemacie OpenMapTiles – tym samym, którego używa styl mapy – i zapisuje je do jednego pliku
`data/tiles/<region>.mbtiles`. Uruchamiamy go trzy razy, raz na region.

Przy pierwszym uruchomieniu Planetiler pobiera dane dodatkowe do widoków z daleka (obrysy mórz, Natural Earth,
linie do podpisów jezior; razem ok. 1,4 GB) do `data/sources/`. Kolejne uruchomienia korzystają z nich bez
pobierania. Wszystko leży w `data/`, więc nic nie trafia do gita.

### 26a. Sprawdź przed

```bash
docker compose ps
ls -ld data/tiles
free -h
df -h /
ls data
```

**Wymagane:**
| komenda | musi pokazać |
|---|---|
| `docker compose ps` | tylko `trail-strider-db-1` (bez `martin` i `frontend`) |
| `ls -ld data/tiles` | `No such file or directory` (folder jeszcze nie istnieje) |
| `free -h` | kolumna `available` przy `Mem:` co najmniej ok. **4Gi** (Planetiler dostaje do 4 GB, zużywa ok. 2,4 GB) |
| `df -h /` | `Avail` co najmniej **5G** |
| `ls data` | m.in. `malopolskie-261001.osm.pbf`, `maramures-261001.osm.pbf`, `pomorskie-261001.osm.pbf`; brak `tiles` i `sources` |

❌ `data/tiles` już istnieje, a jego właścicielem jest `root` – zatrzymaj się i zgłoś.

**Połączenie z serwerami danych dodatkowych** (Planetiler pobiera z nich pliki w 26c):
```bash
curl -sSIL --max-time 20 -o /dev/null -w "%{http_code}\n" https://osmdata.openstreetmap.de/download/water-polygons-split-3857.zip
curl -sSIL --max-time 20 -o /dev/null -w "%{http_code}\n" https://naciscdn.org/naturalearth/packages/natural_earth_vector.sqlite.zip
curl -sSIL --max-time 20 -o /dev/null -w "%{http_code}\n" https://github.com/acalcutt/osm-lakelines/releases/download/v12/lake_centerline.shp.zip
```

| fragment | znaczenie |
|---|---|
| `-I` | tylko nagłówki odpowiedzi, bez pobierania pliku |
| `-L` | podążaj za przekierowaniem (GitHub przekierowuje na inny serwer) |
| `-sS` | bez paska postępu, ale z komunikatem błędu |
| `--max-time 20` | przerwij po 20 s zamiast czekać bez końca |
| `-o /dev/null -w "%{http_code}\n"` | wypisz tylko kod odpowiedzi HTTP |

**Wymagane:** każda komenda wypisuje `200`.

❌ Przy `osmdata.openstreetmap.de` (obrysy mórz) pojawia się `curl: (7) Failed to connect …` albo `curl: (28) … timed out`
i `000` – Twój komputer nie łączy się z tym serwerem (zdarzyło się u dwóch osób). Nie uruchamiaj 26c, tylko skopiuj
plik od osoby, która już go ma:
1. Wrzuć `water-polygons-split-3857.zip` do `data/sources/` (nazwa musi być dokładnie taka; jeśli folderu nie ma:
   `mkdir -p data/sources`).
2. Sprawdź, czy plik nie uszkodził się po drodze:
   ```bash
   ls -l data/sources/water-polygons-split-3857.zip
   sha256sum data/sources/water-polygons-split-3857.zip
   ```
   Rozmiar i suma muszą być identyczne jak u osoby, od której kopiujesz. Plik autora instrukcji: `931892733`,
   `99619ac05f2d19771d522c868232b2a0373b86925d2c60fed9173bd31b7658e2`.
3. Dalej normalnie 26b i 26c. `--download` pobiera tylko brakujące pliki, więc obrysów mórz już nie pobiera.

❌ Brak połączenia z innym serwerem – tak samo: skopiuj odpowiedni plik (`natural_earth_vector.sqlite.zip` albo
`lake_centerline.shp.zip`) do `data/sources/` i porównaj `sha256sum` z osobą, od której kopiujesz.

ℹ️ Przy `available` ok. 2,9Gi (z wolnym swapem) 26c też przeszło, w 3:46.


### 26b. Obraz Planetilera i folder na kafle

**Wykonaj:**
```bash
docker pull ghcr.io/onthegomap/planetiler:0.10.2
docker image inspect --format '{{index .RepoDigests 0}}' ghcr.io/onthegomap/planetiler:0.10.2
mkdir -p data/tiles
ls -ld data/tiles
```
- `0.10.2` – wydanie stabilne; komendy niżej używają tagu razem ze skrótem `sha256`, więc każdy ma dokładnie
  ten sam obraz,
- `mkdir -p data/tiles` – folder na kafle tworzysz Ty, więc należy do Ciebie.

**Wymagane:**
| komenda | musi pokazać |
|---|---|
| `docker pull` | na końcu `Digest: sha256:cf32202dbc001a9ab4bc11534b642b13de3798179817da8558e567a3d13dd403` |
| `docker image inspect` | `ghcr.io/onthegomap/planetiler@sha256:cf32202dbc001a9ab4bc11534b642b13de3798179817da8558e567a3d13dd403` |
| `ls -ld data/tiles` | właściciel i grupa – Twoja nazwa użytkownika (nie `root`) |

### 26c. Małopolska

**Wykonaj:**
```bash
rm -rf data/tmp
time docker run --rm --user "$(id -u):$(id -g)" \
  -e JAVA_TOOL_OPTIONS="-Xmx4g" \
  -v "$(pwd)/data":/data \
  ghcr.io/onthegomap/planetiler:0.10.2@sha256:cf32202dbc001a9ab4bc11534b642b13de3798179817da8558e567a3d13dd403 \
  --download \
  --osm-path=/data/malopolskie-261001.osm.pbf \
  --output=/data/tiles/malopolskie.mbtiles \
  2>&1 | tee data/tiles/malopolskie.log
```

| fragment | znaczenie |
|---|---|
| `rm -rf data/tmp` | pliki robocze Planetilera z poprzedniego uruchomienia (po udanym przebiegu zostają puste foldery) |
| `--rm` | kontener usuwa się po zakończeniu – narzędzie jednorazowe, jak osm2pgsql |
| `--user "$(id -u):$(id -g)"` | kontener działa jako Ty, więc pliki wynikowe należą do Ciebie |
| `-Xmx4g` | do 4 GB pamięci dla Javy (szczyt u autora ok. 2,4 GB; 1 GB nie wystarcza) |
| `-v "$(pwd)/data":/data` | folder `data/` widoczny w kontenerze jako `/data` |
| `--download` | pobierz brakujące dane dodatkowe (tylko za pierwszym razem) |
| `--osm-path`, `--output` | plik wejściowy i plik wynikowy (końcówka `.mbtiles` wybiera format) |
| `2>&1 \| tee …log` | wynik na ekranie i jednocześnie w pliku `.log` |

Trwa ok. 3,5 minuty (u autora 3:31, w tym ok. 2 minut pobierania).

**Sprawdź po:**
```bash
grep -E "OutOfMemory|ERROR|Exception" data/tiles/malopolskie.log
grep "Downloading https" data/tiles/malopolskie.log
grep "FINISHED" data/tiles/malopolskie.log
ls -lh data/tiles data/sources
python3 -c "
import sqlite3, json
c = sqlite3.connect('data/tiles/malopolskie.mbtiles')
m = dict(c.execute('select name, value from metadata'))
print(m['bounds'], m['minzoom'], m['maxzoom'], m['planetiler:osm:osmosisreplicationtime'])
print(len(json.loads(m['json'])['vector_layers']), 'warstw')
print(c.execute('select count(*) from tiles').fetchone()[0], 'kafli')
"
```
Skrypt Pythona zagląda do pliku MBTiles (to baza SQLite): obszar (`bounds`), zakres zoomów, datę danych OSM,
liczbę warstw i liczbę kafli.

**Wymagane:**
| komenda | musi pokazać |
|---|---|
| pierwszy `grep` | nic |
| `grep "Downloading https"` | kilka linii – pobieranie danych dodatkowych |
| `grep "FINISHED"` | linia z `FINISHED!` |
| `ls -lh` | `malopolskie.mbtiles` ok. **152M** i `malopolskie.log`; w `data/sources` 3 pliki `.zip` (razem ok. 1,4 GB) |
| Python | `18.87522,49.02835,21.43328,50.53221 0 14 2026-10-01T20:22:06Z`, `16 warstw`, `11292 kafli` |

ℹ️ Ostrzeżenia `WAR` w logu są w porządku: `No GB polygon for inferring route network types` (reguła tylko dla
Wielkiej Brytanii) oraz `Unable to form closed polygon for OSM relation 49715` / `14296` (granice Polski
i Słowacji są w pliku województwa tylko we fragmentach; linie granic i tak trafiają do kafli). Statystyka
`data errors` w podsumowaniu to automatycznie naprawione albo pominięte geometrie – też w porządku.

❌ `OutOfMemoryError`, `ERROR` albo `Exception` – zatrzymaj się i zgłoś (dołącz ok. 30 linii logu wokół błędu).

⚠️ Po nieudanym uruchomieniu **nie uruchamiaj 26c ponownie przed zgłoszeniem**. `tee` nadpisuje
`malopolskie.log` przy każdym uruchomieniu, a druga próba i tak kończy się `already exists` (niżej), więc przyczyna
z pierwszej przepada.

❌ `already exists, use the --force argument to overwrite` – w `data/tiles` został pusty plik `.mbtiles` (0 B)
po wcześniejszej, nieudanej próbie. Usuń pozostałości:
```bash
rm -f data/tiles/malopolskie.mbtiles
rm -rf data/tmp
```
Potem wróć do testu połączenia (`curl`) z 26a. Jeśli wszystko daje `200`, uruchom 26c jeszcze raz, a przy kolejnym
błędzie zgłoś cały `malopolskie.log`.

❌ Log kończy się nagle, bez `FINISHED!` i bez `Exception` – prawdopodobnie systemowi zabrakło RAM-u i zabił proces.
Sprawdź:
```bash
journalctl -k | grep -i "killed process"
```
Jeśli jest tam `java`, zamknij ciężkie programy (przeglądarka, Discord), sprawdź `free -h`, usuń pozostałości jak
wyżej i uruchom ponownie.

ℹ️ Jeśli obrysy mórz zostały skopiowane w 26a, `grep "Downloading https"` pokaże tylko Natural Earth
i `lake_centerline` – to w porządku.

ℹ️ Powyższe dotyczy też 26d i 26e – podmień `malopolskie` na `pomorskie` albo `maramures`.

### 26d. Pomorskie

**Wykonaj:**
```bash
rm -rf data/tmp
time docker run --rm --user "$(id -u):$(id -g)" \
  -e JAVA_TOOL_OPTIONS="-Xmx4g" \
  -v "$(pwd)/data":/data \
  ghcr.io/onthegomap/planetiler:0.10.2@sha256:cf32202dbc001a9ab4bc11534b642b13de3798179817da8558e567a3d13dd403 \
  --download \
  --osm-path=/data/pomorskie-261001.osm.pbf \
  --output=/data/tiles/pomorskie.mbtiles \
  2>&1 | tee data/tiles/pomorskie.log
```
Różnią się tylko `--osm-path`, `--output` i nazwa logu. Trwa ok. 1 minuty.

**Sprawdź po:**
```bash
grep -E "OutOfMemory|ERROR|Exception" data/tiles/pomorskie.log
grep "Downloading https" data/tiles/pomorskie.log
grep "FINISHED" data/tiles/pomorskie.log
ls -lh data/tiles
python3 -c "
import sqlite3, json
c = sqlite3.connect('data/tiles/pomorskie.mbtiles')
m = dict(c.execute('select name, value from metadata'))
print(m['bounds'], m['minzoom'], m['maxzoom'], m['planetiler:osm:osmosisreplicationtime'])
print(len(json.loads(m['json'])['vector_layers']), 'warstw')
print(c.execute('select count(*) from tiles').fetchone()[0], 'kafli')
"
```

**Wymagane:**
| komenda | musi pokazać |
|---|---|
| pierwszy i drugi `grep` | nic (dane dodatkowe użyte ponownie, bez pobierania) |
| `grep "FINISHED"` | linia z `FINISHED!` |
| `ls -lh` | dochodzi `pomorskie.mbtiles` ok. **106M** i `pomorskie.log` |
| Python | `16.68672,53.4806,19.66069,55.08543 0 14 2026-10-01T20:22:06Z`, `16 warstw`, `21287 kafli` |

ℹ️ Ostrzeżenia `WAR` jak w 26c; tu relacje `49715` (Polska) i `60189` (Rosja – granica na Mierzei Wiślanej).
Kafli jest więcej niż w Małopolsce, bo prostokąt regionu obejmuje też kawałek Bałtyku.

### 26e. Maramureș

**Wykonaj:**
```bash
rm -rf data/tmp
time docker run --rm --user "$(id -u):$(id -g)" \
  -e JAVA_TOOL_OPTIONS="-Xmx4g" \
  -v "$(pwd)/data":/data \
  ghcr.io/onthegomap/planetiler:0.10.2@sha256:cf32202dbc001a9ab4bc11534b642b13de3798179817da8558e567a3d13dd403 \
  --download \
  --osm-path=/data/maramures-261001.osm.pbf \
  --output=/data/tiles/maramures.mbtiles \
  2>&1 | tee data/tiles/maramures.log
```
Trwa ok. 45 sekund.

**Sprawdź po:**
```bash
grep -E "OutOfMemory|ERROR|Exception" data/tiles/maramures.log
grep "Downloading https" data/tiles/maramures.log
grep "FINISHED" data/tiles/maramures.log
python3 -c "
import sqlite3, json
c = sqlite3.connect('data/tiles/maramures.mbtiles')
m = dict(c.execute('select name, value from metadata'))
print(m['bounds'], m['minzoom'], m['maxzoom'], m['planetiler:osm:osmosisreplicationtime'])
print(len(json.loads(m['json'])['vector_layers']), 'warstw')
print(c.execute('select count(*) from tiles').fetchone()[0], 'kafli')
"
rm -rf data/tmp
ls -lh data/tiles
```

**Wymagane:**
| komenda | musi pokazać |
|---|---|
| pierwszy i drugi `grep` | nic |
| `grep "FINISHED"` | linia z `FINISHED!` |
| Python | `22.96148,47.32062,25.05644,48.02179 0 14 2026-10-01T20:22:06Z`, `16 warstw`, `4856 kafli` |
| `ls -lh data/tiles` | `malopolskie.mbtiles` ok. 152M, `maramures.mbtiles` ok. 17M, `pomorskie.mbtiles` ok. 106M i trzy pliki `.log` |

ℹ️ `bounds` Maramureșu to prostokąt obrysu okręgu z kroku 21 (`--set-bounds`). Ostrzeżenia `WAR` jak w 26c;
tu relacje `90689` (Rumunia) i `60199` (Ukraina).


---

## Krok 27. Obrysy regionów i maska (`db/sql/map_regions.sql`)

Skrypt tworzy w schemacie `app` dwie tabele, z których Martin robi kafle:
- `app.map_regions` – obrysy trzech regionów (wielokąty złożone z linii granic w tabeli `boundaries`),
- `app.map_mask` – „cały świat bez trzech regionów”.

Na mapie maska zakrywa wszystko poza regionem, a obrys rysuje jego granicę. Jedna maska wystarcza dla wszystkich
regionów, bo widok jest zawsze ograniczony do jednego z nich.

**Sprawdź przed:**
```bash
docker compose ps db
```
**Wymagane:** `trail-strider-db-1`, status `Up ... (healthy)`; krok 22c dał trzy regiony.

**Wykonaj:**
```bash
docker compose exec -T db psql -U osm -d osm -v ON_ERROR_STOP=1 -f - < db/sql/map_regions.sql
```
Całość jest jedną transakcją: przy błędzie baza zostaje bez zmian.

**Wymagane (cały wynik):**
```
BEGIN
CREATE SCHEMA
psql:<stdin>:7: NOTICE:  schema "app" already exists, skipping
DROP TABLE
psql:<stdin>:10: NOTICE:  table "map_regions" does not exist, skipping
SELECT 3
DROP TABLE
psql:<stdin>:20: NOTICE:  table "map_mask" does not exist, skipping
SELECT 1
CREATE INDEX
CREATE INDEX
   id   |          name           |  km2
--------+-------------------------+-------
  72481 | Maramureș               |  6304
 130975 | województwo pomorskie   | 19545
 224459 | województwo małopolskie | 15184
(3 rows)

 parts | holes
-------+-------
     1 |     3
(1 row)

COMMIT
```
- trzy regiony z tymi samymi powierzchniami co w kroku 22c,
- `parts 1`, `holes 3` – maska to jeden wielokąt świata z trzema otworami,
- komunikaty `NOTICE` są normalne.

❌ `ROLLBACK` albo `ERROR` – zatrzymaj się i zgłoś.


---

## Krok 28. Serwer kafli Martin

**Martin** (serwer kafli od twórców MapLibre) to usługa `martin` w `compose.yaml`; jego konfiguracja to
`map/martin.yaml`. Podaje przeglądarce:
- kafle z plików `data/tiles/*.mbtiles` – źródła `malopolskie`, `pomorskie`, `maramures` (nazwa = nazwa pliku),
- kafle z tabel `app.map_mask` i `app.map_regions` (tylko tych – reszta bazy nie jest publikowana),
- czcionki, ikonki (zestaw `ofm`) i styl mapy (`liberty`).

Port `127.0.0.1:3000` – dostępny tylko z tego komputera. Hasło do bazy Martin dostaje ze zmiennej ustawianej
w `compose.yaml` z wartości w `.env`, więc nie ma go w żadnym pliku w repozytorium.

**Sprawdź przed:**
```bash
ls data/tiles
ss -ltn | grep ':3000'
grep -cE '^POSTGRES_PASSWORD=[A-Za-z0-9._~-]+$' .env
docker compose config --quiet && echo "compose OK"
docker compose config --services
```

**Wymagane:**
| komenda | musi pokazać |
|---|---|
| `ls data/tiles` | `malopolskie.log  malopolskie.mbtiles  maramures.log  maramures.mbtiles  pomorskie.log  pomorskie.mbtiles` |
| `ss -ltn \| grep ':3000'` | nic (port 3000 wolny) |
| `grep -cE ... .env` | `1` – hasło ma tylko znaki bezpieczne w adresie połączenia z bazą |
| `docker compose config --quiet` | `compose OK` |
| `docker compose config --services` | `db`, `brouter`, `routing`, `backend`, `frontend`, `martin` |

❌ `grep -cE` pokazuje `0` – hasło zawiera znaki (np. `@ : / ?`), które psują adres połączenia. Zatrzymaj się
i zgłoś (**nie wklejaj hasła**).

**Wykonaj:**
```bash
docker compose up -d frontend
```
`frontend` zależy od `backend` i `martin`, więc ta komenda uruchamia wszystkie usługi aplikacji: bazę, BRouter,
routing, backend, Martina i frontend. Za pierwszym razem Docker pobierze obraz Martina. Frontend startuje dopiero,
gdy Martin jest gotowy (`Healthy`, u autora ok. 30 s).

**Sprawdź po:**
```bash
docker compose ps
docker compose logs martin | grep -E "WARN|ERROR|Using|Connected|Published|Added source|now active"
curl -s localhost:3000/catalog | python3 -c "import json,sys; print(sorted(json.load(sys.stdin)['tiles']))"
curl -s localhost:3000/map_mask | python3 -c "import json,sys; print(json.load(sys.stdin)['bounds'])"
for u in malopolskie malopolskie/11/1137/695 "font/Noto%20Sans%20Regular/256-511" sprite/ofm.json sprite/ofm.png "sprite/ofm@2x.png" style/liberty map_regions map_mask/8/142/86 map_regions/8/142/86; do
  curl -s -o /dev/null -w "%{http_code}  %{content_type}  %{size_download} B  $u\n" "http://localhost:3000/$u"
done
```
- `/catalog` – spis wszystkiego, co Martin udostępnia; skrypt wypisuje źródła kafli,
- pętla odpytuje każdy rodzaj adresu i wypisuje kod odpowiedzi, typ i rozmiar (treść jest pomijana).

**Wymagane:**
| komenda | musi pokazać |
|---|---|
| `docker compose ps` | 6 usług `Up`; `db`, `routing`, `backend` i `martin` z `(healthy)`; Martin z portem `127.0.0.1:3000->3000/tcp` (przez pierwsze ok. 30 s `health: starting`) |
| logi Martina | `Using /map/martin.yaml`; `Added source` dla `malopolskie`, `maramures`, `pomorskie`; `Connected to PostgreSQL/PostGIS ... postgis.version=3.6.4`; `Published source` dla `map_mask` i `map_regions`; `Added source` dla `map_mask` i `map_regions`; `Martin server is now active`. **Żadnej** linii z `WARN` ani `ERROR` |
| katalog | `['malopolskie', 'map_mask', 'map_regions', 'maramures', 'pomorskie']` |
| `bounds` maski | `[-180.0, -85.0511, 180.0, 85.0511]` |
| pętla | wszędzie `200`, typy i rozmiary jak w tabeli niżej (rozmiary orientacyjne, żaden nie może być zerowy) |

| adres | co to | typ | u autora |
|---|---|---|---|
| `malopolskie` | opis źródła (TileJSON) | `application/json` | 7814 B |
| `malopolskie/11/1137/695` | kafel z Krakowem | `application/x-protobuf` | 71531 B |
| `font/Noto%20Sans%20Regular/256-511` | znaki z `ą ę ł ś ż` | `application/x-protobuf` | 137913 B |
| `sprite/ofm.json`, `ofm.png`, `ofm@2x.png` | spis ikonek i obrazki | `application/json`, `image/png`, `image/png` | 17905, 35697, 90858 B |
| `style/liberty` | styl mapy | `application/json` | – |
| `map_regions` | opis źródła obrysów | `application/json` | 286 B |
| `map_mask/8/142/86`, `map_regions/8/142/86` | kafle maski i obrysu przy Krakowie | `application/x-protobuf` | 4800, 4836 B |

ℹ️ Przy kolejnych uruchomieniach Martina linie w `docker compose logs martin` się powtarzają – to normalne.

❌ Martin nie jest `healthy`, w logach `ERROR`/`WARN` albo któryś adres nie zwraca `200` – zatrzymaj się i zgłoś
(dołącz `docker compose logs martin`).


---

## Krok 29. Mapa w aplikacji

Frontend (kod w repozytorium) pobiera styl i kafle z Martina pod adresem `http://localhost:3000` i ogranicza
widok do wybranego regionu. **Plik `frontend/.env.local` nie jest do tego potrzebny** – adres Martina jest
wpisany w kodzie jako domyślny; zmienna `VITE_MARTIN_URL` w `.env.local` służy tylko do jego zmiany.

### 29a. Małopolska

**Wykonaj (przeglądarka):**
1. Otwórz `http://localhost:5173`, naciśnij **F12**, zakładka **Network**.
2. Zaznacz **Disable Cache**, wyczyść pole filtra i odśwież stronę: `Ctrl+Shift+R`.
3. Przybliżaj, oddalaj i przesuwaj mapę.

**Wymagane:**
| co | musi być |
|---|---|
| mapa | cała Małopolska pod paskiem wyszukiwania; poza województwem jednolite tło (maska), na granicy zielona linia |
| oddalanie | najdalej do widoku całego województwa – dalej się nie da i nie da się wyjechać poza region |
| Network, kolumna **Domain** | wyłącznie `localhost:5173` (aplikacja) i `localhost:3000` (Martin) |
| Network, filtr `openfreemap` | pusto |
| Network, kolumna **File** | m.in. `liberty` (styl), `malopolskie` (opis źródła), liczby (kafle – kolumna pokazuje tylko ostatni fragment adresu), `0-255` i `256-511` (czcionki), `ofm.json`, `ofm.png` (ikonki), `map_mask`, `map_regions` |
| przycisk ⓘ w prawym dolnym rogu mapy | `© OpenMapTiles © OpenStreetMap contributors` |

ℹ️ To nie są błędy:
- czerwone wiersze `NS_BINDING_ABORTED` – MapLibre anuluje pobieranie kafli, które przy przesuwaniu przestały być potrzebne,
- status `204` przy kaflach `map_mask` i `map_regions` – pusty kafel (np. wnętrze regionu), `304` – kafel z pamięci przeglądarki,
- w konsoli (zakładka **Console**): `Image "gate"/"office"/"atm" could not be loaded` (tych ikonek nie ma też
  w oryginalnym zestawie OpenFreeMap), ostrzeżenia `highway-shield… Expected … number, but found null`,
  jednorazowe `WebGL context was lost` i `Max vertices per segment is 65535` – mapa rysuje się mimo nich poprawnie.

### 29b. Pomorskie i Maramureș (test)

Region wybiera się w kodzie frontu (wybór w interfejsie zrobi zespół frontu). Do testu zmieniasz tymczasowo
jedną wartość.

**Wykonaj:**
```bash
grep -n 'regionId=' frontend/src/App.tsx
```
1. W wypisanej linii `frontend/src/App.tsx` zmień `regionId="malopolskie"` na `regionId="pomorskie"` i zapisz plik.
   Vite przeładuje stronę sam (w razie potrzeby `Ctrl+Shift+R`).
2. Obejrzyj mapę, potem to samo z `regionId="maramures"`.
3. **Przywróć `regionId="malopolskie"`** i zapisz.

**Wymagane:**
| region | musi być |
|---|---|
| pomorskie | całe województwo z Zatoką Gdańską i Helem; w Network kafle `localhost:3000/pomorskie/…` |
| Maramureș | cały okręg; nazwy z rumuńskimi znakami (np. `Vișeu de Sus`, `Săpânța`); kafle `localhost:3000/maramures/…` |
| konsola | brak błędów zaczynających się od `Region:` |

**Sprawdź po (po przywróceniu Małopolski):**
```bash
grep -n 'regionId=' frontend/src/App.tsx
git status --short
```
**Wymagane:** linia z `regionId="malopolskie"`; `git status --short` – pusto (zmiany testowej nie commitujemy).


---

## Krok 30. Test bez internetu

**Wykonaj:**
1. Wyłącz Wi-Fi (i kabel sieciowy, jeśli jest). Kontenery działają lokalnie, więc wyłączenie sieci ich nie dotyczy.
2. W zakładce Network kliknij kosz (wyczyszczenie listy) i odśwież stronę: `Ctrl+Shift+R`.
3. Poprzesuwaj i poprzybliżaj mapę.
4. W polu filtra wpisz `-domain:localhost` (minus = „wszystko **oprócz** localhost”).
5. Włącz z powrotem Wi-Fi.

**Wymagane:**
| co | musi być |
|---|---|
| mapa bez Wi-Fi | wyświetla się jak w kroku 29: kafle, napisy z polskimi znakami, ikonki |
| filtr `-domain:localhost` bez Wi-Fi | **pusta lista** – nic nie wyszło poza Twój komputer |

ℹ️ Przy włączonym Wi-Fi ten filtr może pokazać kilka wierszy `data:image/svg+xml…` – to obrazki zapisane
w kodzie strony (przyciski mapy): bez domeny, bez nagłówków, `0 B` transferu. To nie są zapytania do internetu.


---

## Krok 31. Sprzątanie

**Sprawdź przed:**
```bash
ls data
```

**Wykonaj:**
```bash
rm -rf data/tmp
rm -f data/romania-261001.osm.pbf data/romania-261001.osm.pbf.md5
```
Opcjonalnie:
```bash
rm -f data/kopia_bdl.dump
rm -f data/tiles/*.log
```

| plik | dlaczego można usunąć |
|---|---|
| `data/tmp` | puste foldery robocze Planetilera |
| `romania-261001.osm.pbf` (+ `.md5`) | potrzebny tylko do wycięcia Maramureșu (kroki 20–21). Ponowne wycięcie wymagałoby pobrania go z Geofabrik (329 MB), o ile plik z tą datą będzie jeszcze dostępny |
| `kopia_bdl.dump` (opcjonalnie) | kopia z kroku 17; import się udał, a `bdl` jest bez zmian |
| `data/tiles/*.log` (opcjonalnie) | zapis przebiegu Planetilera; mapa ich nie potrzebuje (Martin je pomija) |

**Nie usuwaj:** plików `*-261001.osm.pbf` trzech regionów (import do bazy i kafle), `data/tiles/*.mbtiles`
(mapa), `data/sources/` i `data/tile_weights.tsv.gz` (ponowne generowanie kafli bez pobierania), `data/bdl/`.

**Sprawdź po:**
```bash
ls data
git status --short
```

**Wymagane:**
| komenda | musi pokazać |
|---|---|
| `ls data` | `bdl`, `malopolskie-261001.osm.pbf`, `malopolskie-261001.osm.pbf.md5`, `maramures-261001.osm.pbf`, `pomorskie-261001.osm.pbf`, `pomorskie-261001.osm.pbf.md5`, `sources`, `tile_weights.tsv.gz`, `tiles` (oraz `kopia_bdl.dump`, jeśli go zostawiłeś) |
| `git status --short` | pusto |

✅ **Gotowe.** Baza ma trzy regiony, a mapa w aplikacji działa lokalnie, bez internetu.


---

## Codzienna praca

```bash
cd ~/Trail-Strider
docker compose up -d frontend    # aplikacja z mapą: uruchamia też bazę, BRouter, routing, backend i Martina
```
Aplikacja: `http://localhost:5173`. Koniec pracy: `docker compose stop`.


---

## Znane ograniczenia (stan na 3.11.2026)

- Widać napisy i ikonki części obiektów spoza regionu: pliki Małopolski i Pomorza z Geofabrik zawierają pas
  terenu za granicą województwa, a napisy są rysowane nad maską.
- Część nazw jest po angielsku (np. `Krakow`) – styl wybiera najpierw nazwę angielską (`name_en`).
- Ostrzeżenia w konsoli przeglądarki z kroku 29a.
- Trasy z BRoutera nie są ograniczone do regionu.


---

## Jak to działa

### Schemat

```
DANE (data/, poza gitem)              BAZA (usługa db)                 MARTIN (localhost:3000)           PRZEGLĄDARKA
<region>-261001.osm.pbf ──Planetiler──► data/tiles/<region>.mbtiles ──► /<region>/{z}/{x}/{y} ─────┐
         │                                                                                          │
         └──osm2pgsql──► boundaries ──map_regions.sql──► app.map_regions ──► /map_regions/… ───────┤   MapLibre
                                                         app.map_mask    ──► /map_mask/… ──────────┼─► (frontend)
REPOZYTORIUM (map/)                                                                                 │
styles/liberty.json, fonts/*.ttf, sprites/ofm/*.svg ──────────────► /style/liberty, /font/…, /sprite/ofm ─┘
```

1. Przeglądarka pobiera **styl** (`/style/liberty`) – plik JSON z regułami rysowania i adresami źródeł danych.
2. Dla każdego źródła pobiera raz jego **opis (TileJSON)**, np. `/malopolskie`: wzór adresu kafli, zakres
   zoomów i obszar (`bounds`).
3. Pobiera tylko **kafle** widocznego obszaru (`/malopolskie/z/x/y`) oraz czcionki i ikonki.
4. Rysuje warstwy po kolei. Maska i obrys regionu są rysowane po liniach granic, a przed napisami, więc napisy
   nie są ucinane przez maskę.

### Elementy

| element | rola |
|---|---|
| **kafel** | kwadratowy wycinek mapy o adresie `z/x/y` (zoom, kolumna, wiersz). Kafle są **wektorowe**: zawierają geometrię i atrybuty obiektów, a rysuje je przeglądarka według stylu |
| **Planetiler** | zamienia PBF regionu na kafle w schemacie **OpenMapTiles** (16 warstw, np. `transportation`, `landcover`, `water`, `place`; zoom 0–14). Kafle powstają dla prostokąta regionu z nagłówka PBF. Do widoków z daleka dokłada dane dodatkowe z `data/sources/` |
| **MBTiles** | jeden plik z kaflami regionu (w środku baza SQLite: opis + kafle) |
| **Martin** | serwer kafli. Pliki `.mbtiles` podaje tak, jak są; kafle z tabel bazy tworzy na bieżąco zapytaniem SQL; czcionki (`.ttf`) i ikonki (`.svg`) składa w formaty, których potrzebuje przeglądarka. Publikuje tylko to, co jest w `map/martin.yaml` |
| **styl** (`map/styles/liberty.json`) | styl Liberty z OpenFreeMap; zmienione: adresy źródeł na `localhost:3000`, usunięte cieniowanie terenu z serwera OpenFreeMap, dodane warstwy `region_mask` (maska) i `region_outline` (obrys) |
| **maska i obrys** | tabele z kroku 27. `bounds` maski są wpisane ręcznie w `map/martin.yaml`: maska sięga krawędzi świata, a liczone automatycznie wychodzą odwrócone (zawinięcie długości geograficznej przy 180°) i przeglądarka nie pobierałaby kafli maski |
| **frontend** | po wyborze regionu pobiera jego TileJSON z Martina, ustawia widok na cały region (z marginesem na nagłówek), blokuje widok do tego obszaru i podmienia w stylu źródło kafli na wybrany region. Maska i obrys są wspólne dla wszystkich regionów |

### Zmiany w plikach mapy

- **styl** (`map/styles/liberty.json`): zapisz plik i odśwież przeglądarkę (`Ctrl+Shift+R`) – Martin czyta styl
  przy każdym zapytaniu, restart nie jest potrzebny,
- **konfiguracja Martina** (`map/martin.yaml`): `docker compose restart martin` – plik jest czytany tylko przy starcie.

### Pliki w repozytorium

| plik | rola |
|---|---|
| `compose.yaml` | usługa `martin` (obraz, port, foldery tylko do odczytu, adres bazy); frontend zależy od Martina |
| `map/martin.yaml` | co Martin publikuje |
| `map/styles/liberty.json` | styl mapy |
| `map/fonts/` | Noto Sans Regular, Bold, Italic (wersja 2.015) + licencja `OFL.txt` |
| `map/sprites/ofm/` | 264 ikonki SVG zestawu OpenFreeMap; licencje w `map/sprites/LICENSE.md` |
| `db/sql/map_regions.sql` | obrysy regionów i maska (krok 27) |
| `frontend/src/components/map/Regions.ts` | lista regionów i adres Martina |
| `frontend/src/components/map/MapView.tsx`, `frontend/src/App.tsx` | wyświetlanie regionu i ograniczenie widoku (zmiany oznaczone komentarzem `[mapa-regiony]`) |

### Wersje

| narzędzie / dane | wersja |
|---|---|
| Planetiler | `ghcr.io/onthegomap/planetiler:0.10.2@sha256:cf32202dbc001a9ab4bc11534b642b13de3798179817da8558e567a3d13dd403` |
| Martin | `ghcr.io/maplibre/martin:1.16.1@sha256:59902019bf9038926ff0c71174237d6852e64c457830a6349abe7090be8818ca` |
| osmium-tool | `1.16.0-1build1` (Ubuntu 24.04) |
| MapLibre GL JS (frontend) | `6.14.0` |
| dane OSM | Geofabrik, `261001` (stan z 1.10.2026) |
| czcionki Noto Sans | 2.015, repozytorium `notofonts/notofonts.github.io`, commit `5c82cef0a8f08806f932062e18c02be62be278f0` |
| ikonki i styl | repozytorium `hyperknot/openfreemap-styles`, commit `006ea5796803ba2df4330888836cb0a8f17473b4` |

### Licencje

| element | licencja |
|---|---|
| dane OpenStreetMap | ODbL 1.0 – wymagany dopisek `© OpenStreetMap contributors` |
| schemat OpenMapTiles (kafle z Planetilera) | kod BSD 3-Clause, projekt CC BY 4.0 – wymagany dopisek `© OpenMapTiles` |
| Planetiler | Apache 2.0 |
| Martin | Apache 2.0 / MIT |
| MapLibre GL JS | BSD 3-Clause |
| osmium-tool | GPL 3.0 |
| styl Liberty | kod BSD 3-Clause, projekt CC BY 4.0; repozytorium openfreemap-styles – MIT |
| czcionki Noto Sans | SIL Open Font License 1.1 (`map/fonts/OFL.txt`) |
| ikonki (Maki) | CC0 1.0 |
| Natural Earth | domena publiczna |

Oba wymagane dopiski wyświetla mapa pod przyciskiem ⓘ (krok 29a).
