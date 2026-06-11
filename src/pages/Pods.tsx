import React from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowLeft, Compass, Trophy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import FriendPodsHomeSection from "@/components/FriendPodsHomeSection";
import { useAuth } from "@/auth/AuthProvider";
import EmptyState from "@/components/EmptyState";
import MyJoinRequestsPanel from "@/components/MyJoinRequestsPanel";

const Pods: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Friend Pods — Spider League</title>
        <meta
          name="description"
          content="Battle alongside your friends in private Spider League pods."
        />
        <link rel="canonical" href={`${window.location.origin}/pods`} />
      </Helmet>

      <div className="container mx-auto px-4 py-4 sm:py-6 space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4 mr-1" /> Home
            </Link>
          </Button>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-medium">Friend Pods</span>
          <div className="ml-auto">
            <Button variant="outline" size="sm" asChild>
              <Link to="/pods/browse"><Compass className="h-4 w-4 mr-1" />Browse pods</Link>
            </Button>
          </div>
        </div>

        {!user ? (
          <EmptyState
            icon={Users}
            title="Pods Are For Friends"
            description="Friend pods are private mini-leagues built for your group chat. Create a pod, share the invite link, battle each other's spiders, and chase the top of the pod leaderboard together."
            primaryAction={{ label: "Sign In", to: "/auth" }}
            secondaryAction={{ label: "Browse Pods", to: "/pods/browse", icon: Compass }}
          />
        ) : (
          <>
            <MyJoinRequestsPanel />
            <FriendPodsHomeSection />
          </>
        )}
      </div>
    </div>
  );
};

export default Pods;