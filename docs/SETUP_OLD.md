# STOSOWAC SIE DO SETUP.md   SETUP_OLD.md jest archaiczne i zostanie usunete jesli komus sie uda poprawnie 
# SETUP – środowisko bazy danych OSM (Trail-Strider, folder `db/`)
Instrukcja prowadzi od czystego Ubuntu do działającej bazy PostgreSQL + PostGIS
z danymi OpenStreetMap i skryptów generujących przykładowe mapy (PNG).

**Zasady:**
- Każdy krok: **Sprawdź przed → Wykonaj → Sprawdź po.**
- Wynik musi się zgadzać z tabelą „Wymagane”. Jeśli nie – **zatrzymaj się** i zgłoś, nie idź dalej.
- Komendy wpisujesz w terminalu (Ctrl+Alt+T). Linie zaczynające się od `#` to komentarze – nie trzeba ich wpisywać.

---

## Krok 0. Sprawdzenie systemu

**Sprawdź:**
```bash
lsb_release -d        # wersja systemu
uname -m              # architektura procesora
df -h /               # wolne miejsce na dysku
free -h               # pamięć RAM
```

**Wymagane:**
| komenda | musi pokazać |
|---|---|
| `lsb_release -d` | `Description: Ubuntu 24.04.x LTS` (x = dowolna cyfra) |
| `uname -m` | `x86_64` |
| `df -h /` | kolumna `Avail`: co najmniej **15G** |
| `free -h` | wiersz `Mem:`, kolumna `total`: co najmniej **8Gi** |

Komunikat `No LSB modules are available.` przy `lsb_release` jest normalny – ignoruj.

❌ Jeśli coś się nie zgadza: zatrzymaj się i zgłoś.

---

## Krok 1. Aktualizacja systemu

**Sprawdź przed:**
```bash
sudo dpkg --audit
```
**Wymagane:** brak wyniku (pusto) = system pakietów jest w porządku.

**Wykonaj:**
```bash
sudo apt update
sudo apt upgrade
```
- `apt update` – pobiera aktualną listę pakietów (nic nie instaluje).
- `apt upgrade` – instaluje aktualizacje. **Bez `-y`:** apt pokaże listę zmian i zapyta `Do you want to continue? [Y/n]`.
  **Przeczytaj listę przed potwierdzeniem.** Jeśli w sekcji `The following packages will be REMOVED`
  jest cokolwiek – odpowiedz `n` i zgłoś.

Jeśli pojawi się okienko **„Ubuntu 26.04 LTS Upgrade Available”** – kliknij **Don't Upgrade**.
Projekt działa na 24.04.

**Sprawdź po:**
```bash
sudo dpkg --audit
apt list --upgradable
ls /var/run/reboot-required 2>/dev/null && echo "RESTART POTRZEBNY" || echo "bez restartu"
```

**Wymagane:**
| komenda | musi pokazać |
|---|---|
| `sudo dpkg --audit` | pusto |
| `apt list --upgradable` | tylko `Listing... Done` (brak pakietów do aktualizacji) |
| ostatnia komenda | `bez restartu` – idź dalej; `RESTART POTRZEBNY` – zrestartuj (`sudo reboot`) i dopiero potem krok 2 |

❌ Jeśli `dpkg --audit` coś wypisuje albo `apt upgrade` zakończył się błędem (`E: ...`, `error code`) – zatrzymaj się i zgłoś.

---

## Krok 2. Git

**Sprawdź przed:**
```bash
git --version
```
- `git version 2.43.0` – Git jest, pomiń „Wykonaj (instalacja)”.
- `Command 'git' not found` – zainstaluj.

**Wykonaj (instalacja, tylko jeśli brak):**
```bash
sudo apt install git
```

**Wykonaj (konfiguracja – zawsze):**
```bash
git config --global user.name "Imię Nazwisko"
git config --global user.email "twoj@mail"
```
Użyj tego samego adresu e-mail co na koncie GitHub – wtedy commity podepną się pod Twoje konto.

**Sprawdź po:**
```bash
git --version
git config --global user.name
git config --global user.email
```

**Wymagane:**
| komenda | musi pokazać |
|---|---|
| `git --version` | `git version 2.43.0` |
| `git config --global user.name` | Twoje imię i nazwisko |
| `git config --global user.email` | Twój e-mail z GitHuba |

---

## Krok 3. Docker Engine + Docker Compose (dokładne wersje)

Instalujemy z **oficjalnego repozytorium Dockera** (nie snap, nie `docker.io` z Ubuntu),
w wersjach przetestowanych w projekcie, a potem **blokujemy je przed aktualizacją**.

| pakiet | wersja |
|---|---|
| `docker-ce`, `docker-ce-cli`, `docker-ce-rootless-extras` | `5:29.8.2-1~ubuntu.24.04~noble` |
| `containerd.io` | `2.3.6-1~ubuntu.24.04~noble` |
| `docker-buildx-plugin` | `0.37.1-1~ubuntu.24.04~noble` |
| `docker-compose-plugin` | `5.6.0-1~ubuntu.24.04~noble` |

### 3a. Sprawdź przed

```bash
docker --version
dpkg --get-selections | grep -Ei 'docker|containerd|runc|podman'
```

**Wymagane:**
| komenda | musi pokazać |
|---|---|
| `docker --version` | `Command 'docker' not found` (Docker jeszcze nie zainstalowany) |
| `dpkg --get-selections ...` | pusto (brak starych/konkurencyjnych pakietów) |

❌ Jeśli Docker już jest albo druga komenda coś wypisuje – zatrzymaj się i zgłoś.

### 3b. Wykonaj – dodanie repozytorium Dockera

```bash
# narzędzia potrzebne do pobrania klucza
sudo apt install ca-certificates curl

# klucz GPG Dockera (apt sprawdza nim, czy pakiety są autentyczne)
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# wpis repozytorium (wartości noble / amd64 wstawią się same)
sudo tee /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF

sudo apt update
```

**Sprawdź:**
```bash
ls -l /etc/apt/keyrings/docker.asc
apt-cache madison docker-ce | grep 29.8.2
```

**Wymagane:**
| komenda | musi pokazać |
|---|---|
| `tee` (wypisało się przy dodawaniu) | `Suites: noble` oraz `Architectures: amd64` |
| `sudo apt update` | linia z `https://download.docker.com/linux/ubuntu noble` |
| `ls -l ...docker.asc` | plik ok. 3,8 KB, uprawnienia `-rw-r--r--` |
| `apt-cache madison ...` | `docker-ce | 5:29.8.2-1~ubuntu.24.04~noble | https://download.docker.com/...` |

### 3c. Wykonaj – instalacja dokładnych wersji i blokada

```bash
sudo apt install \
  docker-ce=5:29.8.2-1~ubuntu.24.04~noble \
  docker-ce-cli=5:29.8.2-1~ubuntu.24.04~noble \
  docker-ce-rootless-extras=5:29.8.2-1~ubuntu.24.04~noble \
  containerd.io=2.3.6-1~ubuntu.24.04~noble \
  docker-buildx-plugin=0.37.1-1~ubuntu.24.04~noble \
  docker-compose-plugin=5.6.0-1~ubuntu.24.04~noble
```
Przed `Y`: sprawdź, że w sekcji `REMOVED` nic nie ma (`0 to remove`).

```bash
sudo apt-mark hold docker-ce docker-ce-cli docker-ce-rootless-extras containerd.io docker-buildx-plugin docker-compose-plugin
```
`apt-mark hold` – zamraża wersje: przyszłe `apt upgrade` ich nie ruszą (pojawią się jako `kept back` – to poprawne).
Zmiana wersji Dockera odbywa się tylko świadomie, razem z aktualizacją tej instrukcji.

### 3d. Sprawdź po

```bash
docker --version
docker compose version
docker buildx version
containerd --version
systemctl is-active docker
apt-mark showhold
sudo docker run --rm hello-world
```

**Wymagane:**
| komenda | musi pokazać |
|---|---|
| `docker --version` | `Docker version 29.8.2, build 7fc2dff` |
| `docker compose version` | `Docker Compose version v5.6.0` |
| `docker buildx version` | `github.com/docker/buildx v0.37.1 ...` |
| `containerd --version` | `containerd containerd v2.3.6 ...` |
| `systemctl is-active docker` | `active` |
| `apt-mark showhold` | 6 pakietów: `containerd.io`, `docker-buildx-plugin`, `docker-ce`, `docker-ce-cli`, `docker-ce-rootless-extras`, `docker-compose-plugin` |
| `sudo docker run --rm hello-world` | `Hello from Docker!` (za pierwszym razem najpierw pobierze mały obraz testowy) |

---

## Krok 4. Docker bez `sudo` (grupa `docker`)

Domyślnie każda komenda `docker` wymaga `sudo`. Dodanie użytkownika do grupy `docker` to usuwa.
**Uwaga:** członek grupy `docker` ma w praktyce uprawnienia roota. Na prywatnym laptopie to standard.

**Sprawdź przed:**
```bash
groups
```
**Wymagane:** na liście **nie ma** `docker` (jeśli już jest – pomiń ten krok).

**Wykonaj:**
```bash
sudo usermod -aG docker $USER
```
Następnie **wyloguj się i zaloguj ponownie** (albo `sudo reboot`) – zmiana grup działa dopiero w nowej sesji.

**Sprawdź po (w nowej sesji):**
```bash
groups
docker run --rm hello-world
docker image rm hello-world
```

**Wymagane:**
| komenda | musi pokazać |
|---|---|
| `groups` | na liście jest `docker` |
| `docker run --rm hello-world` (BEZ `sudo`) | `Hello from Docker!` |
| `docker image rm hello-world` | `Untagged: hello-world:latest` (sprzątanie obrazu testowego) |

❌ `permission denied while trying to connect to the Docker daemon socket` = sesja nie została odświeżona – wyloguj się i zaloguj ponownie.

---

## Krok 5. Python – moduł `venv`

Ubuntu 24.04 ma wbudowanego Pythona 3.12, ale moduł do tworzenia środowisk (`venv`) jest w osobnym pakiecie.

**Sprawdź przed:**
```bash
python3 --version
dpkg -l python3.12-venv 2>/dev/null | grep ^ii
```

**Wymagane:**
| komenda | musi pokazać |
|---|---|
| `python3 --version` | `Python 3.12.3` |
| `dpkg -l python3.12-venv ...` | pusto = trzeba zainstalować; linia zaczynająca się od `ii` = już jest, pomiń „Wykonaj” |

**Wykonaj:**
```bash
sudo apt install python3.12-venv
```

**Sprawdź po:**
```bash
dpkg -l python3.12-venv | grep ^ii
python3 -m venv /tmp/venvtest && /tmp/venvtest/bin/pip --version; rm -rf /tmp/venvtest
```
Druga linia tworzy próbne środowisko w katalogu tymczasowym, sprawdza w nim `pip` i od razu je usuwa.

**Wymagane:**
| komenda | musi pokazać |
|---|---|
| `dpkg -l ...` | linia zaczynająca się od `ii  python3.12-venv` |
| test venv | `pip 24.0 from /tmp/venvtest/...` (bez błędu `ensurepip is not available`) |

---

✅ **Koniec części instalacyjnej.** System ma Git, Docker (zablokowane wersje) i Pythona z `venv`.
Dalej: pobranie repozytorium, konfiguracja, baza danych i dane OSM.



---

# CZĘŚĆ 2. Projekt: repozytorium, baza, dane

## Krok 6. Pobranie repozytorium

**Sprawdź przed:**
```bash
ls -d ~/Trail-Strider
ssh -T git@github.com
```

**Wymagane:**
| komenda | musi pokazać |
|---|---|
| `ls -d ~/Trail-Strider` | `No such file or directory` (folder jeszcze nie istnieje) |
| `ssh -T git@github.com` | `Hi <twój-login>! You've successfully authenticated...` |

❌ Jeśli `ssh -T` daje `Permission denied (publickey)` – najpierw skonfiguruj dostęp SSH do GitHuba (poza tą instrukcją).

**Wykonaj:**
```bash
cd ~
git clone git@github.com:MasnyMaras/Trail-Strider.git
cd ~/Trail-Strider/db
```
⚠️ Środowisko bazy danych znajduje się w folderze `db/`. Nie edytuj plików poza `db/` (np. `frontend/`).
**Od tego miejsca wszystkie komendy wykonujesz w `~/Trail-Strider/db`.**

**Sprawdź po:**
```bash
git branch
pwd
ls -a
```

**Wymagane:**
| komenda | musi pokazać |
|---|---|
| `git branch` | `* main` |
| `pwd` | `/home/<twoja-nazwa>/Trail-Strider/db` |
| `ls -a` | m.in. `.env.example`, `.gitattributes`, `.gitignore`, `SETUP.md`, `compose.yaml` |


---

## Krok 7. Plik `.env` (hasło do bazy)

`.env` przechowuje hasło do Twojej lokalnej bazy. Nie trafia do repozytorium (jest w `.gitignore`).

**Wykonaj:**
```bash
cp .env.example .env
```
Otwórz `.env` w edytorze i zmień `change_me` na własne hasło.
Zasady: bez spacji, bez cudzysłowów, bez polskich znaków, bez znaków `$` i `#`.

⚠️ Hasło jest zapisywane w bazie **tylko przy jej pierwszym uruchomieniu**. Ustal je teraz.

**Sprawdź po:**
```bash
docker compose config --quiet && echo "skladnia OK"
docker compose config | grep -E "^name:|name: trail-strider_|host_ip"
git check-ignore -v .env
```

**Wymagane:**
| komenda | musi pokazać |
|---|---|
| `docker compose config --quiet ...` | `skladnia OK` |
| `docker compose config \| grep ...` | `name: trail-strider`, `host_ip: 127.0.0.1`, `name: trail-strider_default`, `name: trail-strider_pgdata` |
| `git check-ignore -v .env` | `db/.gitignore:2:.env	.env` – plik `.env` jest ignorowany przez Gita (nie trafi do repozytorium) |




---

## Krok 8. Pobranie danych OSM (Małopolska)

Używamy pliku z konkretną datą (stan OSM na 1.10.2026) zamiast `latest` – wszyscy mają identyczne dane.

**Sprawdź przed:**
```bash
df -h /
```
**Wymagane:** kolumna `Avail` co najmniej **5G**.

**Wykonaj:**
```bash
mkdir -p data
wget -P data https://download.geofabrik.de/europe/poland/malopolskie-261001.osm.pbf
wget -P data https://download.geofabrik.de/europe/poland/malopolskie-261001.osm.pbf.md5
```
Pobieranie trwa kilka minut (193 MB).

**Sprawdź po:**
```bash
cd data && md5sum -c malopolskie-261001.osm.pbf.md5; cd ..
ls -l data
git check-ignore -v data/malopolskie-261001.osm.pbf
```

**Wymagane:**
| komenda | musi pokazać |
|---|---|
| `md5sum -c ...` | `malopolskie-261001.osm.pbf: OK` (plik kompletny i nieuszkodzony) |
| `ls -l data` | `malopolskie-261001.osm.pbf` o rozmiarze **202209422** oraz `.md5` o rozmiarze **61** |
| `git check-ignore -v ...` | `db/.gitignore:5:data/	data/malopolskie-261001.osm.pbf` (dane nie trafią do repozytorium) |

❌ `md5sum` pokazuje `FAILED` – usuń pliki z `data/` i pobierz ponownie.




---

## Krok 9. Uruchomienie bazy danych

**Sprawdź przed:**
```bash
ss -ltn | grep 5432
docker volume ls | grep trail-strider
```

**Wymagane:**
| komenda | musi pokazać |
|---|---|
| `ss -ltn \| grep 5432` | pusto (port 5432 wolny) |
| `docker volume ls \| grep trail-strider` | pusto (baza jeszcze nie istnieje) |

❌ Jeśli port 5432 jest zajęty – działa już inna baza PostgreSQL. Zatrzymaj ją albo zgłoś.

**Wykonaj:**
```bash
docker compose up -d
```
Za pierwszym razem Docker pobierze obraz bazy (ok. 240 MB). `-d` = baza działa w tle.

**Sprawdź po:**
```bash
docker compose ps
docker compose logs db | tail -n 3
docker compose exec db psql -U osm -d osm -P pager=off -c "SELECT version();"
docker compose exec db psql -U osm -d osm -P pager=off -c "SELECT postgis_lib_version();"
```
Jeśli w logach nie ma jeszcze `ready to accept connections` – odczekaj kilka sekund i powtórz (pierwsze uruchomienie tworzy bazę).

**Wymagane:**
| komenda | musi pokazać |
|---|---|
| `docker compose ps` | `trail-strider-db-1`, status `Up`, port `127.0.0.1:5432->5432/tcp` |
| `docker compose logs db \| tail -n 3` | ostatnia linia: `database system is ready to accept connections` |
| `SELECT version();` | zaczyna się od `PostgreSQL 18.6` |
| `SELECT postgis_lib_version();` | `3.6.4` |

ℹ️ Po restarcie komputera baza nie startuje sama – przed pracą: `docker compose up -d` (w `~/Trail-Strider/db`).


### 9b. Podgląd bazy (przed importem)

Do bazy wchodzi się konsolą `psql`, która działa wewnątrz kontenera:
```bash
docker compose exec db psql -U osm -d osm
```
Znak zachęty zmieni się na `osm=#` – jesteś w bazie. Zasady:
- komendy zaczynające się od `\` to polecenia konsoli (bez średnika),
- zapytania SQL muszą kończyć się `;` (bez średnika zachęta zmienia się na `osm-#` – psql czeka na resztę; `\r` czyści, `Ctrl+C` przerywa),
- jeśli wynik otworzy się w przeglądarce tekstu – strzałki przewijają, `q` zamyka,
- `\q` – wyjście z bazy.

Wpisz po kolei:
```
\dn
\dt public.*
SELECT pg_size_pretty(pg_database_size('osm'));
\q
```

**Wymagane (pusta baza):**
| komenda | co pokazuje | musi pokazać |
|---|---|---|
| `\dn` | schematy („foldery” na tabele) | `public`, `tiger`, `topology` |
| `\dt public.*` | tabele w schemacie `public` | tylko `spatial_ref_sys` (słownik układów współrzędnych) |
| `SELECT pg_size_pretty(...)` | rozmiar bazy | ok. `19 MB` |

Te same komendy wykonasz po imporcie – pojawią się tabele z danymi OSM.


---

## Krok 10. Import danych OSM do bazy

**Sprawdź przed:**
```bash
docker compose exec db psql -U osm -d osm -P pager=off -c "\dt public.*"
```
**Wymagane:** tylko `spatial_ref_sys` (baza bez danych OSM).

**Wykonaj:**
```bash
time docker compose run --rm osm2pgsql -O flex -S /config/generic.lua /data/malopolskie-261001.osm.pbf
```
- `-O flex -S /config/generic.lua` – tryb importu i plik konfiguracji (`db/osm2pgsql/generic.lua`),
- `/data/...` – plik danych (`db/data/...`); ścieżki są widziane z wnętrza kontenera,
- za pierwszym razem Docker pobierze obraz osm2pgsql (ok. 280 MB),
- import trwa ok. 1,5 minuty.

**Wymagane (końcówka wyniku):**
```
  Processed 24096182 nodes in ...
  Processed 3142543 ways in ...
  Processed 30762 relations in ...
...
osm2pgsql took ...s overall.
```
Liczby `nodes / ways / relations` muszą być **identyczne**; czasy mogą się różnić.
❌ Jakakolwiek linia z `ERROR` – zatrzymaj się i zgłoś.

**Sprawdź po** (te same komendy co w 9b):
```bash
docker compose exec db psql -U osm -d osm
```
```
\dt public.*
SELECT pg_size_pretty(pg_database_size('osm'));
\q
```
Dokładna liczba obiektów:
```bash
docker compose exec db psql -U osm -d osm -P pager=off -c "SELECT (SELECT count(*) FROM points) AS points, (SELECT count(*) FROM lines) AS lines, (SELECT count(*) FROM polygons) AS polygons, (SELECT count(*) FROM routes) AS routes, (SELECT count(*) FROM boundaries) AS boundaries;"
```

**Wymagane:**
| komenda | musi pokazać |
|---|---|
| `\dt public.*` | 7 tabel: `boundaries`, `lines`, `osm2pgsql_properties`, `points`, `polygons`, `routes`, `spatial_ref_sys` |
| rozmiar bazy | ok. `1314 MB` (wcześniej 19 MB) |
| liczba obiektów | `points 1071381`, `lines 938950`, `polygons 2179021`, `routes 2986`, `boundaries 3889` – **co do sztuki** |

| tabela | co zawiera |
|---|---|
| `points` | punkty z tagami (np. źródła wody, schroniska, sklepy) |
| `lines` | linie (drogi, ścieżki, rzeki) |
| `polygons` | obszary (budynki, lasy, jeziora) |
| `routes` | trasy, m.in. **szlaki turystyczne** |
| `boundaries` | granice administracyjne |



---

## Krok 11. Środowisko Pythona UWAGA TO JEST DO TESTU CZY WYGENERUJĄ NAM SIĘ PLIKI PNG ZE SKRYPTU PYTHONA, SPRAWDZENIE CZY WSZYSTKO DZIALA, DOCELOWO TO SRODOWISKO NIE MA ZNACZENIA, JEST TYMCZASOWE, 

Paczki Pythona instalujemy w osobnym środowisku (`.venv`) w dokładnych wersjach z `scripts/requirements.txt`.

**Wykonaj:**
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r scripts/requirements.txt
```
- `python3 -m venv .venv` – tworzy środowisko w `db/.venv` (poza repozytorium, jest w `.gitignore`),
- `source .venv/bin/activate` – włącza środowisko; znak zachęty zaczyna się od `(.venv)`,
- `pip install -r ...` – instaluje 22 paczki w dokładnych wersjach.

⚠️ Aktywacja działa tylko w tym oknie terminala. **W każdym nowym terminalu** przed uruchomieniem skryptów:
`cd ~/Trail-Strider/db && source .venv/bin/activate`. Wyjście ze środowiska: `deactivate`.

**Sprawdź po:**
```bash
diff <(pip freeze --path .venv/lib/python3.12/site-packages) scripts/requirements.txt && echo "IDENTYCZNE"
git check-ignore -v .venv
```

**Wymagane:**
| komenda | musi pokazać |
|---|---|
| `diff ...` | `IDENTYCZNE` (zainstalowane wersje = wersje z `requirements.txt`) |
| `git check-ignore -v .venv` | `db/.gitignore:8:.venv/	.venv` |

❌ Jeśli `diff` wypisuje różnice (linie z `<` / `>`) – zgłoś.



---

## Krok 12. Test końcowy – mapy z bazy danych

Dwa skrypty pobierają dane z bazy i rysują mapy PNG. Jeśli oba zadziałają – całe środowisko jest poprawne.

**Sprawdź przed:**
```bash
pwd
docker compose ps
```

**Wymagane:**
| komenda | musi pokazać |
|---|---|
| znak zachęty | zaczyna się od `(.venv)` (jeśli nie: `source .venv/bin/activate`) |
| `pwd` | `/home/<twoja-nazwa>/Trail-Strider/db` |
| `docker compose ps` | `trail-strider-db-1` ze statusem `Up` |

**Wykonaj:**
```bash
python scripts/krakow_map.py
python scripts/malopolskie_roads.py
```

**Wymagane:**
| skrypt | musi pokazać |
|---|---|
| `krakow_map.py` | `granica 1`, `drogi 60,178`, `budynki 126,351`, `noclegi 410`, `Zapisano output/krakow.png` |
| `malopolskie_roads.py` | `(385,313 odcinków dróg)`, `Zapisano output/malopolskie_drogi.png` |

Liczby obiektów muszą być **identyczne**. Czasy są orientacyjne (u autora: ok. 4 s na skrypt).

**Sprawdź po:** otwórz obrazy:
```bash
xdg-open output/krakow.png
xdg-open output/malopolskie_drogi.png
```
- `krakow.png` – budynki, drogi, czerwone punkty noclegów, niebieska granica miasta,
- `malopolskie_drogi.png` – sieć dróg województwa (główne grube czarne, lokalne jasne), niebieska granica.

✅ **Środowisko gotowe.** Masz u siebie bazę PostgreSQL + PostGIS z danymi OSM Małopolski i działające skrypty.

### Codzienna praca (po restarcie komputera)
```bash
cd ~/Trail-Strider/db
docker compose up -d             # uruchom bazę (więcej o pracy z dockerem w README_ADDITIONAL.md - moj plik stary, nie trzeba go doglebie analizowac ale mozna znalezc wiecej info o pracy z dockerem, bazą)
source .venv/bin/activate        # włącz środowisko Pythona
```
Koniec pracy: `docker compose stop` (dane zostają w bazie).



---

# MIGRACJA do nowej struktury (dla osób, które przeszły ten SETUP)

Od teraz `compose.yaml`, `.env` i `data/` są w **głównym folderze** repozytorium (`~/Trail-Strider`),
a nie w `db/`. Aktualna instrukcja: `docs/SETUP.md`. Twoja baza z danymi **zostaje** – nie trzeba ponownego importu.

## M1. Zatrzymaj bazę (jeszcze ze starego miejsca)

```bash
cd ~/Trail-Strider/db
docker compose down
```
**Wymagane:** `Container trail-strider-db-1 Removed`. Dane zostają w wolumenie.
(Jeśli baza nie była uruchomiona – komunikat może być pusty, to OK.)

## M2. Pobierz nową strukturę

```bash
cd ~/Trail-Strider
git status
git pull
```
**Wymagane:** przed `git pull` – `nothing to commit, working tree clean`. Po `git pull` – w głównym folderze są `compose.yaml` i `.env.example`.
ℹ️ Po `git pull` polecenie `git status` może pokazać `db/data/` i `db/output/` jako nowe pliki (`??`).
To normalne – znikną po kroku M3. **Nie dodawaj ich do commita.**

## M3. Przenieś swoje pliki lokalne (Git ich nie przenosi)

```bash
mv db/.env .env
mv db/data data
rm -rf db/output
```
Jeśli któregoś z nich nie masz (nie doszedłeś do tego kroku) – pomiń tę linię.

**Sprawdź:**
```bash
ls -a
git status --short
```
**Wymagane:** w `ls -a` są `.env` i `data`; `git status --short` – **pusto**.

## M4. Uruchom bazę z nowego miejsca

```bash
docker compose up -d
docker compose logs db | grep -i "skipping initialization"
```
**Wymagane:** `Database directory appears to contain a database; Skipping initialization` – baza podpięła Twoje istniejące dane.

## M5. Python i skrypty

Środowisko zostaje w `db/.venv`. Zmienia się tylko sposób uruchamiania – **z głównego folderu**:
```bash
cd ~/Trail-Strider
source db/.venv/bin/activate
python db/scripts/krakow_map.py
```
**Wymagane:** te same liczby co wcześniej; obrazy zapisują się teraz w `~/Trail-Strider/output/`.
