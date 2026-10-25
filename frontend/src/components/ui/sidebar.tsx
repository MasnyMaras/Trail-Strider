import { useState} from "react";
import { ChevronLeft, ChevronRight, Download, Plus, Menu, X, Route,ChevronDown, ChevronUp } from "lucide-react";
import type { RoutePoint } from "@/types/route";
import type { RoutePreferences, DayStat } from "@/App";

interface SidebarProps {
    isOpen: boolean;
    onToggle: () => void;
    points: RoutePoint[];
    onAddStop: (insertIndex: number) => void;
    onRemoveStop: (id: string) => void;
    onUpdatePointValue: (id: string, newValue: string) => void;
    onReorderPoints: (newPoints: RoutePoint[]) => void;
    isAutoMode: boolean;
    onAutoModeToggle: (newState: boolean) => void;
    onOpenPreferences: () => void;
    onOpenSaveRoute: () => void;
    routePreferences: RoutePreferences | null;
    routeStats?: DayStat[] | null;
}

export default function Sidebar({
                                isOpen,
                                onToggle,
                                points,
                                onAddStop,
                                onRemoveStop,
                                onUpdatePointValue,
                                onReorderPoints,
                                isAutoMode,
                                onAutoModeToggle,
                                onOpenPreferences,
                                onOpenSaveRoute,
                                routePreferences,
                                routeStats
}: SidebarProps) {


    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

    const addStop = (insertIndex: number) => {
        onAddStop(insertIndex);
    };

    const removeStop = (idToRemove: string) => {
        onRemoveStop(idToRemove);
    };

    const updatePointValue = (id: string, newValue: string) => {
        onUpdatePointValue(id, newValue);
    }

    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragEnter = (_e: React.DragEvent, targetIndex: number) => {
        if (draggedIndex === null || draggedIndex === targetIndex) return;

        const newPoints = [...points];
        const [moved] = newPoints.splice(draggedIndex, 1);
        newPoints.splice(targetIndex, 0, moved);
        onReorderPoints(newPoints);

        setDraggedIndex(targetIndex);
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
    };
    const handleAutoModeToggle = () => {
        const newState = !isAutoMode;
        onAutoModeToggle(newState);
        /*alert(`Tryb automatyczny: ${newState ? "włączony" : "wyłączony"}`);*/
    };
    const [expandedDays, setExpandedDays] = useState<number[]>([]);
    const toggleDay = (index: number) => {
        setExpandedDays(prev =>
            prev.includes(index)
                ? prev.filter(dayIndex => dayIndex !== index)
                : [...prev, index]
        );
    };
    return (
        <aside
            className={`absolute right-0 top-20 bottom-20 z-20 flex w-64 flex-col rounded-l-2xl border border-white/50 bg-white/30 shadow-lg backdrop-blur-md transition-transform duration-300 ease-in-out md:right-4 md:top-20 md:bottom-15 md:w-80 md:rounded-2xl lg:w-120 ${
                isOpen ? "translate-x-0" : "translate-x-full md:translate-x-[calc(100%+1rem)]"
            }`}
        >
            <button
                onClick={onToggle}
                className="absolute -left-10 top-1/2 flex h-16 w-10 -translate-y-1/2 items-center justify-center rounded-l-xl border-y border-l border-white/50 bg-white/60 text-slate-700 shadow-[-4px_0_10px_rgba(0,0,0,0.05)] backdrop-blur-md transition-all hover:bg-white hover:text-green-700 focus:bg-white focus:outline-none"
                aria-label={isOpen ? "Zwiń panel" : "Rozwiń panel"}
            >
                {isOpen ? <ChevronRight size={24} /> : <ChevronLeft size={24} />}
            </button>

            <div className="flex flex-1 flex-col overflow-hidden p-4 md:p-6">
                <h2 className="mb-6 text-center text-2xl font-['Luckiest_Guy'] tracking-wide text-green-700 drop-shadow-sm md:text-3xl">
                    Planowanie trasy
                </h2>
                <div className="mb-4 flex items-center justify-between rounded-xl bg-white/60 px-4 py-3 shadow-sm border border-white/60">
                    <span className="text-sm font-bold text-slate-700">Tryb automatyczny</span>
                    <button
                        type="button"
                        onClick={handleAutoModeToggle}
                        className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-300 ease-in-out focus:outline-none ${
                            isAutoMode ? "border-green-700 bg-green-700" : "border-slate-300 bg-gray-300"
                        }`}
                        aria-pressed={isAutoMode}
                    >
                        <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-300 ease-in-out ${
                                isAutoMode ? "translate-x-6" : "translate-x-0.5"
                            }`}
                        />
                    </button>
                </div>
                <div
                    className="flex flex-1 flex-col overflow-y-auto pb-4 pr-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-green-700 [&::-webkit-scrollbar-thumb]:rounded-full [scrollbar-width:thin] [scrollbar-color:theme(colors.green.700)_transparent]"
                    onWheel={(e) => e.stopPropagation()}
                    onDragOver={(e) => e.preventDefault()}
                >
                    {points.map((point, index) => {
                        const isFirst = index === 0;
                        const isLast = index === points.length - 1;
                        const canDelete = !isFirst && !isLast;
                        const labelText = isFirst ? "Początek trasy" : isLast ? "Koniec trasy" : `Przystanek ${index}`;
                        const isDragged = draggedIndex === index;

                        return (
                            <div key={point.id} className="flex flex-col">

                                <div
                                    className="flex w-full items-center gap-2"
                                    onDragEnter={(e) => handleDragEnter(e, index)}
                                    onDragOver={(e) => e.preventDefault()}
                                >

                                    <div
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, index)}
                                        onDragEnd={handleDragEnd}
                                        className={`group flex flex-1 items-center rounded-xl bg-white px-3 py-1 shadow-sm border transition-all duration-300 focus-within:shadow-md focus-within:border-green-700 focus-within:hover:border-green-700 ${
                                            isDragged
                                                ? 'opacity-30 scale-95 border-dashed border-green-700 shadow-none'
                                                : 'border-white/60 hover:border-slate-300'
                                        }`}
                                    >
                                        <div className="flex-1">
                                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 md:text-xs cursor-default">
                                                {labelText}
                                            </label>
                                            <input
                                                type="text"
                                                value={point.value}
                                                onChange={(e) => updatePointValue(point.id, e.target.value)}
                                                placeholder={`Wpisz ${labelText.toLowerCase()}...`}
                                                className="w-full bg-transparent text-sm font-medium text-slate-800 placeholder:text-slate-300 focus:outline-none"
                                                draggable
                                                onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") {
                                                        alert(`Wpisano ${labelText}: ${e.currentTarget.value}`);
                                                    }
                                                }}
                                            />
                                        </div>

                                        <div className="ml-2 flex items-center text-slate-300">
                                            <div title="Chwyć i przenieś" className="hover:text-slate-500 transition-colors p-1 cursor-grab active:cursor-grabbing">
                                                <Menu size={16} />
                                            </div>
                                        </div>
                                    </div>

                                    {canDelete ? (
                                        <button
                                            onClick={() => removeStop(point.id)}
                                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/50 text-slate-500 shadow-sm transition-colors hover:bg-white hover:text-red-500"
                                            title="Usuń przystanek"
                                        >
                                            <X size={16} />
                                        </button>
                                    ) : (
                                        <div className="h-8 w-8 shrink-0"></div>
                                    )}
                                </div>

                                {!isLast && (
                                    <div className={`relative my-1.5 flex items-center justify-center opacity-60 pr-10 transition-opacity ${isDragged ? 'opacity-0' : ''}`}>
                                        <div className="flex flex-col items-center gap-1">
                                            <span className="h-1 w-1 rounded-full bg-slate-800"></span>
                                            <span className="h-1 w-1 rounded-full bg-slate-800"></span>
                                            <span className="h-1 w-1 rounded-full bg-slate-800"></span>
                                        </div>

                                        <button
                                            onClick={() => addStop(index + 1)}
                                            className="absolute right-10 flex h-6 w-6 items-center justify-center rounded-full bg-white/70 text-green-700 shadow-sm transition-colors hover:bg-white border border-transparent hover:border-green-700"
                                            title="Dodaj przystanek tutaj"
                                        >
                                            <Plus size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    <button
                        onClick={onOpenPreferences}
                        className="group relative mt-6 shrink-0 flex h-10 w-full items-center overflow-hidden rounded-full bg-white border border-white/60 text-xs font-medium text-slate-800 shadow-sm transition-colors duration-500 hover:text-white focus:outline-none focus:ring-2 focus:ring-green-700 focus:ring-offset-2 md:h-11 md:text-sm"
                    >
                        <span className="absolute left-4 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-green-700 transition-transform duration-700 ease-out group-hover:scale-[250]"></span>
                        <div className="relative z-10 flex w-full items-center justify-center gap-2 px-5 transition-all duration-500">
                            <span className="w-2 transition-all duration-500 group-hover:w-0 group-hover:-ml-2"></span>
                            <span className="transition-all duration-500">Podziel trasę</span>
                            <div className="w-0 overflow-hidden opacity-0 transition-all duration-500 group-hover:w-4 group-hover:opacity-100">
                                <Route className="h-4 w-4" />
                            </div>
                        </div>
                    </button>

                    <div className="my-4 flex min-h-[100px] w-full shrink-0 items-center justify-center rounded-xl bg-white/40 p-4 shadow-sm backdrop-blur-sm">
                        <span className="text-sm font-bold text-slate-700">Wykres wysokościowy całej trasy</span>
                    </div>

                    {routePreferences && routePreferences.days > 0 && (
                        <div className="mt-2 mb-4 flex w-full flex-col gap-2 shrink-0">
                            {Array.from({ length: routePreferences.days }).map((_, index) => {
                                const isExpanded = expandedDays.includes(index);
                                const backendDistance = routeStats?.[index]?.distance;
                                const backendTime = routeStats?.[index]?.time;
                                return (
                                    <div key={index} className="flex w-full flex-col overflow-hidden rounded-xl border border-white/60 bg-white/60 shadow-sm backdrop-blur-sm transition-all duration-300">

                                        <button
                                            onClick={() => toggleDay(index)}
                                            className="flex w-full items-center justify-between px-4 py-3 hover:bg-white/80 transition-colors focus:outline-none"
                                        >
                                            <span className="font-['Luckiest_Guy'] text-lg tracking-wide text-green-700 drop-shadow-sm">
                                                Dzień {index + 1}
                                            </span>
                                            <div className="text-slate-400 transition-transform duration-300">
                                                {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                            </div>
                                        </button>

                                        <div className={`transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0'}`}>
                                            <div className="flex flex-col gap-2 px-4 pb-4 pt-1">

                                                <div className="flex w-full items-center justify-between px-1 text-xs md:text-[15px] font-semibold text-slate-600">
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-slate-400">Dystans:</span>
                                                        <span>{backendDistance !== undefined && backendDistance !== null ? `${backendDistance} km` : "X km"}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-slate-400">Czas:</span>
                                                        <span>{backendTime ? `${backendTime} h` : "X h"}</span>
                                                    </div>
                                                </div>

                                                <div className="flex min-h-[80px] w-full items-center justify-center rounded-lg border-2  border-slate-300 bg-white/50 p-2">
                                                    <span className="text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
                                                        wykres wysokosciowy dnia
                                                    </span>
                                                </div>

                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                </div>


                <button
                    onClick={onOpenSaveRoute}
                    className="group relative mt-auto flex h-10 w-full items-center overflow-hidden rounded-full bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 shadow-sm transition-colors duration-500 hover:text-white focus:outline-none focus:ring-2 focus:ring-green-700 focus:ring-offset-2 md:h-11 md:text-sm"
                >
                    <span className="absolute left-4 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-green-700 transition-transform duration-700 ease-out group-hover:scale-[250]"></span>

                    <div className="relative z-10 flex w-full items-center justify-center gap-2 px-5 transition-all duration-500">
                        <span className="w-2 transition-all duration-500 group-hover:w-0 group-hover:-ml-2"></span>
                        <span className="transition-all duration-500">Zapisz jako GPX</span>
                        <div className="w-0 overflow-hidden opacity-0 transition-all duration-500 group-hover:w-4 group-hover:opacity-100">
                            <Download className="h-4 w-4" />
                        </div>
                    </div>
                </button>
            </div>
        </aside>
    );
}