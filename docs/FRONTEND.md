# FRONTEND – aplikacja kliencka (React + Vite, folder `frontend/`)
Instrukcja uruchamia frontend projektu: aplikację jednostronicową (SPA) w React + TypeScript (zbudowaną przy użyciu Vite) w kontenerze Dockera, w trybie deweloperskim z obsługą Hot Module Replacement (HMR).
Frontend komunikuje się z backendem za pośrednictwem wbudowanego w Vite mechanizmu reverse proxy.

```
przeglądarka (localhost:5173) ──► frontend (Vite dev server)
                                         │
                         proxy: /api ────┴──► backend:8000 ──► routing / db
```

Wszystkie zapytania wysyłane w kodzie Reacta do ścieżek relatywnych `/api/...` są automatycznie przekazywane wewnątrz sieci Dockera do kontenera `backend:8000`, co całkowicie eliminuje problem CORS i nie wymaga definiowania adresów IP na sztywno.

**Wymagania:** wykonane w całości `docs/SETUP.md`, `docs/BROUTER.md`, `docs/ROUTING.md` oraz `docs/BACKEND.md` (usługi `db`, `brouter`, `routing` i `backend` działają i są zdrowe).

**Zasady:**
- Każdy krok: **Sprawdź przed → Wykonaj → Sprawdź po.**
- Wynik musi się zgadzać z tabelą „Wymagane”. Jeśli nie – **zatrzymaj się** i zgłoś, nie idź dalej.
- Wszystkie komendy wykonujesz w głównym katalogu projektu (`~/Trail-Strider`).

---

## Krok 1. Uruchomienie frontendu

**Sprawdź przed:**
```bash
cd ~/Trail-Strider
ls frontend
docker compose config --services
docker compose ps backend
ss -ltn | grep 5173
```

**Wymagane:**
| komenda | musi pokazać |
|---|---|
| `ls frontend` | m.in. `Dockerfile`, `.dockerignore`, `package.json`, `package-lock.json`, `vite.config.ts`, `src` |
| `docker compose config --services` | na liście są: `db`, `brouter`, `routing`, `backend`, `frontend` |
| `docker compose ps backend` | `trail-strider-backend-1`, status `Up ... (healthy)` |
| `ss -ltn \| grep 5173` | pusto (port 5173 wolny) |

❌ `ls: cannot access 'frontend/Dockerfile'` – nie masz najnowszej wersji repozytorium: `git pull`.  
❌ Backend nie działa lub jest `unhealthy` – wykonaj najpierw `docs/BACKEND.md`.  
❌ Port 5173 zajęty – zatrzymaj się i sprawdź, jaki proces go blokuje.

**Wykonaj:**
```bash
docker compose up -d --build frontend
```
- `--build` – buduje obraz z `frontend/Dockerfile`: Node.js 22 Alpine + instalacja zależności przez `npm ci` na podstawie `package-lock.json`,
- za pierwszym razem pobranie obrazu i instalacja pakietów trwa ok. 30–60 s,
- frontend startuje dopiero, gdy backend zgłasza status `(healthy)`.

**Sprawdź po** (odczekaj ok. 10 s po uruchomieniu):
```bash
docker compose ps frontend
docker compose logs frontend | tail -n 6
curl -s -I http://127.0.0.1:5173 | head -n 1
curl -s http://127.0.0.1:5173/api/health; echo
curl -s http://127.0.0.1:5173/api/health/db; echo
curl -s -X POST http://127.0.0.1:5173/api/route -H "Content-Type: application/json" \
  -d '{"points": [[20.94498, 50.06465], [20.93658, 50.06143]]}' \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(list(d), d['json']['features'][0]['properties']['track-length'])"
docker image ls trail-strider-frontend
```

**Wymagane:**
| komenda | musi pokazać |
|---|---|
| `docker compose ps frontend` | `trail-strider-frontend-1`, status `Up`, port `127.0.0.1:5173->5173/tcp` |
| `docker compose logs frontend` | linie Vite: `ready in ... ms`, `➜ Local: http://localhost:5173/` |
| `curl ...:5173` | `HTTP/1.1 200 OK` |
| `curl .../api/health` | `{"status":"ok"}` (zapytanie przeszło przez proxy do backendu) |
| `curl .../api/health/db` | `{"db":"ok","postgis":"3.6.4"}` |
| trasa przez proxy | `['json', 'gpx'] 1707` |
| `docker image ls ...` | `trail-strider-frontend:latest` |

Otwórz w przeglądarce: **`http://localhost:5173`** – strona aplikacji React powinna się załadować.

✅ **Frontend działa.**

## Praca z aplikacją i API

### 1. Zapytania do API w kodzie React
Dzięki skonfigurowanemu proxy w `vite.config.ts`, w kodzie frontendu **nigdy nie wpisujemy adresów `http://127.0.0.1:8000` ani `localhost`**. Odwołujemy się zawsze do ścieżki relatywnej `/api`.
## Codzienna praca

```bash
docker compose up -d frontend       
docker compose stop frontend        
docker compose logs -f frontend     
```
- **docker compose up -d frontend**: uruchom (uruchomi też backend, bazę, routing i BRouter, jeśli nie działają)
- **docker compose stop frontend**: zatrzymaj sam frontend
- **docker compose logs -f frontend**: logi Vite na żywo (Ctrl+C kończy podgląd, nie zatrzymuje kontenera)


---

## Zmiana bibliotek frontu (`package.json` / `package-lock.json`)

⚠️ **Do weryfikacji przez autora frontendu.**

Biblioteki (`node_modules`) są instalowane w obrazie (`npm ci` w `frontend/Dockerfile`) i trzymane w kontenerze
w **wolumenie anonimowym** (`- /app/node_modules` w `compose.yaml`) – dzięki temu kod z repozytorium
(`./frontend:/app`) ich nie zasłania. Przy odtwarzaniu kontenera Compose **przejmuje zawartość wolumenu
anonimowego z poprzedniego kontenera** – samo `--build` zbuduje obraz z nowymi bibliotekami, ale kontener
dalej będzie widział stare `node_modules`.

**Kiedy:** po `git pull`, jeśli zmienił się `frontend/package.json` lub `frontend/package-lock.json`,
albo po dodaniu biblioteki.

**Wykonaj:**
```bash
docker compose up -d --build -V frontend
```
- `--build` – buduje obraz z nowymi bibliotekami (`npm ci`),
- `-V` (`--renew-anon-volumes`) – tworzy wolumen anonimowy od nowa, zamiast przejmować stary; kontener widzi
  `node_modules` z nowego obrazu.

**Sprawdź po:**
```bash
docker compose exec frontend npm ls --depth=0
```
Lista bibliotek pierwszego poziomu z wersjami – musi zgadzać się z `frontend/package.json`.

| objaw | przyczyna | co zrobić |
|---|---|---|
| w logach Vite lub w przeglądarce: `Failed to resolve import "..."` po `git pull` | kontener ma stare `node_modules` | `docker compose up -d --build -V frontend` |

ℹ️ Stary wolumen anonimowy zostaje na dysku. Nieużywane wolumeny usuwa `docker volume prune`
(pyta o potwierdzenie; **nie rusza** wolumenów podpiętych do istniejących kontenerów, np. bazy `pgdata`).