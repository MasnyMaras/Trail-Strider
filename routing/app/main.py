from typing import Literal

import requests
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from app import routing

app = FastAPI(title="Trail-Strider routing")


class RouteRequest(BaseModel):
    points: list[tuple[float, float]]  # [[lon, lat], ...]
    mode: Literal["m", "a"] = "m"      # m - manual, a - automatic


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/route")
def route(req: RouteRequest):
    try:
        return routing.path(req.points, req.mode)
    except ValueError as e:                                         # fi less than 2 points
        raise HTTPException(status_code=400, detail=str(e))
    except NotImplementedError as e:                                # fi flag is not "m" or "a", a is not implemented yet
        raise HTTPException(status_code=501, detail=str(e))
    except requests.HTTPError as e:
        status = 400 if e.response.status_code < 500 else 502
        raise HTTPException(status_code=status, detail=f"brouter: {e.response.text.strip()}")
    except requests.Timeout:
        raise HTTPException(status_code=504, detail="brouter: timeout")
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"brouter: {e}")
