// Serves an HTML page with Open Graph meta tags for a given spider or battle.
// Social crawlers (iMessage, WhatsApp, Slack, X, Facebook) fetch this URL
// and render the unfurl. Real browsers get redirected to the SPA page.
//
// Usage:
//   /functions/v1/og-card?type=spider&id=<spider_id>
//   /functions/v1/og-card?type=battle&id=<battle_id>

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_ORIGIN = "https://spiderleague.app";
const DEFAULT_OG = `${APP_ORIGIN}/spider-league-og.png`;

const esc = (s: string) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

interface Meta {
  title: string;
  description: string;
  image: string;
  url: string;
  redirectTo: string;
  type: string;
}

function renderHtml(m: Meta): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${esc(m.title)}</title>
<meta name="description" content="${esc(m.description)}" />
<link rel="canonical" href="${esc(m.url)}" />

<meta property="og:type" content="${esc(m.type)}" />
<meta property="og:site_name" content="Spider League" />
<meta property="og:title" content="${esc(m.title)}" />
<meta property="og:description" content="${esc(m.description)}" />
<meta property="og:image" content="${esc(m.image)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:url" content="${esc(m.url)}" />

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(m.title)}" />
<meta name="twitter:description" content="${esc(m.description)}" />
<meta name="twitter:image" content="${esc(m.image)}" />

<meta http-equiv="refresh" content="0; url=${esc(m.redirectTo)}" />
<script>window.location.replace(${JSON.stringify(m.redirectTo)});</script>
</head>
<body style="background:#0b0712;color:#fff;font-family:system-ui;padding:32px;text-align:center;">
<p>Opening <a href="${esc(m.redirectTo)}" style="color:#ec4899;">${esc(m.title)}</a> on Spider League…</p>
<img src="${esc(m.image)}" alt="${esc(m.title)}" style="max-width:100%;height:auto;border-radius:12px;margin-top:16px;" />
</body>
</html>`;
}

function fallback(redirectTo: string, reason: string): Response {
  return new Response(
    renderHtml({
      title: "Spider League",
      description: "Snap a photo of any spider, get battle stats, and compete in weekly matchups with friends.",
      image: DEFAULT_OG,
      url: redirectTo,
      redirectTo,
      type: "website",
    }),
    {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=60",
        "x-og-fallback": reason,
      },
    },
  );
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const type = url.searchParams.get("type");
  const id = url.searchParams.get("id");

  if (!type || !id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return fallback(APP_ORIGIN, "missing-or-invalid-params");
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  try {
    if (type === "spider") {
      const { data, error } = await supabase
        .from("spiders")
        .select("id,nickname,species,rarity,power_score,image_url,share_image_url")
        .eq("id", id)
        .maybeSingle();
      if (error || !data) return fallback(`${APP_ORIGIN}/collection`, "spider-not-found");
      const title = `${data.nickname} — ${data.rarity} ${data.species}`;
      const description = `🕷️ ${data.rarity} ${data.species} • ${data.power_score} Power. Snap your own spider and battle on Spider League.`;
      const image = data.share_image_url || data.image_url || DEFAULT_OG;
      const redirectTo = `${APP_ORIGIN}/?spider=${data.id}`;
      return new Response(
        renderHtml({
          title,
          description,
          image,
          url: `${APP_ORIGIN}/s/${data.id}`,
          redirectTo,
          type: "article",
        }),
        {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "public, max-age=300",
          },
        },
      );
    }

    if (type === "battle") {
      const { data, error } = await supabase
        .from("battles")
        .select("id,team_a,team_b,winner,turn_count,share_image_url,is_active")
        .eq("id", id)
        .maybeSingle();
      if (error || !data) return fallback(`${APP_ORIGIN}/battle-history`, "battle-not-found");
      const teamA: any = data.team_a;
      const teamB: any = data.team_b;
      const aName = teamA?.spider?.nickname ?? "Spider A";
      const bName = teamB?.spider?.nickname ?? "Spider B";
      const winSide = data.winner;
      const winnerName = winSide === "A" ? aName : winSide === "B" ? bName : null;
      const title = winnerName
        ? `🏆 ${winnerName} wins! ${aName} vs ${bName}`
        : `${aName} vs ${bName} — Spider League`;
      const description = winnerName
        ? `${winnerName} won after ${data.turn_count ?? "?"} rounds on Spider League. Tap to watch the recap.`
        : `Live battle on Spider League. Tap to watch.`;
      const image = data.share_image_url || DEFAULT_OG;
      const redirectTo = `${APP_ORIGIN}/battle/${data.id}`;
      return new Response(
        renderHtml({
          title,
          description,
          image,
          url: `${APP_ORIGIN}/b/${data.id}`,
          redirectTo,
          type: "article",
        }),
        {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "public, max-age=300",
          },
        },
      );
    }

    return fallback(APP_ORIGIN, "unknown-type");
  } catch (e) {
    console.error("og-card error", e);
    return fallback(APP_ORIGIN, "exception");
  }
});