import { useState, useEffect } from "react";
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
import { ArrowLeft, Plus, Clock, CheckCircle, Lightbulb, ChevronUp, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";

interface RoadmapItem {
  id: string;
  title: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  category: string;
  status: "BACKLOG" | "IN_PROGRESS" | "COMPLETED";
  upvote_count: number;
  user_has_upvoted?: boolean;
}

interface KanbanColumn {
  id: string;
  title: string;
  description: string;
  items: RoadmapItem[];
  color: string;
  icon: React.ReactNode;
}

const Roadmap = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmissionOpen, setIsSubmissionOpen] = useState(false);
  const [featureTitle, setFeatureTitle] = useState("");
  const [featureDescription, setFeatureDescription] = useState("");
  const [featurePriority, setFeaturePriority] = useState<"LOW" | "MEDIUM" | "HIGH">("MEDIUM");
  const [roadmapItems, setRoadmapItems] = useState<RoadmapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [upvotingItems, setUpvotingItems] = useState<Set<string>>(new Set());

  const kanbanColumns: Omit<KanbanColumn, 'items'>[] = [
    {
      id: "BACKLOG",
      title: "Backlog",
      description: "Ideas and features under consideration",
      color: "bg-gray-500",
      icon: <Lightbulb className="h-5 w-5" />,
    },
    {
      id: "IN_PROGRESS",
      title: "In Progress",
      description: "Currently being developed",
      color: "bg-blue-500",
      icon: <Clock className="h-5 w-5" />,
    },
    {
      id: "COMPLETED",
      title: "Completed",
      description: "Recently shipped features",
      color: "bg-green-500",
      icon: <CheckCircle className="h-5 w-5" />,
    }
  ];

  const priorityColors = {
    LOW: "bg-gray-500",
    MEDIUM: "bg-yellow-500",
    HIGH: "bg-red-500"
  };

  useEffect(() => {
    fetchRoadmapItems();
  }, [user]);

  const fetchRoadmapItems = async () => {
    try {
      setLoading(true);
      
      // Fetch roadmap items
      const { data: items, error: itemsError } = await supabase
        .from('roadmap_items')
        .select('*')
        .order('upvote_count', { ascending: false });

      if (itemsError) throw itemsError;

      let itemsWithUpvotes: RoadmapItem[];

      // If user is logged in, check which items they have upvoted
      if (user) {
        const { data: userUpvotes, error: upvotesError } = await supabase
          .from('roadmap_upvotes')
          .select('roadmap_item_id')
          .eq('user_id', user.id);

        if (upvotesError) throw upvotesError;

        const upvotedItemIds = new Set(userUpvotes?.map(u => u.roadmap_item_id) || []);
        
        itemsWithUpvotes = (items || []).map(item => ({
          id: item.id,
          title: item.title,
          description: item.description,
          priority: item.priority as "LOW" | "MEDIUM" | "HIGH",
          category: item.category,
          status: item.status as "BACKLOG" | "IN_PROGRESS" | "COMPLETED",
          upvote_count: item.upvote_count,
          user_has_upvoted: upvotedItemIds.has(item.id)
        }));
      } else {
        itemsWithUpvotes = (items || []).map(item => ({
          id: item.id,
          title: item.title,
          description: item.description,
          priority: item.priority as "LOW" | "MEDIUM" | "HIGH",
          category: item.category,
          status: item.status as "BACKLOG" | "IN_PROGRESS" | "COMPLETED",
          upvote_count: item.upvote_count,
          user_has_upvoted: false
        }));
      }

      setRoadmapItems(itemsWithUpvotes);
    } catch (error) {
      console.error('Error fetching roadmap items:', error);
      toast({
        title: "Error",
        description: "Failed to load roadmap items.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpvote = async (itemId: string) => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "You must be signed in to upvote roadmap items.",
        variant: "destructive"
      });
      return;
    }

    setUpvotingItems(prev => new Set([...prev, itemId]));

    try {
      const item = roadmapItems.find(i => i.id === itemId);
      if (!item) return;

      if (item.user_has_upvoted) {
        // Remove upvote
        const { error } = await supabase
          .from('roadmap_upvotes')
          .delete()
          .eq('user_id', user.id)
          .eq('roadmap_item_id', itemId);

        if (error) throw error;

        // Update local state
        setRoadmapItems(prev =>
          prev.map(i =>
            i.id === itemId
              ? { ...i, user_has_upvoted: false, upvote_count: i.upvote_count - 1 }
              : i
          )
        );
      } else {
        // Add upvote
        const { error } = await supabase
          .from('roadmap_upvotes')
          .insert({
            user_id: user.id,
            roadmap_item_id: itemId
          });

        if (error) throw error;

        // Update local state
        setRoadmapItems(prev =>
          prev.map(i =>
            i.id === itemId
              ? { ...i, user_has_upvoted: true, upvote_count: i.upvote_count + 1 }
              : i
          )
        );
      }
    } catch (error) {
      console.error('Error updating upvote:', error);
      toast({
        title: "Error",
        description: "Failed to update upvote. Please try again.",
        variant: "destructive"
      });
    } finally {
      setUpvotingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
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

  // Group items by status
  const columnsWithItems: KanbanColumn[] = kanbanColumns.map(column => ({
    ...column,
    items: roadmapItems.filter(item => item.status === column.id)
  }));

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
            <p className="text-muted-foreground">Track our progress, upvote features you want, and submit your ideas</p>
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

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          /* Kanban Board - Now with 3 columns instead of 4 (removed Testing) */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {columnsWithItems.map((column) => (
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
                        <div className="flex justify-between items-center">
                          <Badge variant="outline" className="text-xs">
                            {item.category}
                          </Badge>
                          <Button
                            variant={item.user_has_upvoted ? "default" : "outline"}
                            size="sm"
                            className="flex items-center gap-1 h-7 px-2"
                            onClick={() => handleUpvote(item.id)}
                            disabled={upvotingItems.has(item.id)}
                          >
                            {upvotingItems.has(item.id) ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <ChevronUp className="h-3 w-3" />
                            )}
                            <span className="text-xs">{item.upvote_count}</span>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-12 text-center">
          <Card className="max-w-2xl mx-auto">
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-2">Want to contribute?</h3>
              <p className="text-muted-foreground mb-4">
                We're always looking for feedback and ideas from our community. 
                Upvote features you want to see and submit your own feature requests!
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