import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const AboutUs = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/5">
      <Helmet>
        <title>About Us - Spider League</title>
        <meta name="description" content="Learn about the origins of Spider League and how Brian Gilan created this unique spider battling game." />
      </Helmet>

      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <Link to="/">
            <Button variant="ghost" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <div className="mb-8">
              <img 
                src="/lovable-uploads/1c9720f5-76a7-4e52-9f7b-757b5ebc5a12.png" 
                alt="Spider League Logo" 
                className="mx-auto max-w-md w-full h-auto"
              />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              About Spider League
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              The story behind the world's leading spider sport
            </p>
          </div>

          {/* Story Section */}
          <div className="grid md:grid-cols-2 gap-12 items-center mb-16">
            <div className="space-y-6">
              <h2 className="text-3xl font-bold text-foreground">
                How It All Started
              </h2>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  Spider League was born from the Tim Robinson on Late Night. Brian was surprised there wasn't actually a Spider League app, so he made one, and got a few friends to join the fun.
                </p>
                <p>
                  What started as a joke among friends quickly evolved into something much bigger.
                </p>
              </div>
            </div>
            
            <div className="bg-card rounded-lg p-8 shadow-lg">
              <h3 className="text-2xl font-bold text-foreground mb-4">
                The Vision
              </h3>
              <blockquote className="text-muted-foreground italic border-l-4 border-primary pl-4">
                "I wanted to create a space for people to share spiders with friends and have friendly fights."
              </blockquote>
              <p className="text-sm text-muted-foreground mt-4">
                - Brian Gilan, Founder
              </p>
            </div>
          </div>

          {/* Features Section */}
          <div className="bg-secondary/10 rounded-lg p-8 mb-16">
            <h2 className="text-3xl font-bold text-foreground mb-8 text-center">
              What Makes Spider League Special
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="bg-primary/10 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🕷️</span>
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  Real Spider Science
                </h3>
                <p className="text-muted-foreground">
                  Our AI-powered identification system uses real spider characteristics 
                  and behaviors to create authentic battle scenarios.
                </p>
              </div>
              
              <div className="text-center">
                <div className="bg-primary/10 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">⚔️</span>
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  Strategic Battles
                </h3>
                <p className="text-muted-foreground">
                  Each spider's unique traits create complex battle dynamics, 
                  making every match unpredictable and exciting.
                </p>
              </div>
              
              <div className="text-center">
                <div className="bg-primary/10 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🏆</span>
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  Global Community
                </h3>
                <p className="text-muted-foreground">
                  Connect with spider enthusiasts worldwide and climb 
                  the leaderboards with your champion arachnids.
                </p>
              </div>
            </div>
          </div>

          {/* Call to Action */}
          <div className="text-center">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Ready to Join the League?
            </h2>
            <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
              Start your spider collection today and discover which of your eight-legged 
              friends has what it takes to become a champion.
            </p>
            <div className="flex gap-4 justify-center">
              <Link to="/upload">
                <Button size="lg" className="gap-2">
                  Upload Your First Spider
                </Button>
              </Link>
              <Link to="/leaderboard">
                <Button variant="outline" size="lg">
                  View Leaderboard
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AboutUs;