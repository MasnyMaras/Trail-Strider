import { ArrowRight } from "lucide-react";
export default function Header() {
    const handleActionClick = () => {
        console.log("[Header] working");
        alert("header clicked working");
    };

    return (
        <header className="absolute top-0 left-0 right-0 z-20 flex w-full items-center justify-between bg-white/10 px-6 py-4 backdrop-blur-md shadow-sm border-b border-white/50">

            <div>
                <h1 className="text-3xl md:text-4xl font-['Luckiest_Guy'] tracking-wide text-green-700 drop-shadow-md">
                    Trail-Strider
                </h1>
            </div>

            <nav aria-label="main navigation">
                <button
                    onClick={handleActionClick}
                    className="group relative flex h-10 min-w-35 items-center overflow-hidden rounded-full bg-white text-sm font-medium text-slate-800 shadow-sm transition-colors duration-500 hover:text-white focus:outline-none focus:ring-2 focus:ring-green-700 focus:ring-offset-2"
                >
                    <span className="absolute left-4 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-green-700 transition-transform duration-700 ease-out group-hover:scale-[150]"></span>


                    <div className="relative z-10 flex w-full items-center justify-center gap-2 px-5 transition-all duration-500">

                        <span className="w-2 transition-all duration-500 group-hover:w-0 group-hover:-ml-2"></span>

                        <span className="transition-all duration-500">Zaloguj się</span>

                        <div className="w-0 overflow-hidden opacity-0 transition-all duration-500 group-hover:w-4 group-hover:opacity-100">
                            <ArrowRight className="h-4 w-4" />
                        </div>
                    </div>
                </button>
            </nav>

        </header>
    );
}