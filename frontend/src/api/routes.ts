import type { RouteRequest, RouteResponse } from "@/types/route"

function isRouteResponse(value: unknown): value is RouteResponse {
    if (!value || typeof value !== "object") return false

    const response = value as Record<string, unknown>
    return (
        typeof response.route === "object" &&
        response.route !== null &&
        Array.isArray(response.elevation_profile) &&
        typeof response.total_distance_meters === "number" &&
        typeof response.estimated_duration_seconds === "number" &&
        typeof response.gpx === "string"
    )
}

export async function calculateRoute(
    request: RouteRequest,
): Promise<RouteResponse> {
    const response = await fetch("/api/route", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
    })

    const body: unknown = await response.json().catch(() => null)

    if (!response.ok) {
        const error = body as { detail?: unknown } | null
        throw new Error(
            typeof error?.detail === "string"
                ? error.detail
                : "Nie udało się wyznaczyć trasy.",
        )
    }

    if (!isRouteResponse(body)) {
        throw new Error(
            "Backend zwrócił starszy format odpowiedzi. Integracja trasy będzie dostępna po aktualizacji backendu.",
        )
    }

    return body
}