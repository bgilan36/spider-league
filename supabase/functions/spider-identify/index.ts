import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { HfInference } from "https://esm.sh/@huggingface/inference@2.3.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function toUint8ArrayFromBase64(base64: string): Uint8Array {
  const cleaned = base64.includes(",") ? base64.split(",")[1] : base64;
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function titleCase(str: string) {
  return str
    .replace(/[_-]+/g, " ")
    .split(" ")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

function generateNickname(species: string) {
  const adjectives = [
    "Shadow",
    "Crimson",
    "Iron",
    "Silk",
    "Night",
    "Ember",
    "Storm",
    "Ghost",
    "Venom",
    "Glimmer",
  ];
  const nouns = [
    "Weaver",
    "Stalker",
    "Spinner",
    "Fang",
    "Crawler",
    "Prowler",
    "Skitter",
    "Bite",
    "Warden",
    "Hunter",
  ];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const base = `${adj}${noun}`;
  // Include hint of species for flavor
  const hint = species.split(" ")[0];
  return `${base} ${hint}`.trim();
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { image, topK = 5 } = await req.json();

    if (!image || typeof image !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing 'image' (base64 string) in body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const token = Deno.env.get("HUGGING_FACE_ACCESS_TOKEN");
    if (!token) {
      console.error("Missing HUGGING_FACE_ACCESS_TOKEN secret");
      return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const hf = new HfInference(token);

    const bytes = toUint8ArrayFromBase64(image);
    const blob = new Blob([bytes]);

    // Use a reliable general-purpose classifier
    const results = await hf.imageClassification({
      model: "microsoft/resnet-50",
      data: blob as unknown as File, // API accepts Blob/File
    });

    const sorted = (Array.isArray(results) ? results : [])
      .sort((a: any, b: any) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, Math.max(1, Math.min(10, Number(topK) || 5)));

    const speciesRaw = sorted[0]?.label || "Unknown";
    const species = titleCase(speciesRaw);
    const nickname = generateNickname(species);

    const payload = {
      species,
      nickname,
      candidates: sorted.map((r: any) => ({ label: titleCase(r.label), score: r.score })),
    };

    console.log("spider-identify result:", payload);

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in spider-identify:", error);
    return new Response(
      JSON.stringify({ error: "Unexpected error", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
