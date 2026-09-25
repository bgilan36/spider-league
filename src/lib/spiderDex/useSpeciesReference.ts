import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SpeciesReference {
  slug: string;
  common_name: string;
  scientific_name: string;
  family: string;
  habitat: string;
  us_range: string;
  size_min_mm: number;
  size_max_mm: number;
  danger: string;
  diagnostic_features: string;
  image_url: string | null;
  image_credit: string | null;
  wikipedia_url: string | null;
  summary: string | null;
}

/** Loads the whole reference species library once (≈130 rows) and caches it. */
export function useSpeciesLibrary() {
  return useQuery({
    queryKey: ["spider_species_library"],
    staleTime: 1000 * 60 * 60,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("spider_species")
        .select("slug,common_name,scientific_name,family,habitat,us_range,size_min_mm,size_max_mm,danger,diagnostic_features,image_url,image_credit,wikipedia_url,summary")
        .order("common_name");
      if (error) throw error;
      return (data ?? []) as SpeciesReference[];
    },
  });
}

/** Resolve free text like "Latrodectus mactans (Southern Black Widow)" to a reference row. */
export function findReference(lib: SpeciesReference[] | undefined, text?: string | null) {
  if (!lib || !text) return undefined;
  const t = text.toLowerCase();
  const sci = t.split("(")[0].trim();
  const inner = t.match(/\((.*?)\)/)?.[1]?.trim();
  return (
    lib.find((r) => r.scientific_name.toLowerCase() === sci) ||
    lib.find((r) => r.slug === t || r.common_name.toLowerCase() === (inner ?? t)) ||
    lib.find((r) => r.common_name.toLowerCase() === t)
  );
}
