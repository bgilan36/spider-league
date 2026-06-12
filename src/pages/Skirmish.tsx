import { SpiderSkirmishCard } from "@/components/SpiderSkirmishCard";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const Skirmish = () => {
  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-3 sm:px-6 py-6">
        <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
          <Link to="/"><ArrowLeft className="h-4 w-4 mr-1" />Back</Link>
        </Button>
        <div className="mb-4">
          <h1 className="text-2xl font-bold">Wild Skirmish</h1>
          <p className="text-sm text-muted-foreground">
            Battle a wild spider for XP and bragging rights. Perfect for your first win.
          </p>
        </div>
        <SpiderSkirmishCard />
      </main>
    </div>
  );
};

export default Skirmish;