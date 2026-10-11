import os
import requests
import time
import gpxpy
import gpxpy.gpx
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import URL, create_engine

BROUTER_URL = os.getenv("BROUTER_URL", "http://localhost:17777/brouter")

def connect_db():
    load_dotenv()

    engine = create_engine(URL.create(
        "postgresql+psycopg",
        username=os.environ["POSTGRES_USER"],
        password=os.environ["POSTGRES_PASSWORD"],
        host="127.0.0.1",
        port=5432,
        database=os.environ["POSTGRES_DB"],
    ))

    return engine

def brouter_response(points):
    response = requests.get(
        BROUTER_URL,
        params={
            "lonlats": f"{points}",
            "profile": "trekking",
            "alternativeidx": 0,
            "format": "geojson",
        },
        timeout = 10,
    )
    response.raise_for_status()
    return response.json()

def create_gpx(route, output_file):
    gpx = gpxpy.gpx.GPX()
    gpx.creator = "Trail-Strider"

    features = route.get("features", [])
    if not features:
        raise ValueError("Invalid brouter response.")

    geometry = features[0].get("geometry", {})
    if geometry.get("type") != "LineString":
        raise ValueError("LineString geometry expected.")

    coordinates = geometry.get("coordinates", [])
    if not coordinates:
        raise ValueError("No coordinates found.")

    track = gpxpy.gpx.GPXTrack()
    gpx.tracks.append(track)

    segment = gpxpy.gpx.GPXTrackSegment()
    track.segments.append(segment)

    for coord in coordinates:
        lon, lat = coord[:2]
        elevation = coord[2] if len(coord) > 2 else None

        point = gpxpy.gpx.GPXTrackPoint(
            latitude=lat,
            longitude=lon,
            elevation=elevation,
        )
        segment.points.append(point)

    path = Path(output_file)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(gpx.to_xml(), encoding="utf-8")

    return path

def main():
    # placeholder for real data: pairs of coordinates lon, lat - points selected by user in manual mode:
    coordinates = [
        (19.935833, 49.307500),
        (19.934084, 49.251005),
        (19.980521, 49.269497),
        (19.949600, 49.299200),
        (19.981650, 49.232370),
        (19.932204, 49.236528),
        (19.949600, 49.299200),
    ]

    points = "|".join(
        f"{lon},{lat}" for lon, lat in coordinates
    )
    start = time.perf_counter()
    route = brouter_response(points)
    t = time.perf_counter() - start
    print(f"Brouter took {t:.2f} seconds to generate manual response.")
    create_gpx(route, "output/manual.gpx")

if __name__ == "__main__":
    main()