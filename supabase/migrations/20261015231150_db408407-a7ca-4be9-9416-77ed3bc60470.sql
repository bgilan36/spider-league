DO $$ BEGIN
  EXECUTE replace(pg_get_functiondef('public.set_my_week_entries(uuid[])'::regprocedure),
    $q$s.image_url <> 'https://www.spiderleague.app/images/starter-spider.png'$q$, $q$s.species <> 'Spider League Starter Spider'$q$);
  EXECUTE replace(pg_get_functiondef('public.set_my_week_veteran(uuid)'::regprocedure),
    $q$image_url <> 'https://www.spiderleague.app/images/starter-spider.png'$q$, $q$species <> 'Spider League Starter Spider'$q$);
END $$;