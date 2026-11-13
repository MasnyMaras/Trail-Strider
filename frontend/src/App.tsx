//import { Button } from "@/components/ui/button"
import Header from "@/components/ui/header"
import MapView from "@/components/map/MapView"
import Footer from "@/components/ui/footer"
import Sidebar from "@/components/ui/sidebar"
import TrailPreferences from "@/components/ui/trail_preferences"
import SaveRoute from "@/components/ui/save_route"
import NotFound from "@/components/ui/not_found"
//import SearchBar from "@/components/ui/search_bar";
import ElevationProfile from "@/components/ui/elevation_profile.tsx";
import type { RegionId } from "@/components/map/Regions"
import { calculateRoute } from "@/api/routes"
import { useEffect, useState, useCallback, useRef } from "react";
import type { RoutePoint, RouteResponse, SinglePointRole } from "@/types/route"

export interface RoutePreferences {
    difficulty: number;
    days: number;
    accommodation: number[];
    roadType: number[];
}
export interface DayStat {
    distance?: number;
    time?: string;
}
interface CachedSegment {
    coords: [number, number, number][];
    elevation: { distance_meters: number; elevation_meters: number }[];
    distance: number;
    duration: number;
}

const getSegmentKey = (p1: [number, number], p2: [number, number]) =>
    `${p1[0]},${p1[1]}->${p2[0]},${p2[1]}`;

function splitResponseIntoSegments(
    subPoints: [number, number][],
    response: RouteResponse
): CachedSegment[] {
    const allCoords = response.route.features[0].geometry.coordinates;
    const allElev = response.elevation_profile || [];
    const totalDist = response.total_distance_meters || 0;
    const totalDur = response.estimated_duration_seconds || 0;

    if (subPoints.length === 2) {
        return [{
            coords: allCoords,
            elevation: allElev,
            distance: totalDist,
            duration: totalDur,
        }];
    }

    const splitIndices: number[] = [0];
    let searchFrom = 0;

    for (let i = 1; i < subPoints.length - 1; i++) {
        const [lon, lat] = subPoints[i];
        let bestIdx = searchFrom;
        let minDist = Infinity;

        for (let j = searchFrom; j < allCoords.length; j++) {
            const d = Math.hypot(allCoords[j][0] - lon, allCoords[j][1] - lat);
            if (d < minDist) {
                minDist = d;
                bestIdx = j;
            }
        }
        splitIndices.push(bestIdx);
        searchFrom = bestIdx;
    }
    splitIndices.push(allCoords.length - 1);

    const segments: CachedSegment[] = [];
    for (let i = 0; i < splitIndices.length - 1; i++) {
        const startIdx = splitIndices[i];
        const endIdx = splitIndices[i + 1];

        const segCoords = allCoords.slice(startIdx, endIdx + 1);
        const startDist = allElev[startIdx]?.distance_meters ?? 0;
        const endDist = allElev[endIdx]?.distance_meters ?? totalDist;
        const segDist = Math.max(0, endDist - startDist);

        const segElev = allElev.slice(startIdx, endIdx + 1).map((p) => ({
            distance_meters: p.distance_meters - startDist,
            elevation_meters: p.elevation_meters,
        }));

        const segDur = totalDist > 0 ? totalDur * (segDist / totalDist) : 0;

        segments.push({
            coords: segCoords,
            elevation: segElev,
            distance: segDist,
            duration: segDur,
        });
    }

    return segments;
}
export function App() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const [isAutoMode, setIsAutoMode] = useState(false)
    const [isPreferencesOpen, setIsPreferencesOpen] = useState(false)
    const [routePreferences, setRoutePreferences] = useState<RoutePreferences | null>(null)
    const [routeStats, setRouteStats] = useState<DayStat[] | null>(null)
    const [isSaveRouteOpen, setIsSaveRouteOpen] = useState(false)
    const [routeResponse, setRouteResponse] = useState<RouteResponse | null>(null)
    const [routeError, setRouteError] = useState<string | null>(null)
    const [isRouteLoading, setIsRouteLoading] = useState(false)
    const [regionId, setRegionId] = useState<RegionId>("malopolskie")
    const [singlePointRole, setSinglePointRole] = useState<SinglePointRole>(null)
    const routeRequestRef = useRef<AbortController | null>(null)
    const segmentCacheRef = useRef(new Map<string, CachedSegment>())

    const [points, setPoints] = useState<RoutePoint[]>([
        { id: "start-initial", value: "" },
        { id: "end-initial", value: "" },
    ])

    const handleAddPoint = (coords: [number, number], mode: "start" | "end" | "middle") => {
        const defaultName = `${coords[1].toFixed(4)}, ${coords[0].toFixed(4)}`
        const newPoint: RoutePoint = {
            id: `point-${Date.now()}`,
            value: defaultName,
            coordinates: coords,
        }
        setSinglePointRole(null)

        setPoints((prev) => {
            const copy = [...prev]

            if (mode === "start") {
                if (copy.length > 0 && !copy[0].coordinates) {
                    copy[0] = { ...copy[0], value: defaultName, coordinates: coords }
                    return copy
                }
                return [newPoint, ...copy]
            }

            if (mode === "end") {
                const lastIdx = copy.length - 1
                if (lastIdx >= 0 && !copy[lastIdx].coordinates) {
                    copy[lastIdx] = { ...copy[lastIdx], value: defaultName, coordinates: coords }
                    return copy
                }
                return [...copy, newPoint]
            }

            const insertIdx = Math.max(1, copy.length - 1)
            copy.splice(insertIdx, 0, newPoint)
            return copy
        })
    }
    const handleRemovePoint = (id: string) => {
        setPoints((prev) => {
            const removedIndex = prev.findIndex((point) => point.id === id)
            const nextPoints = prev.filter((point) => point.id !== id)
            const hadTwoCoordinates = prev.length === 2 && prev.every((point) => point.coordinates)

            if (hadTwoCoordinates && nextPoints.length === 1) {
                setSinglePointRole(removedIndex === 0 ? "end" : "start")
            } else {
                setSinglePointRole(null)
            }

            return nextPoints
        })
    }

    const handleRegionChange = (nextRegionId: RegionId) => {
        if (nextRegionId === regionId) return

        setRegionId(nextRegionId)
        setSinglePointRole(null)
        setPoints([
            { id: "start-initial", value: "" },
            { id: "end-initial", value: "" },
        ])
        setRouteResponse(null)
        setRouteError(null)
        setRouteStats(null)
        segmentCacheRef.current.clear()
    }

    const handleUpdatePointValue = (id: string, newValue: string) => {
        setPoints((prev) =>
            prev.map((p) =>
                p.id === id
                    ? {
                        ...p,
                        value: newValue,
                        coordinates: undefined,
                    }
                    : p
            )
        )
    }
    const handleAddStop = (insertIndex: number) => {
        const newPoint: RoutePoint = {
            id: `point-${Date.now()}`,
            value: "",
        }
        setPoints((prev) => {
            const copy = [...prev]
            copy.splice(insertIndex, 0, newPoint)
            return copy
        })
    }

    const handlePreferencesSubmit = async (preferencesData: RoutePreferences) => {
        setRoutePreferences(preferencesData);
        setIsPreferencesOpen(false);
        setRouteStats(null);
    };
    const handleSaveGpx = () => {
        console.log("Generowanie pliku GPX");
        alert(`Pobieranie GPX.`);
    };

    const handleCalculateRoute = useCallback(async () => {
        const coordinates = points
            .map((point) => point.coordinates)
            .filter((coordinate): coordinate is [number, number] => coordinate !== undefined)

        if (coordinates.length < 2) {
            setRouteError("Wybierz co najmniej dwa punkty trasy.")
            setRouteResponse(null)
            return
        }
        if (routeRequestRef.current) {
            routeRequestRef.current.abort()
        }
        const abortController = new AbortController()
        routeRequestRef.current = abortController

        setIsRouteLoading(true)
        setRouteError(null)

        try {
            if (isAutoMode || coordinates.length === 2) {
                const response = await calculateRoute({
                    points: coordinates,
                    mode: isAutoMode ? "a" : "m",
                }, abortController.signal)

                if (!abortController.signal.aborted) {
                setRouteResponse(response)
                }
                return
            }
            if (coordinates.length === 3) {
                const response = await calculateRoute({
                    points: coordinates,
                    mode: "m",
                }, abortController.signal)

                if (!abortController.signal.aborted) {
                    setRouteResponse(response)
                }
                return


            }

            const numSegments = coordinates.length - 1
            const missingIndices: number[] = []

            for (let i = 0; i < numSegments; i++) {
                const key = getSegmentKey(coordinates[i], coordinates[i + 1])
                if (!segmentCacheRef.current.has(key)) {
                    missingIndices.push(i)
                }
            }

            const missingChains: [number, number][][] = []
            if (missingIndices.length > 0) {
                let currentChain: [number, number][] = [
                    coordinates[missingIndices[0]],
                    coordinates[missingIndices[0] + 1],
                ]

                for (let k = 1; k < missingIndices.length; k++) {
                    const prevSegIdx = missingIndices[k - 1]
                    const currSegIdx = missingIndices[k]

                    if (currSegIdx === prevSegIdx + 1) {
                        currentChain.push(coordinates[currSegIdx + 1])
                    } else {
                        missingChains.push(currentChain)
                        currentChain = [coordinates[currSegIdx], coordinates[currSegIdx + 1]]
                    }
                }
                missingChains.push(currentChain)
            }

            await Promise.all(
                missingChains.map(async (chainPoints) => {
                    const res = await calculateRoute({
                        points: chainPoints,
                        mode: "m",
                    }, abortController.signal)

                    const extractedSegments = splitResponseIntoSegments(chainPoints, res)
                    for (let i = 0; i < chainPoints.length - 1; i++) {
                        const key = getSegmentKey(chainPoints[i], chainPoints[i + 1])
                        segmentCacheRef.current.set(key, extractedSegments[i])
                    }
                })
            )

            if (abortController.signal.aborted) return

            const mergedCoords: [number, number, number][] = []
            const mergedElevation: { distance_meters: number; elevation_meters: number }[] = []
            let totalDistance = 0
            let totalDuration = 0

            for (let i = 0; i < numSegments; i++) {
                const key = getSegmentKey(coordinates[i], coordinates[i + 1])
                const seg = segmentCacheRef.current.get(key)!

                mergedCoords.push(...(i === 0 ? seg.coords : seg.coords.slice(1)))

                const elevToAdd = (i === 0 ? seg.elevation : seg.elevation.slice(1)).map((p) => ({
                    distance_meters: p.distance_meters + totalDistance,
                    elevation_meters: p.elevation_meters,
                }))
                mergedElevation.push(...elevToAdd)

                totalDistance += seg.distance
                totalDuration += seg.duration
            }

            const combinedResponse: RouteResponse = {
                waypoints: coordinates,
                total_distance_meters: totalDistance,
                estimated_duration_seconds: totalDuration,
                gpx: "",
                route: {
                    type: "FeatureCollection",
                    features: [{
                        type: "Feature",
                        properties: { "track-length": String(Math.round(totalDistance)) },
                        geometry: {
                            type: "LineString",
                            coordinates: mergedCoords,
                        },
                    }],
                },
                elevation_profile: mergedElevation,
            }

            setRouteResponse(combinedResponse)
        } catch (error) {
            if (abortController.signal.aborted) return
            setRouteError(
                error instanceof Error
                    ? error.message
                    : "Nie udało się wyznaczyć trasy.",
            )
        } finally {
            if (routeRequestRef.current === abortController) {
                setIsRouteLoading(false)
                routeRequestRef.current = null
            }
        }
    },[points, isAutoMode])

    useEffect(() => {
        const validCoords = points.filter(p => p.coordinates !== undefined);

        const timeoutId = setTimeout(() => {
            if (validCoords.length >= 2) {
                void handleCalculateRoute();
            } else {
                    setRouteResponse(null)
            }
        }, 400);

        return () => clearTimeout(timeoutId);
    }, [points, isAutoMode, handleCalculateRoute]);

    const [currentPath, setCurrentPath] = useState(
        () => window.location.pathname.replace(/\/+$/, "") || "/"
    );
    useEffect(() => {
        const handleLocationChange = () => {
            setCurrentPath(
                window.location.pathname.replace(/\/+$/, "") || "/"
            );
        };
        window.addEventListener("popstate", handleLocationChange);

        return () => {
            window.removeEventListener("popstate", handleLocationChange);
        };
    }, []);

    const isNotFoundView = currentPath !== "/";
    const handleGoHome = () => {
        window.history.pushState({}, "", "/");
        setCurrentPath("/");
    };

    return (
        <div className="flex min-h-screen flex-col overflow-hidden bg-slate-50">
            <Header />
            <main className="relative flex-1 w-full h-full">
                {/*Developer mode for debugging single component*/}
                {currentPath === "/dev" ? (
                    <div className="flex h-full w-full items-center justify-center p-8 bg-slate-100">
                        <div className="w-full max-w-2xl">
                            <h2 className="mb-4 text-xl font-bold text-slate-800">Podgląd Developerski</h2>
                            {/*Debug any component */}
                            <ElevationProfile data={routeResponse?.elevation_profile} />
                        </div>
                    </div>
                //================================
                ) : isNotFoundView ? (
                    <NotFound onGoHome={handleGoHome} />
                ) : (
                    <>
                        {/*<SearchBar isSidebarOpen={isSidebarOpen} />*/}
                        <MapView
                            isSidebarOpen={isSidebarOpen}
                            regionId={regionId}
                            onRegionChange={handleRegionChange}
                            isRouteLoading={isRouteLoading}
                            singlePointRole={singlePointRole}
                            isAutoMode={isAutoMode}
                            automaticWaypoints={routeResponse?.waypoints}
                            points={points}
                            onAddPoint={handleAddPoint}
                            onRemovePoint={handleRemovePoint}
                            routeGeoJson={routeResponse?.route}
                        />
                        <Sidebar
                            isOpen={isSidebarOpen}
                            onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
                            points={points}
                            onAddStop={handleAddStop}
                            onRemoveStop={handleRemovePoint}
                            onUpdatePointValue={handleUpdatePointValue}
                            onReorderPoints={setPoints}
                            singlePointRole={singlePointRole}
                            isAutoMode={isAutoMode}
                            onAutoModeToggle={setIsAutoMode}
                            onOpenPreferences={() => setIsPreferencesOpen(true)}
                            onOpenSaveRoute={() => setIsSaveRouteOpen(true)}
                            routePreferences={routePreferences}
                            routeStats={routeStats}
                            onCalculateRoute={handleCalculateRoute}
                            isRouteLoading={isRouteLoading}
                            routeError={routeError}
                            elevationProfile={routeResponse?.elevation_profile}
                        />
                        <TrailPreferences
                            isOpen={isPreferencesOpen}
                            onClose={() => setIsPreferencesOpen(false)}
                            onSubmit={handlePreferencesSubmit}/>
                        <SaveRoute
                            key={String(isSaveRouteOpen)}
                            isOpen={isSaveRouteOpen}
                            onClose={() => setIsSaveRouteOpen(false)}
                            daysCount={routePreferences?.days || 0}
                            onSave={handleSaveGpx}/>
                    </>
                )}
                <Footer />
            </main>
        </div>
    )
}

export default App