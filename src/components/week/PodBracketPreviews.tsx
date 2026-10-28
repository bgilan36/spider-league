import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import LiveBracketPreview from "@/components/week/LiveBracketPreview";
import type { Participant } from "@/lib/tournament";

interface PodPreview { id: string; name: string; participants: Participant[]; slots: (Participant | null)[]; size: number }
interface Resp { week: { id: string; locks_at: string; status: string } | null; closed?: boolean; pods: PodPreview[] }

/** Live provisional bracket for each of the signed-in player's pods (members only). */
export default function PodBracketPreviews({ weekId, myUserId, revision = "" }: { weekId?: string; myUserId?: string; revision?: string }) {
  const { data } = useQuery({
    queryKey: ["live-pod-brackets", weekId, myUserId, revision],
    enabled: !!myUserId,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("weekly-tournament", { body: { action: "preview_pod_brackets", ...(weekId ? { week_id: weekId } : {}) } });
      if (error || data?.error) throw new Error(data?.error ?? error?.message ?? "Couldn't load pod brackets");
      return data as Resp;
    },
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });
  if (!data?.week || data.closed || !data.pods?.length) return null;
  return (
    <>
      {data.pods.map((p) => (
        <LiveBracketPreview key={p.id} title={`${p.name} pod · live bracket`} myUserId={myUserId}
          preset={{ week: data.week, participants: p.participants, slots: p.slots, size: p.size }} />
      ))}
    </>
  );
}
