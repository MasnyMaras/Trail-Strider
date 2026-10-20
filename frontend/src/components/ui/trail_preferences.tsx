import { useState } from "react";
import { X, Route, BedSingle, Home, Tent, TreePine, Signpost, Map, Footprints } from "lucide-react";

const DIFFICULTY_OPTIONS = [
    { id: 1, label: "początkujący" },
    { id: 2, label: "średni" },
    { id: 3, label: "zaawansowany" }
];
const ACCOMMODATION_OPTIONS = [
    { id: 1, label: "zakwaterowanie", icon: BedSingle },
    { id: 2, label: "schronisko", icon: Home },
    { id: 3, label: "pole namiotowe", icon: Tent },
    { id: 4, label: "na dziko", icon: TreePine }
];

const ROAD_TYPE_OPTIONS = [
    { id: 1, label: "Droga", icon: Map },
    { id: 2, label: "Szlak Tursystyczny", icon: Signpost },
    { id: 3, label: "Na dziko", icon: Footprints }
];
interface TrailPreferencesProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (preferences: {
        difficulty: number;
        days: number;
        accommodation: number[];
        roadType: number[]
    }) => void;
}

export default function TrailPreferences({
                                             isOpen,
                                             onClose,
                                             onSubmit,
                                         }: TrailPreferencesProps) {
    const [difficulty, setDifficulty] = useState<number>(1);
    const [days, setDays] = useState<number | "">(1);

    const [isDayError, setIsDayError] = useState<boolean>(false);
    const [isAccError, setIsAccError] = useState<boolean>(false);
    const [isRoadError, setIsRoadError] = useState<boolean>(false);

    const defaultAccommodation = ACCOMMODATION_OPTIONS.map(opt => opt.id);
    const defaultRoadType = ROAD_TYPE_OPTIONS.map(opt => opt.id);

    const [accommodation, setAccommodation] = useState<number[]>(defaultAccommodation);
    const [roadType, setRoadType] = useState<number[]>(defaultRoadType);

    if (!isOpen) return null;

    const handleClose = () => {
        setDifficulty(1);
        setDays(1);
        setIsDayError(false);
        setIsAccError(false);
        setIsRoadError(false);
        setAccommodation(defaultAccommodation);
        setRoadType(defaultRoadType);
        onClose();
    };

    const handleSubmit = () => {
        const daysInvalid = days === "" || days < 1;
        const accInvalid = accommodation.length === 0;
        const roadInvalid = roadType.length === 0;

        setIsDayError(daysInvalid);
        setIsAccError(accInvalid);
        setIsRoadError(roadInvalid);

        if (daysInvalid || accInvalid || roadInvalid) {
            return;
        }

        const submittedDays = days;

        setDifficulty(1);
        setDays(1);
        setIsDayError(false);
        setIsAccError(false);
        setIsRoadError(false);
        setAccommodation(defaultAccommodation);
        setRoadType(defaultRoadType);

        onSubmit({
            difficulty,
            days: submittedDays,
            accommodation,
            roadType
        });
    };

    const handleBlur = () => {
        if (days === "" || days < 1) {
            setIsDayError(true);
        }
    };

    const toggleAccommodation = (id: number) => {
        setAccommodation(prev => {
            const newAcc = prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id];
            if (newAcc.length > 0) setIsAccError(false);
            return newAcc;
        });
    };

    const toggleRoadType = (id: number) => {
        setRoadType(prev => {
            const newRoad = prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id];
            if (newRoad.length > 0) setIsRoadError(false);
            return newRoad;
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 p-4 backdrop-blur-sm transition-opacity">
            <div className="relative w-full max-w-sm rounded-2xl border border-white/50 bg-white/60 p-6 shadow-2xl backdrop-blur-md">

                <button
                    type="button"
                    onClick={handleClose}
                    className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/50 text-slate-500 shadow-sm transition-colors hover:bg-white hover:text-slate-800 focus:outline-none"
                    title="Zamknij"
                >
                    <X size={18} />
                </button>

                <h2 className="mt-4 mb-2 Stext-center font-['Luckiest_Guy'] text-3xl tracking-wide text-green-700 drop-shadow-sm">
                    Preferencje trasy
                </h2>

                <div className="mb-8 flex flex-col gap-3">

                    <div className="flex flex-col">
                        <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Poziom umiejętności
                        </label>
                        <div className="flex w-full items-center justify-between rounded-xl bg-white p-1 shadow-sm border border-white/60">
                            {DIFFICULTY_OPTIONS.map((option) => {
                                const isActive = difficulty === option.id;
                                return (
                                    <button
                                        key={option.id}
                                        type="button"
                                        onClick={() => setDifficulty(option.id)}
                                        className={`flex-1 rounded-lg py-2 text-[9px] font-bold uppercase tracking-wider transition-all duration-300 md:text-[10px] ${
                                            isActive
                                                ? "bg-green-700 text-white shadow-md"
                                                : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                                        }`}
                                    >
                                        {option.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex flex-col">
                        <div className={`rounded-xl border bg-white px-4 py-3 shadow-sm transition-all duration-300 focus-within:shadow-md ${
                            isDayError
                                ? "border-red-500 focus-within:border-red-500"
                                : "border-white/60 focus-within:border-green-500"
                        }`}>
                            <label className={`mb-1 block text-[10px] font-bold uppercase tracking-wider ${isDayError ? "text-red-500" : "text-slate-500"}`}>
                                Na ile dni podzielić trasę?
                            </label>
                            <input
                                type="number"
                                min="1"
                                value={days}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setDays(val === "" ? "" : parseInt(val));
                                    setIsDayError(false);
                                }}
                                onBlur={handleBlur}
                                className="w-full bg-transparent text-sm font-medium text-slate-800 focus:outline-none"
                            />
                        </div>
                        {isDayError && (
                            <p className="mt-1.5 pl-2 text-xs font-medium text-red-500">
                                minimalna ilość dni 1
                            </p>
                        )}
                    </div>

                    <div className="flex flex-col">
                        <div className={`rounded-xl border bg-white p-4 shadow-sm transition-all duration-300 ${
                            isAccError ? "border-red-500" : "border-white/60"
                        }`}>
                            <label className={`mb-3 block text-[10px] font-bold uppercase tracking-wider ${isAccError ? "text-red-500" : "text-slate-500"}`}>
                                Typ noclegów
                            </label>
                            <div className="flex flex-col gap-2.5">
                                {ACCOMMODATION_OPTIONS.map((option) => {
                                    const isChecked = accommodation.includes(option.id);
                                    const Icon = option.icon;
                                    return (
                                        <button
                                            key={option.id}
                                            type="button"
                                            onClick={() => toggleAccommodation(option.id)}
                                            className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 transition-colors duration-200 ${
                                                isChecked ? 'bg-slate-100/80' : 'hover:bg-slate-50'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <Icon className={`h-5 w-5 ${isChecked ? 'text-green-700' : 'text-slate-400'}`} strokeWidth={isChecked ? 2.5 : 2} />
                                                <span className={`text-sm capitalize ${isChecked ? 'font-semibold text-slate-800' : 'font-medium text-slate-600'}`}>
                                                    {option.label}
                                                </span>
                                            </div>

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
                        {isAccError && (
                            <p className="mt-1.5 pl-2 text-xs font-medium text-red-500">
                                wymagany minimum 1 typ noclegu
                            </p>
                        )}
                    </div>

                    <div className="flex flex-col">
                        <div className={`rounded-xl border bg-white p-4 shadow-sm transition-all duration-300 ${
                            isRoadError ? "border-red-500" : "border-white/60"
                        }`}>
                            <label className={`mb-3 block text-[10px] font-bold uppercase tracking-wider ${isRoadError ? "text-red-500" : "text-slate-500"}`}>
                                Typ drogi
                            </label>
                            <div className="flex flex-col gap-2.5">
                                {ROAD_TYPE_OPTIONS.map((option) => {
                                    const isChecked = roadType.includes(option.id);
                                    const Icon = option.icon;

                                    return (
                                        <button
                                            key={option.id}
                                            type="button"
                                            onClick={() => toggleRoadType(option.id)}
                                            className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 transition-colors duration-200 ${
                                                isChecked ? 'bg-slate-100/80' : 'hover:bg-slate-50'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <Icon className={`h-5 w-5 ${isChecked ? 'text-green-700' : 'text-slate-400'}`} strokeWidth={isChecked ? 2.5 : 2} />
                                                <span className={`text-sm capitalize ${isChecked ? 'font-semibold text-slate-800' : 'font-medium text-slate-600'}`}>
                                                    {option.label}
                                                </span>
                                            </div>

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
                        {isRoadError && (
                            <p className="mt-1.5 pl-2 text-xs font-medium text-red-500">
                                wymagany minimum 1 typ drogi
                            </p>
                        )}
                    </div>

                </div>

                <button
                    onClick={handleSubmit}
                    className="group relative flex h-11 w-full shrink-0 items-center overflow-hidden rounded-full border border-white/60 bg-white text-sm font-medium text-slate-800 shadow-sm transition-colors duration-500 hover:text-white focus:outline-none focus:ring-2 focus:ring-green-700 focus:ring-offset-2"
                >
                    <span className="absolute left-4 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-green-700 transition-transform duration-700 ease-out group-hover:scale-[250]"></span>
                    <div className="relative z-10 flex w-full items-center justify-center gap-2 px-5 transition-all duration-500">
                        <span className="w-2 transition-all duration-500 group-hover:-ml-2 group-hover:w-0"></span>
                        <span className="transition-all duration-500">Podziel trasę</span>
                        <div className="w-0 overflow-hidden opacity-0 transition-all duration-500 group-hover:w-4 group-hover:opacity-100">
                            <Route className="h-4 w-4" />
                        </div>
                    </div>
                </button>
            </div>
        </div>
    );
}