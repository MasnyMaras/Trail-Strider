# ROUTING – usługa wyznaczania tras (folder `routing/`)

## Wstęp
Usługa `routing` to osobny kontener odpowiedzialny w projekcie za wyznaczanie tras. Przyjmuje listę punktów
(start, punkty pośrednie, meta), przekazuje je do BRoutera (silnik tras, `docs/BROUTER.md`) i zwraca gotową trasę:
linię do narysowania na mapie (GeoJSON, z wysokością w każdym punkcie) oraz ten sam przebieg jako GPX.
Docelowo w routingu powstaną też tryb automatyczny (optymalna kolejność punktów) i podział trasy na dni.

Z routingu korzysta **wyłącznie backend** – frontend (przeglądarka) nigdy nie łączy się z routingiem bezpośrednio.
Na potrzeby testów routing jest też dostępny z laptopa (port 8001).

## Jak to działa
1. Backend wysyła do routingu zapytanie `POST /route` z punktami w formacie JSON.
2. `app/main.py` sprawdza format danych i wywołuje funkcję `path()` z `app/routing.py`.
3. `app/routing.py` wysyła zapytanie do BRoutera (`GET /brouter`), a z otrzymanej trasy tworzy też GPX.
4. Routing odsyła backendowi `{"json": <GeoJSON>, "gpx": "<tekst GPX>"}` albo błąd z odpowiednim kodem HTTP
   (tabela w sekcji „API routingu”).

## Co jest w `routing/app` i jak współpracuje z backendem

| plik | rola | związek z backendem |
|---|---|---|
| `main.py` | serwer HTTP (FastAPI): endpointy `/health` i `/route`, zamiana błędów na kody HTTP | jego endpoint `/route` wywołuje backend (`backend/app/routing_client.py`) – format zapytania i odpowiedzi musi być zgodny po obu stronach |
| `routing.py` | logika wyznaczania trasy: zapytanie do BRoutera, tworzenie GPX; tu powstaną tryb automatyczny i podział na dni | backend nie importuje tego kodu – korzysta z niego tylko przez `/route` |
| `test.py` | przykład użycia `routing.py` do ręcznych testów | – |
| `__init__.py` | pusty – oznacza, że `app` to pakiet Pythona | – |

⚠️ Zmiana formatu zapytania lub odpowiedzi `/route` (np. nowe pole, inna nazwa klucza) wymaga zmiany w backendzie –
uzgadniaj ją z osobą odpowiedzialną za backend.

---

**Wymagania:** wykonane `docs/SETUP.md` i `docs/BROUTER.md` – BRouter działa (test trasy z kroku 3 przechodzi).

ℹ️ **Robiłeś poprzednią wersję instrukcji BRoutera** (`docs/BROUTER_OLD.md`): pliki `routing/routing.py`
i `routing/test.py` zostały przeniesione do `routing/app/`. Jeśli masz w nich niezapisane zmiany –
**przed `git pull` zrób commit**, inaczej pull się nie uda. Po pullu nic nie przenosisz ręcznie;
kafle w `routing/segments4` zostają na miejscu.

**Zasady:**
- Każdy krok: **Sprawdź przed → Wykonaj → Sprawdź po.**
- Wynik musi się zgadzać z tabelą „Wymagane”. Jeśli nie – **zatrzymaj się** i zgłoś, nie idź dalej.
- Wszystkie komendy wykonujesz w `~/Trail-Strider`.

---

## Krok 1. Uruchomienie routingu

**Sprawdź przed:**
```bash
cd ~/Trail-Strider
ls routing/app
docker compose ps brouter
ss -ltn | grep 8001
```

**Wymagane:**
| komenda | musi pokazać |
|---|---|
| `ls routing/app` | `__init__.py  main.py  routing.py  test.py` |
| `docker compose ps brouter` | `trail-strider-brouter-1`, status `Up` |
| `ss -ltn \| grep 8001` | pusto (port 8001 wolny) |

**Wykonaj:**
```bash
docker compose up -d --build routing
```
- `--build` – buduje obraz z `routing/Dockerfile`: Python 3.12 + biblioteki z `routing/requirements.txt` (przypięte wersje),
- za pierwszym razem Docker pobiera obraz Pythona (ok. 45 MB) i instaluje biblioteki – ok. 30–40 s,
- routing startuje po uruchomieniu BRoutera (`depends_on` w `compose.yaml`).

**Sprawdź po** (odczekaj ok. 15 s po uruchomieniu):
```bash
docker compose ps routing
curl -s http://127.0.0.1:8001/health; echo
curl -s -X POST http://127.0.0.1:8001/route -H "Content-Type: application/json" \
  -d '{"points": [[20.94498, 50.06465], [20.93658, 50.06143]]}' \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(list(d), d['json']['features'][0]['properties']['track-length'])"
curl -s -X POST http://127.0.0.1:8001/route -H "Content-Type: application/json" -d '{"points": [[20.94498, 50.06465]]}'; echo
```
- `-X POST` – metoda HTTP, `-H "Content-Type: application/json"` – nagłówek: treść to JSON, `-d '...'` – treść zapytania,
- trzecia komenda – trasa między dwoma punktami; wypisuje klucze odpowiedzi i długość trasy w metrach,
- czwarta – za mało punktów (test komunikatu błędu).

**Wymagane:**
| komenda | musi pokazać |
|---|---|
| `docker compose up ...` (koniec wyniku) | `Image trail-strider-routing Built`, `Container trail-strider-brouter-1 Running`, `Container trail-strider-routing-1 Started` |
| `docker compose ps routing` | `trail-strider-routing-1`, status `Up ... (healthy)`, port `127.0.0.1:8001->8000/tcp` |
| `curl .../health` | `{"status":"ok"}` |
| trasa | `['json', 'gpx'] 1707` |
| 1 punkt | `{"detail":"Route must have at least 2 points."}` |

Dokumentacja API routingu: `http://127.0.0.1:8001/docs`.

✅ **Routing działa.** Dalej: `docs/BACKEND.md`.

---

## API routingu

**`POST /route`** – treść zapytania (JSON):
```json
{"points": [[20.94498, 50.06465], [20.93658, 50.06143]], "mode": "m"}
```
- `points` – co najmniej 2 punkty, każdy w kolejności **`[lon, lat]`** (długość, szerokość),
- `mode` – `"m"` ręczny (domyślny), `"a"` automatyczny (jeszcze niezaimplementowany).

Odpowiedź: `{"json": <GeoJSON trasy z BRoutera>, "gpx": "<tekst GPX>"}`. Punkty linii trasy mają postać
`[lon, lat, wysokość]`.

| kod | kiedy | `detail` |
|---|---|---|
| 200 | trasa wyznaczona | – |
| 400 | błędne dane (np. 1 punkt) albo BRouter odrzucił zapytanie (np. punkt poza kaflami) | komunikat, np. `brouter: datafile E15_N45.rd5 not found` |
| 422 | zły format JSON (np. tekst zamiast liczb) | opis błędu (FastAPI) |
| 501 | tryb `"a"` | `Automatic mode not yet implemented.` |
| 502 | BRouter niedostępny albo zwrócił błąd serwera | `brouter: ...` |
| 504 | BRouter nie zdążył (limit 10 s) | `brouter: timeout` |

---

## Codzienna praca

```bash
docker compose up -d routing          # uruchom (uruchomi też BRouter, jeśli nie działa)
docker compose stop routing           # zatrzymaj
docker compose logs -f routing        # logi na żywo (Ctrl+C kończy podgląd)
```

| sytuacja | co zrobić |
|---|---|
| zmiana kodu w `routing/app/` | nic – serwer przeładowuje się sam po zapisie pliku |
| po `git pull` zmienił się `routing/requirements.txt` albo `routing/Dockerfile` | `docker compose up -d --build routing` (jeśli masz już również kontener backendu: `docker compose up -d --build backend routing`) |
| routing `(unhealthy)` po `git pull` / `git pull --rebase` (w logach `Could not import module "app.main"`) | `docker compose up -d --force-recreate routing` |

**Skrypt testowy `test.py`** uruchamiasz w kontenerze:
```bash
docker compose exec -T routing python app/test.py
```
`test.py` wyznacza trasę przez 3 punkty z kafla `E20_N50` i wypisuje ją jako GeoJSON, a następnie jako GPX
(ostatnia linia wyniku: `</gpx>`).

ℹ️ Zapis wyniku do pliku jest w `test.py` zakomentowany (kontener widzi kod tylko do odczytu). Aby zapisać
wynik na laptopie, przekieruj wyjście: `docker compose exec -T routing python app/test.py > output/test.txt`.

---

## Biblioteki Pythona – zasady

- Nową bibliotekę dopisujesz **tylko do `routing/requirements.in`** (sama nazwa, bez wersji).
  **`requirements.txt` nigdy nie edytujesz ręcznie** – jest generowany komendą i to z niego budowany jest obraz.
- Po każdej zmianie generujesz **wszystkie** listy naraz – `backend/requirements.txt` i `routing/requirements.txt`.
  Komenda bierze najnowsze wersje bibliotek; wygenerowanie tylko jednej listy rozjeżdża wersje bibliotek wspólnych
  dla obu usług (np. FastAPI wydaje nowe wersje nawet kilka razy dziennie).
- Po wygenerowaniu przebudowujesz **wszystkie usługi**, także backend, jeśli masz już jego kontener –
  bez `--build` kontener działa dalej ze starymi bibliotekami.

**Procedura:**
1. Dopisz nazwę biblioteki do `routing/requirements.in`.
2. Wygeneruj obie listy:
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
3. Przebuduj usługi:
   - masz tylko routing: `docker compose up -d --build routing`,
   - masz też backend: `docker compose up -d --build backend routing`.
4. Przetestuj: krok 1 tej instrukcji (i krok 1 `docs/BACKEND.md`, jeśli masz backend).
5. Commituj `requirements.in` i `requirements.txt` **obu** usług.

---

## Struktura `routing/`

| plik | co zawiera |
|---|---|
| `app/` | kod usługi (tabela na początku instrukcji) |
| `Dockerfile` | przepis na obraz (Python 3.12, przypięty digestem) |
| `requirements.in` | biblioteki wybrane świadomie: `fastapi`, `fastapi-cli`, `requests`, `gpxpy` |
| `requirements.txt` | pełna lista bibliotek z wersjami – generowana, nie edytować ręcznie |
| `.dockerignore` | `segments4/` – kafle nie trafiają do budowania obrazu |
| `segments4/` | kafle BRoutera (poza repozytorium, `docs/BROUTER.md`) – używa ich tylko kontener `brouter` |

Usługa `routing` w `compose.yaml`: port `127.0.0.1:8001` (w kontenerze 8000), kod z `routing/app`
podpięty do kontenera (tylko odczyt), automatyczne przeładowanie (`--reload`), adres BRoutera w zmiennej
`BROUTER_URL`, healthcheck co 30 s.

---

## Obraz całości (po `docs/ROUTING.md` i `docs/BACKEND.md`)

```
                          localhost (127.0.0.1)
              :8000            :8001             :17777            :5432
                │                │                  │                 │
  ┌─────────────┼────────────────┼──────────────────┼─────────────────┼──────┐
  │          backend ─────────► routing ─────────► brouter            db     │
  │             │           (routing:8000)    (brouter:17777)         ▲      │
  │             └─────────────────────────────────────────────────────┘      │
  │                                                              (db:5432)   │
  │                      sieć Dockera: trail-strider_default                 │
  └──────────────────────────────────────────────────────────────────────────┘
```

| usługa | folder w repozytorium | port z laptopa | adres w sieci projektu | kto z niej korzysta |
|---|---|---|---|---|
| `backend` | `backend/` | `8000` | `backend:8000` | frontend (przeglądarka), testy `curl` |
| `routing` | `routing/` | `8001` | `routing:8000` | backend (z laptopa – tylko testy) |
| `brouter` | gotowy obraz; kafle w `routing/segments4/` | `17777` | `brouter:17777` | routing |
| `db` | `db/` (skrypty, konfiguracja importu) | `5432` | `db:5432` | backend, skrypty, DBeaver |

Kolejność startu wynika z `depends_on`: `db` i `brouter` → `routing` → `backend`.
Kontenery łączą się ze sobą po nazwach usług; porty z localhost (`127.0.0.1`) służą do testów i podglądu.