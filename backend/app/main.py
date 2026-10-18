from typing import Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from app.db import engine
from app.routing_client import get_route


app = FastAPI(title="Trail-Strider API")


class RouteRequest(BaseModel):
    points: list[tuple[float, float]]  # [[lon, lat], ...]
    mode: Literal["m", "a"] = "m"      # m - manual, a - automatic


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
    return get_route(req.points, req.mode)  # TODO: tymczasowo bez przetwarzania
