export type Candidate = { species_key: string; confidence: number; reasoning?: string; diagnosticEvidence?: boolean };
export type Observation = {
  isSpider?: boolean;
  observedFeatures?: string;
  imageQuality?: "clear" | "limited" | "poor";
  speciesResolvable?: boolean;
  candidates?: Candidate[];
};
export type Catalog = Record<string, { family: string }>;

export function rankCandidates(observation: Observation, catalog: Catalog): Candidate[] {
  const unique = new Map<string, Candidate>();
  for (const c of observation.candidates ?? []) {
    if (!c || typeof c.species_key !== "string" || !Number.isFinite(c.confidence)) continue;
    const key = c.species_key.trim();
    if (!Object.hasOwn(catalog, key)) continue;
    const candidate = { ...c, species_key: key, confidence: Math.max(0, Math.min(98, c.confidence)) };
    if ((unique.get(key)?.confidence ?? -1) < candidate.confidence) unique.set(key, candidate);
  }
  return [...unique.values()].sort((a, b) => b.confidence - a.confidence);
}

export function resolveIdentification(observation: Observation, catalog: Catalog, minConfidence: number, minMargin: number): Candidate[] {
  const ranked = rankCandidates(observation, catalog);
  const top = ranked[0];
  if (!top || top.species_key.startsWith("group_")) return ranked;
  const runner = ranked.find((c) => !c.species_key.startsWith("group_") && c.species_key !== top.species_key);
  const ambiguous = top.confidence < minConfidence || (runner !== undefined && top.confidence - runner.confidence < minMargin);
  const insufficient = observation.speciesResolvable === false || observation.imageQuality === "poor" || top.diagnosticEvidence === false;
  if (!ambiguous && !insufficient) return ranked;
  const key = `group_${catalog[top.species_key].family.toLowerCase()}`;
  if (!Object.hasOwn(catalog, key)) return ranked;
  // Same confidence, never a fabricated probability boost. Stable ordering keeps
  // the conservative group first and species alternatives available for correction.
  const group = ranked.find((c) => c.species_key === key);
  return [{ species_key: key, confidence: top.confidence, reasoning: group?.reasoning ?? "Family match; the visible features do not reliably separate these species." }, ...ranked.filter((c) => c.species_key !== key)];
}

export function formatLocation(location?: { latitude?: number; longitude?: number; name?: string }): string {
  const parts: string[] = [];
  if (Number.isFinite(location?.latitude) && Number.isFinite(location?.longitude)) {
    parts.push(`approx coords ${location?.latitude?.toFixed(2)}, ${location?.longitude?.toFixed(2)}`);
  }
  if (location?.name) parts.push(location.name);
  return parts.join(" — ") || "Unknown; do not infer a country or region.";
}