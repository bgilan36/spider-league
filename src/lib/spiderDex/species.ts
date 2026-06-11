// Canonical SpiderDex reference — ~40 common North American species.
// Free-text uploads are matched into a slug via matchSpeciesSlug().

export type DexRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export interface DexSpecies {
  slug: string;
  commonName: string;
  scientificName: string;
  family: string;
  rarity: DexRarity;
  region: string;
  hint: string;
  /** Two-color palette used as the silhouette card background gradient. */
  silhouettePalette: [string, string];
  /** Lowercase aliases (incl. typos, scientific name fragments, common variants). */
  aliases: string[];
}

export const SPECIES_DEX: DexSpecies[] = [
  // --- Widows & recluses (medically significant) ---
  { slug: "southern_black_widow", commonName: "Southern Black Widow", scientificName: "Latrodectus mactans", family: "Theridiidae",
    rarity: "rare", region: "Eastern & Southern US",
    hint: "Hides in woodpiles and dim corners — glossy black with a red hourglass.",
    silhouettePalette: ["#0a0a0a", "#7f1d1d"],
    aliases: ["southern black widow", "black widow", "latrodectus mactans", "mactans"] },
  { slug: "western_black_widow", commonName: "Western Black Widow", scientificName: "Latrodectus hesperus", family: "Theridiidae",
    rarity: "rare", region: "Western US",
    hint: "Found in garages and sheds west of the Rockies.",
    silhouettePalette: ["#111", "#991b1b"],
    aliases: ["western black widow", "latrodectus hesperus", "hesperus"] },
  { slug: "northern_black_widow", commonName: "Northern Black Widow", scientificName: "Latrodectus variolus", family: "Theridiidae",
    rarity: "rare", region: "Northeastern US",
    hint: "Shier cousin — look in woodland leaf litter.",
    silhouettePalette: ["#0a0a0a", "#581c1c"],
    aliases: ["northern black widow", "latrodectus variolus", "variolus"] },
  { slug: "brown_widow", commonName: "Brown Widow", scientificName: "Latrodectus geometricus", family: "Theridiidae",
    rarity: "uncommon", region: "Southern US",
    hint: "Spiky egg sacs are the giveaway.",
    silhouettePalette: ["#3b2a1a", "#7a4f1d"],
    aliases: ["brown widow", "latrodectus geometricus", "geometricus"] },
  { slug: "brown_recluse", commonName: "Brown Recluse", scientificName: "Loxosceles reclusa", family: "Sicariidae",
    rarity: "rare", region: "Central & Southern US",
    hint: "Violin shape on the back; loves cardboard and attics.",
    silhouettePalette: ["#2a1810", "#854d1a"],
    aliases: ["brown recluse", "loxosceles reclusa", "fiddleback", "fiddle-back", "violin spider", "reclusa"] },

  // --- Orb weavers ---
  { slug: "garden_orb_weaver", commonName: "Garden Orb Weaver", scientificName: "Araneidae sp.", family: "Araneidae",
    rarity: "common", region: "Continent-wide",
    hint: "Spins a fresh wheel each evening across paths and porches.",
    silhouettePalette: ["#1a2e1a", "#4a7c3a"],
    aliases: ["garden orb weaver", "orb weaver", "orb weaver spider", "araneidae"] },
  { slug: "black_and_yellow_garden_spider", commonName: "Black & Yellow Garden Spider", scientificName: "Argiope aurantia", family: "Araneidae",
    rarity: "uncommon", region: "Continent-wide",
    hint: "Writes zig-zag silk signatures in its web.",
    silhouettePalette: ["#1a1a1a", "#facc15"],
    aliases: ["argiope aurantia", "writing spider", "corn spider", "black and yellow garden spider", "yellow garden spider"] },
  { slug: "banded_garden_spider", commonName: "Banded Garden Spider", scientificName: "Argiope trifasciata", family: "Araneidae",
    rarity: "uncommon", region: "Continent-wide",
    hint: "Silver bands and a love for sunny meadows.",
    silhouettePalette: ["#2a2a2a", "#cbd5e1"],
    aliases: ["argiope trifasciata", "banded garden spider"] },
  { slug: "barn_spider", commonName: "Barn Spider", scientificName: "Araneus cavaticus", family: "Araneidae",
    rarity: "common", region: "Eastern US & Canada",
    hint: "Charlotte's species — large autumn orb webs on wooden eaves.",
    silhouettePalette: ["#3b2a1a", "#9a7c4a"],
    aliases: ["barn spider", "araneus cavaticus", "cavaticus"] },
  { slug: "spotted_orbweaver", commonName: "Spotted Orbweaver", scientificName: "Neoscona crucifera", family: "Araneidae",
    rarity: "common", region: "Eastern US",
    hint: "Night shift weaver, hides in a curled leaf by day.",
    silhouettePalette: ["#2a1a0a", "#a3621a"],
    aliases: ["neoscona crucifera", "spotted orbweaver", "hentz orbweaver", "neoscona"] },
  { slug: "spiny_orb_weaver", commonName: "Spiny Orb Weaver", scientificName: "Gasteracantha cancriformis", family: "Araneidae",
    rarity: "uncommon", region: "Southern US",
    hint: "Tiny crab-shaped with six bright red spines.",
    silhouettePalette: ["#eaeaea", "#dc2626"],
    aliases: ["spiny orb weaver", "gasteracantha", "crab-like spiny orbweaver"] },
  { slug: "joro_spider", commonName: "Jorō Spider", scientificName: "Trichonephila clavata", family: "Araneidae",
    rarity: "rare", region: "Southeastern US (introduced)",
    hint: "Golden web invader spreading north from Georgia.",
    silhouettePalette: ["#1a1a3a", "#fbbf24"],
    aliases: ["joro", "joro spider", "trichonephila clavata", "jorō"] },
  { slug: "golden_silk_orbweaver", commonName: "Golden Silk Orbweaver", scientificName: "Trichonephila clavipes", family: "Araneidae",
    rarity: "uncommon", region: "Southeastern US",
    hint: "Silk shimmers gold in sunlight; the web can span trails.",
    silhouettePalette: ["#2a1f0a", "#eab308"],
    aliases: ["golden silk orbweaver", "trichonephila clavipes", "banana spider"] },

  // --- Jumping spiders (Salticidae) ---
  { slug: "bold_jumping_spider", commonName: "Bold Jumping Spider", scientificName: "Phidippus audax", family: "Salticidae",
    rarity: "common", region: "Continent-wide",
    hint: "Iridescent green fangs; will turn to look back at you.",
    silhouettePalette: ["#0a0a0a", "#34d399"],
    aliases: ["bold jumping spider", "phidippus audax", "audax", "bold jumper"] },
  { slug: "regal_jumping_spider", commonName: "Regal Jumping Spider", scientificName: "Phidippus regius", family: "Salticidae",
    rarity: "uncommon", region: "Southeastern US",
    hint: "Largest North American jumper — friendly stare on palmettos.",
    silhouettePalette: ["#1a1a1a", "#60a5fa"],
    aliases: ["regal jumping spider", "phidippus regius", "regius"] },
  { slug: "zebra_jumping_spider", commonName: "Zebra Jumping Spider", scientificName: "Salticus scenicus", family: "Salticidae",
    rarity: "common", region: "Continent-wide",
    hint: "Black-and-white stripes patrol sunlit walls.",
    silhouettePalette: ["#0a0a0a", "#f4f4f5"],
    aliases: ["zebra jumping spider", "salticus scenicus", "scenicus"] },
  { slug: "tan_jumping_spider", commonName: "Tan Jumping Spider", scientificName: "Platycryptus undatus", family: "Salticidae",
    rarity: "common", region: "Eastern US",
    hint: "Flat as a sticker against tree bark.",
    silhouettePalette: ["#3a2a1a", "#a8a29e"],
    aliases: ["tan jumping spider", "platycryptus undatus", "undatus"] },

  // --- Wolf spiders (Lycosidae) ---
  { slug: "carolina_wolf_spider", commonName: "Carolina Wolf Spider", scientificName: "Hogna carolinensis", family: "Lycosidae",
    rarity: "uncommon", region: "Continent-wide",
    hint: "Largest wolf in NA — eyes shine in flashlight beams.",
    silhouettePalette: ["#1a1006", "#6b4423"],
    aliases: ["carolina wolf spider", "hogna carolinensis", "carolinensis"] },
  { slug: "wolf_spider", commonName: "Wolf Spider", scientificName: "Lycosidae sp.", family: "Lycosidae",
    rarity: "common", region: "Continent-wide",
    hint: "Ground hunter; mothers carry babies on their back.",
    silhouettePalette: ["#1f1209", "#7a5538"],
    aliases: ["wolf spider", "lycosidae", "lycosa"] },
  { slug: "rabid_wolf_spider", commonName: "Rabid Wolf Spider", scientificName: "Rabidosa rabida", family: "Lycosidae",
    rarity: "uncommon", region: "Eastern US",
    hint: "Striped racing-stripes down a tan body.",
    silhouettePalette: ["#2a1f0a", "#b48a2a"],
    aliases: ["rabid wolf spider", "rabidosa rabida", "rabidosa"] },

  // --- House & cellar ---
  { slug: "common_house_spider", commonName: "Common House Spider", scientificName: "Parasteatoda tepidariorum", family: "Theridiidae",
    rarity: "common", region: "Worldwide",
    hint: "Cobwebbed corners of basements and porches.",
    silhouettePalette: ["#1a1a1a", "#9ca3af"],
    aliases: ["common house spider", "parasteatoda tepidariorum", "tepidariorum", "house spider"] },
  { slug: "cellar_spider", commonName: "Cellar Spider", scientificName: "Pholcidae sp.", family: "Pholcidae",
    rarity: "common", region: "Worldwide",
    hint: "Long thin legs vibrate the web when threatened.",
    silhouettePalette: ["#2a2a2a", "#e5e7eb"],
    aliases: ["cellar spider", "daddy long legs", "pholcidae", "pholcus"] },
  { slug: "long_bodied_cellar_spider", commonName: "Long-bodied Cellar Spider", scientificName: "Pholcus phalangioides", family: "Pholcidae",
    rarity: "common", region: "Worldwide",
    hint: "Often mistaken for a daddy long-legs.",
    silhouettePalette: ["#1a1a1a", "#d4d4d8"],
    aliases: ["pholcus phalangioides", "phalangioides", "long bodied cellar spider"] },
  { slug: "false_widow", commonName: "False Widow", scientificName: "Steatoda grossa", family: "Theridiidae",
    rarity: "uncommon", region: "Continent-wide",
    hint: "Shaped like a widow but harmless; basement haunter.",
    silhouettePalette: ["#1a1a1a", "#7c3aed"],
    aliases: ["false widow", "steatoda grossa", "cupboard spider"] },

  // --- Funnel / grass ---
  { slug: "grass_spider", commonName: "Grass Spider", scientificName: "Agelenopsis sp.", family: "Agelenidae",
    rarity: "common", region: "Continent-wide",
    hint: "Sheet web with a funnel retreat in the grass.",
    silhouettePalette: ["#0f1f0f", "#86a04a"],
    aliases: ["grass spider", "agelenopsis", "funnel weaver"] },
  { slug: "hobo_spider", commonName: "Hobo Spider", scientificName: "Eratigena agrestis", family: "Agelenidae",
    rarity: "uncommon", region: "Pacific Northwest",
    hint: "Fast funnel weaver — chevron pattern on abdomen.",
    silhouettePalette: ["#1a1a1a", "#a8a29e"],
    aliases: ["hobo spider", "eratigena agrestis", "tegenaria agrestis", "agrestis"] },

  // --- Fishing / nursery ---
  { slug: "dark_fishing_spider", commonName: "Dark Fishing Spider", scientificName: "Dolomedes tenebrosus", family: "Pisauridae",
    rarity: "uncommon", region: "Eastern US",
    hint: "Hangs out on tree trunks near water.",
    silhouettePalette: ["#0f1a14", "#475569"],
    aliases: ["dark fishing spider", "dolomedes tenebrosus", "tenebrosus", "fishing spider"] },
  { slug: "six_spotted_fishing_spider", commonName: "Six-spotted Fishing Spider", scientificName: "Dolomedes triton", family: "Pisauridae",
    rarity: "uncommon", region: "Continent-wide",
    hint: "Walks on water; ambushes from lily pads.",
    silhouettePalette: ["#0a1a2a", "#22d3ee"],
    aliases: ["six-spotted fishing spider", "dolomedes triton", "triton"] },
  { slug: "nursery_web_spider", commonName: "Nursery Web Spider", scientificName: "Pisaurina mira", family: "Pisauridae",
    rarity: "uncommon", region: "Eastern US",
    hint: "Wraps egg sacs in a leaf-tent nursery.",
    silhouettePalette: ["#1a1f0a", "#a3a430"],
    aliases: ["nursery web spider", "pisaurina mira"] },

  // --- Crab / lynx / sac ---
  { slug: "crab_spider", commonName: "Crab Spider", scientificName: "Thomisidae sp.", family: "Thomisidae",
    rarity: "common", region: "Continent-wide",
    hint: "Changes color to match the flower it ambushes from.",
    silhouettePalette: ["#fef3c7", "#fbbf24"],
    aliases: ["crab spider", "thomisidae", "flower spider"] },
  { slug: "goldenrod_crab_spider", commonName: "Goldenrod Crab Spider", scientificName: "Misumena vatia", family: "Thomisidae",
    rarity: "uncommon", region: "Continent-wide",
    hint: "Shifts white→yellow over days to match its flower.",
    silhouettePalette: ["#fff7e0", "#facc15"],
    aliases: ["goldenrod crab spider", "misumena vatia", "vatia"] },
  { slug: "green_lynx_spider", commonName: "Green Lynx Spider", scientificName: "Peucetia viridans", family: "Oxyopidae",
    rarity: "uncommon", region: "Southern US",
    hint: "Bright lime green; ambushes bees on flower heads.",
    silhouettePalette: ["#06371a", "#34d399"],
    aliases: ["green lynx spider", "peucetia viridans", "lynx spider"] },
  { slug: "yellow_sac_spider", commonName: "Yellow Sac Spider", scientificName: "Cheiracanthium inclusum", family: "Eutichuridae",
    rarity: "common", region: "Continent-wide",
    hint: "Pale wanderer found on ceilings at night.",
    silhouettePalette: ["#2a2410", "#facc15"],
    aliases: ["yellow sac spider", "cheiracanthium inclusum", "sac spider"] },

  // --- Tarantulas & trapdoors ---
  { slug: "desert_blonde_tarantula", commonName: "Desert Blonde Tarantula", scientificName: "Aphonopelma chalcodes", family: "Theraphosidae",
    rarity: "epic", region: "Southwestern US",
    hint: "Males march across desert roads on monsoon nights.",
    silhouettePalette: ["#3b2a14", "#d4a373"],
    aliases: ["desert blonde tarantula", "aphonopelma chalcodes", "chalcodes"] },
  { slug: "texas_brown_tarantula", commonName: "Texas Brown Tarantula", scientificName: "Aphonopelma hentzi", family: "Theraphosidae",
    rarity: "epic", region: "Central & Southern US",
    hint: "Largest spider you'll meet in Texas grasslands.",
    silhouettePalette: ["#1a0e06", "#7a4a2a"],
    aliases: ["texas brown tarantula", "aphonopelma hentzi", "hentzi", "tarantula"] },
  { slug: "trapdoor_spider", commonName: "Trapdoor Spider", scientificName: "Ummidia sp.", family: "Halonoproctidae",
    rarity: "rare", region: "Southern US",
    hint: "Hinged silk door into a silk-lined burrow.",
    silhouettePalette: ["#1a1a1a", "#525252"],
    aliases: ["trapdoor spider", "ummidia"] },

  // --- Misc / showcase ---
  { slug: "huntsman_spider", commonName: "Huntsman Spider", scientificName: "Heteropoda venatoria", family: "Sparassidae",
    rarity: "rare", region: "Southern US (introduced)",
    hint: "Flat and fast — sprints sideways like a crab.",
    silhouettePalette: ["#1a1a1a", "#a87b3f"],
    aliases: ["huntsman", "huntsman spider", "heteropoda venatoria"] },
  { slug: "spitting_spider", commonName: "Spitting Spider", scientificName: "Scytodes thoracica", family: "Scytodidae",
    rarity: "rare", region: "Continent-wide",
    hint: "Sticks prey to surfaces with a fast venom-glue spit.",
    silhouettePalette: ["#1a1a1a", "#facc15"],
    aliases: ["spitting spider", "scytodes thoracica", "scytodes"] },
  { slug: "woodlouse_hunter", commonName: "Woodlouse Hunter", scientificName: "Dysdera crocata", family: "Dysderidae",
    rarity: "uncommon", region: "Continent-wide",
    hint: "Orange-red with huge fangs — eats pill bugs.",
    silhouettePalette: ["#3a1a06", "#dc2626"],
    aliases: ["woodlouse hunter", "dysdera crocata", "sowbug killer"] },
];

export const TOTAL_DEX_SPECIES = SPECIES_DEX.length;

const SLUG_BY_ALIAS = (() => {
  const m = new Map<string, string>();
  for (const s of SPECIES_DEX) {
    m.set(s.commonName.toLowerCase(), s.slug);
    m.set(s.scientificName.toLowerCase(), s.slug);
    m.set(s.slug, s.slug);
    for (const a of s.aliases) m.set(a.toLowerCase(), s.slug);
  }
  return m;
})();

const SPECIES_BY_SLUG = new Map(SPECIES_DEX.map((s) => [s.slug, s]));

/** Normalize free-text species (strip parens, punctuation, lowercase). */
function normalize(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[,_/\\]+/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Best-effort match from a free-text species string to a canonical slug. */
export function matchSpeciesSlug(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const norm = normalize(raw);
  if (!norm) return null;

  // Exact alias match
  const direct = SLUG_BY_ALIAS.get(norm);
  if (direct) return direct;

  // Tokenized: try every alias against the input.
  for (const [alias, slug] of SLUG_BY_ALIAS.entries()) {
    if (alias.length < 5) continue; // skip very short aliases to avoid noise
    if (norm.includes(alias)) return slug;
  }
  return null;
}

export function getDexSpecies(slug: string): DexSpecies | undefined {
  return SPECIES_BY_SLUG.get(slug);
}