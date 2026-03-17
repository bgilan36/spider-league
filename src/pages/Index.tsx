import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/auth/AuthProvider";
import { useToast } from "@/components/ui/use-toast";
import { Trophy, Users, Loader2, Sword, Bug, Heart, Camera, Target, Sparkles } from "lucide-react";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { format } from "date-fns";
import { HowItWorksModal } from "@/components/HowItWorksModal";
import { UserProfileMenu } from "@/components/UserProfileMenu";
import { BadgeNotification } from "@/components/BadgeNotification";
import { useBadgeSystem } from "@/hooks/useBadgeSystem";
import { UserProfileModal } from "@/components/UserProfileModal";
import { supabase } from "@/integrations/supabase/client";
import PowerScoreArc from "@/components/PowerScoreArc";
import SpiderDetailsModal from "@/components/SpiderDetailsModal";
import BattleMode from "@/components/BattleMode";
import BattleButton from "@/components/BattleButton";
import ActiveChallengesPreview from "@/components/ActiveChallengesPreview";
import BattleDetailsModal from "@/components/BattleDetailsModal";
import ClickableUsername from "@/components/ClickableUsername";

import NotificationsDropdown from "@/components/NotificationsDropdown";
import OnlineUsersBar from "@/components/OnlineUsersBar";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/PullToRefreshIndicator";
import { useIsMobile } from "@/hooks/use-mobile";
import WeeklyEligibleSpiders from "@/components/WeeklyEligibleSpiders";
import { SpiderSkirmishCard } from "@/components/SpiderSkirmishCard";
...
      </main>
      
      {/* Feedback Card */}
      {user && <div className="container mx-auto px-3 sm:px-6 mt-8 sm:mt-12 mb-6 sm:mb-8">
          <a href="https://forms.gle/66uF4PESgaQb9U5r5" target="_blank" rel="noopener noreferrer" className="block">
            <Card className="cursor-pointer hover:scale-[1.02] transition-transform duration-300 bg-gradient-to-br from-primary/10 via-background to-secondary/10 border-primary/20">
              <CardContent className="p-6 sm:p-8 text-center">
                <h3 className="text-lg sm:text-xl md:text-2xl font-bold mb-2 sm:mb-3 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  Help Shape Spider League
                </h3>
                <p className="text-muted-foreground text-sm sm:text-base mb-3 sm:mb-4">We need your beta user feedback to help us make Spider League better.</p>
                <div className="inline-flex items-center gap-2 text-primary font-semibold text-sm sm:text-base">
                  <span>Submit Feedback</span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                </div>
              </CardContent>
            </Card>
          </a>
        </div>}
      
      <SpiderDetailsModal spider={selectedSpider} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      
      <BattleDetailsModal isOpen={isBattleDetailsOpen} onClose={() => setIsBattleDetailsOpen(false)} battle={selectedBattle} />

      <UserProfileModal userId={selectedUserId} isOpen={isUserModalOpen} onClose={handleUserModalClose} />

      <BadgeNotification badge={newBadge} isVisible={showBadgeNotification} onDismiss={dismissBadgeNotification} />
      
      {/* Footer */}
      <footer className="border-t mt-12 sm:mt-16 py-6 sm:py-8 bg-card/30">
        <div className="container mx-auto px-3 sm:px-6 text-center">
          <p className="text-muted-foreground text-xs sm:text-sm mb-3 sm:mb-4">
            © 2025 Spider League. Share spiders for friendly battles.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link to="/shop" className="text-primary hover:text-primary/80 transition-colors underline text-sm">
              Shop
            </Link>
          </div>
        </div>
      </footer>

      {/* Spider Facts Ticker */}
      <div className="relative overflow-hidden bg-primary/10 border-t py-2 sm:py-3">
        <div className="flex animate-scroll whitespace-nowrap">
          {[...Array(2)].map((_, index) => <div key={index} className="flex items-center">
              <span className="text-xs sm:text-sm text-muted-foreground mx-6 sm:mx-8">🕷️ Spiders have been around for over 380 million years</span>
              <span className="text-xs sm:text-sm text-muted-foreground mx-6 sm:mx-8">🕸️ Spider silk is stronger than steel of the same thickness</span>
              <span className="text-xs sm:text-sm text-muted-foreground mx-6 sm:mx-8">🕷️ Most spiders have 8 eyes but some have 6, 4, 2, or even 0</span>
              <span className="text-xs sm:text-sm text-muted-foreground mx-6 sm:mx-8">🕸️ Spiders can't fly but some species can "balloon" using their silk</span>
              <span className="text-xs sm:text-sm text-muted-foreground mx-6 sm:mx-8">🕷️ The Goliath birdeater is the world's largest spider, reaching 12 inches</span>
              <span className="text-xs sm:text-sm text-muted-foreground mx-6 sm:mx-8">🕸️ A spider's fangs are actually chelicerae - modified appendages</span>
              <span className="text-xs sm:text-sm text-muted-foreground mx-6 sm:mx-8">🕷️ Jumping spiders can leap up to 50 times their body length</span>
              <span className="text-xs sm:text-sm text-muted-foreground mx-6 sm:mx-8">🕸️ Some spiders can survive for months without food</span>
            </div>)}
        </div>
      </div>

      
      
      {/* Hidden file input for quick upload */}
      <input ref={fileInputRef} type="file" accept="image/*,.heic,.heif" className="hidden" onChange={handleFileSelect} />
    </div>;
};
export default Index;
