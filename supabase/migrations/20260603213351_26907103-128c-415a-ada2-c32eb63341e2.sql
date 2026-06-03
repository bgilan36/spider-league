CREATE TABLE public.global_chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 500),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.global_chat_messages TO authenticated;
GRANT ALL ON public.global_chat_messages TO service_role;

ALTER TABLE public.global_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view global chat"
  ON public.global_chat_messages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can post their own global chat messages"
  ON public.global_chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authors or admins can delete global chat messages"
  ON public.global_chat_messages FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_global_chat_messages_created_at ON public.global_chat_messages (created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.global_chat_messages;
ALTER TABLE public.global_chat_messages REPLICA IDENTITY FULL;