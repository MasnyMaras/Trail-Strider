# Notatki dla mnie (nie dla zespołu) (występują nieakutalne informacje, kierowac sie SETUP.md, to jest tylko uzupelniajace)jakis shit, moze sie przydac info o korzystaniu z dockera, jakies pojęcia itd

## Co już mam (stan na 06.10.2026)
- Ubuntu 24.04, jądro **6.14.0-35** (celowo, patrz niżej)
- Docker Engine 29.8 + Docker Compose v5 (oficjalne repo apt Dockera)
- Repo `~/zsd2-osm-test` (lokalny git, gałąź `main`)
- Baza PostgreSQL 18 + PostGIS 3.6 w kontenerze, dane w wolumenie `zsd2-osm-test_pgdata`

---

## Historia: co się stało i dlaczego

### 1. Awaria jądra przy `apt upgrade`
- Upgrade ściągnął nowe jądro **7.0**. Mój moduł `huawei-matebook-audio-fix` (DKMS, poprawka dźwięku)
  nie skompilował się pod 7.0 → instalacja jądra przerwana → dpkg w stanie "niedokończonym".
- Naprawa: usunąłem wszystkie pakiety `7.0.0-38` + metapakiety `linux-*-hwe-24.04`.
- Skutek: zostaję na 6.14 (dźwięk działa), ale **jądro nie dostaje już łatek**.
- TODO: gdy poprawka dźwięku będzie działać na 7.0 → wrócić do HWE (`sudo apt install linux-generic-hwe-24.04`).
- NIE robić `sudo apt autoremove` bez czytania listy.
- Przy upgrade bez `-y` — najpierw czytam, co apt chce zrobić.
- Upgrade do Ubuntu 26.04 — odmówiłem, nie w trakcie projektu.

### 2. Instalacja Dockera
- Z oficjalnego repo Dockera (nie snap, nie `docker.io` z Ubuntu) — tak samo jak na serwerze.
- Dodałem się do grupy `docker` → `docker` bez `sudo`.
  Uwaga: grupa docker = praktycznie uprawnienia roota. Na swoim laptopie OK.

### 3. Repo + baza
- Commit 1: `.gitignore`, `.gitattributes`, `README.md`
- Commit 2: `compose.yaml` (usługa bazy), `.env.example`

---

## Pojęcia
- **obraz (image)** — szablon tylko do odczytu, np. `postgis/postgis:18-3.6`
- **kontener** — uruchomiona instancja obrazu; po usunięciu znika wszystko w środku
- **wolumen (volume)** — trwałe dane poza kontenerem (tu: pliki bazy); przeżywa usunięcie kontenera
- **daemon `dockerd`** — działa w tle jako root, robi całą robotę; `docker` to tylko pilot
- **Compose** — całe środowisko opisane w `compose.yaml`, sterowane `docker compose ...`
- **`.env`** — moje prawdziwe hasła; Compose sam go czyta i podstawia za `${...}` w `compose.yaml`.
  NIE idzie do gita. `.env.example` = wzór dla innych, idzie do gita.
- **`127.0.0.1:5432:5432`** — baza dostępna tylko z mojego komputera (bez tego Docker
  wystawia port na całą sieć, omijając firewall ufw!)
- **PG 18+**: dane w `/var/lib/postgresql` (stare poradniki: `/var/lib/postgresql/data` — źle dla 18)
- Hasło/użytkownik z `.env` ustawiane **tylko przy pierwszym starcie** na pustym wolumenie.
  Zmiana później = trzeba skasować wolumen (`docker compose down -v` → tracę dane!)

---

## Ściąga komend

### Baza (uruchamiać w folderze repo)
| komenda | co robi |
|---|---|
| `docker compose up -d` | start bazy w tle |
| `docker compose ps` | czy działa (`Up`) i na jakim porcie |
| `docker compose logs db \| tail -n 20` | ostatnie logi; szukam `ready to accept connections` |
| `docker compose stop` | zatrzymaj (dane zostają) — gdy nie pracuję, zwalnia RAM |
| `docker compose down` | usuń kontener i sieć (dane w wolumenie zostają) |
| `docker compose down -v` | **usuń też dane bazy** — ostrożnie! |
| `docker compose config` | sprawdź `compose.yaml` + `.env` bez uruchamiania (pokazuje hasło) |

### Wejście do bazy
```bash
docker compose exec db psql -U osm -d osm          # konsola SQL, wyjście: \q
docker compose exec db psql -U osm -d osm -P pager=off -c "SELECT postgis_full_version();"
docker compose exec db psql -U osm -d osm -P pager=off -c "\dx"   # lista rozszerzeń
```
- `exec db` = wykonaj w kontenerze `db`; `-c` = jedno zapytanie i koniec
- `-P pager=off` = bez przeglądarki wyników; gdy w nią wpadnę: strzałki/spacja, `q` wychodzi

### Docker ogólnie
| komenda | co robi |
|---|---|
| `docker ps -a` | wszystkie kontenery (też zatrzymane) |
| `docker images` | pobrane obrazy |
| `docker volume ls` | wolumeny |
| `docker container prune` | usuń zatrzymane kontenery |
| `docker system df` | ile miejsca zajmuje Docker |

### Git
| komenda | co robi |
|---|---|
| `git status` | co zmienione / nowe / gotowe do commita |
| `git diff plik` | co dokładnie zmieniłem w pliku |
| `git restore plik` | cofnij niezacommitowane zmiany w pliku |
| `git add plik1 plik2` | dodaj do commita (po nazwie, nie `git add .`) |
| `git commit -m "opis"` | zapisz etap |
| `git log --oneline` | historia commitów |

### System
| komenda | co robi |
|---|---|
| `uname -r` | wersja jądra |
| `df -h /` | wolne miejsce na dysku |
| `free -h` | RAM |
| `ss -ltn \| grep 5432` | czy coś słucha na porcie 5432 |
| `dkms status` | moduły DKMS (poprawka dźwięku) |
| `sudo dpkg --audit` | czy jakieś pakiety są niedokończone (pusto = OK) |
| `apt ... -s` | symulacja — pokaże, co by zrobił, nic nie zmienia |

---

## Zasady, które sobie wyrobiłem
- Komendy wpisuję w **terminal** (VS Code: Ctrl+`), nie w pliki.
- Zapisuję pliki (Ctrl+K, S = zapisz wszystkie) — Docker czyta z dysku.
- Przed ryzykowną operacją apt: najpierw `-s` (symulacja).
- Stałe wersje obrazów (`18-3.6`), nie `latest` — wszyscy mają to samo.

## Następny etap
Geofabrik PBF (najpierw pomorskie, ~100 MB) → osm2pgsql w kontenerze → import do `db` → pomiar czasu i rozmiaru.





---
---

# PRZEWODNIK: siadam do komputera i orientuję się, co się dzieje

Idę od góry do dołu. Każdy punkt: **komenda → co widzę → co to znaczy → co jeśli coś nie tak**.
Wszystko w terminalu (VS Code: `Ctrl+``). Hasła nikomu nie wklejam.

---

## KROK 1. Gdzie jestem?

### `pwd`
**Co widzę:**
```
/home/kuczera/zsd2-osm-test
```
**Co to znaczy:** ścieżka folderu, w którym aktualnie jestem.
**Ważne:** komendy `docker compose ...` działają TYLKO w folderze repo (tam, gdzie leży `compose.yaml`).
**Jeśli jestem gdzie indziej:** `cd ~/zsd2-osm-test`

### `ls -a`
**Co widzę:**
```
.  ..  .env  .env.example  .git  .gitattributes  .gitignore  compose.yaml  README.md  README_FORME.md
```
**Co to znaczy:** pliki w repo (`-a` = pokaż też ukryte, zaczynające się od kropki).
**Ważne:**
- `compose.yaml` – przepis na bazę (jaki obraz, port, gdzie dane)
- `.env` – moje hasło i nazwa bazy (tylko u mnie, nie idzie do gita)
- `.env.example` – wzór `.env` dla innych (idzie do gita)
- `.git` – folder gita, nie ruszam ręcznie
**Jeśli nie ma `.env`:** `cp .env.example .env` i wpisuję hasło w VS Code. Bez tego baza nie wystartuje.

---

## KROK 2. Czy Docker działa?

### `systemctl is-active docker`
**Co widzę:**
```
active
```
**Co to znaczy:** silnik Dockera (program w tle, który uruchamia kontenery) jest włączony.
**Ważne:** startuje sam przy włączeniu Ubuntu. Nie ma nic wspólnego z repo – działa zawsze.
**Jeśli widzę `inactive` lub `failed`:**
`sudo systemctl start docker`, potem `sudo systemctl status docker --no-pager` i czytam błąd.

---

## KROK 3. Czy moja baza działa?

### `docker compose ps` (w folderze repo)
**Co widzę, gdy działa:**
```
NAME                 IMAGE                    COMMAND                  SERVICE   CREATED       STATUS       PORTS
zsd2-osm-test-db-1   postgis/postgis:18-3.6   "docker-entrypoint.s…"   db        9 hours ago   Up 9 hours   127.0.0.1:5432->5432/tcp
```
**Co znaczy każda kolumna:**
- `NAME` – nazwa kontenera: `zsd2-osm-test` (nazwa folderu) + `db` (nazwa usługi z compose.yaml) + `1` (numer)
- `IMAGE` – z jakiego obrazu powstał: Postgres 18 z PostGIS 3.6
- `COMMAND` – program startowy w kontenerze, nieistotne
- `SERVICE` – `db` = nazwa usługi z mojego `compose.yaml`; tej nazwy używam w komendach (`exec db`, `logs db`)
- `CREATED` – kiedy kontener powstał
- `STATUS` – **najważniejsze.** `Up X` = działa od X czasu
- `PORTS` – `127.0.0.1:5432->5432/tcp` = port 5432 na laptopie prowadzi do portu 5432 w kontenerze,
  `127.0.0.1` = tylko z mojego komputera, nie z sieci

**Co widzę, gdy nie działa:** pusta tabela (same nagłówki) albo `STATUS` = `Exited (...)`.
**Co wtedy:** `docker compose up -d` (start w tle). Dane są bezpieczne – leżą w wolumenie, nie w kontenerze.

**Co widzę, gdy jestem poza repo:**
```
no configuration file provided: not found
```
→ Compose nie znalazł `compose.yaml` w tym folderze. `cd ~/zsd2-osm-test`.

### `docker ps` (działa w każdym folderze)
**Co widzę:**
```
CONTAINER ID   IMAGE                    COMMAND                  CREATED        STATUS        PORTS                      NAMES
bf88f92594c3   postgis/postgis:18-3.6   "docker-entrypoint.s…"   10 hours ago   Up 10 hours   127.0.0.1:5432->5432/tcp   zsd2-osm-test-db-1
```
**Co to znaczy:** WSZYSTKIE działające kontenery na komputerze, nie tylko z tego repo.
**Różnica względem `docker compose ps`:** zamiast `SERVICE` jest `CONTAINER ID` (unikalny numer kontenera).
Teraz wyglądają tak samo, bo mam tylko jeden kontener. Z drugim projektem `docker ps` pokaże oba.
**Kiedy używam:** gdy chcę wiedzieć, co w ogóle chodzi na komputerze (np. coś zajmuje port 5432).

### `docker ps -a`
**Co to znaczy:** jak wyżej + kontenery ZATRZYMANE (`Exited`). Przydaje się, gdy kontener padł i chcę go znaleźć.

---

## KROK 4. Czy baza wystartowała poprawnie? (logi)

### `docker compose logs db | tail -n 20`
**Co to robi:** `logs db` = wszystko, co baza wypisała; `| tail -n 20` = tylko ostatnie 20 linii.
**Co widzę, gdy OK (ostatnia linia):**
```
db-1  | ... LOG:  database system is ready to accept connections
```
**Co to znaczy:** Postgres wstał i przyjmuje połączenia.
**Inne linie, które są normalne:**
- `listening on IPv4 address "0.0.0.0", port 5432` – to WEWNĄTRZ kontenera; z zewnątrz i tak tylko 127.0.0.1
- czas w logach jest w UTC (u mnie +2h)
- przy pierwszym starcie: `PostgreSQL init process complete` – baza została utworzona od zera
**Jeśli widzę `ERROR` / `FATAL`:** kopiuję te linie i szukam / pytam. Częsty błąd: brak hasła w `.env`.
**Na żywo:** `docker compose logs -f db` (śledzi nowe linie, wyjście `Ctrl+C`).

---

## KROK 5. Czy przepis jest poprawny?

### `docker compose config`
**Co widzę (fragment):**
```
name: zsd2-osm-test
services:
  db:
    environment:
      POSTGRES_DB: osm
      POSTGRES_PASSWORD: <moje hasło>
      POSTGRES_USER: osm
    image: postgis/postgis:18-3.6
    volumes:
      - type: volume
        source: pgdata
        target: /var/lib/postgresql
    ports:
      - host_ip: 127.0.0.1
        target: 5432
        published: "5432"
volumes:
  pgdata:
    name: zsd2-osm-test_pgdata
```
**Co to znaczy:** NIE mój plik, tylko to, co Docker naprawdę wykona po przetworzeniu:
- `${POSTGRES_PASSWORD}` z mojego pliku → zamienione na hasło z `.env`
- `"127.0.0.1:5432:5432"` → rozpisane: `host_ip` (adres na laptopie), `published` (port na laptopie), `target` (port w kontenerze)
- `pgdata:/var/lib/postgresql` → rozpisane: wolumen `pgdata` podpięty w kontenerze pod `/var/lib/postgresql`
- dopisane nazwy z prefiksem folderu: `zsd2-osm-test_pgdata`
**Ważne:** uruchamiam po każdej zmianie `compose.yaml` lub `.env`, ZANIM zrobię `up`.
- błąd składni (np. złe wcięcie) → wyjdzie tutaj
- puste miejsce zamiast hasła → `.env` nie istnieje albo zła nazwa zmiennej
- `host_ip` inny niż `127.0.0.1` → baza wystawiona na sieć, poprawić
**Uwaga:** pokazuje hasło – nie wklejam tego nikomu.

---

## KROK 6. Gdzie są dane i ile zajmują?

### `docker volume ls`
**Co widzę:**
```
DRIVER    VOLUME NAME
local     zsd2-osm-test_pgdata
```
**Co to znaczy:** wolumen = folder na dysku zarządzany przez Dockera. Tu są WSZYSTKIE dane bazy.
**Ważne:**
- usunięcie kontenera (`docker compose down`) → dane zostają
- usunięcie repo → dane zostają
- `docker compose down -v` → **dane znikają** (`-v` = usuń też wolumeny)

### `docker volume inspect zsd2-osm-test_pgdata`
**Co widzę (najważniejsze pola):**
```
"CreatedAt": "2026-10-06T01:20:44+02:00",
"Labels": {
    "com.docker.compose.project": "zsd2-osm-test",
    "com.docker.compose.volume": "pgdata"
},
"Mountpoint": "/var/lib/docker/volumes/zsd2-osm-test_pgdata/_data",
```
**Co to znaczy:**
- `CreatedAt` – kiedy wolumen powstał (= kiedy pierwszy raz uruchomiłem bazę)
- `Labels` – po tym Compose wie, że ten wolumen należy do mojego projektu
- `Mountpoint` – fizyczna ścieżka na moim dysku

### `sudo du -sh /var/lib/docker/volumes/zsd2-osm-test_pgdata/_data`
**Co widzę:**
```
109M    /var/lib/docker/volumes/zsd2-osm-test_pgdata/_data
```
**Co to znaczy:** ile miejsca na dysku zajmuje cały serwer Postgresa (`sudo`, bo folder należy do roota).
**Ważne:** sprawdzam przed i po imporcie OSM. Pusty serwer = ok. 109 MB.

### `sudo ls /var/lib/docker/volumes/zsd2-osm-test_pgdata/_data`
**Co widzę:** `18`
**Co to znaczy:** podfolder z numerem wersji Postgresa. W środku pliki wewnętrzne bazy.
**Ważne:** NIGDY nie edytuję ani nie kasuję tych plików ręcznie – zepsuję bazę.

### `df -h /`
**Co widzę:**
```
Filesystem      Size  Used Avail Use% Mounted on
/dev/nvme0n1p5   77G   21G   53G  28% /
```
**Co to znaczy:** wolne miejsce na partycji Ubuntu (`Avail`). Docker, repo i dane OSM dzielą te same GB.
**Ważne:** przed importem całej Polski sprawdzić, czy jest zapas.

### `docker system df`
**Co to znaczy:** ile miejsca zajmuje Docker łącznie: obrazy, kontenery, wolumeny.

---

## KROK 7. Wchodzę do bazy

### `docker compose exec db psql -U osm -d osm`
**Co to robi:**
- `docker compose exec db` – wykonaj komendę wewnątrz działającego kontenera `db`
- `psql` – konsolowy klient Postgresa (jest w obrazie, nic nie instaluję)
- `-U osm` – jako użytkownik `osm`; `-d osm` – do bazy `osm`
**Co widzę:**
```
psql (18.6 (Debian 18.6-1.pgdg13+2))
Type "help" for help.

osm=#
```
**Co to znaczy:** jestem w konsoli SQL. `osm=#` = jestem w bazie `osm`, `#` = jako superuser.
**Zasady w środku:**
- komendy z `\` = komendy psql (bez średnika)
- wszystko inne = SQL, MUSI kończyć się `;` (bez średnika psql czeka na resztę, zachęta zmienia się na `osm-#`)
- wyjście: `\q`
- jeśli wynik otworzy się w przeglądarce (pager): strzałki/spacja przewijają, `q` zamyka
- jednorazowe zapytanie bez wchodzenia:
  `docker compose exec db psql -U osm -d osm -P pager=off -c "ZAPYTANIE"`

---

## KROK 8. Co jest w bazie (komendy w psql)

### `\conninfo`
**Co widzę (najważniejsze wiersze):**
```
 Database             | osm
 Client User          | osm
 Server Port          | 5432
 Password Used        | false
 Superuser            | on
```
**Co to znaczy:**
- `Database osm` / `Client User osm` – w jakiej bazie i jako kto jestem
- `Password Used false` – od środka kontenera Postgres nie pyta o hasło.
  Z zewnątrz (Python, QGIS przez `localhost:5432`) hasło z `.env` JEST wymagane
- `Superuser on` – użytkownik `osm` może wszystko (też skasować bazę). OK do testów;
  docelowo aplikacja dostanie osobnego użytkownika z ograniczonymi prawami

### `\l`
**Co widzę:**
```
       Name       | Owner | Encoding | ...
------------------+-------+----------+
 osm              | osm   | UTF8     |
 postgres         | osm   | UTF8     |
 template0        | osm   | UTF8     |
 template1        | osm   | UTF8     |
 template_postgis | osm   | UTF8     |
```
**Co to znaczy:** jeden serwer Postgresa = kilka niezależnych baz.
- `osm` – **MOJA baza**, utworzona z `POSTGRES_DB` w `.env`
- `postgres` – domyślna baza serwisowa, zawsze istnieje
- `template0`, `template1` – szablony, z których powstają nowe bazy
- `template_postgis` – szablon z PostGIS, dodany przez obraz
**Ważne:** pracuję tylko w `osm`. Reszty nie ruszam.
`UTF8` = polskie znaki (nazwy szlaków, miejscowości) zapiszą się poprawnie.

### `\dn`
**Co widzę:**
```
   Name   |       Owner
----------+-------------------
 public   | pg_database_owner
 tiger    | osm
 topology | osm
```
**Co to znaczy:** schematy = foldery na tabele wewnątrz bazy.
- `public` – domyślny; tabela bez podanego schematu ląduje tutaj
- `tiger` – geokoder adresów USA, dla nas śmieć (dodany automatycznie przez obraz)
- `topology` – rozszerzenie PostGIS, na razie nieużywane
**Ważne:** w projekcie planujemy schemat na dane OSM (wspólne) + osobne schematy na dane każdego developera.

### `\dt`
**Co widzę:**
```
  Schema  |           Name           | Type  | Owner
----------+--------------------------+-------+-------
 public   | spatial_ref_sys          | table | osm
 tiger    | addr                     | table | osm
 ... (34 tabele tiger)
 topology | layer                    | table | osm
 topology | topology                 | table | osm
```
**Co to znaczy:** lista tabel. Kolumna `Schema` mówi, w którym „folderze” jest tabela.
**Ważne:**
- danych OSM jeszcze NIE MA – po imporcie pojawią się tu nowe tabele (punkty, linie, poligony)
- `tiger.*` – puste, ignoruję
- `public.spatial_ref_sys` – JEDYNA ważna: słownik ok. 8500 układów współrzędnych (kody EPSG)
**Tylko jeden schemat:** `\dt public.*`
**Szczegóły tabeli (kolumny):** `\d nazwa_tabeli`, np. `\d spatial_ref_sys`

### `\dx`
**Co widzę:**
```
          Name          | Version |   Schema   |       Description
------------------------+---------+------------+-----------------------------
 fuzzystrmatch          | 1.2     | public     | similarities between strings
 plpgsql                | 1.0     | pg_catalog | PL/pgSQL procedural language
 postgis                | 3.6.4   | public     | geometry and geography types
 postgis_tiger_geocoder | 3.6.4   | tiger      | geocoder (USA)
 postgis_topology       | 3.6.4   | topology   | topology types
```
**Co to znaczy:** rozszerzenia = dodatki do Postgresa.
- `postgis` – **najważniejsze**: typy geometrii (punkt, linia, poligon) i funkcje przestrzenne (odległość, przecięcie)
- `plpgsql` – język funkcji w bazie, standard
- `fuzzystrmatch` – potrzebne geokoderowi tiger
- `postgis_tiger_geocoder`, `postgis_topology` – nieużywane

### `SELECT postgis_full_version();`
**Co widzę (skrót):**
```
POSTGIS="3.6.4" PGSQL="180" GEOS="3.14.1" PROJ="9.8.1" ...
```
**Co to znaczy:**
- `POSTGIS` – wersja PostGIS
- `PGSQL="180"` – Postgres 18
- `GEOS` – biblioteka do operacji na geometriach (przecięcia, bufory)
- `PROJ` – biblioteka do przeliczania układów współrzędnych
**Ważne:** jeśli to zapytanie działa → PostGIS jest gotowy.

### `SELECT pg_size_pretty(pg_database_size('osm'));`
**Co widzę:**
```
 pg_size_pretty
----------------
 19 MB
```
**Co to znaczy:** rozmiar samej bazy `osm` liczony przez Postgresa.
**Dlaczego mniej niż `du` (109M):** `du` liczy cały serwer: 5 baz + WAL (dziennik zmian Postgresa)
+ pliki systemowe. Do mierzenia NASZYCH danych używam tego zapytania, do miejsca na dysku – `du`.

### `SELECT srid, auth_name, auth_srid, left(srtext, 60) FROM spatial_ref_sys WHERE srid IN (4326, 3857, 2180);`
**Co widzę:** 3 wiersze z opisami układów.
**Co to znaczy – układy, które będą wracać:**
- **4326** – WGS84, stopnie (długość/szerokość). Tak są zapisane dane OSM i GPS
- **3857** – Web Mercator. Mapy w przeglądarce (Leaflet, OpenLayers)
- **2180** – PUWG 1992. Polska w METRACH – do liczenia długości tras i odległości

### `\q`
Wyjście z psql, wracam do zwykłego terminala.

---

## KROK 9. Skończyłem pracę

| komenda | co robi | dane |
|---|---|---|
| `docker compose stop` | zatrzymuje bazę, zwalnia RAM | zostają |
| `docker compose up -d` | uruchamia ponownie | – |
| `docker compose down` | usuwa kontener i sieć | zostają (w wolumenie) |
| `docker compose down -v` | usuwa kontener, sieć **i wolumen** | **ZNIKAJĄ** |

**Ważne:** kontener NIE startuje sam po restarcie komputera – po włączeniu kompa: `docker compose up -d`.
(Sam Docker startuje, kontener nie – nie dałem mu polityki restartu.)

---

## KROK 10. Stan gita

### `git status`
**Co widzę, gdy wszystko zapisane:**
```
On branch main
nothing to commit, working tree clean
```
**Co to znaczy:** wszystkie zmiany są w commitach.
**Inne stany:**
- `Changes not staged for commit: modified: plik` – zmieniłem plik, nie dodałem do commita
- `Untracked files: plik` – nowy plik, git go jeszcze nie śledzi
- `Changes to be committed` – dodane (`git add`), czekają na `git commit`
**Ważne:** `.env` NIGDY nie może się tu pojawić. Jeśli się pojawi → sprawdzić `.gitignore`.

### `git log --oneline`
**Co widzę:**
```
c26943c (HEAD -> main) Add PostGIS database service (Docker Compose)
51b86a8 Initial test project structure
```
**Co to znaczy:** historia commitów, najnowszy na górze. `HEAD -> main` = tu jestem, gałąź `main`.




## KROK 11. Kiedy dane przeżywają, a kiedy znikają (sprawdzone testem)

### `docker compose stop` → `docker compose up -d`
- Widzę: `Stopped`; w `docker ps -a` kontener `Exited (0)`; po `up` TO SAMO ID kontenera
- Ważne: kontener tylko zatrzymany. Dane są.

### `docker compose down` → `docker compose up -d`
- Widzę: `Container Removed`, `Network Removed`; `docker ps -a` pusto; `docker volume ls` wolumen jest;
  po `up` NOWE ID kontenera
- Ważne: kontener usunięty, ale nowy podpina stary wolumen. Dane są.

### `docker compose down -v` → `docker compose up -d`
- Widzę: dodatkowo `Volume zsd2-osm-test_pgdata Removed`; `docker volume ls` pusto;
  po `up`: `Volume Created` i w logach pełna inicjalizacja (`PostgreSQL init process complete`)
- Ważne: DANE ZNIKAJĄ. Baza od zera, tylko PostGIS. Hasło z `.env` czytane na nowo
  (jedyny moment, żeby je zmienić).

### Błędy, na które wpadłem
- `service "db" is not running` → `exec` przy wyłączonej bazie; najpierw `docker compose up -d`
- `dt: command not found` → komendę psql (`\dt`) wpisałem w terminal zamiast w psql
- `syntax error at or near "/"` → `/l` zamiast `\l` (musi być backslash)
- zachęta `osm-#` → psql czeka na dokończenie zapytania (brak `;`); `\r` czyści, `Ctrl+C` przerywa
- kilka komend naraz: kilka `-c`, np. `-c "\dt public.*" -c "SELECT * FROM test;"`
- pomoc: `docker compose --help`, `docker compose ps --help`


---

## KROK 12. Pobranie danych OSM z Geofabrik

### `mkdir -p data`
**Co widzę:** nic (brak komunikatu = sukces); w `ls` pojawia się folder `data`.
**Co to robi:** tworzy folder na dane OSM. `-p` = nie zgłaszaj błędu, jeśli już istnieje.
**Ważne:** `data/` jest w `.gitignore` → pliki PBF (setki MB – GB) NIGDY nie idą do gita.
Każdy w zespole pobiera dane sam (komendą z README).

### `wget -P data https://download.geofabrik.de/europe/poland/pomorskie-latest.osm.pbf`
**Co widzę (najważniejsze linie):**
```
HTTP request sent, awaiting response... 307 Temporary Redirect
Location: https://download.geofabrik.de/europe/poland/pomorskie-261005.osm.pbf [following]
Length: 117887279 (112M) [application/octet-stream]
Saving to: 'data/pomorskie-latest.osm.pbf'
... 100%[======>] 112.43M  1.01MB/s    in 3m 13s
'data/pomorskie-latest.osm.pbf' saved [117887279/117887279]
```
**Co to znaczy:**
- `wget -P data` – pobierz plik do folderu `data`
- `307 Temporary Redirect` → `pomorskie-261005` – link „latest” przekierowuje na plik z datą.
  **Moje dane są ze stanu OSM na 05.10.2026** (format daty: RRMMDD). Zapisywać przy każdym imporcie.
- `saved [117887279/117887279]` – pobrano wszystkie bajty (liczby muszą być równe)

### `wget -P data https://download.geofabrik.de/europe/poland/pomorskie-latest.osm.pbf.md5`
**Co widzę:** `saved [59]` – mały plik tekstowy (59 bajtów).
**Co to jest:** suma kontrolna = „odcisk palca” pliku PBF podany przez Geofabrik.

### `cd data && md5sum -c pomorskie-latest.osm.pbf.md5; cd ..`
**Co widzę:**
```
pomorskie-latest.osm.pbf: OK
```
**Co to robi:** liczy odcisk mojego pobranego pliku i porównuje z tym od Geofabrik.
**Ważne:** `OK` = plik kompletny i nieuszkodzony. `FAILED` = pobrać jeszcze raz.
`&&` = drugą komendę wykonaj tylko, jeśli pierwsza się udała; `;` = wykonaj zawsze.

### `ls -lh data`
**Co widzę:**
```
-rw-rw-r-- 1 kuczera kuczera 113M Oct  6 19:08 pomorskie-latest.osm.pbf
-rw-rw-r-- 1 kuczera kuczera   59 Oct  6 19:58 pomorskie-latest.osm.pbf.md5
```
**Co to znaczy:** `-l` = szczegóły, `-h` = rozmiary czytelne (M, G). PBF ok. 113 MB.

### `git status` (po pobraniu)
**Co widzę:** brak `data/` na liście.
**Ważne:** potwierdzenie, że `.gitignore` działa.

### Dlaczego tak (decyzje)
- **Pomorskie (112 MB) zamiast całej Polski (2,0 GB)** – szybki test: import w minutach, nie godzinach.
  Jak wszystko zadziała → powtarzam dla `poland-latest.osm.pbf`.
- **Geofabrik zamiast Overpass API** – cel projektu: dane lokalnie w bazie, bez limitów i zależności od cudzego serwera.
- **Licencja danych: ODbL 1.0** – darmowe, ALE aplikacja musi pokazywać „© OpenStreetMap contributors”.
- **Geofabrik aktualizuje pliki codziennie.** Do rozważenia później: jak często odświeżać dane
  (ponowny import vs aktualizacje przyrostowe `osm2pgsql-replication`).

---
---

## KROK 13. Prywatne notatki poza gitem

### Dopisane do `.gitignore`:
```
# Moje prywatne notatki
README_FORME.md
```
### `git status`
**Co widzę:** `modified: .gitignore`, a `README_FORME.md` zniknął z `Untracked files`.

### `git add .gitignore` → `git commit -m "Ignore personal notes"`
**Co widzę:** `[main 8460880] Ignore personal notes  1 file changed, 3 insertions(+), 1 deletion(-)`
**Ważne:** repo trafi kiedyś na GitHub dla zespołu – moje notatki zostają tylko u mnie.
Rozważane: commitować jako `docs/notes.md` (dla zespołu) – odrzucone, to notatki dla mnie.

---

## KROK 14. Konfiguracja importu (osm2pgsql flex)

### `mkdir -p osm2pgsql`
**Co to robi:** folder na konfiguracje importu.
**Ważne:** ten folder IDZIE do gita – to „kod” importu (przepis), nie dane.

### `wget -O osm2pgsql/generic.lua https://raw.githubusercontent.com/osm2pgsql-dev/osm2pgsql/master/flex-config/generic.lua`
**Co widzę:** `Length: 6747 (6.6K)` ... `saved [6747/6747]`
**Co to robi:** `-O plik` = zapisz pod tą nazwą. Pobiera oficjalną przykładową konfigurację z repo osm2pgsql.
Licencja pliku: domena publiczna.

### Co jest w `generic.lua` (otworzyć w VS Code)
| tabela (`define_..._table`) | co do niej trafi | przykład dla projektu |
|---|---|---|
| `points` | punkty (nody) z tagami | źródła wody, schroniska |
| `lines` | otwarte linie (way) | ścieżki, drogi, rzeki |
| `polygons` | zamknięte obszary | lasy, jeziora, budynki |
| `routes` | relacje `type=route` | **całe szlaki turystyczne** – kluczowa tabela |
| `boundaries` | granice | gminy, województwa |

- `local srid = 3857` – geometrie w Web Mercator (układ map w przeglądarce).
  **Do decyzji w docelowej konfiguracji:** 3857 (pod wyświetlanie) vs 4326 (standard GPS/GeoJSON).
- `type = 'jsonb'` – wszystkie tagi obiektu w jednej kolumnie JSON → rozszerzenie `hstore` NIEPOTRZEBNE.
  Zapytanie: `WHERE tags->>'amenity' = 'drinking_water'`
- `delete_keys` – tagi techniczne wyrzucane jako śmieci (`source`, `fixme`, ...)

### Dlaczego tak (decyzje)
**Tryb importu: flex (nie pgsql)**
| tryb | co to | status |
|---|---|---|
| `pgsql` | stary: sztywne tabele `planet_osm_point/line/polygon/roads` | przestarzały od wersji 2.0 (2024), do usunięcia |
| **`flex`** | konfiguracja w Lua: sam decyduję o tabelach i kolumnach | zalecany dla nowych projektów; w 2026 przeszedł na niego główny styl mapy OSM |
- Uwaga: większość tutoriali w sieci pokazuje stary `pgsql` – nie kopiować bezmyślnie.
- Plan: najpierw `generic.lua` (wszystko, do eksploracji danych) → potem WŁASNA konfiguracja Lua
  tylko z tym, czego potrzebuje projekt (szlaki, woda, noclegi), w osobnym schemacie (`osm`).

**Jak uruchamiać osm2pgsql: obraz Docker `iboates/osm2pgsql:2.3.1`**
| opcja | wersja | ocena |
|---|---|---|
| **obraz Docker `iboates/osm2pgsql`** | 2.3.1 (najnowsza) | ✅ polecany na oficjalnej stronie osm2pgsql; utrzymywany przez osobę z zewnątrz (ryzyko: może przestać być aktualizowany) |
| `apt install osm2pgsql` (Ubuntu 24.04) | 1.11 – stara | ❌ sprzed wersji 2.0 |
| własny obraz Docker | dowolna | ⚠️ więcej pracy; plan B, gdyby obraz iboates przestał być aktualizowany |
- Przypięta wersja `2.3.1`, nie `latest` – wszyscy w zespole mają identyczny import.
- Przez Docker: nic nie instaluję w systemie, kolega na Windowsie ma to samo.
---

## KROK 15. osm2pgsql jako usługa w `compose.yaml`

### Dopisany blok w `compose.yaml` (pod `db:`, to samo wcięcie)
```yaml
  osm2pgsql:
    image: iboates/osm2pgsql:2.3.1       # przypięta wersja
    profiles: ["tools"]                  # NIE startuje przy "docker compose up" - tylko na żądanie
    depends_on:
      - db                               # przy uruchomieniu najpierw upewnij się, że baza działa
    environment:
      PGHOST: db                         # adres bazy = nazwa usługi w sieci projektu
      PGUSER: ${POSTGRES_USER}           # te same dane logowania co baza (z .env)
      PGPASSWORD: ${POSTGRES_PASSWORD}
      PGDATABASE: ${POSTGRES_DB}
    volumes:
      - ./data:/data:ro                  # pliki PBF widoczne w kontenerze jako /data (tylko odczyt)
      - ./osm2pgsql:/config:ro           # konfiguracje Lua widoczne jako /config (tylko odczyt)
```
**Co ważne:**
- `profiles: ["tools"]` – `db` działa cały czas, osm2pgsql to narzędzie jednorazowe (uruchom → importuj → koniec).
- `PGHOST: db` – kontenery w sieci projektu widzą się po NAZWIE USŁUGI, nie po IP.
- `PG...` – standardowe zmienne klienta Postgresa; osm2pgsql sam je czyta → w komendzie
  NIE podaję hasła (nie ląduje w historii terminala).
- `./data:/data:ro` – **bind mount**: mój folder widoczny w kontenerze. Różnica:
  wolumen (`pgdata`) = zarządza nim Docker; bind mount = zwykły folder z mojego dysku.
  `:ro` = tylko odczyt, osm2pgsql nie może nic zmienić w moich plikach.
- **Ścieżki w komendach osm2pgsql to ścieżki W KONTENERZE:** `/data/...`, `/config/...`
  (nie `./data/...`).

### `docker compose config --quiet && echo "skladnia OK"`
**Co widzę:** `skladnia OK`
**Co to robi:** sprawdza `compose.yaml` + `.env` bez wypisywania (hasło się nie pokazuje).
Błąd wcięcia / składni → komunikat zamiast `skladnia OK`.

### `docker compose up -d` → `docker compose ps`
**Co widzę:** działa tylko `zsd2-osm-test-db-1`.
**Ważne:** osm2pgsql się nie uruchomił → profil działa poprawnie.

### `docker compose run --rm osm2pgsql --version`
**Co widzę (za pierwszym razem):** długa lista linii `xxxx Downloading ... MB`, `Pull complete`, na końcu:
```
Image iboates/osm2pgsql:2.3.1 Pulled
osm2pgsql version 2.3.1 (2.3.1)
...
Proj 9.8.1
Lua 5.1.4 (LuaJIT ...)
```
**Co to robi:**
- `run` – uruchom jednorazowy kontener usługi z podanymi argumentami
- `--rm` – usuń kontener po zakończeniu (nie zostają śmieci w `docker ps -a`)
- `--version` – osm2pgsql wypisuje wersję i kończy
**Jak czytać log pobierania:**
- obraz = kilkanaście **warstw**; każda linia z kodem (np. `16a85b1e8922`) = postęp JEDNEJ warstwy
- liczby rosną do rozmiaru warstwy – to NIE jest suma; linie się powtarzają, bo terminal odświeża stan
- duże były tylko 2 warstwy (137 MB i 104 MB), reszta to KB–kilka MB
- `Already exists` – warstwa wspólna z innym obrazem, pobrana wcześniej
- pobiera się TYLKO za pierwszym razem
**Ważne:** `^C` wciśnięte PO powrocie znaku zachęty niczego nie przerywa.

### `docker images`
**Co widzę:**
```
IMAGE                     ID             DISK USAGE   CONTENT SIZE   EXTRA
iboates/osm2pgsql:2.3.1   6548a1e2492e       1.09GB          279MB
postgis/postgis:18-3.6    60f6ad1d21ea        957MB          239MB    U
```
**Co to znaczy:**
- `CONTENT SIZE` – ile się POBRAŁO (skompresowane); 279 MB = tyle co na Docker Hub ✅
- `DISK USAGE` – ile zajmuje na dysku PO ROZPAKOWANIU (ok. 4× więcej)
- `U` (In Use) – obraz używany przez działający kontener

### `docker system df`
**Co widzę:**
```
TYPE            TOTAL     ACTIVE    SIZE      RECLAIMABLE
Images          2         1         2.047GB   1.09GB (53%)
Containers      1         1         28.67kB   0B (0%)
Local Volumes   1         1         113.5MB   0B (0%)
```
**Co to znaczy:**
- `Images` – obrazy razem 2 GB (jednorazowy koszt narzędzi)
- `RECLAIMABLE 1.09GB` – obraz osm2pgsql „do odzyskania”, bo żaden kontener go teraz nie używa.
  **NIE usuwać** (`docker image prune -a`) – przy następnym imporcie pobierałby się od nowa.
- `Local Volumes` – moja baza (rośnie po imporcie)
