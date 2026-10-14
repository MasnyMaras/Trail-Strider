import { ChevronLeft, ChevronRight, Download } from "lucide-react";

interface SidebarProps {
    isOpen: boolean;
    onToggle: () => void;
}

export default function Sidebar({ isOpen, onToggle }: SidebarProps) {
    const handlePlaceholderClick = () => {
        console.log("[Sidebar] Action button clicked");
        alert("Zapisano ustawienia");
    };

    return (
        <aside
            className={`absolute right-0 top-20 bottom-20 z-20 flex w-64 flex-col rounded-l-2xl border border-white/50 bg-white/30 shadow-lg backdrop-blur-md transition-transform duration-300 ease-in-out md:right-4 md:top-20 md:bottom-15 md:w-80 md:rounded-2xl lg:w-120 ${
                isOpen ? "translate-x-0" : "translate-x-full md:translate-x-[calc(100%+1rem)]"
            }`}
        >
            <button
                onClick={onToggle}
                className="absolute -left-10 top-1/2 flex h-16 w-10 -translate-y-1/2 items-center justify-center rounded-l-xl border-y border-l border-white/50 bg-white/60 text-slate-700 shadow-[-4px_0_10px_rgba(0,0,0,0.05)] backdrop-blur-md transition-all hover:bg-white hover:text-green-600 focus:bg-white focus:outline-none"
                aria-label={isOpen ? "Zwiń panel" : "Rozwiń panel"}
            >
                {isOpen ? <ChevronRight size={24} /> : <ChevronLeft size={24} />}
            </button>

            <div className="m-2 flex flex-1 flex-col overflow-hidden rounded-xl bg-white p-3 shadow-inner md:p-4">
                <h2 className="mb-3 text-base font-bold text-slate-800 md:mb-4 md:text-lg">
                    Ustawienia trasy
                </h2>

                <p className="flex-1 text-xs text-slate-500 md:text-sm">
                    Tutaj w przyszłości pojawią się opcje wyszukiwania i filtry...
                </p>

                <button
                    onClick={handlePlaceholderClick}
                    className="group relative mt-auto flex h-10 w-full items-center overflow-hidden rounded-full bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 shadow-sm transition-colors duration-500 hover:text-white focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2 md:h-11 md:text-sm"
                >
                    <span className="absolute left-4 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-green-600 transition-transform duration-700 ease-out group-hover:scale-[250]"></span>

                    <div className="relative z-10 flex w-full items-center justify-center gap-2 px-5 transition-all duration-500">

                        <span className="w-2 transition-all duration-500 group-hover:w-0 group-hover:-ml-2"></span>

                        <span className="transition-all duration-500">Zapisz Trasę</span>

                        <div className="w-0 overflow-hidden opacity-0 transition-all duration-500 group-hover:w-4 group-hover:opacity-100">
                            <Download className="h-4 w-4" />
                        </div>
                    </div>
                </button>
            </div>
        </aside>
    );
}