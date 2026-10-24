import os
from collections.abc import Sequence
from typing import Any, Literal

import requests
import gpxpy
import gpxpy.gpx
import numpy as np
from itertools import product
from ortools.constraint_solver import routing_enums_pb2
from ortools.constraint_solver import pywrapcp

BROUTER_URL = os.getenv("BROUTER_URL", "http://brouter:17777/brouter")

def build_distance_matrix(coordinates: Sequence[Sequence[float]]) -> np.ndarray :
    """
        Build a pairwise road-distance matrix using Haversine distance.
        Calculates the routed distance between every ordered pair of distinct
        coordinates.

        Args:
            coordinates (list, array_like): list of [lon, lat] points in DD (Decimal Degrees) form.
        Returns:
            2D, array_like: distance matrix for combinations between given coordinates.
        """
    coords = np.asarray(coordinates)
    lon = np.radians(coords[:, 0])
    lat = np.radians(coords[:, 1])
    dlon = lon[:, None] - lon[None, :]
    dlat = lat[:, None] - lat[None, :]

    a = (np.sin(dlat / 2.0) ** 2+ np.cos(lat[:, None])* np.cos(lat[None, :])* np.sin(dlon / 2.0) ** 2)
    a = np.clip(a, 0.0, 1.0)

    earth_radius_m = 6371000.0
    return 2.0 * earth_radius_m * np.arcsin(np.sqrt(a))

def tsp_solution(distance_matrix: np.ndarray) -> list[int]:
    """
        Find a low-cost route through all nodes using Google OR-Tools.

        Args:
            distance_matrix (2D, array-like): represents the cost of traveling from node i to node j.
        Returns:
            order (list, integer): list of node indices in visitation order, including the start and destination.
        Raises:
            RuntimeError: If OR-Tools fails to find a solution.
        """
    n = len(distance_matrix)
    if n < 2: return list(range(n))

    manager = pywrapcp.RoutingIndexManager(
        n,
        1,
        [0],
        [n-1],
    )

    routing = pywrapcp.RoutingModel(manager)

    def distance_callback(from_index: int, to_index: int) -> int:
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return int(distance_matrix[from_node][to_node])

    callback_index = routing.RegisterTransitCallback(distance_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(callback_index)

    search_parameters = pywrapcp.DefaultRoutingSearchParameters()
    search_parameters.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    )
    search_parameters.local_search_metaheuristic = (
        routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    )
    search_parameters.time_limit.seconds = 5

    solution = routing.SolveWithParameters(search_parameters)
    if solution is None:
        raise RuntimeError("OR-Tools: no solution found.")

    order = []
    index = routing.Start(0)

    while not routing.IsEnd(index):
        order.append(manager.IndexToNode(index))
        index = solution.Value(routing.NextVar(index))

    order.append(manager.IndexToNode(index))
    return order

def brouter_response(coordinates: Sequence[Sequence[float]]) -> dict[str, Any]:
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
            "profile": "hiking-mountain",
            "alternativeidx": 0,
            "format": "geojson",
        },
        timeout = 60,
    )
    response.raise_for_status()
    return response.json()

def create_gpx(route: dict[str, Any]) -> str:
    """
    Converts GeoJSON route to GPX format. Does not save it as a file, but returns it as a dictionary instead.

    Args:
        route (dict): GeoJSON with the generated path.
    Returns:
        str: generated path in GPX format.
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

def path(coordinates: Sequence[Sequence[float]], flag: Literal["m","a"] | None = "m") -> dict[str, Any]:
    """
    Generates path in selected mode.

    Args:
        coordinates (list, array_like): list of [lon, lat] points in DD (Decimal Degrees) form.
        flag (literal): "m" - manual mode, "a" - automatic mode.
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

    if not isinstance(coordinates, (list, tuple)):
        raise ValueError("Coordinates must be a list of points [lon, lat].")

    if len(coordinates) < 2:
        raise ValueError("Route must have at least 2 points.")

    for point in coordinates:
        if not isinstance(point, (list, tuple)) or len(point) != 2:
            raise ValueError("Each point must be [lon,lat].")

    if not isinstance(flag,str) or flag not in ("m", "a"):
        raise ValueError("Unknown flag. Accepted values: 'm', 'a'.")
    elif flag == "m":
        route = brouter_response(coordinates)
        gpx   = create_gpx(route)

        return {
            "json": route,
            "gpx":  gpx,
        }
    elif flag == "a":
        matrix = build_distance_matrix(coordinates)
        order = tsp_solution(matrix)
        ordered_cords = [coordinates[i] for i in order]
        route = brouter_response(ordered_cords)
        gpx = create_gpx(route)

        return {
            "json": route,
            "gpx": gpx,
        }
    else:
        raise ValueError("Unknown flag. Accepted values: 'm', 'a'.")
