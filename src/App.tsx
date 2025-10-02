import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import SpiderUpload from "./pages/SpiderUpload";
import SpiderCollection from "./pages/SpiderCollection";
import Leaderboard from "./pages/Leaderboard";
import Roadmap from "./pages/Roadmap";
import BattleHistory from "./pages/BattleHistory";
import BattleMode from "./pages/BattleMode";
import TurnBasedBattle from "./pages/TurnBasedBattle";
import AboutUs from "./pages/AboutUs";
import Shop from "./pages/Shop";
import UserCollection from "./pages/UserCollection";
import { AuthProvider } from "@/auth/AuthProvider";
import Layout from "@/components/Layout";
import NotificationListener from "@/components/NotificationListener";
import { InstallPrompt } from "@/components/InstallPrompt";
import BattleNotification from "@/components/BattleNotification";

const queryClient = new QueryClient();

// Set dark theme as default
document.documentElement.classList.add('dark');

const App = () => (
  <QueryClientProvider client={queryClient}>
    <HelmetProvider>
      <AuthProvider>
        <TooltipProvider>
          <InstallPrompt />
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <NotificationListener />
            <BattleNotification />
            <Layout>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/upload" element={<SpiderUpload />} />
                <Route path="/collection" element={<SpiderCollection />} />
                <Route path="/leaderboard" element={<Leaderboard />} />
                <Route path="/battle-history" element={<BattleHistory />} />
                <Route path="/battle-mode" element={<BattleMode />} />
                <Route path="/battle/:battleId" element={<TurnBasedBattle />} />
                <Route path="/roadmap" element={<Roadmap />} />
                <Route path="/collection/:userId" element={<UserCollection />} />
                <Route path="/shop" element={<Shop />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Layout>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </HelmetProvider>
  </QueryClientProvider>
);

export default App;
