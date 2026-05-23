SELECT cron.schedule(
  'weekly-matchup-seeder',
  '5 0 * * 1',  -- Monday 00:05 UTC
  $$
  SELECT net.http_post(
    url := 'https://wdqsgswrkrxjeesahshc.supabase.co/functions/v1/weekly-matchup-seeder',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkcXNnc3dya3J4amVlc2Foc2hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgzODUzNTcsImV4cCI6MjA2Mzk2MTM1N30.1zcvmxi8ldSRWPoNmYO8yNTYmCYUKDBF6T3I_e-xVOg"}'::jsonb,
    body := jsonb_build_object('triggered_at', now())
  );
  $$
);