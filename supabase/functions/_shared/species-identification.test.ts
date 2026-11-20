import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { formatLocation, rankCandidates, resolveIdentification } from "./species-identification.ts";
const catalog = { widow: { family: "Theridiidae" }, false_widow: { family: "Theridiidae" }, group_theridiidae: { family: "Theridiidae" } };
const c = (species_key: string, confidence: number) => ({ species_key, confidence });
Deno.test("sort and deduplicate before evaluating alternatives", () => {
  assertEquals(rankCandidates({ candidates: [c("widow", 20), c("false_widow", 80), c("widow", 90), c("invented", 99)] }, catalog), [c("widow", 90), c("false_widow", 80)]);
});
Deno.test("close lookalikes remain a family match with both alternatives", () => {
  const result = resolveIdentification({ candidates: [c("widow", 82), c("false_widow", 79)] }, catalog, 70, 10);
  assertEquals(result.map((x) => x.species_key), ["group_theridiidae", "widow", "false_widow"]);
  assertEquals(result[0].confidence, 82);
});
Deno.test("a family result is never demoted to a nearby species guess", () => {
  assertEquals(resolveIdentification({ candidates: [c("group_theridiidae", 85), c("widow", 80)] }, catalog, 70, 10)[0].species_key, "group_theridiidae");
});
Deno.test("missing diagnostic evidence cannot produce a confident species", () => {
  assertEquals(resolveIdentification({ candidates: [{ ...c("widow", 95), diagnosticEvidence: false }] }, catalog, 70, 10)[0].species_key, "group_theridiidae");
});
Deno.test("clear diagnostic species identification is preserved", () => {
  assertEquals(resolveIdentification({ imageQuality: "clear", speciesResolvable: true, candidates: [{ ...c("widow", 92), diagnosticEvidence: true }, c("false_widow", 40)] }, catalog, 70, 10)[0].species_key, "widow");
});
Deno.test("unknown location does not assume the United States", () => {
  assertEquals(formatLocation(), "Unknown; do not infer a country or region.");
  assertEquals(formatLocation({ name: "Paris, France" }), "Paris, France");
});
Deno.test("poor photo defaults to family even with high model confidence", () => {
  assertEquals(resolveIdentification({ imageQuality: "poor", candidates: [c("widow", 95)] }, catalog, 70, 10)[0].species_key, "group_theridiidae");
});