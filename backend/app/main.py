from typing import Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from app.db import engine
from app.lodgings import lodgings_near_route
from app.routing_client import get_route


app = FastAPI(title="Trail-Strider API")


class RouteRequest(BaseModel):
    points: list[tuple[float, float]]  # [[lon, lat], ...]
    mode: Literal["m", "a"] = "m"      # m - manual, a - automatic
    buffer_m: int = Field(1000, ge=0, le=5000)  # noclegi do tej odległości od trasy [m]


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
