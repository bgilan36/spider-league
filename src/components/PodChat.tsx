import { useCallback, useEffect, useMemo, useState } from "react";
import { Heart, Loader2, MessageCircle, Send, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";

interface PodChatProps {
  leagueId: string;
  members: Array<{ user_id: string; profiles?: { display_name?: string | null; avatar_url?: string | null } | null }>;
}

interface Reply {
  id: string;
  user_id: string;
  message: string;
  created_at: string;
}

interface Message {
  id: string;
  user_id: string;
  message: string;
  created_at: string;
  likes: string[]; // user_ids who liked
  replies: Reply[];
}

const PodChat = ({ leagueId, members }: PodChatProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [openReplyFor, setOpenReplyFor] = useState<string | null>(null);

  const memberMap = useMemo(() => {
    const map = new Map<string, { name: string; avatar: string | null }>();
    members.forEach((m) =>
      map.set(m.user_id, {
        name: m.profiles?.display_name || `Player ${m.user_id.slice(0, 6)}`,
        avatar: m.profiles?.avatar_url || null,
      }),
    );
    return map;
  }, [members]);

  const fetchAll = useCallback(async () => {
    const [{ data: msgs }, { data: replies }, { data: likes }] = await Promise.all([
      (supabase as any)
        .from("pod_chat_messages")
        .select("id,user_id,message,created_at")
        .eq("league_id", leagueId)
        .order("created_at", { ascending: false })
        .limit(100),
      (supabase as any)
        .from("pod_chat_replies")
        .select("id,message_id,user_id,message,created_at")
        .eq("league_id", leagueId)
        .order("created_at", { ascending: true }),
      (supabase as any).from("pod_chat_likes").select("message_id,user_id").eq("league_id", leagueId),
    ]);

    const repliesByMsg = new Map<string, Reply[]>();
    (replies || []).forEach((r: any) => {
      const arr = repliesByMsg.get(r.message_id) || [];
      arr.push({ id: r.id, user_id: r.user_id, message: r.message, created_at: r.created_at });
      repliesByMsg.set(r.message_id, arr);
    });

    const likesByMsg = new Map<string, string[]>();
    (likes || []).forEach((l: any) => {
      const arr = likesByMsg.get(l.message_id) || [];
      arr.push(l.user_id);
      likesByMsg.set(l.message_id, arr);
    });

    setMessages(
      (msgs || []).map((m: any) => ({
        id: m.id,
        user_id: m.user_id,
        message: m.message,
        created_at: m.created_at,
        likes: likesByMsg.get(m.id) || [],
        replies: repliesByMsg.get(m.id) || [],
      })),
    );
    setLoading(false);
  }, [leagueId]);

  useEffect(() => {
    fetchAll();
    const channel = supabase
      .channel(`pod-chat-${leagueId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pod_chat_messages", filter: `league_id=eq.${leagueId}` }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "pod_chat_replies", filter: `league_id=eq.${leagueId}` }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "pod_chat_likes", filter: `league_id=eq.${leagueId}` }, fetchAll)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAll, leagueId]);

  const post = async () => {
    if (!user || !draft.trim()) return;
    setPosting(true);
    const text = draft.trim();
    const { data, error } = await (supabase as any)
      .from("pod_chat_messages")
      .insert({ league_id: leagueId, user_id: user.id, message: text })
      .select("id,user_id,message,created_at")
      .single();
    setPosting(false);
    if (error) {
      toast({ title: "Couldn't post", description: error.message, variant: "destructive" });
      return;
    }
    setDraft("");
    if (data) {
      setMessages((prev) =>
        prev.some((m) => m.id === data.id)
          ? prev
          : [{ id: data.id, user_id: data.user_id, message: data.message, created_at: data.created_at, likes: [], replies: [] }, ...prev],
      );
    }
    fetchAll();
  };

  const postReply = async (messageId: string) => {
    if (!user) return;
    const text = (replyDrafts[messageId] || "").trim();
    if (!text) return;
    const { data, error } = await (supabase as any)
      .from("pod_chat_replies")
      .insert({ league_id: leagueId, message_id: messageId, user_id: user.id, message: text })
      .select("id,user_id,message,created_at,message_id")
      .single();
    if (error) {
      toast({ title: "Couldn't reply", description: error.message, variant: "destructive" });
      return;
    }
    setReplyDrafts((p) => ({ ...p, [messageId]: "" }));
    setOpenReplyFor(null);
    if (data) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId && !m.replies.some((r) => r.id === data.id)
            ? { ...m, replies: [...m.replies, { id: data.id, user_id: data.user_id, message: data.message, created_at: data.created_at }] }
            : m,
        ),
      );
    }
  };

  const toggleLike = async (msg: Message) => {
    if (!user) return;
    const liked = msg.likes.includes(user.id);
    if (liked) {
      await (supabase as any).from("pod_chat_likes").delete().eq("message_id", msg.id).eq("user_id", user.id);
    } else {
      await (supabase as any).from("pod_chat_likes").insert({ league_id: leagueId, message_id: msg.id, user_id: user.id });
    }
  };

  const deleteMessage = async (id: string) => {
    await (supabase as any).from("pod_chat_messages").delete().eq("id", id);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageCircle className="h-5 w-5 text-primary" />
          Pod chat
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {user ? (
          <div className="space-y-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Talk smack, plan battles, share strategy..."
              maxLength={1000}
              rows={2}
            />
            <div className="flex justify-end">
              <Button size="sm" onClick={post} disabled={posting || !draft.trim()}>
                {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send
              </Button>
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : messages.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No messages yet — say hi!</p>
        ) : (
          <ul className="space-y-3">
            {messages.map((msg) => {
              const author = memberMap.get(msg.user_id) || { name: "Pod member", avatar: null };
              const liked = !!user && msg.likes.includes(user.id);
              const canDelete = user?.id === msg.user_id;
              return (
                <li key={msg.id} className="rounded-md border border-border bg-background/40 p-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-semibold">
                      {author.avatar ? <img src={author.avatar} alt="" className="h-full w-full object-cover" /> : author.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{author.name}</span>
                        <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm">{msg.message}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-1">
                        <Button size="sm" variant="ghost" onClick={() => toggleLike(msg)} disabled={!user} className="h-7 px-2">
                          <Heart className={`h-3.5 w-3.5 ${liked ? "fill-destructive text-destructive" : ""}`} />
                          <span className="text-xs">{msg.likes.length}</span>
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setOpenReplyFor(openReplyFor === msg.id ? null : msg.id)} disabled={!user} className="h-7 px-2">
                          <MessageCircle className="h-3.5 w-3.5" />
                          <span className="text-xs">Reply</span>
                        </Button>
                        {canDelete && (
                          <Button size="sm" variant="ghost" onClick={() => deleteMessage(msg.id)} className="h-7 px-2 text-muted-foreground">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>

                      {msg.replies.length > 0 && (
                        <ul className="mt-3 space-y-2 border-l-2 border-border pl-3">
                          {msg.replies.map((r) => {
                            const ra = memberMap.get(r.user_id) || { name: "Pod member", avatar: null };
                            return (
                              <li key={r.id} className="text-sm">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{ra.name}</span>
                                  <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</span>
                                </div>
                                <p className="whitespace-pre-wrap break-words text-sm">{r.message}</p>
                              </li>
                            );
                          })}
                        </ul>
                      )}

                      {openReplyFor === msg.id && (
                        <div className="mt-2 space-y-2">
                          <Textarea
                            value={replyDrafts[msg.id] || ""}
                            onChange={(e) => setReplyDrafts((p) => ({ ...p, [msg.id]: e.target.value }))}
                            placeholder="Write a reply..."
                            rows={2}
                            maxLength={500}
                          />
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="ghost" onClick={() => setOpenReplyFor(null)}>Cancel</Button>
                            <Button size="sm" onClick={() => postReply(msg.id)} disabled={!(replyDrafts[msg.id] || "").trim()}>Reply</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default PodChat;
