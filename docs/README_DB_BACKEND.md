# Trail-Strider – baza danych i backend

Skrócona instrukcja uruchomienia bazy danych (PostgreSQL + PostGIS z danymi OSM i Lasów Państwowych),
BRoutera, usługi routingu i backendu. Szczegółowe opisy i wyniki kontrolne: `docs/SETUP.md`,
`docs/BROUTER.md`, `docs/ROUTING.md`, `docs/BACKEND.md`.

System: Ubuntu 24.04 LTS, x86_64, min. 8 GB RAM i 20 GB wolnego miejsca.
Od kroku 2 wszystkie komendy wykonuje się w folderze `~/Trail-Strider`.

---

## 1. Instalacja narzędzi (jednorazowo)

### Git

```bash
sudo apt update
sudo apt install git
git config --global user.name "Imię Nazwisko"
git config --global user.email "twoj@mail"
```

### Docker (wersje przypięte)

```bash
sudo apt install ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
sudo tee /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
sudo apt update
sudo apt install \
  docker-ce=5:29.8.2-1~ubuntu.24.04~noble \
  docker-ce-cli=5:29.8.2-1~ubuntu.24.04~noble \
  docker-ce-rootless-extras=5:29.8.2-1~ubuntu.24.04~noble \
  containerd.io=2.3.6-1~ubuntu.24.04~noble \
  docker-buildx-plugin=0.37.1-1~ubuntu.24.04~noble \
  docker-compose-plugin=5.6.0-1~ubuntu.24.04~noble
sudo apt-mark hold docker-ce docker-ce-cli docker-ce-rootless-extras containerd.io docker-buildx-plugin docker-compose-plugin
```

Docker bez `sudo` (po tej komendzie wyloguj się i zaloguj ponownie):

```bash
sudo usermod -aG docker $USER
```

### Python venv

```bash
sudo apt install python3.12-venv
```

---

## 2. Repozytorium i hasło do bazy

```bash
cd ~
git clone git@github.com:MasnyMaras/Trail-Strider.git
cd ~/Trail-Strider
cp .env.example .env
```

W pliku `.env` zmień `change_me` na własne hasło (bez spacji, cudzysłowów, polskich znaków, `$` i `#`).
Hasło zapisuje się w bazie tylko przy jej pierwszym uruchomieniu.

---

## 3. Dane OSM (Małopolska, Pomorskie, Rumunia – stan na 1.10.2026)

```bash
mkdir -p data
wget -P data https://download.geofabrik.de/europe/poland/malopolskie-261001.osm.pbf
wget -P data https://download.geofabrik.de/europe/poland/malopolskie-261001.osm.pbf.md5
wget -P data https://download.geofabrik.de/europe/poland/pomorskie-261001.osm.pbf
wget -P data https://download.geofabrik.de/europe/poland/pomorskie-261001.osm.pbf.md5
wget -P data https://download.geofabrik.de/europe/romania-261001.osm.pbf
wget -P data https://download.geofabrik.de/europe/romania-261001.osm.pbf.md5
cd data && md5sum -c malopolskie-261001.osm.pbf.md5 pomorskie-261001.osm.pbf.md5 romania-261001.osm.pbf.md5; cd ..
```

Jeśli przy którymś pliku pojawi się `FAILED`, usuń go razem z `.md5` i pobierz ponownie.

---

## 4. Baza danych i import OSM

```bash
docker compose up -d db
docker compose run --rm osm2pgsql -O flex -S /config/generic.lua \
  /data/malopolskie-261001.osm.pbf /data/pomorskie-261001.osm.pbf /data/romania-261001.osm.pbf
```

Wszystkie pliki importuje się w jednym wywołaniu – każdy import tworzy tabele OSM od nowa.

---

## 5. Środowisko Pythona (skrypty w `db/scripts`)

```bash
python3 -m venv db/.venv
source db/.venv/bin/activate
pip install -r db/scripts/requirements.txt
```

W każdym nowym terminalu przed uruchomieniem skryptów: `source db/.venv/bin/activate`.

---

## 6. Dane Lasów Państwowych (schemat `bdl`)

```bash
python db/scripts/bdl_download.py
python db/scripts/bdl_load.py
```

---

## 7. Punkty „Zanocuj w lesie” i tabela noclegów

```bash
docker compose exec -T db psql -U osm -d osm -v ON_ERROR_STOP=1 -f - < db/sql/zanocuj_punkty.sql
docker compose exec -T db psql -U osm -d osm -v ON_ERROR_STOP=1 \
  -v "wojewodztwo=województwo pomorskie" -f - < db/sql/zanocuj_punkty.sql
docker compose exec -T db psql -U osm -d osm -v ON_ERROR_STOP=1 -f - < db/sql/noclegi.sql
```

Skryptów SQL nie uruchamia się w DBeaverze (używają poleceń konsoli `psql`).

---

## 8. Kafle BRoutera

Cztery kafle obejmują wszystkie trzy regiony (Małopolska, Pomorskie, Maramureș):

```bash
mkdir -p routing/segments4
for k in E15_N45 E15_N50 E20_N45 E20_N50; do
  wget -P routing/segments4 https://brouter.de/brouter/segments4/$k.rd5
done
```

---

## 9. BRouter, routing i backend

```bash
docker compose up -d --build db brouter routing backend
docker compose ps
```

Test:

```bash
curl -s http://127.0.0.1:8000/api/health; echo
curl -s http://127.0.0.1:8000/api/health/db; echo
curl -s -X POST http://127.0.0.1:8000/api/route -H "Content-Type: application/json" \
  -d '{"points": [[20.975, 50.015], [20.89, 50.13]]}' | head -c 300; echo
```

Dokumentacja API w przeglądarce: `http://127.0.0.1:8000/docs`.

| usługa | adres z komputera | adres w sieci Dockera |
|---|---|---|
| backend | `127.0.0.1:8000` | `backend:8000` |
| routing | `127.0.0.1:8001` | `routing:8000` |
| brouter | `127.0.0.1:17777` | `brouter:17777` |
| db | `127.0.0.1:5432` | `db:5432` |

---

## Codzienna praca

```bash
cd ~/Trail-Strider
git pull
docker compose up -d
```

| sytuacja | komenda |
|---|---|
| koniec pracy (dane zostają) | `docker compose stop` |
| po `git pull` zmieniły się `requirements.txt` lub `Dockerfile` | `docker compose up -d --build` |
| backend lub routing `(unhealthy)` po `git pull` | `docker compose up -d --force-recreate backend routing` |
| logi usługi | `docker compose logs -f backend` (lub `routing`, `brouter`, `db`) |
| stan usług | `docker compose ps` |

Nie używaj `docker compose down -v` – usuwa bazę danych.

---

## Odświeżenie danych

Po każdej zmianie danych źródłowych uruchom ponownie wszystko, co z nich wynika, w tej kolejności:

| zmiana | uruchom ponownie |
|---|---|
| import OSM (krok 4) | krok 7 (oba `zanocuj_punkty.sql` i `noclegi.sql`) |
| dane Lasów Państwowych (krok 6) | krok 7 |
| tylko `zanocuj_punkty.sql` | `noclegi.sql` |

---

## Podgląd bazy

Konsola w kontenerze:

```bash
docker compose exec db psql -U osm -d osm
```

DBeaver (`sudo snap install dbeaver-ce --classic`), połączenie PostgreSQL:

| pole | wartość |
|---|---|
| Host | `127.0.0.1` |
| Port | `5432` |
| Database | `osm` |
| Username | `osm` |
| Password | hasło z `.env` |

| schemat | zawartość |
|---|---|
| `public` | dane OSM: `points`, `lines`, `polygons`, `routes`, `boundaries` |
| `bdl` | Lasy Państwowe: `zanocuj_w_lesie`, `noclegi_powierzchniowe`, `noclegi_kubaturowe`, `zanocuj_punkty` |
| `app` | dane dla backendu: `noclegi` |

Geometria we wszystkich tabelach jest w EPSG:3857; odległości w metrach liczy się po `ST_Transform(geom, 2180)`.
