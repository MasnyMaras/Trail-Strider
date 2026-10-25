# Trail-Strider

## Project Overview
**Trail-Strider** is an open-source, multi-day hiking route planner designed to generate balanced, ready-to-hike trek itineraries across three distinct regions: **Lesser Poland (Małopolskie)**, **Pomerania (Pomorskie)**, and **Maramureș (Romania)**.

## Project Structure
Description of repository directories:
```
Trail-Strider/
├── backend/            FastAPI service with SQLAlchemy & psycopg; handles API endpoints
├── db/                 PostgreSQL/PostGIS setup and osm2pgsql configs, including ETL scripts importing State Forests (BDL) and "Zanocuj w lesie" lodging points with water-proximity weighting
├── docs/               Project documentation, guides, and technical specifications
├── frontend/           React + TypeScript (Vite) SPA
├── routing/            Pedestrian routing service integrating local BRouter instance, routing profiles, and Google OR-Tools for automated TSP waypoint optimization
├── utils/              Helper scripts
├── .env.example        Example environment variables configuration file          
├── .gitigore           Git rules for ignored files and directories
├── README.md           General information about the project in English
├── README_PL.md        General information about the project in Polish
└── compose.yaml        Docker Compose orchestration file for all application services and dependencies
```

## Licenses and Copyright
This project integrates various open-source components. All utilized tools are applied in accordance with their respective licensing terms and conditions.

### Update Licenses
| **Tool**                  | **License**                                                              |
|-|-|
| **Docker** | Apache 2.0 |
| **Python** | Python Software Foundation License |
| **FastAPI** | MIT |
| **BRouter** | MIT |
| **Google OR-Tools** | Apache 2.0 |
| **PostgreSQL** | PostgreSQL License |
| **PostGIS** | GPLv2+ |
| **osm2pgsql** | GNU GPL v2 |
| **React** | MIT |
| **TypeScript** | Apache 2.0 |
| **Vite** | MIT |
| **Tailwindcss** | MIT |
| **shadcn/ui** | MIT |
| **MapLibre GL JS** | BSD-3-Clause |
| **OpenStreetMap** | Open Database License (ODbL) 1.0 |
| **Copernicus DEM** | Copernicus program open license |