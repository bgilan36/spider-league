import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Plus, Users, Clock, CheckCircle, Lightbulb } from "lucide-react";

interface FeatureItem {
  id: string;
  title: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  category: string;
  estimatedTime: string;
}

interface KanbanColumn {
  id: string;
  title: string;
  description: string;
  items: FeatureItem[];
  color: string;
  icon: React.ReactNode;
}

const Roadmap = () => {
  const { toast } = useToast();
  const [isSubmissionOpen, setIsSubmissionOpen] = useState(false);
  const [featureTitle, setFeatureTitle] = useState("");
  const [featureDescription, setFeatureDescription] = useState("");
  const [featurePriority, setFeaturePriority] = useState<"LOW" | "MEDIUM" | "HIGH">("MEDIUM");

  // Placeholder roadmap data
  const kanbanColumns: KanbanColumn[] = [
    {
      id: "backlog",
      title: "Backlog",
      description: "Ideas and features under consideration",
      color: "bg-gray-500",
      icon: <Lightbulb className="h-5 w-5" />,
      items: [
        {
          id: "1",
          title: "Spider Battle Arena",
          description: "Real-time multiplayer spider battles with spectator mode",
          priority: "HIGH",
          category: "Combat",
          estimatedTime: "6-8 weeks"
        },
        {
          id: "2",
          title: "Mobile App",
          description: "Native mobile app for iOS and Android",
          priority: "MEDIUM",
          category: "Platform",
          estimatedTime: "12-16 weeks"
        },
        {
          id: "3",
          title: "Spider Trading Market",
          description: "Marketplace for trading spiders between players",
          priority: "MEDIUM",
          category: "Economy",
          estimatedTime: "8-10 weeks"
        }
      ]
    },
    {
      id: "in-progress",
      title: "In Progress",
      description: "Currently being developed",
      color: "bg-blue-500",
      icon: <Clock className="h-5 w-5" />,
      items: [
        {
          id: "4",
          title: "Weekly Leaderboards",
          description: "Time-based ranking system that resets weekly",
          priority: "HIGH",
          category: "Competition",
          estimatedTime: "2-3 weeks"
        },
        {
          id: "5",
          title: "Enhanced Spider AI",
          description: "Improved spider classification and rarity detection",
          priority: "HIGH",
          category: "AI/ML",
          estimatedTime: "4-5 weeks"
        }
      ]
    },
    {
      id: "testing",
      title: "Testing",
      description: "Features in testing and QA phase",
      color: "bg-yellow-500",
      icon: <Users className="h-5 w-5" />,
      items: [
        {
          id: "6",
          title: "User Profiles Enhancement",
          description: "Extended user profiles with achievements and stats",
          priority: "MEDIUM",
          category: "Social",
          estimatedTime: "1-2 weeks"
        }
      ]
    },
    {
      id: "completed",
      title: "Completed",
      description: "Recently shipped features",
      color: "bg-green-500",
      icon: <CheckCircle className="h-5 w-5" />,
      items: [
        {
          id: "7",
          title: "Spider Upload System",
          description: "AI-powered spider identification and classification",
          priority: "HIGH",
          category: "Core",
          estimatedTime: "Completed"
        },
        {
          id: "8",
          title: "Power Score System",
          description: "Dynamic spider power calculation algorithm",
          priority: "HIGH",
          category: "Core",
          estimatedTime: "Completed"
        }
      ]
    }
  ];

  const priorityColors = {
    LOW: "bg-gray-500",
    MEDIUM: "bg-yellow-500",
    HIGH: "bg-red-500"
  };

  const handleFeatureSubmission = () => {
    if (!featureTitle.trim() || !featureDescription.trim()) {
      toast({
        title: "Missing Information",
        description: "Please fill in both title and description.",
        variant: "destructive"
      });
      return;
    }

    // Here you would typically submit to your backend
    toast({
      title: "Feature Idea Submitted!",
      description: "Thank you for your suggestion. We'll review it and add it to our roadmap.",
    });

    // Reset form
    setFeatureTitle("");
    setFeatureDescription("");
    setFeaturePriority("MEDIUM");
    setIsSubmissionOpen(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Roadmap — Spider League</title>
        <meta name="description" content="View the Spider League development roadmap and submit feature ideas." />
        <link rel="canonical" href={`${window.location.origin}/roadmap`} />
      </Helmet>
      
      <main className="container mx-auto px-6 py-8">
        <div className="flex items-center gap-2 mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back to Home
            </Link>
          </Button>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-medium">Roadmap</span>
        </div>
        
        <div className="flex items-center justify-between mb-8">
          <div className="text-center flex-1">
            <div className="flex justify-center mb-4">
              <img 
                src="/lovable-uploads/3a8558c8-28e5-4ad2-8bb8-425536ee81ca.png" 
                alt="Spider League Logo" 
                className="h-12 w-auto"
              />
            </div>
            <h1 className="text-4xl font-bold mb-2">Development Roadmap</h1>
            <p className="text-muted-foreground">Track our progress and submit your feature ideas</p>
          </div>
        </div>

        <div className="flex justify-end mb-6">
          <Dialog open={isSubmissionOpen} onOpenChange={setIsSubmissionOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Submit Feature Idea
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Submit Feature Idea</DialogTitle>
                <DialogDescription>
                  Share your ideas to help improve Spider League. We review all submissions!
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="title">Feature Title</Label>
                  <Input
                    id="title"
                    placeholder="e.g., Spider Training Mode"
                    value={featureTitle}
                    onChange={(e) => setFeatureTitle(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe your feature idea in detail..."
                    value={featureDescription}
                    onChange={(e) => setFeatureDescription(e.target.value)}
                    rows={4}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select value={featurePriority} onValueChange={(value: "LOW" | "MEDIUM" | "HIGH") => setFeaturePriority(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Low Priority</SelectItem>
                      <SelectItem value="MEDIUM">Medium Priority</SelectItem>
                      <SelectItem value="HIGH">High Priority</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setIsSubmissionOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleFeatureSubmission}>
                  Submit Idea
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Kanban Board */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {kanbanColumns.map((column) => (
            <div key={column.id} className="space-y-4">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-md ${column.color} text-white`}>
                  {column.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{column.title}</h3>
                  <p className="text-sm text-muted-foreground">{column.description}</p>
                </div>
              </div>
              
              <div className="space-y-3">
                {column.items.map((item) => (
                  <Card key={item.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-sm font-medium leading-tight">
                          {item.title}
                        </CardTitle>
                        <Badge 
                          variant="secondary" 
                          className={`${priorityColors[item.priority]} text-white text-xs`}
                        >
                          {item.priority}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <CardDescription className="text-xs mb-3">
                        {item.description}
                      </CardDescription>
                      <div className="flex justify-between items-center text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-xs">
                          {item.category}
                        </Badge>
                        <span>{item.estimatedTime}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Card className="max-w-2xl mx-auto">
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-2">Want to contribute?</h3>
              <p className="text-muted-foreground mb-4">
                We're always looking for feedback and ideas from our community. 
                Submit your feature requests and help shape the future of Spider League!
              </p>
              <Dialog open={isSubmissionOpen} onOpenChange={setIsSubmissionOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Lightbulb className="mr-2 h-4 w-4" />
                    Share Your Ideas
                  </Button>
                </DialogTrigger>
              </Dialog>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Roadmap;