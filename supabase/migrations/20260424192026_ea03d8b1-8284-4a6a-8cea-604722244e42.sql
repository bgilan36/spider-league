ALTER TABLE public.pod_chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.pod_chat_replies REPLICA IDENTITY FULL;
ALTER TABLE public.pod_chat_likes REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pod_chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pod_chat_replies;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pod_chat_likes;