CREATE OR REPLACE FUNCTION public.set_my_week_entries(p_spider_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  w public.game_weeks;
  uid uuid := auth.uid();
  n int;
  ok int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT * INTO w FROM public.current_open_game_week();
  IF w.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Entries are locked for this week'); END IF;
  n := COALESCE(array_length(p_spider_ids,1),0);
  IF n > 3 THEN RETURN jsonb_build_object('ok', false, 'error', 'You can enter up to 3 spiders'); END IF;
  SELECT count(*) INTO ok FROM public.spiders s
    WHERE s.id = ANY(p_spider_ids) AND s.owner_id = uid AND s.is_approved IS NOT FALSE
      AND s.created_at >= w.starts_at AND s.created_at < w.locks_at
      AND s.image_url <> 'https://www.spiderleague.app/images/starter-spider.png';
  IF ok <> n THEN RETURN jsonb_build_object('ok', false, 'error', 'Only spiders you caught this week can be entered'); END IF;
  DELETE FROM public.weekly_entries WHERE week_id = w.id AND user_id = uid;
  INSERT INTO public.weekly_entries(week_id, spider_id, user_id, is_veteran, effective_power, is_auto)
    SELECT w.id, s.id, uid, false, s.power_score, false FROM public.spiders s WHERE s.id = ANY(p_spider_ids);
  RETURN jsonb_build_object('ok', true, 'week_id', w.id, 'count', n);
END $$;

CREATE OR REPLACE FUNCTION public.set_my_week_veteran(p_spider_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  w public.game_weeks;
  uid uuid := auth.uid();
  fresh int;
  pw int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT * INTO w FROM public.current_open_game_week();
  IF w.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Entries are locked for this week'); END IF;
  SELECT count(*) INTO fresh FROM public.spiders WHERE owner_id = uid AND created_at >= w.starts_at AND created_at < w.locks_at
    AND is_approved IS NOT FALSE AND image_url <> 'https://www.spiderleague.app/images/starter-spider.png';
  IF fresh > 0 THEN RETURN jsonb_build_object('ok', false, 'error', 'Veterans are only for weeks without a fresh catch'); END IF;
  DELETE FROM public.weekly_entries WHERE week_id = w.id AND user_id = uid;
  IF p_spider_id IS NULL THEN RETURN jsonb_build_object('ok', true, 'week_id', w.id, 'count', 0); END IF;
  SELECT power_score INTO pw FROM public.spiders WHERE id = p_spider_id AND owner_id = uid;
  IF pw IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'That spider is not yours'); END IF;
  INSERT INTO public.weekly_entries(week_id, spider_id, user_id, is_veteran, effective_power, is_auto)
    VALUES (w.id, p_spider_id, uid, true, round(pw * 0.85)::int, false);
  RETURN jsonb_build_object('ok', true, 'week_id', w.id, 'count', 1);
END $$;