import { useState } from "react";
import { X, Download, ListChecks, AlertCircle } from "lucide-react";

interface SaveRouteProps {
    isOpen: boolean;
    onClose: () => void;
    daysCount: number;
    onSave: (selectedDays: number[]) => void;
}

export default function SaveRoute({ isOpen, onClose, daysCount, onSave }: SaveRouteProps) {
    const [selectedDays, setSelectedDays] = useState<number[]>([]);
    const [isSaveError, setIsSaveError] = useState<boolean>(false);


    if (!isOpen) return null;

    const toggleDay = (index: number) => {
        setSelectedDays(prev =>
            prev.includes(index) ? prev.filter(d => d !== index) : [...prev, index]
        );
        setIsSaveError(false)
    };

    const handleSelectAll = () => {
        const allDays = Array.from({ length: daysCount }).map((_, i) => i);
        setSelectedDays(allDays);
        setIsSaveError(false)
    };

    const handleSave = () => {
        if (daysCount > 0 && selectedDays.length === 0) {
            setIsSaveError(true)
            return;
        }
        onSave(selectedDays);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 p-4 backdrop-blur-sm transition-opacity">
            <div className="relative flex w-full max-w-sm max-h-[90vh] flex-col rounded-2xl border border-white/50 bg-white/60 p-6 shadow-2xl backdrop-blur-md" onClick={(e) => e.stopPropagation()}>

                <button
                    type="button"
                    onClick={() => {
                        setIsSaveError(false);
                        onClose();
                    }}                    className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/50 text-slate-500 shadow-sm transition-colors hover:bg-white hover:text-slate-800 focus:outline-none"
                    title="Zamknij"
                >
                    <X size={18} />
                </button>

                <h2 className="mb-4 mt-2 text-center font-['Luckiest_Guy'] text-4xl tracking-wide text-green-700 drop-shadow-sm uppercase">
                    Zapisz plik GPX
                </h2>

                {daysCount > 0 ? (
                    <>
                        <div className="mb-6 flex flex-1 flex-col overflow-y-auto pr-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-green-700 [&::-webkit-scrollbar-thumb]:rounded-full [scrollbar-width:thin]">
                            <label className="block px-1 text-[15px] font-bold uppercase tracking-wider text-slate-500">
                                Wybierz dni do zapisu
                            </label>
                            {isSaveError && (
                                <p className="mt-1.5 mb-2 pl-2 text-[15px] font-medium text-red-500">
                                    minimalna ilość dni 1
                                </p>
                            )}
                            <div className="flex flex-col gap-2">
                                {Array.from({ length: daysCount }).map((_, index) => {
                                    const isChecked = selectedDays.includes(index);
                                    return (
                                        <button
                                            key={index}
                                            type="button"
                                            onClick={() => toggleDay(index)}
                                            className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 shadow-sm transition-colors duration-200 ${
                                                isChecked ? 'border-green-700 bg-white/80' : 'border-white/60 bg-white/40 hover:bg-white/60'
                                            }`}
                                        >
                                            <span className={`font-['Luckiest_Guy'] text-lg tracking-wide drop-shadow-sm ${isChecked ? 'text-green-700' : 'text-slate-600'}`}>
                                                Dzień {index + 1}
                                            </span>

                                            <div className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-300 ease-in-out ${
                                                isChecked ? "bg-green-700" : "bg-slate-300"
                                            }`}>
                                                <span className={`flex h-4 w-4 transform items-center justify-center rounded-full bg-white shadow-sm transition-transform duration-300 ease-in-out ${
                                                    isChecked ? "translate-x-6" : "translate-x-1"
                                                }`}>
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="shrink-0 flex flex-col gap-3">
                            <button
                                onClick={handleSelectAll}
                                className="group relative flex h-10 w-full items-center overflow-hidden rounded-full border border-slate-200 bg-slate-50 text-xs font-medium text-slate-800 shadow-sm transition-colors duration-500 hover:text-white focus:outline-none focus:ring-2 focus:ring-green-700 focus:ring-offset-2 md:h-11 md:text-sm"
                            >
                                <span className="absolute left-4 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-green-700 transition-transform duration-700 ease-out group-hover:scale-[250]"></span>
                                <div className="relative z-10 flex w-full items-center justify-center gap-2 px-5 transition-all duration-500">
                                    <span className="w-2 transition-all duration-500 group-hover:-ml-2 group-hover:w-0"></span>
                                    <span className="transition-all duration-500">Zaznacz całą trasę</span>
                                    <div className="w-0 overflow-hidden opacity-0 transition-all duration-500 group-hover:w-4 group-hover:opacity-100">
                                        <ListChecks className="h-4 w-4" />
                                    </div>
                                </div>
                            </button>

                            <button
                                onClick={handleSave}
                                className="group relative flex h-11 w-full items-center overflow-hidden rounded-full border border-white/60 bg-white text-sm font-medium text-slate-800 shadow-sm transition-colors duration-500 hover:text-white focus:outline-none focus:ring-2 focus:ring-green-700 focus:ring-offset-2"
                            >
                                <span className="absolute left-4 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-green-700 transition-transform duration-700 ease-out group-hover:scale-[250]"></span>
                                <div className="relative z-10 flex w-full items-center justify-center gap-2 px-5 transition-all duration-500">
                                    <span className="w-2 transition-all duration-500 group-hover:-ml-2 group-hover:w-0"></span>
                                    <span className="transition-all duration-500">Zapisz jako gpx</span>
                                    <div className="w-0 overflow-hidden opacity-0 transition-all duration-500 group-hover:w-4 group-hover:opacity-100">
                                        <Download className="h-4 w-4" />
                                    </div>
                                </div>
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="mb-2 flex flex-col items-center justify-center p-2 text-center">
                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100/80 text-amber-600">
                            <AlertCircle size={24} />
                        </div>
                        <span className="mb-2 text-[16px] font-medium text-slate-700">
                            Zapisujesz trasę bez preferencji i podziału na dni.
                        </span>

                        <button
                            onClick={handleSave}
                            className="mt-6 group relative flex h-11 w-full items-center overflow-hidden rounded-full border border-white/60 bg-white text-sm font-medium text-slate-800 shadow-sm transition-colors duration-500 hover:text-white focus:outline-none focus:ring-2 focus:ring-green-700 focus:ring-offset-2"
                        >
                            <span className="absolute left-4 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-green-700 transition-transform duration-700 ease-out group-hover:scale-[250]"></span>
                            <div className="relative z-10 flex w-full items-center justify-center gap-2 px-5 transition-all duration-500">
                                <span className="w-2 transition-all duration-500 group-hover:-ml-2 group-hover:w-0"></span>
                                <span className="transition-all duration-500">Zapisz jako gpx</span>
                                <div className="w-0 overflow-hidden opacity-0 transition-all duration-500 group-hover:w-4 group-hover:opacity-100">
                                    <Download className="h-4 w-4" />
                                </div>
                            </div>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}