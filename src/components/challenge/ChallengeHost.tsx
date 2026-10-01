import { useEffect, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import type { ComposeArgs } from "@/lib/challenges";
import ChallengeComposer from "./ChallengeComposer";
import ChallengeResponseDialog from "./ChallengeResponseDialog";

/** Single mount point for challenge dialogs so they outlive whatever opened them. */
export default function ChallengeHost() {
  const { user } = useAuth();
  const [compose, setCompose] = useState<ComposeArgs | null>(null);
  const [respond, setRespond] = useState<string | null>(null);
  useEffect(() => {
    const c = (e: Event) => setCompose({ ...((e as CustomEvent).detail || {}) });
    const r = (e: Event) => setRespond((e as CustomEvent).detail?.challengeId ?? null);
    window.addEventListener("challenge:compose", c);
    window.addEventListener("challenge:respond", r);
    return () => { window.removeEventListener("challenge:compose", c); window.removeEventListener("challenge:respond", r); };
  }, []);
  if (!user) return null;
  return (
    <>
      {compose && <ChallengeComposer args={compose} onClose={() => setCompose(null)} />}
      {respond && <ChallengeResponseDialog challengeId={respond} onClose={() => setRespond(null)} />}
    </>
  );
}
