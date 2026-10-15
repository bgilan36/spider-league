import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { logEvent } from "@/lib/tournament";
import { supabase } from "@/integrations/supabase/client";

/** Logs email-driven visits (utm_source=email) once per landing. */
export default function UtmCapture() {
  const { search, pathname } = useLocation();
  useEffect(() => {
    // One "app_visit" per signed-in user per day, for weekly-active counts.
    const day = new Date().toISOString().slice(0, 10);
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id;
      if (!uid || localStorage.getItem(`visit:${uid}`) === day) return;
      localStorage.setItem(`visit:${uid}`, day);
      logEvent("app_visit");
    });
  }, [pathname]);

  useEffect(() => {
    const p = new URLSearchParams(search);
    if (p.get("utm_source") !== "email") return;
    const key = `utm:${p.get("utm_campaign")}:${pathname}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    const weekMatch = pathname.match(/^\/week\/([^/]+)/);
    logEvent("email_visit", { campaign: p.get("utm_campaign"), medium: p.get("utm_medium"), path: pathname }, weekMatch?.[1] ?? null);
  }, [search, pathname]);
  return null;
}
