import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skull, Timer, Swords, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ClickableUsername from './ClickableUsername';

interface DeathChallenge {
  id: string;
  challenger_id: string;
  challenger_spider_id: string;
  status: string;
  challenge_message: string | null;
  created_at: string;
  expires_at: string;
  challenger_spider?: { nickname: string; species: string; image_url: string; power_score: number };
  challenger_profile?: { display_name: string };
}

const DeathBattleFeed: React.FC = () => {
  const [challenges, setChallenges] = useState<DeathChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const fetchRef = useRef<() => void>(() => {});
  const INITIAL_VISIBLE = 3;

  const fetchChallenges = useCallback(async () => {
    try {
      setLoading(true);
      const nowIso = new Date().toISOString();

      const { data: rows, error } = await supabase
        .from('battle_challenges')
        .select('*')
        .eq('status', 'OPEN')
        .eq('is_all_or_nothing', true)
        .gt('expires_at', nowIso)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error || !rows || rows.length === 0) {
        setChallenges([]);
        return;
      }

      const spiderIds = [...new Set(rows.map(r => r.challenger_spider_id).filter(Boolean))];
      const userIds = [...new Set(rows.map(r => r.challenger_id).filter(Boolean))];

      const [{ data: spiders }, { data: profiles }] = await Promise.all([
        spiderIds.length > 0
          ? supabase.from('spiders').select('id, nickname, species, image_url, power_score').in('id', spiderIds)
          : Promise.resolve({ data: [] as any[] } as any),
        userIds.length > 0
          ? supabase.from('profiles').select('id, display_name').in('id', userIds)
          : Promise.resolve({ data: [] as any[] } as any),
      ]);

      const spiderMap = new Map((spiders || []).map((s: any) => [s.id, s]));
      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

      setChallenges(rows.map((r: any) => ({
        ...r,
        challenger_spider: spiderMap.get(r.challenger_spider_id) || null,
        challenger_profile: profileMap.get(r.challenger_id) || null,
      })));
    } catch (err) {
      console.error('Error fetching death battle challenges:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRef.current = fetchChallenges; }, [fetchChallenges]);

  useEffect(() => {
    fetchChallenges();

    const channel = supabase
      .channel('death-battle-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battle_challenges' }, () => {
        fetchRef.current();
      })
      .subscribe();

    const refresh = () => fetchRef.current();
    window.addEventListener('challenge:created', refresh as any);
    window.addEventListener('challenge:cancelled', refresh as any);
    window.addEventListener('challenge:accepted', refresh as any);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('challenge:created', refresh as any);
      window.removeEventListener('challenge:cancelled', refresh as any);
      window.removeEventListener('challenge:accepted', refresh as any);
    };
  }, [fetchChallenges]);

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-6 bg-muted rounded w-56 mb-4" />
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className="h-20 bg-muted rounded" />)}
        </div>
      </div>
    );
  }

  if (challenges.length === 0) return null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2 mb-1">
          <Skull className="w-5 h-5 text-destructive" />
          Death Battle Challenges
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground">
          These players have thrown down the gauntlet — the loser forfeits their spider forever.
        </p>
      </div>

      <div className="space-y-3">
        {(showAll ? challenges : challenges.slice(0, INITIAL_VISIBLE)).map(challenge => {
          const timeLeft = new Date(challenge.expires_at).getTime() - Date.now();
          const hoursLeft = Math.max(0, Math.floor(timeLeft / (1000 * 60 * 60)));
          const spider = challenge.challenger_spider;

          return (
            <Card
              key={challenge.id}
              className="border-l-4 border-l-destructive hover:shadow-md transition-shadow"
            >
              <CardContent className="flex items-center gap-3 p-3 sm:p-4">
                {/* Spider image */}
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-md overflow-hidden flex-shrink-0">
                  {spider?.image_url ? (
                    <img src={spider.image_url} alt={spider.nickname} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <Swords className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="font-semibold text-sm truncate">{spider?.nickname ?? 'Unknown'}</span>
                    <Badge variant="destructive" className="text-[10px]">Death Battle</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    <ClickableUsername
                      userId={challenge.challenger_id}
                      displayName={challenge.challenger_profile?.display_name}
                      variant="link"
                      size="sm"
                      className="text-xs p-0 h-auto"
                    />
                    {' '}is looking for an opponent
                  </p>
                  {challenge.challenge_message && (
                    <p className="text-xs italic text-muted-foreground truncate mt-0.5">
                      "{challenge.challenge_message}"
                    </p>
                  )}
                </div>

                {/* Stats */}
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <Badge variant="outline" className="flex items-center gap-1 text-xs">
                    <Timer className="w-3 h-3" />
                    {hoursLeft}h left
                  </Badge>
                  <div className="text-right">
                    <div className="text-sm font-bold">{spider?.power_score ?? '?'}</div>
                    <div className="text-xs text-muted-foreground">Power</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!showAll && challenges.length > INITIAL_VISIBLE && (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll(true)}
            className="text-xs"
          >
            See more ({challenges.length - INITIAL_VISIBLE}) <ChevronDown className="w-3 h-3 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default DeathBattleFeed;
