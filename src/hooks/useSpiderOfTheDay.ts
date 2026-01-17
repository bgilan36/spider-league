import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SpiderOfTheDay {
  id: string;
  spiderId: string;
  featuredDate: string;
  powerBonus: number;
  spider: {
    id: string;
    nickname: string;
    species: string;
    image_url: string;
    rarity: string;
    power_score: number;
    owner_id: string;
    profiles?: {
      display_name: string | null;
      avatar_url: string | null;
    };
  };
}

export const useSpiderOfTheDay = () => {
  const [spiderOfTheDay, setSpiderOfTheDay] = useState<SpiderOfTheDay | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSpiderOfTheDay = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];

        // First check if today's spider exists
        const { data: todaySpider, error: fetchError } = await supabase
          .from('spider_of_the_day')
          .select(`
            id,
            spider_id,
            featured_date,
            power_bonus,
            spiders (
              id,
              nickname,
              species,
              image_url,
              rarity,
              power_score,
              owner_id,
              profiles (
                display_name,
                avatar_url
              )
            )
          `)
          .eq('featured_date', today)
          .maybeSingle();

        if (fetchError) throw fetchError;

        if (todaySpider && todaySpider.spiders) {
          const spiderData = todaySpider.spiders as any;
          setSpiderOfTheDay({
            id: todaySpider.id,
            spiderId: todaySpider.spider_id,
            featuredDate: todaySpider.featured_date,
            powerBonus: todaySpider.power_bonus,
            spider: {
              id: spiderData.id,
              nickname: spiderData.nickname,
              species: spiderData.species,
              image_url: spiderData.image_url,
              rarity: spiderData.rarity,
              power_score: spiderData.power_score,
              owner_id: spiderData.owner_id,
              profiles: spiderData.profiles
            }
          });
        } else {
          // No spider of the day yet - trigger selection
          await supabase.rpc('select_spider_of_the_day');
          
          // Fetch again after selection
          const { data: newSpider, error: refetchError } = await supabase
            .from('spider_of_the_day')
            .select(`
              id,
              spider_id,
              featured_date,
              power_bonus,
              spiders (
                id,
                nickname,
                species,
                image_url,
                rarity,
                power_score,
                owner_id,
                profiles (
                  display_name,
                  avatar_url
                )
              )
            `)
            .eq('featured_date', today)
            .maybeSingle();

          if (refetchError) throw refetchError;

          if (newSpider && newSpider.spiders) {
            const spiderData = newSpider.spiders as any;
            setSpiderOfTheDay({
              id: newSpider.id,
              spiderId: newSpider.spider_id,
              featuredDate: newSpider.featured_date,
              powerBonus: newSpider.power_bonus,
              spider: {
                id: spiderData.id,
                nickname: spiderData.nickname,
                species: spiderData.species,
                image_url: spiderData.image_url,
                rarity: spiderData.rarity,
                power_score: spiderData.power_score,
                owner_id: spiderData.owner_id,
                profiles: spiderData.profiles
              }
            });
          }
        }
      } catch (error) {
        console.error('Error fetching spider of the day:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSpiderOfTheDay();
  }, []);

  return { spiderOfTheDay, loading };
};
