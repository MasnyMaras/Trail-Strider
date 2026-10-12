export default function Header() {
    const handleActionClick = () => {
        console.log("[Header] working");
        alert("header clicked working");
    };

    return (
        <header className="w-full bg-green-800 text-slate-50 px-6 py-4 flex items-center justify-between shadow-md">

            <div>
                <h1 className="text-xl md:text-2xl font-bold tracking-tight">
                    Trail-Strider
                </h1>
            </div>

            <nav aria-label="Główna nawigacja">
                <button onClick={handleActionClick} className="text-sm md:text-base font-medium hover:text-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-800 rounded px-2 py-1">
                    Zaloguj się
                </button>
            </nav>

        </header>
    );
}