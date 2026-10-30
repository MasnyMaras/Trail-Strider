import logging
import os

import requests
from fastapi import HTTPException

ROUTING_URL = os.environ["ROUTING_URL"]
logger = logging.getLogger(__name__)


def get_route(points, mode):
    try:
        r = requests.post(
            f"{ROUTING_URL}/route",
            json={"points": points, "mode": mode},
            timeout=15,
        )
    except requests.Timeout:
        raise HTTPException(status_code=504, detail="route calculation timed out")
    except requests.RequestException as e:
        logger.warning("routing unreachable: %s", e)                           # zapis logow kontenera, docker compose logs backend
        raise HTTPException(status_code=503, detail="routing unavailable")

    if r.status_code in (400, 422, 501):
        raise HTTPException(status_code=r.status_code, detail=r.json()["detail"])
    if r.status_code == 504:
        raise HTTPException(status_code=504, detail="route calculation timed out")
    if r.status_code != 200:
        logger.warning("routing error %s: %s", r.status_code, r.text)               
        raise HTTPException(status_code=502, detail="route service unavailable")
    return r.json()

def get_lodgings(path, db_lodgings, waypoints, n, tmax, beta, level):
    try:
        r = requests.post(
            f"{ROUTING_URL}/w_lodgings",
            json={
                "path": path,
                "db_lodgings": db_lodgings,
                "waypoints": waypoints,
                "n": n,
                "tmax": tmax,
                "beta": beta,
                "level": level,
            },
            timeout=30,
        )
    except requests.Timeout:
        raise HTTPException(status_code=504, detail="route calculation timed out")
    except requests.RequestException as e:
        logger.warning("routing unreachable: %s", e)  # zapis logow kontenera, docker compose logs backend
        raise HTTPException(status_code=503, detail="routing unavailable")

    if r.status_code in (400, 422, 501):
        raise HTTPException(status_code=r.status_code, detail=r.json()["detail"])
    if r.status_code == 504:
        raise HTTPException(status_code=504, detail="route calculation timed out")
    if r.status_code != 200:
        logger.warning("routing error %s: %s", r.status_code, r.text)
        raise HTTPException(status_code=502, detail="route service unavailable")
    return r.json()