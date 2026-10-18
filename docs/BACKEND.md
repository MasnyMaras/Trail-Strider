# BACKEND – serwer API (FastAPI, folder `backend/`)
Instrukcja uruchamia backend projektu: serwer API w Pythonie (FastAPI) w kontenerze Dockera.
Backend łączy się z bazą danych i z usługą routingu; z backendem rozmawia frontend.

```
przeglądarka / curl ──► backend ──► db       (PostgreSQL + PostGIS)
                            └─────► routing ──► brouter
```

Endpointy na tym etapie:
- `GET /api/health` – czy backend działa,
- `GET /api/health/db` – czy działa połączenie z bazą,
- `POST /api/route` – wyznaczenie trasy przez routing (na razie zwraca odpowiedź routingu bez zmian).

**Wymagania:** wykonane w całości `docs/SETUP.md`, `docs/BROUTER.md` i `docs/ROUTING.md`.

**Zasady:**
- Każdy krok: **Sprawdź przed → Wykonaj → Sprawdź po.**
- Wynik musi się zgadzać z tabelą „Wymagane”. Jeśli nie – **zatrzymaj się** i zgłoś, nie idź dalej.
- Wszystkie komendy wykonujesz w `~/Trail-Strider`.

---

## Krok 1. Uruchomienie backendu

**Sprawdź przed:**
```bash
cd ~/Trail-Strider
ls backend
docker compose config --services
docker compose ps routing
ss -ltn | grep 8000
```

**Wymagane:**
| komenda | musi pokazać |
|---|---|
| `ls backend` | `app  Dockerfile  requirements.in  requirements.txt` |
| `docker compose config --services` | `db`, `brouter`, `routing`, `backend` |
| `docker compose ps routing` | `trail-strider-routing-1`, status `Up ... (healthy)` (`docs/ROUTING.md`) |
| `ss -ltn \| grep 8000` | pusto (port 8000 wolny) |

❌ `ls: cannot access 'backend'` – nie masz najnowszej wersji repozytorium: `git pull`.
❌ Port 8000 zajęty – zatrzymaj się i zgłoś.

**Wykonaj:**
```bash
docker compose up -d --build backend
```
- `--build` – buduje obraz z `backend/Dockerfile`: Python 3.12 + biblioteki z `backend/requirements.txt` (przypięte wersje);
  przebudowuje też routing (z pamięci podręcznej, jeśli nic się nie zmieniło),
- za pierwszym razem instalacja bibliotek trwa ok. 20–40 s,
- backend startuje dopiero, gdy baza i routing mają status `(healthy)`; jeśli nie działają, Compose uruchomi je sam
  (razem z BRouterem).

**Sprawdź po** (odczekaj ok. 15 s po uruchomieniu):
```bash
docker compose ps
docker compose logs backend | tail -n 3
curl -s http://127.0.0.1:8000/api/health; echo
curl -s http://127.0.0.1:8000/api/health/db; echo
curl -s -X POST http://127.0.0.1:8000/api/route -H "Content-Type: application/json" \
  -d '{"points": [[20.94498, 50.06465], [20.93658, 50.06143]]}' \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(list(d), d['json']['features'][0]['properties']['track-length'])"
curl -s -X POST http://127.0.0.1:8000/api/route -H "Content-Type: application/json" -d '{"points": [[20.94498, 50.06465]]}'; echo
docker image ls trail-strider-backend
```

**Wymagane:**
| komenda | musi pokazać |
|---|---|
| `docker compose up ...` (koniec wyniku) | `Image trail-strider-backend Built`, `Image trail-strider-routing Built`, `Container trail-strider-db-1 Healthy`, `Container trail-strider-routing-1 Healthy`, `Container trail-strider-backend-1 Started` |
| `docker compose ps` | `db`, `routing`, `backend` ze statusem `Up ... (healthy)`, `brouter` ze statusem `Up`; backend: port `127.0.0.1:8000->8000/tcp` |
| `docker compose logs ... \| tail -n 3` | ostatnia linia: `Application startup complete.` (albo zapytania healthchecku `"GET /api/health HTTP/1.1" 200 OK`) |
| `curl .../api/health` | `{"status":"ok"}` |
| `curl .../api/health/db` | `{"db":"ok","postgis":"3.6.4"}` |
| trasa | `['json', 'gpx'] 1707` |
| 1 punkt | `{"detail":"Route must have at least 2 points."}` |
| `docker image ls ...` | `trail-strider-backend:latest` |

Otwórz w przeglądarce `http://127.0.0.1:8000/docs` – strona **„Trail-Strider API”** z trzema endpointami.
To dokumentacja API generowana automatycznie z kodu; przycisk **Try it out → Execute** wysyła prawdziwe zapytanie.

✅ **Backend działa.**

---

## API backendu

**`POST /api/route`** – treść zapytania (JSON), taka sama jak w routingu:
```json
{"points": [[20.94498, 50.06465], [20.93658, 50.06143]], "mode": "m"}
```
- `points` – co najmniej 2 punkty, każdy **`[lon, lat]`**,
- `mode` – `"m"` ręczny (domyślny), `"a"` automatyczny (jeszcze niezaimplementowany).

Odpowiedź (tymczasowo – bez przetwarzania): `{"json": <GeoJSON trasy>, "gpx": "<tekst GPX>"}`.

| kod | kiedy | `detail` |
|---|---|---|
| 200 | trasa wyznaczona | – |
| 400 | błędne dane (np. 1 punkt) albo punkt poza kaflami BRoutera | komunikat z routingu, np. `brouter: datafile E15_N45.rd5 not found` |
| 422 | zły format JSON | opis błędu (FastAPI) |
| 501 | tryb `"a"` | `Automatic mode not yet implemented.` |
| 502 | awaria BRoutera lub routingu | `route service unavailable` (szczegóły w `docker compose logs backend`) |
| 503 | routing nie odpowiada (kontener wyłączony) | `routing unavailable` |
| 504 | przekroczony czas wyznaczania trasy | `route calculation timed out` |

---

## Codzienna praca

```bash
docker compose up -d backend       # uruchom (uruchomi też bazę, routing i BRouter, jeśli nie działają)
docker compose stop                # zatrzymaj wszystko
docker compose logs -f backend     # logi na żywo (Ctrl+C kończy podgląd, nie zatrzymuje backendu)
```

| sytuacja | co zrobić |
|---|---|
| zmiana kodu w `backend/app/` | nic – serwer przeładowuje się sam po zapisie pliku (w logach: `WatchFiles detected changes ... Reloading...`) |
| zmiana `backend/requirements.txt` albo `backend/Dockerfile` (np. po `git pull`) | `docker compose up -d --build backend` – bez `--build` zostaje stary obraz |
| `/api/health/db` zwraca `{"detail":"database unavailable"}` (kod 503) | baza nie działa: `docker compose ps db`, uruchom ją: `docker compose up -d db` |
| `/api/route` zwraca `{"detail":"routing unavailable"}` (kod 503) | routing nie działa: `docker compose ps routing`, uruchom go: `docker compose up -d routing` |
| backend lub routing `(unhealthy)` po `git pull` / `git pull --rebase` / przenoszeniu plików (w logach `Could not import module "app.main"`) | `docker compose up -d --force-recreate backend routing` |

ℹ️ Kontenery widzą foldery `backend/app` i `routing/app` bezpośrednio z repozytorium (bind mount). Gdy folder zostanie
usunięty i utworzony na nowo (robi to np. `git pull --rebase`), kontener dalej widzi stary, pusty folder –
dlatego trzeba go odtworzyć (`--force-recreate`).

ℹ️ **Healthcheck.** Docker co 30 s wysyła z wnętrza kontenera zapytanie do `/api/health` (backend) i `/health`
(routing). Wynik widać w `docker compose ps`: `(healthy)` – odpowiada, `(unhealthy)` – 3 nieudane próby z rzędu
(sprawdź `docker compose logs`). Healthcheck niczego nie restartuje, tylko pokazuje stan. Zapytania healthchecku
są widoczne w logach jako `127.0.0.1:... "GET /api/health" 200 OK`.

ℹ️ Baza (`db`) też ma healthcheck (`pg_isready`): `docker compose ps db` pokazuje `(healthy)`.

---

## Dodanie biblioteki Pythona (backend i routing)

- Nową bibliotekę dopisujesz **tylko do `requirements.in`** danej usługi (sama nazwa, bez wersji).
  **`requirements.txt` nigdy nie edytujesz ręcznie** – jest generowany komendą i to z niego budowany jest obraz.
- Po każdej zmianie generujesz **wszystkie** listy naraz – `backend/requirements.txt` i `routing/requirements.txt`.
  Komenda bierze najnowsze wersje bibliotek; wygenerowanie tylko jednej listy rozjeżdża wersje bibliotek wspólnych
  dla obu usług (np. FastAPI wydaje nowe wersje nawet kilka razy dziennie).
- Po wygenerowaniu przebudowujesz **obie usługi** – bez `--build` kontener działa dalej ze starymi bibliotekami.

1. Dopisz nazwę biblioteki do `backend/requirements.in` albo `routing/requirements.in`.
2. Wygeneruj **obie** pełne listy z dokładnymi wersjami:
```bash
for s in backend routing; do
  docker run --rm -v "$PWD/$s:/b:ro" \
    python:3.12-slim@sha256:a6e34c598f2467ed0e9a8d349809fcd8b5c603269512df273a0bb1784edc11b1 \
    sh -c "pip install -q --no-cache-dir -r /b/requirements.in && pip freeze" > $s/requirements.txt
done
diff backend/requirements.txt routing/requirements.txt
```
   Komunikaty `WARNING: Running pip as the 'root' user` i `[notice] A new release of pip` są normalne.
   `diff` może pokazać tylko biblioteki specyficzne dla jednej usługi (np. `SQLAlchemy` / `gpxpy`) – nigdy tę samą
   bibliotekę w dwóch różnych wersjach.
3. Przebuduj i przetestuj obie usługi: `docker compose up -d --build backend routing`, a potem testy z kroku 1 tej
   instrukcji i z `docs/ROUTING.md`.
4. Commituj pliki `requirements.in` i `requirements.txt` obu usług.

---

## Struktura `backend/`

| plik | co zawiera |
|---|---|
| `app/main.py` | endpointy API: `/api/health`, `/api/health/db`, `/api/route` |
| `app/db.py` | połączenie z bazą: pula połączeń SQLAlchemy (sterownik psycopg), dane logowania ze zmiennych `PG...` |
| `app/routing_client.py` | wywołanie usługi routingu (`POST /route`) i tłumaczenie jej błędów na kody dla frontu |
| `app/__init__.py` | pusty – oznacza, że `app` to pakiet Pythona |
| `Dockerfile` | przepis na obraz (Python 3.12, przypięty digestem) |
| `requirements.in` | biblioteki wybrane świadomie: `fastapi`, `fastapi-cli`, `sqlalchemy`, `psycopg[binary]`, `requests` |
| `requirements.txt` | pełna lista bibliotek z wersjami – generowana, nie edytować ręcznie; z niej budowany jest obraz |

Usługa `backend` w `compose.yaml`: port `127.0.0.1:8000`, kod z `backend/app` podpięty do kontenera (tylko odczyt),
automatyczne przeładowanie (`--reload`) – ustawienia do pracy lokalnej; healthcheck co 30 s;
dane logowania do bazy w zmiennych `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` (wartości z `.env`);
adres routingu w `ROUTING_URL`; `depends_on` – backend czeka, aż baza i routing będą `(healthy)`.