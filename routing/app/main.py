from typing import Literal, Any

import requests
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from app import routing, planner

app = FastAPI(title="Trail-Strider routing")


class RouteRequest(BaseModel):
    points: list[tuple[float, float]]  # [[lon, lat], ...]
    mode: Literal["m", "a"] = "m"      # m - manual, a - automatic

class LodgingsRequest(BaseModel):
    path: dict[str, Any]                    # base BRouter path
    db_lodgings: list[dict]                 # list of lodgings from database
    waypoints: list[tuple[float, float]]    # [[lon, lat], ...]
    n: int = Field(ge=1)                    # number of days to split the route
    tmax: float = Field(gt=0)               # max allowed time of one leg of the route in hours
    beta: float = Field(ge=0, le=0.5)       # safety margin, 0.15 < beta < 0.20
    level: Literal["b", "i", "a"] = "i"     # b - beginner, i - intermediate, a - advanced

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/route")
def route(req: RouteRequest):
    try:
        return routing.path(req.points, req.mode)
    except ValueError as e:                                         # fi less than 2 points
        raise HTTPException(status_code=400, detail=str(e))
    except requests.HTTPError as e:
        status = 400 if e.response.status_code < 500 else 502
        raise HTTPException(status_code=status, detail=f"brouter: {e.response.text.strip()}")
    except requests.Timeout:
        raise HTTPException(status_code=504, detail="brouter: timeout")
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"brouter: {e}")

@app.post("/w_lodgings")
def w_lodgings(req: LodgingsRequest):
    try:
        return planner.lodgings(req.path, req.db_lodgings, req.waypoints, req.n, req.tmax, req.beta, req.level)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except requests.HTTPError as e:
        status = 400 if e.response.status_code < 500 else 502
        raise HTTPException(status_code=status, detail=f"brouter: {e.response.text.strip()}")
    except requests.Timeout:
        raise HTTPException(status_code=504, detail="brouter: timeout")
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"brouter: {e}")