import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { selectFreshEntries } from "../_shared/tournament-entries.ts";
import { bracketSize, layoutBracket, type Participant } from "../_shared/tournament-engine.ts";

Deno.test("preview and lock share automatic and explicitly chosen fresh entries", () => {
  const spiders = [10, 40, 30, 20].map((power_score, i) => ({ id: `s${i}`, owner_id: "player", power_score }));
  assertEquals(selectFreshEntries(spiders, []).map((s) => s.id), ["s1", "s2", "s3"]);
  assertEquals(selectFreshEntries(spiders, [{ spider_id: "s0", user_id: "player", is_veteran: false }]).map((s) => s.id), ["s0"]);
});

Deno.test("five actual spiders preview an eight-slot bracket with three top-seed byes", () => {
  const participants = Array.from({ length: 5 }, (_, i) => ({ id: `s${i}`, power: 100 - i, spider_id: `s${i}`, is_wild: false })) as Participant[];
  const slots = layoutBracket(participants, bracketSize(participants.length, 2), false);
  assertEquals(slots.length, 8);
  assertEquals(slots.filter(Boolean).length, 5);
  assertEquals(slots.filter((s) => s === null).length, 3);
  assertEquals(slots[0]?.id, "s0");
  assertEquals(slots[1], null);
});
Deno.test("a three-spider pod previews a four-slot real-only bracket with one bye", () => {
  const participants = ["a", "b", "c"].map((o, i) => ({ id: `p${i}`, owner_id: o, power: 90 - i, spider_id: `p${i}`, is_wild: false })) as Participant[];
  const slots = layoutBracket(participants, bracketSize(participants.length, 2), true);
  assertEquals(slots.length, 4);
  assertEquals(slots.filter((s) => s === null).length, 1);
  assertEquals(slots.every((s) => !s || !s.is_wild), true);
});
