import React from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowLeft, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import FriendPodsHomeSection from "@/components/FriendPodsHomeSection";
import { useAuth } from "@/auth/AuthProvider";
import EmptyState from "@/components/EmptyState";

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
        </div>

        {!user ? (
          <EmptyState
            icon={Users}
            title="Pods Are For Friends"
            description="Sign in to create a private pod, invite your crew, and start a season of bragging-rights battles."
            primaryAction={{ label: "Sign In", to: "/auth" }}
          />
        ) : (
          <FriendPodsHomeSection />
        )}
      </div>
    </div>
  );
};

export default Pods;