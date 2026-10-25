# Trail-Strider

## O projekcie
**Trail-Strider** to otwartoźródłowy planer wielodniowych wędrówek pieszych, zaprojektowany do generowania zrównoważonych, gotowych planów tras w trzech różnych regionach: **województwie małopolskim**, **województwie pomorskim** oraz **okręgu Maramuresz (Rumunia)**.

## Struktura projektu
Opis katalogów i plików w repozytorium:
```
Trail-Strider/
├── backend/            Serwis FastAPI (SQLAlchemy i psycopg); obsługuje punkty końcowe API
├── db/                 Konfiguracja PostgreSQL/PostGIS oraz osm2pgsql, w tym skrypty ETL importujące punkty noclegowe Lasów Państwowych (BDL) i programu „Zanocuj w lesie” z uwzględnieniem bliskości wody
├── docs/               Dokumentacja projektu, przewodniki oraz specyfikacje techniczne
├── frontend/           Aplikacja SPA w oparciu o React + TypeScript (Vite)
├── routing/            Serwis trasowania pieszego integrujący lokalną instancję BRoutera, profile routingu oraz Google OR-Tools do automatycznej optymalizacji kolejności punktów (TSP)
├── utils/              Skrypty pomocnicze
├── .env.example        Przykładowy plik konfiguracyjny ze zmiennymi środowiskowymi
├── .gitignore          Reguły Git dla ignorowanych plików i katalogów
├── README.md           Ogólne informacje o projekcie w języku angielskim
├── README_PL.md        Ogólne informacje o projekcie w języku polskim
└── compose.yaml        Plik orkiestracji Docker Compose dla wszystkich usług i zależności aplikacji
```

## Licencje i prawa autorskie
Niniejszy projekt integruje różne komponenty open-source. Wszystkie wykorzystane narzędzia są stosowane zgodnie z ich odpowiednimi warunkami i postanowieniami licencyjnymi.

### Wykaz licencji
| **Narzędzie**             | **Licencja**                                                             |
|---|---|
| **Docker**                | Apache 2.0                                                               |
| **Python**                | Python Software Foundation License                                       |
| **FastAPI**               | MIT                                                                      |
| **BRouter**               | MIT                                                                      |
| **Google OR-Tools**       | Apache 2.0                                                               |
| **PostgreSQL**            | PostgreSQL License                                                       |
| **PostGIS**               | GPLv2+                                                                   |
| **osm2pgsql**             | GNU GPL v2                                                               |
| **React**                 | MIT                                                                      |
| **TypeScript**            | Apache 2.0                                                               |
| **Vite**                  | MIT                                                                      |
| **Tailwindcss**           | MIT                                                                      |
| **shadcn/ui**             | MIT                                                                      |
| **MapLibre GL JS**        | BSD-3-Clause                                                             |
| **OpenStreetMap**         | Open Database License (ODbL) 1.0                                         |
| **Copernicus DEM**        | Otwarta licencja programu Copernicus (Copernicus program open license)   |