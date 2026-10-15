import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { logEvent } from "@/lib/tournament";

/** Logs email-driven visits (utm_source=email) once per landing. */
export default function UtmCapture() {
  const { search, pathname } = useLocation();
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
