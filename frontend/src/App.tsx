//import { Button } from "@/components/ui/button"
import Header from "@/components/ui/header"
import MapView from "@/components/map/MapView"
import Footer from "@/components/ui/footer"
import Sidebar from "@/components/ui/sidebar"
import TrailPreferences from "@/components/ui/trail_preferences"
import SaveRoute from "@/components/ui/save_route"
import NotFound from "@/components/ui/not_found"
import SearchBar from "@/components/ui/search_bar";
import ElevationProfile from "@/components/ui/elevation_profile.tsx";
import { calculateRoute } from "@/api/routes"
import { useEffect, useState } from "react";
import type { RoutePoint, RouteResponse } from "@/types/route"

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
        setPoints((prev) => prev.filter((p) => p.id !== id))
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

    const handleCalculateRoute = async () => {
        const coordinates = points
            .map((point) => point.coordinates)
            .filter((coordinate): coordinate is [number, number] => coordinate !== undefined)

        if (coordinates.length < 2) {
            setRouteError("Wybierz co najmniej dwa punkty trasy.")
            return
        }

        setIsRouteLoading(true)
        setRouteError(null)

        try {
            const response = await calculateRoute({
                points: coordinates,
                mode: isAutoMode ? "a" : "m",
            })
            setRouteResponse(response)
        } catch (error) {
            setRouteResponse(null)
            setRouteError(
                error instanceof Error
                    ? error.message
                    : "Nie udało się wyznaczyć trasy.",
            )
        } finally {
            setIsRouteLoading(false)
        }
    }

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
                        <SearchBar isSidebarOpen={isSidebarOpen} />
                        <MapView
                            isSidebarOpen={isSidebarOpen}
                            points={points}
                            onAddPoint={handleAddPoint}
                            onRemovePoint={handleRemovePoint}/>
                        <Sidebar
                            isOpen={isSidebarOpen}
                            onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
                            points={points}
                            onAddStop={handleAddStop}
                            onRemoveStop={handleRemovePoint}
                            onUpdatePointValue={handleUpdatePointValue}
                            onReorderPoints={setPoints}
                            isAutoMode={isAutoMode}
                            onAutoModeToggle={setIsAutoMode}
                            onOpenPreferences={() => setIsPreferencesOpen(true)}
                            onOpenSaveRoute={() => setIsSaveRouteOpen(true)}
                            routePreferences={routePreferences}
                            routeStats={routeStats}
                            onCalculateRoute={handleCalculateRoute}
                            isRouteLoading={isRouteLoading}
                            routeError={routeError}/>
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