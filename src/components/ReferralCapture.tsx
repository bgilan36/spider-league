import { useEffect, useRef } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "pendingReferralInviterId";

/**
 * Captures ?ref=<inviter_user_id> from the URL on first load and stores it.
 * After sign-in, redeems the referral via record_referral RPC.
 */
const ReferralCapture = () => {
  const { user } = useAuth();
  const redeemedRef = useRef(false);

  // Capture from URL on mount
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get("ref");
      if (ref && /^[0-9a-f-]{36}$/i.test(ref)) {
        localStorage.setItem(STORAGE_KEY, ref);
      }
    } catch {
      // ignore
    }
  }, []);

  // Redeem once user is signed in
  useEffect(() => {
    if (!user || redeemedRef.current) return;
    const inviterId = localStorage.getItem(STORAGE_KEY);
    if (!inviterId || inviterId === user.id) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    redeemedRef.current = true;
    (supabase.rpc as any)("record_referral", {
      p_inviter_id: inviterId,
      p_source: "share_link",
      p_source_ref: null,
    })
      .then(() => {
        localStorage.removeItem(STORAGE_KEY);
      })
      .catch(() => {
        // silent — best-effort
      });
  }, [user]);

  return null;
};

export default ReferralCapture;