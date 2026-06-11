// Lazily generates + uploads a share-card PNG for a spider or battle,
// caches the URL on the DB row, and returns the canonical share URL
// (an edge-function URL that emits Open Graph tags for link unfurls).

import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

export type ShareKind = "spider" | "battle";

export function buildShareUrl(kind: ShareKind, id: string): string {
  // Public crawler-friendly URL with OG tags. Browsers get redirected to the
  // SPA route by the edge function.
  return `${SUPABASE_URL}/functions/v1/og-card?type=${kind}&id=${id}`;
}

async function uploadCard(
  kind: ShareKind,
  id: string,
  ownerId: string,
  blob: Blob,
): Promise<string | null> {
  const path = `${ownerId}/share-cards/${kind}-${id}.png`;
  const { error } = await supabase.storage
    .from("spiders")
    .upload(path, blob, {
      cacheControl: "31536000",
      contentType: "image/png",
      upsert: true,
    });
  if (error) {
    console.warn("share-card upload failed", error);
    return null;
  }
  const { data } = supabase.storage.from("spiders").getPublicUrl(path);
  return data.publicUrl ?? null;
}

/**
 * Ensures a share image exists for the given resource. If not, it generates
 * one client-side and uploads it. Returns the canonical share URL whether or
 * not the card upload succeeded.
 */
export async function ensureShareCard(opts: {
  kind: ShareKind;
  id: string;
  existingImageUrl?: string | null;
  generate: () => Promise<Blob | null>;
}): Promise<{ shareUrl: string; imageUrl: string | null }> {
  const shareUrl = buildShareUrl(opts.kind, opts.id);

  if (opts.existingImageUrl) {
    return { shareUrl, imageUrl: opts.existingImageUrl };
  }

  try {
    const { data: userData } = await supabase.auth.getUser();
    const ownerId = userData?.user?.id;
    if (!ownerId) return { shareUrl, imageUrl: null };

    const blob = await opts.generate();
    if (!blob) return { shareUrl, imageUrl: null };

    const publicUrl = await uploadCard(opts.kind, opts.id, ownerId, blob);
    if (!publicUrl) return { shareUrl, imageUrl: null };

    const table = opts.kind === "spider" ? "spiders" : "battles";
    await supabase
      .from(table)
      .update({ share_image_url: publicUrl })
      .eq("id", opts.id);

    return { shareUrl, imageUrl: publicUrl };
  } catch (e) {
    console.warn("ensureShareCard failed", e);
    return { shareUrl, imageUrl: null };
  }
}