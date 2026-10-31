export interface RoutePoint {
    id: string
    value: string
    coordinates?: Coordinates
}

export type Coordinates = [
    longitude: number,
    latitude: number,
]

export type ElevationCoordinates = [
    longitude: number,
    latitude: number,
    elevation: number,
]

export interface RouteRequest {
    points: Coordinates[]
    mode: "m" | "a"
}

export interface ElevationPoint {
    distance_meters: number
    elevation_meters: number
}

export interface RouteGeometry {
    type: "LineString"
    coordinates: ElevationCoordinates[]
}

export interface RouteFeature {
    type: "Feature"
    geometry: RouteGeometry
    properties: Record<string, unknown>
}

export interface RouteGeoJson {
    type: "FeatureCollection"
    features: RouteFeature[]
}

export interface RouteResponse {
    waypoints: Coordinates[]
    route: RouteGeoJson
    elevation_profile: ElevationPoint[]
    total_distance_meters: number
    estimated_duration_seconds: number
    gpx: string
}