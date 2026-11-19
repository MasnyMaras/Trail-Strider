export interface PlaceSearchResult {
    id: string;
    name: string;
    category: string;
    region: string;
    region_id: "malopolskie" | "pomorskie" | "maramures";
    longitude: number;
    latitude: number;
}

function isPlaceSearchResult(value: unknown): value is PlaceSearchResult {
    if (!value || typeof value !== "object") return false;
    const place = value as Record<string, unknown>;
    return (
        typeof place.id === "string" &&
        typeof place.name === "string" &&
        typeof place.category === "string" &&
        typeof place.region === "string" &&
        (place.region_id === "malopolskie" ||
            place.region_id === "pomorskie" ||
            place.region_id === "maramures") &&
        typeof place.longitude === "number" &&
        Number.isFinite(place.longitude) &&
        typeof place.latitude === "number" &&
        Number.isFinite(place.latitude)
    );
}

export async function searchPlaces(
    query: string,
    signal?: AbortSignal,
): Promise<PlaceSearchResult[]> {
    const response = await fetch(`/api/places/search?q=${encodeURIComponent(query)}`, { signal });
    const body: unknown = await response.json().catch(() => null);

    if (!response.ok) {
        const error = body as { detail?: unknown } | null;
        throw new Error(
            typeof error?.detail === "string"
                ? error.detail
                : "Nie udało się wyszukać miejsc.",
        );
    }

    if (!Array.isArray(body) || !body.every(isPlaceSearchResult)) {
        throw new Error("Backend zwrócił nieprawidłowy format wyników wyszukiwania.");
    }

    return body;
}
