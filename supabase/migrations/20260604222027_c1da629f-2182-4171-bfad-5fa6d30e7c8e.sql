
CREATE TABLE public.chat_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.global_chat_messages(id) ON DELETE CASCADE,
  mentioner_user_id uuid NOT NULL,
  mentioned_user_id uuid NOT NULL,
  message_preview text NOT NULL DEFAULT '',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, mentioned_user_id)
);

CREATE INDEX idx_chat_mentions_mentioned_user ON public.chat_mentions(mentioned_user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.chat_mentions TO authenticated;
GRANT ALL ON public.chat_mentions TO service_role;

ALTER TABLE public.chat_mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own mentions"
ON public.chat_mentions FOR SELECT
TO authenticated
USING (auth.uid() = mentioned_user_id OR auth.uid() = mentioner_user_id);

CREATE POLICY "Users can create mentions they send"
ON public.chat_mentions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = mentioner_user_id);

CREATE POLICY "Mentioned users can mark mentions read"
ON public.chat_mentions FOR UPDATE
TO authenticated
USING (auth.uid() = mentioned_user_id)
WITH CHECK (auth.uid() = mentioned_user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_mentions;
