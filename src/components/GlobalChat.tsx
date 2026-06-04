import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Globe, Loader2, Send, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import ClickableUsername from "@/components/ClickableUsername";

interface ChatMessage {
  id: string;
  user_id: string;
  message: string;
  created_at: string;
}

interface ProfileLite {
  display_name: string | null;
  avatar_url: string | null;
}

const MAX_LEN = 500;
const PAGE_SIZE = 50;

interface MentionCandidate {
  id: string;
  display_name: string;
}

// Convert a display name into a mention token (no spaces, preserves case-insensitive match).
const toMentionToken = (name: string) => name.replace(/\s+/g, "_");

const GlobalChat = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionResults, setMentionResults] = useState<MentionCandidate[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  // Tokens (lowercased) that have been resolved to user ids via the picker.
  const mentionMapRef = useRef<Record<string, string>>({});

  const loadProfiles = useCallback(async (userIds: string[]) => {
    const missing = Array.from(new Set(userIds)).filter((id) => !profiles[id]);
    if (missing.length === 0) return;
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", missing);
    if (data) {
      setProfiles((prev) => {
        const next = { ...prev };
        data.forEach((p: any) => {
          next[p.id] = { display_name: p.display_name, avatar_url: p.avatar_url };
        });
        return next;
      });
    }
  }, [profiles]);

  const fetchAll = useCallback(async () => {
    const { data, error } = await supabase
      .from("global_chat_messages")
      .select("id,user_id,message,created_at")
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);
    if (error) {
      setLoading(false);
      return;
    }
    const ordered = (data || []).slice().reverse();
    setMessages(ordered);
    setLoading(false);
    await loadProfiles(ordered.map((m: any) => m.user_id));
  }, [loadProfiles]);

  useEffect(() => {
    fetchAll();
    const channel = supabase
      .channel("global-chat")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "global_chat_messages" },
        async (payload) => {
          const m = payload.new as ChatMessage;
          setMessages((prev) => {
            if (prev.some((x) => x.id === m.id)) return prev;
            const next = [...prev, m];
            return next.slice(-PAGE_SIZE);
          });
          await loadProfiles([m.user_id]);
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "global_chat_messages" },
        (payload) => {
          const oldRow = payload.old as { id: string };
          setMessages((prev) => prev.filter((m) => m.id !== oldRow.id));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  // Mention autocomplete: search profiles when an @query is active.
  useEffect(() => {
    if (mentionQuery === null) {
      setMentionResults([]);
      return;
    }
    let cancelled = false;
    const run = async () => {
      const q = mentionQuery.trim();
      let query = supabase
        .from("profiles")
        .select("id, display_name")
        .not("display_name", "is", null)
        .order("display_name", { ascending: true })
        .limit(6);
      if (q.length > 0) {
        query = query.ilike("display_name", `${q}%`);
      }
      const { data } = await query;
      if (cancelled) return;
      const list = (data || [])
        .filter((p: any) => p.id !== user?.id && p.display_name)
        .map((p: any) => ({ id: p.id as string, display_name: p.display_name as string }));
      setMentionResults(list);
      setMentionIndex(0);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [mentionQuery, user?.id]);

  const handleDraftChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value.slice(0, MAX_LEN);
    setDraft(value);
    const caret = e.target.selectionStart ?? value.length;
    const upto = value.slice(0, caret);
    const match = upto.match(/(?:^|\s)@([A-Za-z0-9_]*)$/);
    if (match) {
      setMentionQuery(match[1]);
    } else {
      setMentionQuery(null);
    }
  };

  const selectMention = (candidate: MentionCandidate) => {
    const el = textareaRef.current;
    if (!el) return;
    const caret = el.selectionStart ?? draft.length;
    const before = draft.slice(0, caret);
    const after = draft.slice(caret);
    const replaced = before.replace(/@([A-Za-z0-9_]*)$/, "");
    const token = toMentionToken(candidate.display_name);
    mentionMapRef.current[token.toLowerCase()] = candidate.id;
    const next = `${replaced}@${token} ${after}`;
    setDraft(next.slice(0, MAX_LEN));
    setMentionQuery(null);
    requestAnimationFrame(() => {
      const pos = (replaced + `@${token} `).length;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  const post = async () => {
    if (!user) {
      toast({ title: "Sign in to chat", description: "You need to be signed in to post." });
      return;
    }
    const text = draft.trim();
    if (!text) return;
    if (text.length > MAX_LEN) {
      toast({ title: "Message too long", description: `Keep it under ${MAX_LEN} characters.`, variant: "destructive" });
      return;
    }
    setPosting(true);
    const { data: inserted, error } = await supabase
      .from("global_chat_messages")
      .insert({ user_id: user.id, message: text })
      .select("id")
      .single();
    setPosting(false);
    if (error) {
      toast({ title: "Couldn't post", description: error.message, variant: "destructive" });
      return;
    }
    // Parse mentions and insert rows for any resolved tokens.
    if (inserted?.id) {
      const tokens = Array.from(text.matchAll(/@([A-Za-z0-9_]+)/g)).map((m) => m[1].toLowerCase());
      const uniqueIds = Array.from(
        new Set(
          tokens
            .map((t) => mentionMapRef.current[t])
            .filter((id): id is string => Boolean(id) && id !== user.id),
        ),
      );
      if (uniqueIds.length > 0) {
        const preview = text.slice(0, 140);
        await supabase.from("chat_mentions").insert(
          uniqueIds.map((mentionedId) => ({
            message_id: inserted.id,
            mentioner_user_id: user.id,
            mentioned_user_id: mentionedId,
            message_preview: preview,
          })),
        );
      }
    }
    setDraft("");
    mentionMapRef.current = {};
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("global_chat_messages").delete().eq("id", id);
    if (error) {
      toast({ title: "Couldn't delete", description: error.message, variant: "destructive" });
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery !== null && mentionResults.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % mentionResults.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((i) => (i - 1 + mentionResults.length) % mentionResults.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        selectMention(mentionResults[mentionIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMentionQuery(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      post();
    }
  };

  const remaining = MAX_LEN - draft.length;

  const items = useMemo(() => messages, [messages]);

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Globe className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          Global Chat
          <span className="ml-auto text-xs font-normal text-muted-foreground">Live · everyone online</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div
          ref={scrollRef}
          className="h-64 sm:h-72 overflow-y-auto rounded-md border bg-muted/30 p-3 space-y-3"
        >
          {loading ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading chat…
            </div>
          ) : items.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground text-center">
              No messages yet. Say hi to the league!
            </div>
          ) : (
            items.map((m) => {
              const prof = profiles[m.user_id];
              const name = prof?.display_name || `Player ${m.user_id.slice(0, 6)}`;
              const isMine = user?.id === m.user_id;
              return (
                <div key={m.id} className="flex items-start gap-2 group">
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarImage src={prof?.avatar_url || undefined} alt={name} />
                    <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <ClickableUsername
                        userId={m.user_id}
                        displayName={name}
                        className="text-sm"
                      />
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                      </span>
                      {isMine && (
                        <button
                          onClick={() => remove(m.id)}
                          className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                          aria-label="Delete message"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="text-sm whitespace-pre-wrap break-words leading-snug">
                      {m.message}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {user ? (
          <div className="space-y-1">
            <div className="flex items-end gap-2">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value.slice(0, MAX_LEN))}
                onKeyDown={onKeyDown}
                placeholder="Message the league…"
                rows={2}
                className="resize-none"
              />
              <Button onClick={post} disabled={posting || !draft.trim()} size="icon" aria-label="Send">
                {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground px-1">
              <span>Enter to send · Shift+Enter for newline</span>
              <span className={remaining < 40 ? "text-destructive" : ""}>{remaining}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-2">
            Sign in to join the conversation.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default GlobalChat;