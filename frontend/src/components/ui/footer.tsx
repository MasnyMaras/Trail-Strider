export default function Footer() {
    return (
        <footer className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
            <div className="bg-white/70 backdrop-blur-md text-slate-700 shadow-sm border border-white/40 px-4 py-1.5 rounded-full">
                <p className="text-xs font-medium tracking-wide">
                    &copy; {new Date().getFullYear()} Trail-Strider. Wszelkie prawa zastrzeżone.
                </p>
            </div>
        </footer>
    );
}