type ClassifierConfidence = {
  confidence: number;
  reliability: "very_high" | "high" | "medium" | "low";
  reason: string;
};

type ClassifierResult = {
  label: string;
  score: number;
};

export async function classifyImage(_image: string | Blob): Promise<{
  results: ClassifierResult[];
  topResult: ClassifierResult;
  confidence: ClassifierConfidence;
}> {
  // Lightweight browser fallback used only when server-side identification fails.
  const topResult = { label: "unverified spider", score: 0.45 };

  return {
    results: [topResult],
    topResult,
    confidence: {
      confidence: 0.45,
      reliability: "low",
      reason: "Server identification unavailable. Using low-confidence local fallback.",
    },
  };
}
