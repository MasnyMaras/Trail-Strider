import os
import requests
import gpxpy
import gpxpy.gpx

BROUTER_URL = os.getenv("BROUTER_URL", "http://localhost:17777/brouter")

def brouter_response(coordinates):
    """
    Uses brouter to designate a route based on given coordinates.

    Args:
        coordinates (list, array_like): list of [lon, lat] points in DD (Decimal Degrees) form.
    Returns:
        dict: GeoJSON with the generated path.
    """
    points = "|".join(
        f"{lon},{lat}" for lon, lat in coordinates
    )

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

def create_gpx(route):
    """
    Converts GeoJSON route to GPX format. Does not save it as a file, but returns it as a dictionary instead.

    Args:
        route (dict): GeoJSON with the generated path.
    Returns:
        dict: generated path in GPX format.
    """
    features = route.get("features", [])
    if not features:
        raise ValueError("Invalid brouter response.")

    geometry = features[0].get("geometry", {})
    if geometry.get("type") != "LineString":
        raise ValueError("LineString geometry expected.")

    coordinates = geometry.get("coordinates", [])
    if not coordinates:
        raise ValueError("No coordinates found.")

    gpx = gpxpy.gpx.GPX()
    gpx.creator = "Trail-Strider"

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

    return gpx.to_xml()

def path(coordinates, flag="m"):
    """
    Generates path in selected mode.

    Args:
        coordinates (list, array_like): list of [lon, lat] points in DD (Decimal Degrees) form.
        flag (str): "m" - manual mode, "a" - automatic mode.
    Returns:
        dict:
            {
                "json": GeoJSON including generated path.
                "gpx": generated path in GPX format.
            }
    Raises:
        ValueError: invalid arguments,
        requests.RequestException: brouter communication error.
    """
    if flag is None:
        flag = "m"

    if not isinstance(flag,str) or flag not in ("m", "a"):
        raise ValueError("Unknown flag. Accepted values: 'm', 'a'.")
    elif flag == "m":
        if not isinstance(coordinates, (list, tuple)):
            raise ValueError("Coordinates must be a list of points [lon, lat].")

        if len(coordinates) < 2:
            raise ValueError("Route must have at least 2 points.")

        for point in coordinates:
            if not isinstance(point, (list, tuple)) or len (point) !=2:
                raise ValueError("Each point must be [lon,lat].")

        route = brouter_response(coordinates)
        gpx   = create_gpx(route)

        return {
            "json": route,
            "gpx":  gpx,
        }
    elif flag == "a":
        # TODO: implement automatic routing
        raise NotImplementedError("Automatic mode not yet implemented.")
    else:
        raise ValueError("Unknown flag. Accepted values: 'm', 'a'.")