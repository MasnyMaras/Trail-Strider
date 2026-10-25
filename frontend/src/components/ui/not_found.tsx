import { Compass, Home } from "lucide-react";

interface NotFoundProps {
    onGoHome?: () => void;
}

export default function NotFound({ onGoHome }: NotFoundProps) {
    const handleHomeClick = () => {
        console.log("[NotFound] Przycisk powrotu do strony głównej");
        alert("Powrót do strony głównej działa");
        onGoHome?.();
    };

    return (
        <main className="relative flex flex-1 w-full h-full items-center justify-center pt-50 p-6 bg-slate-50 overflow-hidden">

            <div className="relative z-10 flex w-full max-w-md flex-col items-center rounded-3xl border border-white/50 bg-white/40 p-8 text-center shadow-xl backdrop-blur-md">

                <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-100/80 text-green-700 shadow-sm">
                    <Compass size={40} />
                </div>

                <span className="mb-1 font-['Luckiest_Guy'] text-6xl tracking-wider text-green-700 drop-shadow-sm">
                    404
                </span>

                <h1 className="mb-2  text-xl font-bold text-slate-800">
                    Not Found
                </h1>

                <p className="mb-8 text-xs md:text-sm text-slate-600 leading-relaxed">
                    Strona, której szukasz, nie istnieje. Sprawdź adres lub wróc do strony głownej.
                </p>

                <button
                    onClick={handleHomeClick}
                    className="group relative flex h-11 w-full items-center overflow-hidden rounded-full border border-white/60 bg-white text-sm font-medium text-slate-800 shadow-sm transition-colors duration-500 hover:text-white focus:outline-none focus:ring-2 focus:ring-green-700 focus:ring-offset-2"
                >
                    <span className="absolute left-4 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-green-700 transition-transform duration-700 ease-out group-hover:scale-[250]"></span>

                    <div className="relative z-10 flex w-full items-center justify-center gap-2 px-5 transition-all duration-500">
                        <span className="w-2 transition-all duration-500 group-hover:-ml-2 group-hover:w-0"></span>
                        <span className="transition-all duration-500">Wróć na stronę główną</span>
                        <div className="w-0 overflow-hidden opacity-0 transition-all duration-500 group-hover:w-5 group-hover:opacity-100">
                            <Home className="h-4 w-4" />
                        </div>
                    </div>
                </button>
            </div>
        </main>
    );
}