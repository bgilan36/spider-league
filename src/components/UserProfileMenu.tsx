import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Upload, MessageSquare, Heart } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Profile {
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  email_communications_enabled: boolean;
}

interface WallPost {
  id: string;
  message: string;
  created_at: string;
  poster_user_id: string;
  profiles: {
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

interface Bite {
  id: string;
  created_at: string;
  poker_user_id: string;
  profiles: {
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

export const UserProfileMenu = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile>({ display_name: null, avatar_url: null, bio: null, email_communications_enabled: true });
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [wallPosts, setWallPosts] = useState<WallPost[]>([]);
  const [bites, setBites] = useState<Bite[]>([]);
  const [loadingWallPosts, setLoadingWallPosts] = useState(false);
  const [loadingBites, setLoadingBites] = useState(false);

  useEffect(() => {
    if (user && isOpen) {
      fetchProfile();
      fetchWallPosts();
      fetchBites();
    }
  }, [user, isOpen]);

  const fetchProfile = async () => {
    if (!user) return;

    try {
      // Fetch profile data
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('display_name, avatar_url, bio')
        .eq('id', user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error fetching profile:', profileError);
        return;
      }

      // Fetch settings data
      const { data: settingsData, error: settingsError } = await supabase
        .from('profile_settings')
        .select('email_communications_enabled')
        .eq('id', user.id)
        .single();

      if (settingsError && settingsError.code !== 'PGRST116') {
        console.error('Error fetching settings:', settingsError);
      }

      setProfile({
        display_name: profileData?.display_name || null,
        avatar_url: profileData?.avatar_url || null,
        bio: profileData?.bio || null,
        email_communications_enabled: settingsData?.email_communications_enabled ?? true
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const updateProfile = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Update profile data
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          display_name: profile.display_name,
          avatar_url: profile.avatar_url,
          bio: profile.bio,
          updated_at: new Date().toISOString()
        });

      if (profileError) throw profileError;

      // Update settings data
      const { error: settingsError } = await supabase
        .from('profile_settings')
        .upsert({
          id: user.id,
          email_communications_enabled: profile.email_communications_enabled,
          updated_at: new Date().toISOString()
        });

      if (settingsError) throw settingsError;

      toast({
        title: "Profile updated",
        description: "Your profile has been successfully updated.",
      });
      setIsOpen(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchWallPosts = async () => {
    if (!user) return;
    
    setLoadingWallPosts(true);
    try {
      const { data: posts, error } = await supabase
        .from('profile_wall_posts')
        .select('id, message, created_at, poster_user_id')
        .eq('profile_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      if (posts && posts.length > 0) {
        const userIds = posts.map(p => p.poster_user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', userIds);

        const postsWithProfiles = posts.map(post => ({
          ...post,
          profiles: profiles?.find(p => p.id === post.poster_user_id) || null
        }));

        setWallPosts(postsWithProfiles);
      } else {
        setWallPosts([]);
      }
    } catch (error) {
      console.error('Error fetching wall posts:', error);
    } finally {
      setLoadingWallPosts(false);
    }
  };

  const fetchBites = async () => {
    if (!user) return;
    
    setLoadingBites(true);
    try {
      const { data: pokesData, error } = await supabase
        .from('pokes')
        .select('id, created_at, poker_user_id')
        .eq('poked_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      if (pokesData && pokesData.length > 0) {
        const userIds = pokesData.map(p => p.poker_user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', userIds);

        const bitesWithProfiles = pokesData.map(poke => ({
          ...poke,
          profiles: profiles?.find(p => p.id === poke.poker_user_id) || null
        }));

        setBites(bitesWithProfiles);
      } else {
        setBites([]);
      }
    } catch (error) {
      console.error('Error fetching bites:', error);
    } finally {
      setLoadingBites(false);
    }
  };

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0 || !user) return;

    const file = event.target.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `avatars/${user.id}/${fileName}`;

    setUploading(true);
    try {
      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('spiders')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('spiders')
        .getPublicUrl(filePath);

      setProfile(prev => ({ ...prev, avatar_url: urlData.publicUrl }));

      toast({
        title: "Avatar uploaded",
        description: "Your avatar has been uploaded successfully.",
      });
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast({
        title: "Upload failed",
        description: "Failed to upload avatar. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  if (!user) return null;

  const displayName = profile.display_name || user.email?.split('@')[0] || 'User';
  const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="flex items-center gap-3">
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" className="flex items-center gap-2 p-2">
            <Avatar className="h-8 w-8">
              <AvatarImage src={profile.avatar_url || undefined} alt={displayName} />
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <span className="hidden sm:inline font-medium">{displayName}</span>
          </Button>
        </DialogTrigger>
        
        <DialogContent className="sm:max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>My Profile</DialogTitle>
          </DialogHeader>
          
          <Tabs defaultValue="edit" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="edit">Edit Profile</TabsTrigger>
              <TabsTrigger value="wall">
                <MessageSquare className="h-4 w-4 mr-2" />
                Wall ({wallPosts.length})
              </TabsTrigger>
              <TabsTrigger value="bites">
                <Heart className="h-4 w-4 mr-2" />
                Bites ({bites.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="edit" className="space-y-6">
              {/* Avatar Upload */}
              <div className="flex flex-col items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={profile.avatar_url || undefined} alt={displayName} />
                  <AvatarFallback className="text-lg">{initials}</AvatarFallback>
                </Avatar>
                
                <div className="relative">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={uploadAvatar}
                    className="hidden"
                    id="avatar-upload"
                    disabled={uploading}
                  />
                  <Label htmlFor="avatar-upload" className="cursor-pointer">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploading}
                      asChild
                    >
                      <span className="flex items-center gap-2">
                        {uploading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                        {uploading ? 'Uploading...' : 'Upload Avatar'}
                      </span>
                    </Button>
                  </Label>
                </div>
              </div>

              {/* Display Name */}
              <div className="space-y-2">
                <Label htmlFor="display_name">Display Name</Label>
                <Input
                  id="display_name"
                  value={profile.display_name || ''}
                  onChange={(e) => setProfile(prev => ({ ...prev, display_name: e.target.value }))}
                  placeholder="Enter your display name"
                />
              </div>

              {/* Bio */}
              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={profile.bio || ''}
                  onChange={(e) => setProfile(prev => ({ ...prev, bio: e.target.value }))}
                  placeholder="Tell us about yourself..."
                  rows={3}
                />
              </div>

              {/* Email Communications */}
              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-1">
                  <Label htmlFor="email-communications" className="text-sm font-medium">
                    Email Communications
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Receive updates and notifications via email
                  </p>
                </div>
                <Switch
                  id="email-communications"
                  checked={profile.email_communications_enabled}
                  onCheckedChange={(checked) => 
                    setProfile(prev => ({ ...prev, email_communications_enabled: checked }))
                  }
                />
              </div>

              {/* Actions */}
              <div className="flex justify-between gap-3">
                <Button variant="outline" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={updateProfile} disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Save Changes
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="wall">
              <ScrollArea className="h-[400px] pr-4">
                {loadingWallPosts ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : wallPosts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No wall posts yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {wallPosts.map((post) => (
                      <div key={post.id} className="border rounded-lg p-4 space-y-2">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={post.profiles?.avatar_url || undefined} />
                            <AvatarFallback>
                              {post.profiles?.display_name?.[0]?.toUpperCase() || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="font-medium text-sm">
                              {post.profiles?.display_name || 'Anonymous'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                        <p className="text-sm">{post.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="bites">
              <ScrollArea className="h-[400px] pr-4">
                {loadingBites ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : bites.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Heart className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No bites received yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {bites.map((bite) => (
                      <div key={bite.id} className="flex items-center gap-3 border rounded-lg p-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={bite.profiles?.avatar_url || undefined} />
                          <AvatarFallback>
                            {bite.profiles?.display_name?.[0]?.toUpperCase() || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="font-medium text-sm">
                            {bite.profiles?.display_name || 'Anonymous'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(bite.created_at), { addSuffix: true })}
                          </p>
                        </div>
                        <Heart className="h-5 w-5 text-red-500 fill-red-500" />
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <Button variant="outline" onClick={signOut}>
        Sign out
      </Button>
    </div>
  );
};