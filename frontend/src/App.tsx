import { Button } from "@/components/ui/button"
import Header from "@/components/ui/header"

export function App() {
    return (
        <div className="flex min-h-screen flex-col bg-slate-50">
            <Header />
            <p className="text-sm">
                    Tailwind CSS & shadcn/ui działają
                </p>
                <Button variant="default" onClick={() => alert("Dziala")}>
                    test
                </Button>
        </div>
    )
}

export default App