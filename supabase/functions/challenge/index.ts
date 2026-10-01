// Friendly Challenges + Capture Battles: the only way to send, accept,
// decline or cancel a player-vs-player challenge. Mirrors src/lib/gameRules.ts.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import { isAttackStance, isDefenseStance } from "../_shared/battle-math.ts";
import { COOLDOWN_MS, isDemoUser, publicSpider } from "../_shared/matchmaking.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
export const RESPONSE_HOURS = 48; // time to accept before a challenge expires
export const MOVE_HOURS = 12;     // time per move before the computer plays for you
const BANDS = [0.15, 0.3, 0.5];

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });

function stancesFrom(s: any) {
  return {
    attack: isAttackStance(s?.attack) ? s.attack : "power_strike",
    defense: isDefenseStance(s?.defense) ? s.defense : "iron_web",
  };
}

/** Starting 5, approved, not resting, not already in a live battle or open challenge. */
async function spiderProblem(sb: any, spider: any, ownerId: string, opts: { ignoreChallengeId?: string } = {}) {
  if (!spider) return "That spider no longer exists.";
  if (spider.owner_id !== ownerId) return "That spider has a different owner now.";
  if (!spider.is_approved) return "That spider isn't approved to battle.";
  if (!spider.eligible_until || new Date(spider.eligible_until) <= new Date()) return `${spider.nickname} is retired. Re-enlist it first.`;
  if (spider.last_battled_at && new Date(spider.last_battled_at).getTime() + COOLDOWN_MS > Date.now()) {
    const mins = Math.ceil((new Date(spider.last_battled_at).getTime() + COOLDOWN_MS - Date.now()) / 60000);
    return `${spider.nickname} is resting for ${mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`}.`;
  }
  const { data: live } = await sb.from("battles").select("id")
    .eq("is_active", true).eq("mode", "interactive")
    .or(`team_a->spider->>id.eq.${spider.id},team_b->spider->>id.eq.${spider.id}`).limit(1);
  if (live?.length) return `${spider.nickname} is already in a battle.`;
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const sb = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Please sign in again.", code: "SESSION_EXPIRED" }, 401);
    const userSb = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: u } = await userSb.auth.getUser(auth.slice(7));
    if (!u?.user) return json({ error: "Please sign in again.", code: "SESSION_EXPIRED" }, 401);
    const me = u.user.id;
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");
    const uuid = (v: unknown) => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : null;

    const loadSpider = async (id: string | null) =>
      id ? (await sb.from("spiders").select("*").eq("id", id).maybeSingle()).data : null;

    // ---------- suggest: eligible, similar-strength opponents ----------
    if (action === "suggest") {
      const mine = await loadSpider(uuid(body.spiderId));
      if (!mine || mine.owner_id !== me) return json({ error: "Pick one of your spiders first." }, 400);
      const nowIso = new Date().toISOString();
      const cutoff = new Date(Date.now() - COOLDOWN_MS).toISOString();
      let pool: any[] = [];
      for (const pct of BANDS) {
        const { data } = await sb.from("spiders")
          .select("id,owner_id,nickname,species,image_url,rarity,power_score,hit_points,damage,speed,defense,venom,webcraft,level")
          .eq("is_approved", true).neq("owner_id", me).gt("eligible_until", nowIso)
          .or(`last_battled_at.is.null,last_battled_at.lt.${cutoff}`)
          .gte("power_score", Math.floor(mine.power_score * (1 - pct)))
          .lte("power_score", Math.ceil(mine.power_score * (1 + pct))).limit(40);
        pool = data || [];
        if (pool.length >= 3) break;
      }
      const owners = [...new Set(pool.map((s) => s.owner_id))];
      const [{ data: profs }, { data: pres }] = owners.length
        ? await Promise.all([
          sb.from("profiles").select("id,display_name,is_demo").in("id", owners),
          sb.from("user_presence").select("user_id,last_seen").in("user_id", owners),
        ])
        : [{ data: [] }, { data: [] }];
      const prof = new Map((profs || []).map((p: any) => [p.id, p]));
      const seen = new Map((pres || []).map((p: any) => [p.user_id, p.last_seen]));
      const byOwner = new Map<string, any>();
      for (const s of pool) {
        const p: any = prof.get(s.owner_id);
        if (!p || p.is_demo) continue;
        const prev = byOwner.get(s.owner_id);
        if (!prev || Math.abs(s.power_score - mine.power_score) < Math.abs(prev.power_score - mine.power_score)) {
          byOwner.set(s.owner_id, { ...s, owner_name: p.display_name || "Player", owner_last_seen: seen.get(s.owner_id) ?? null });
        }
      }
      const opponents = [...byOwner.values()]
        .sort((a, b) => Math.abs(a.power_score - mine.power_score) - Math.abs(b.power_score - mine.power_score))
        .slice(0, 6);
      return json({ success: true, opponents, practiceAvailable: opponents.length === 0 });
    }

    // ---------- send ----------
    if (action === "send") {
      const mode = body.mode === "capture" ? "capture" : "friendly";
      const key = typeof body.idempotencyKey === "string" && /^[A-Za-z0-9-]{8,80}$/.test(body.idempotencyKey) ? body.idempotencyKey : null;
      if (key) {
        const { data: dup } = await sb.from("battle_challenges").select("id").eq("challenger_id", me).eq("idempotency_key", key).maybeSingle();
        if (dup) return json({ success: true, challengeId: dup.id, duplicate: true });
      }
      const mine = await loadSpider(uuid(body.spiderId));
      const p1 = await spiderProblem(sb, mine, me);
      if (p1) return json({ error: p1, code: "SPIDER_INELIGIBLE" }, 400);
      const { data: openOwn } = await sb.from("battle_challenges").select("id")
        .eq("challenger_spider_id", mine.id).eq("status", "OPEN").gt("expires_at", new Date().toISOString()).limit(1);
      if (openOwn?.length) return json({ error: `${mine.nickname} already has a pending challenge. Cancel it first.`, code: "ALREADY_PENDING", challengeId: openOwn[0].id }, 409);

      const target = await loadSpider(uuid(body.opponentSpiderId));
      let targetUserId: string | null = uuid(body.targetUserId);
      if (target) {
        if (target.owner_id === me) return json({ error: "You can't challenge your own spider." }, 400);
        if (!target.eligible_until || new Date(target.eligible_until) <= new Date()) return json({ error: `${target.nickname} is retired and can't be challenged.`, code: "OPPONENT_INELIGIBLE" }, 400);
        targetUserId = target.owner_id;
      }
      if (targetUserId === me) return json({ error: "You can't challenge yourself." }, 400);
      // Demo accounts only ever play other demo accounts.
      if (targetUserId && (await isDemoUser(sb, targetUserId)) !== (await isDemoUser(sb, me))) {
        return json({ error: "Demo accounts and real players can't challenge each other.", code: "OPPONENT_INELIGIBLE" }, 400);
      }

      if (mode === "capture") {
        if (await isDemoUser(sb, me)) return json({ error: "Demo accounts can't play Capture Battles.", code: "DEMO_BLOCKED" }, 403);
        if (!target) return json({ error: "Capture Battles must name the exact spider you're challenging." }, 400);
        const c = body.consent || {};
        if (c.agreed !== true || c.mySpiderId !== mine.id || c.opponentSpiderId !== target.id) {
          return json({ error: "Confirm the exact spiders at stake before sending.", code: "CONSENT_REQUIRED" }, 400);
        }
      }
      const expires = new Date(Date.now() + RESPONSE_HOURS * 3600_000).toISOString();
      const { data: row, error } = await sb.from("battle_challenges").insert({
        challenger_id: me,
        challenger_spider_id: mine.id,
        accepter_spider_id: target?.id ?? null,
        target_user_id: targetUserId,
        is_all_or_nothing: mode === "capture",
        challenger_consented_at: mode === "capture" ? new Date().toISOString() : null,
        challenger_stances: stancesFrom(body.stances),
        challenge_message: mode === "capture"
          ? `${mine.nickname} challenges ${target!.nickname} to a Capture Battle`
          : target ? `${mine.nickname} challenges ${target.nickname} to a Friendly Challenge` : `${mine.nickname} is looking for a Friendly Challenge`,
        status: "OPEN",
        expires_at: expires,
        idempotency_key: key,
        league_id: uuid(body.leagueId),
      }).select("id").single();
      if (error) {
        if (key) {
          const { data: dup } = await sb.from("battle_challenges").select("id").eq("challenger_id", me).eq("idempotency_key", key).maybeSingle();
          if (dup) return json({ success: true, challengeId: dup.id, duplicate: true });
        }
        return json({ error: error.message.includes("Rate limit") ? "Too many challenges — wait a few minutes." : "Couldn't send the challenge." }, 400);
      }
      return json({ success: true, challengeId: row.id, expiresAt: expires });
    }

    const challengeId = uuid(body.challengeId);
    if (!challengeId) return json({ error: "Missing challenge." }, 400);
    const { data: ch } = await sb.from("battle_challenges").select("*").eq("id", challengeId).maybeSingle();
    if (!ch) return json({ error: "That challenge no longer exists.", code: "NOT_FOUND" }, 404);
    const expired = ch.status === "OPEN" && new Date(ch.expires_at) <= new Date();

    // ---------- cancel (challenger) ----------
    if (action === "cancel") {
      if (ch.challenger_id !== me) return json({ error: "Only the sender can cancel this challenge." }, 403);
      const { data } = await sb.from("battle_challenges").update({ status: "CANCELLED", responded_at: new Date().toISOString() })
        .eq("id", ch.id).eq("status", "OPEN").select("id");
      return data?.length ? json({ success: true }) : json({ error: "This challenge was already answered.", code: "NOT_OPEN", status: ch.status }, 409);
    }

    const isTarget = ch.target_user_id === me || (!ch.target_user_id && ch.challenger_id !== me);

    // ---------- decline (recipient) ----------
    if (action === "decline") {
      if (!ch.target_user_id || ch.target_user_id !== me) return json({ error: "Only the challenged player can decline." }, 403);
      const { data } = await sb.from("battle_challenges").update({ status: "DECLINED", responded_at: new Date().toISOString() })
        .eq("id", ch.id).eq("status", "OPEN").select("id");
      return data?.length ? json({ success: true }) : json({ error: "This challenge was already answered.", code: "NOT_OPEN", status: ch.status }, 409);
    }

    // ---------- accept ----------
    if (action === "accept") {
      if (ch.status === "ACCEPTED" && ch.accepter_id === me && ch.battle_id) return json({ success: true, battleId: ch.battle_id, resumed: true });
      if (ch.status !== "OPEN") return json({ error: `This challenge is ${ch.status.toLowerCase()}.`, code: "NOT_OPEN", status: ch.status }, 409);
      if (expired) return json({ error: "This challenge expired.", code: "EXPIRED" }, 409);
      if (ch.challenger_id === me || !isTarget) return json({ error: "This challenge was sent to another player." }, 403);

      const capture = ch.is_all_or_nothing === true;
      if ((await isDemoUser(sb, me)) !== (await isDemoUser(sb, ch.challenger_id))) {
        return json({ error: "Demo accounts and real players can't challenge each other.", code: "OPPONENT_INELIGIBLE" }, 403);
      }
      const mySpiderId = capture && ch.accepter_spider_id ? ch.accepter_spider_id : uuid(body.spiderId);
      if (capture && ch.accepter_spider_id && mySpiderId !== ch.accepter_spider_id) return json({ error: "This challenge names a specific spider of yours." }, 400);
      const mine = await loadSpider(mySpiderId);
      const p1 = await spiderProblem(sb, mine, me);
      if (p1) return json({ error: p1, code: "SPIDER_INELIGIBLE" }, 400);
      const theirs = await loadSpider(ch.challenger_spider_id);
      const p2 = await spiderProblem(sb, theirs, ch.challenger_id);
      if (p2) {
        await sb.from("battle_challenges").update({ status: "CANCELLED", responded_at: new Date().toISOString() }).eq("id", ch.id).eq("status", "OPEN");
        return json({ error: `The challenger's spider can't battle anymore: ${p2}`, code: "CHALLENGER_INELIGIBLE" }, 409);
      }
      if (capture) {
        if (await isDemoUser(sb, me) || await isDemoUser(sb, ch.challenger_id)) return json({ error: "Demo accounts can't play Capture Battles.", code: "DEMO_BLOCKED" }, 403);
        const c = body.consent || {};
        if (c.agreed !== true || c.mySpiderId !== mine.id || c.opponentSpiderId !== theirs.id) {
          return json({ error: "Confirm the exact spiders at stake before accepting.", code: "CONSENT_REQUIRED" }, 400);
        }
      }

      // Claim the challenge atomically — only one accept can win.
      const nowIso = new Date().toISOString();
      const { data: claimed } = await sb.from("battle_challenges").update({
        status: "ACCEPTED", accepter_id: me, accepter_spider_id: mine.id, responded_at: nowIso,
        accepter_consented_at: capture ? nowIso : null,
      }).eq("id", ch.id).eq("status", "OPEN").select("id");
      if (!claimed?.length) return json({ error: "Someone already answered this challenge.", code: "NOT_OPEN" }, 409);

      const first = theirs.speed >= mine.speed ? ch.challenger_id : me;
      const demo = (await isDemoUser(sb, me)) || (await isDemoUser(sb, ch.challenger_id));
      const { data: battle, error: bErr } = await sb.from("battles").insert({
        challenge_id: ch.id,
        stakes_type: capture ? "capture" : "friendly",
        team_a: { userId: ch.challenger_id, spider: publicSpider(theirs) },
        team_b: { userId: me, spider: publicSpider(mine) },
        current_turn_user_id: first,
        p1_current_hp: theirs.hit_points,
        p2_current_hp: mine.hit_points,
        is_active: true,
        rng_seed: crypto.randomUUID(),
        league_id: ch.league_id,
        mode: "interactive",
        stances: { [ch.challenger_id]: stancesFrom(ch.challenger_stances), [me]: stancesFrom(body.stances) },
        awaiting_action: "attack",
        awaiting_user_id: first,
        is_pvp: true,
        turn_deadline: new Date(Date.now() + MOVE_HOURS * 3600_000).toISOString(),
        is_demo: demo,
      }).select("id").single();
      if (bErr) {
        await sb.from("battle_challenges").update({ status: "OPEN", accepter_id: null, accepter_spider_id: ch.accepter_spider_id, accepter_consented_at: null, responded_at: null }).eq("id", ch.id);
        console.error("challenge accept battle insert", bErr);
        return json({ error: "Couldn't start the battle. Please try again." }, 500);
      }
      await sb.from("battle_challenges").update({ battle_id: battle.id }).eq("id", ch.id);
      return json({ success: true, battleId: battle.id });
    }

    return json({ error: "Unknown action." }, 400);
  } catch (e) {
    console.error("challenge error", e);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});
