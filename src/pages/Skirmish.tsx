import { SpiderSkirmishCard } from "@/components/SpiderSkirmishCard";
import Header from "@/components/Header";

const Skirmish = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-3 sm:px-6 py-6">
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