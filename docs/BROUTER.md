# BROUTER – silnik wyznaczania tras (usługa `brouter`)
Instrukcja uruchamia BRouter – gotowy program do wyznaczania tras pieszych i rowerowych –
w kontenerze Dockera i sprawdza, że wyznacza trasę.

**Wymagania:** wykonany `docs/SETUP.md` (Docker, repozytorium, plik `.env`).

ℹ️ **Robiłeś już poprzednią wersję tej instrukcji** (`docs/BROUTER_OLD.md`) i Twój BRouter działa?
Nie powtarzaj tej instrukcji – przejdź do `docs/ROUTING.md`.

**Zasady:**
- Każdy krok: **Sprawdź przed → Wykonaj → Sprawdź po.**
- Wynik musi się zgadzać z tabelą „Wymagane”. Jeśli nie – **zatrzymaj się** i zgłoś, nie idź dalej.
- Wszystkie komendy wykonujesz w `~/Trail-Strider`.

---

## Krok 1. Kafel z danymi (`.rd5`)

BRouter liczy trasy na podstawie plików `.rd5` („kafli”). Każdy kafel obejmuje obszar 5° × 5°,
a nazwa to jego lewy dolny (południowo-zachodni) róg: `E20_N50` = długość 20–25°E, szerokość 50–55°N.

Kafle nie są w repozytorium (za duże, wykluczone w `.gitignore`) – każdy pobiera je sam.
Folder `routing/segments4` po pobraniu repozytorium **nie istnieje** (Git nie przechowuje pustych folderów).

**Sprawdź przed:**
```bash
cd ~/Trail-Strider
ls routing/segments4
df -h /
```

**Wymagane:**
| komenda | musi pokazać |
|---|---|
| `ls routing/segments4` | `No such file or directory` (folder jeszcze nie istnieje) |
| `df -h /` | kolumna `Avail`: co najmniej **1G** |

**Wykonaj:**
```bash
mkdir -p routing/segments4
wget -P routing/segments4 https://brouter.de/brouter/segments4/E20_N50.rd5
```
- `mkdir -p` – tworzy folder (podpięty do kontenera BRoutera – musi istnieć przed jego uruchomieniem),
- `wget -P <folder>` – zapisuje plik w podanym folderze pod oryginalną nazwą.

**Sprawdź po:**
```bash
ls -l routing/segments4
git check-ignore -v routing/segments4/E20_N50.rd5
```

**Wymagane:**
| komenda | musi pokazać |
|---|---|
| `ls -l routing/segments4` | `E20_N50.rd5`, rozmiar ok. **68,6 MB** (stan 12.10.2026: `68623840`) |
| `git check-ignore -v ...` | `.gitignore:65:*.rd5	routing/segments4/E20_N50.rd5` (plik nie trafi do repozytorium) |

⚠️ Serwer BRoutera aktualizuje kafle co jakiś czas i nie udostępnia wersji z datą – rozmiar może się
nieznacznie różnić. Liczy się, że plik się pobrał (bez błędu `wget`) i ma kilkadziesiąt MB.

ℹ️ **Zasięg:** `E20_N50` obejmuje tylko wschodnią część Małopolski. Kraków (~19,9°E) leży w `E15_N50`,
Tatry w `E20_N45`. Punkt poza pobranymi kaflami daje błąd `datafile E15_N45.rd5 not found` (krok 3).
Które kafle pobieramy docelowo – do ustalenia w zespole.

---

## Krok 2. Uruchomienie BRoutera

**Sprawdź przed:**
```bash
ss -ltn | grep 17777
docker compose config --services
```

**Wymagane:**
| komenda | musi pokazać |
|---|---|
| `ss -ltn \| grep 17777` | pusto (port 17777 wolny) |
| `docker compose config --services` | na liście jest `brouter` |

**Wykonaj:**
```bash
docker compose up -d brouter
```
Za pierwszym razem Docker pobierze obraz BRoutera (`ghcr.io/abrensch/brouter`, ok. 95 MB).

**Sprawdź po:**
```bash
docker compose ps brouter
```

**Wymagane:**
| komenda | musi pokazać |
|---|---|
| `docker compose ps brouter` | `trail-strider-brouter-1`, status `Up`, port `127.0.0.1:17777->17777/tcp` |

ℹ️ W logach (`docker compose logs brouter`) mogą się pojawić linie `RouteServer got exception (will continue):
java.lang.NullPointerException ... "getline" is null`. Oznaczają połączenie z portem BRoutera bez zapytania HTTP
(np. test połączenia) – BRouter działa dalej. O tym, czy działa poprawnie, rozstrzyga test w kroku 3.

ℹ️ BRouter ma w `compose.yaml` ustawienie `restart: unless-stopped` – po restarcie komputera uruchomi się sam,
chyba że zatrzymałeś go ręcznie (`docker compose stop`).

⚠️ Obraz BRoutera jest na tagu `nightly` (nieprzypięta wersja) – u różnych osób wersja może się różnić.
Stan na 18.10.2026: `BRouter-1.7.11-beta`.

---

## Krok 3. Test wyznaczania trasy

**Wykonaj:**
```bash
curl -s "http://127.0.0.1:17777/brouter?lonlats=20.94498,50.06465|20.93658,50.06143&profile=trekking&alternativeidx=0&format=geojson" \
  | python3 -c "import json,sys; p=json.load(sys.stdin)['features'][0]['properties']; print(p['creator'], p['track-length'])"
curl -s "http://127.0.0.1:17777/brouter?lonlats=19.935833,49.3075|19.934084,49.251005&profile=trekking&format=geojson"; echo
```
- pierwsza komenda – trasa między dwoma punktami w kaflu `E20_N50`; z odpowiedzi (GeoJSON)
  wypisuje wersję BRoutera i długość trasy w metrach,
- `lonlats=` – punkty w kolejności **długość,szerokość** (`lon,lat`), rozdzielone `|`,
- druga komenda – punkty w Tatrach, poza pobranym kaflem (test komunikatu błędu).

**Wymagane:**
| komenda | musi pokazać |
|---|---|
| trasa | `BRouter-1.7.11-beta 1707` |
| punkty poza kaflem | `datafile E15_N45.rd5 not found` |

Długość `1707` (metrów) dotyczy kafla ze stanu 12.10.2026 – przy nowszym kaflu może się nieznacznie różnić.

ℹ️ Profil `trekking` to profil **rowerowy** BRoutera. Wybór profilu pieszego – do ustalenia
(osoba odpowiedzialna za routing).

✅ **BRouter działa.** Dalej: `docs/ROUTING.md`.

---

## Codzienna praca

```bash
docker compose up -d brouter          # uruchom
docker compose stop brouter           # zatrzymaj
docker compose logs --tail 50 brouter # ostatnie logi
```