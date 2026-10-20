//import { Button } from "@/components/ui/button"
import Header from "@/components/ui/header"
import MapView from "@/components/map/MapView"
import Footer from "@/components/ui/footer"
import Sidebar from "@/components/ui/sidebar"
import TrailPreferences from "@/components/ui/trail_preferences"
import { useState } from "react";
import type { RoutePoint } from "@/types/route"

export function App() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const [isAutoMode, setIsAutoMode] = useState(false)
    const [isPreferencesOpen, setIsPreferencesOpen] = useState(false)

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
    const handlePreferencesSubmit = (preferencesData: {
        difficulty: number;
        days: number;
        accommodation: number[];
        roadType: number[]
    }) => {
        console.log("Ustawione pref:", {
            points,
            isAutoMode,
            preferences: preferencesData
        });

        alert(
            `Ustawiono preferencje:\n` +
            `Poziom trudności (ID): ${preferencesData.difficulty}\n` +
            `Dni: ${preferencesData.days}\n` +
            `Noclegi (ID): ${preferencesData.accommodation.length > 0 ? "[" + preferencesData.accommodation.join(", ") + "]" : "Brak"}\n` +
            `Typ drogi (ID): ${preferencesData.roadType.length > 0 ? "[" + preferencesData.roadType.join(", ") + "]" : "Brak"}`
        );
        setIsPreferencesOpen(false);
    };

    return (
        <div className="flex min-h-screen flex-col overflow-hidden bg-slate-50">
            <Header />
            <main className="relative flex-1 w-full h-full">
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
                />
                <TrailPreferences
                    isOpen={isPreferencesOpen}
                    onClose={() => setIsPreferencesOpen(false)}
                    onSubmit={handlePreferencesSubmit}
                />
                <Footer />
            </main>
        </div>
    )
}

export default App