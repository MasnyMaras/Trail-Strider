# BACKEND – serwer API (FastAPI, folder `backend/`)
Instrukcja uruchamia backend projektu: serwer API w Pythonie (FastAPI) w kontenerze Dockera.
Na tym etapie backend ma dwa endpointy kontrolne: `GET /api/health` (czy backend działa) i `GET /api/health/db`
(czy działa połączenie z bazą). Połączenie z routingiem dojdzie w kolejnych wersjach.

**Wymagania:** najpierw wykonaj w całości `docs/SETUP.md` oraz `docs/BROUTER.md`.

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
ss -ltn | grep 8000
```

**Wymagane:**
| komenda | musi pokazać |
|---|---|
| `ls backend` | `app  Dockerfile  requirements.in  requirements.txt` |
| `docker compose config --services` | `backend`, `brouter`, `db` |
| `ss -ltn \| grep 8000` | pusto (port 8000 wolny) |

❌ `ls: cannot access 'backend'` – nie masz najnowszej wersji repozytorium: `git pull`.
❌ Port 8000 zajęty – zatrzymaj się i zgłoś.

**Wykonaj:**
```bash
docker compose up -d --build backend
```
- `--build` – buduje obraz z `backend/Dockerfile`: Python 3.12 + biblioteki z `backend/requirements.txt` (przypięte wersje),
- za pierwszym razem Docker pobiera obraz Pythona (ok. 45 MB) i instaluje biblioteki – ok. 40 s,
- backend startuje dopiero, gdy baza (`db`) ma status `(healthy)`; jeśli baza nie działa, Compose uruchomi ją sam.

**Sprawdź po** (odczekaj ok. 15 s po uruchomieniu):
```bash
docker compose ps backend
docker compose logs backend | tail -n 3
curl -s http://127.0.0.1:8000/api/health
curl -s http://127.0.0.1:8000/api/health/db
docker image ls trail-strider-backend
```

**Wymagane:**
| komenda | musi pokazać |
|---|---|
| `docker compose up ...` (koniec wyniku) | `Image trail-strider-backend Built`, `Container trail-strider-db-1 Healthy`, `Container trail-strider-backend-1 Started` |
| `docker compose ps backend` | `trail-strider-backend-1`, status `Up ... (healthy)`, port `127.0.0.1:8000->8000/tcp` (tuż po starcie: `(health: starting)`) |
| `docker compose logs ... \| tail -n 3` | ostatnia linia: `Application startup complete.` |
| `curl .../api/health` | `{"status":"ok"}` |
| `curl .../api/health/db` | `{"db":"ok","postgis":"3.6.4"}` |
| `docker image ls ...` | `trail-strider-backend:latest` |

Otwórz w przeglądarce `http://127.0.0.1:8000/docs` – strona **„Trail-Strider API”** z endpointami `GET /api/health` i `GET /api/health/db`.
To dokumentacja API generowana automatycznie z kodu; przycisk **Try it out → Execute** wysyła prawdziwe zapytanie.

✅ **Backend działa.**

---

## Codzienna praca

```bash
docker compose up -d backend       # uruchom (po restarcie komputera backend nie startuje sam)
docker compose stop backend        # zatrzymaj
docker compose logs -f backend     # logi na żywo (Ctrl+C kończy podgląd, nie zatrzymuje backendu)
```

| sytuacja | co zrobić |
|---|---|
| zmiana kodu w `backend/app/` | nic – serwer przeładowuje się sam po zapisie pliku (w logach: `WatchFiles detected changes ... Reloading...`) |
| zmiana `backend/requirements.txt` albo `backend/Dockerfile` (np. po `git pull`) | `docker compose up -d --build backend` – bez `--build` zostaje stary obraz |
| `/api/health/db` zwraca `{"detail":"database unavailable"}` (kod 503) | baza nie działa: `docker compose ps db`, uruchom ją: `docker compose up -d db` |
| backend `(unhealthy)` po `git pull` / `git pull --rebase` / przenoszeniu plików (`curl` nic nie zwraca, w logach `Could not import module "app.main"`) | `docker compose up -d --force-recreate backend` |

ℹ️ Kontener widzi folder `backend/app` bezpośrednio z repozytorium (bind mount). Gdy folder zostanie usunięty
i utworzony na nowo (robi to np. `git pull --rebase`), kontener dalej widzi stary, pusty folder –
dlatego trzeba go odtworzyć (`--force-recreate`).

ℹ️ **Healthcheck.** Docker co 30 s wysyła z wnętrza kontenera zapytanie do `/api/health`. Wynik widać
w `docker compose ps` przy statusie: `(healthy)` – backend odpowiada, `(unhealthy)` – 3 nieudane próby
z rzędu, backend nie działa (sprawdź `docker compose logs backend`). Healthcheck niczego nie restartuje,
tylko pokazuje stan. Zapytania healthchecku są widoczne w logach jako `127.0.0.1:... "GET /api/health" 200 OK`.

ℹ️ Baza (`db`) też ma healthcheck (`pg_isready`): `docker compose ps db` pokazuje `(healthy)`.
Pierwsze `docker compose up -d db` po pobraniu tej wersji odtworzy kontener bazy (zmieniła się jego
konfiguracja) – dane zostają w wolumenie.

---

## Dodanie biblioteki Pythona

1. Dopisz nazwę biblioteki do `backend/requirements.in` (lista bibliotek wybranych świadomie, bez wersji).
2. Wygeneruj pełną listę z dokładnymi wersjami:
```bash
docker run --rm -v "$PWD/backend:/b:ro" \
  python:3.12-slim@sha256:a6e34c598f2467ed0e9a8d349809fcd8b5c603269512df273a0bb1784edc11b1 \
  sh -c "pip install -q --no-cache-dir -r /b/requirements.in && pip freeze" > backend/requirements.txt
```
   Komunikaty `WARNING: Running pip as the 'root' user` i `[notice] A new release of pip` są normalne.
   ⚠️ Komenda bierze najnowsze wersje **wszystkich** bibliotek z `requirements.in` – po niej przetestuj backend.
3. Przebuduj obraz: `docker compose up -d --build backend`.
4. Commituj oba pliki: `requirements.in` i `requirements.txt`.

---

## Struktura `backend/`

| plik | co zawiera |
|---|---|
| `app/main.py` | kod API (endpointy) |
| `app/db.py` | połączenie z bazą: pula połączeń SQLAlchemy (sterownik psycopg), dane logowania ze zmiennych `PG...` |
| `app/__init__.py` | pusty – oznacza, że `app` to pakiet Pythona |
| `Dockerfile` | przepis na obraz (Python 3.12, przypięty digestem) |
| `requirements.in` | biblioteki wybrane świadomie: `fastapi`, `fastapi-cli`, `sqlalchemy`, `psycopg[binary]` |
| `requirements.txt` | pełna lista bibliotek z wersjami – z niej budowany jest obraz |

Usługa `backend` w `compose.yaml`: port `127.0.0.1:8000`, kod z `backend/app` podpięty do kontenera
(tylko odczyt), automatyczne przeładowanie (`--reload`) – ustawienia do pracy lokalnej; healthcheck co 30 s;
dane logowania do bazy w zmiennych `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` (wartości z `.env`);
`depends_on` – backend czeka, aż baza będzie `(healthy)`.