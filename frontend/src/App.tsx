//import { Button } from "@/components/ui/button"
import Header from "@/components/ui/header"
import MapView from "@/components/map/MapView"

export function App() {
    return (
        <div className="flex min-h-screen flex-col overflow-hidden bg-slate-50">
            <Header />
            <main className="relative flex-1 w-full h-full">
                <MapView />
            </main>
        </div>
    )
}

export default App