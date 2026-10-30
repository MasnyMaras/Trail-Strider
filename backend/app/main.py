from typing import Literal, Any
import json

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.exc import OperationalError, ProgrammingError

from app.db import engine
from app.lodgings import lodgings_near_route
from app.routing_client import get_route, get_lodgings


app = FastAPI(title="Trail-Strider API")


class RouteRequest(BaseModel):
    points: list[tuple[float, float]]  # [[lon, lat], ...]
    mode: Literal["m", "a"] = "m"      # m - manual, a - automatic
    buffer_m: int = Field(1000, ge=0, le=5000)  # noclegi do tej odległości od trasy [m]

class PlanRequest(BaseModel):
    path: dict[str, Any]                          # GeoJSON from /api/route
    waypoints: list[tuple[float, float]]          # [[lon, lat], ...]
    n: int = Field(ge=1, le=30)                   # number of days
    tmax: float = Field(gt=0)                     # max time for one fragment [h]
    beta: float = Field(0.15, ge=0.0, le=0.5)     # safety margin
    level: Literal["b", "i", "a"] = "i"
    buffer_m: int = Field(1000, ge=0, le=5000)

@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/health/db")
def health_db():
    try:
        with engine.connect() as conn:
            postgis = conn.execute(text("SELECT postgis_lib_version()")).scalar_one()
    except OperationalError:
        raise HTTPException(status_code=503, detail="database unavailable")
    return {"db": "ok", "postgis": postgis}


@app.post("/api/route")
def plan_route(req: RouteRequest):
    route = get_route(req.points, req.mode)
    try:
        geojson = route.get("route") or route["json"]   # nowy format ("route") albo dotychczasowy ("json")
        geometry = geojson["features"][0]["geometry"]
    except (KeyError, IndexError, TypeError, AttributeError):
        raise HTTPException(status_code=502, detail="invalid route from routing service")
    try:
        route["lodgings"] = lodgings_near_route(geometry, req.buffer_m)
    except OperationalError:
        raise HTTPException(status_code=503, detail="database unavailable")
    except ProgrammingError:   # np. brak tabeli app.noclegi
        raise HTTPException(status_code=503, detail="lodgings unavailable: run db/sql/noclegi.sql")
    return route

def _route_geometry(geojson: dict) -> dict:
    try:
        return geojson["features"][0]["geometry"]
    except (KeyError, IndexError, TypeError):
        raise HTTPException(status_code=422, detail="invalid path geojson")

@app.post("/api/plan")
def plan_lodgings(req: PlanRequest):
    geometry = _route_geometry(req.path)
    try:
        db_lodgings = lodgings_near_route(geometry, req.buffer_m)
    except OperationalError:
        raise HTTPException(status_code=503, detail="database unavailable")
    except ProgrammingError:
        raise HTTPException(status_code=503, detail="lodgings unavailable: run db/sql/noclegi.sql")

    db_lodgings = json.loads(json.dumps(db_lodgings, default=float))
    return get_lodgings(req.path, db_lodgings, req.waypoints, req.n, req.tmax, req.beta, req.level)
