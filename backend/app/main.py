from fastapi import FastAPI, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from app.db import engine

app = FastAPI(title="Trail-Strider API")


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
