import { pipeline } from "@huggingface/transformers";

let classifierPromise: Promise<any> | null = null;

// Enhanced confidence thresholds inspired by Picture Insect's accuracy standards
const CONFIDENCE_THRESHOLDS = {
  VERY_HIGH: 0.85,
  HIGH: 0.7,
  MEDIUM: 0.5,
  LOW: 0.3
};

// Spider-specific keywords for result filtering
const SPIDER_KEYWORDS = [
  'spider', 'arachnid', 'tarantula', 'widow', 'recluse', 'funnel', 'wolf', 
  'jumping', 'orb', 'huntsman', 'crab', 'lynx', 'nursery', 'cobweb',
  'phoneutria', 'latrodectus', 'loxosceles', 'atrax', 'sicarius'
];

async function getClassifier() {
  if (!classifierPromise) {
    classifierPromise = pipeline(
      "image-classification",
      "onnx-community/mobilenetv4_conv_small.e2400_r224_in1k",
      { 
        device: "webgpu",
        // Fallback to WASM if WebGPU fails
        dtype: {
          encoder_model: "fp16",
          decoder_model_merged: "q4", 
        }
      }
    ).catch(async () => {
      console.log("WebGPU failed, falling back to WASM");
      return pipeline(
        "image-classification", 
        "onnx-community/mobilenetv4_conv_small.e2400_r224_in1k",
        { device: "wasm" }
      );
    });
  }
  return classifierPromise;
}

function resizeImage(base64: string, maxSize = 512): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      
      // Calculate new dimensions
      const ratio = Math.min(maxSize / img.width, maxSize / img.height);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      
      // Draw and resize
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.src = base64;
  });
}

// Enhanced spider-specific result filtering - STRICTLY spiders only
function filterSpiderResults(results: Array<{ label: string; score: number }>): Array<{ label: string; score: number }> {
  // Comprehensive list of non-spider terms to exclude
  const excludeKeywords = [
    'guitar', 'instrument', 'music', 'bird', 'mammal', 'reptile', 'fish', 'insect',
    'plant', 'flower', 'tree', 'furniture', 'tool', 'vehicle', 'food', 'building',
    'person', 'human', 'face', 'hand', 'dog', 'cat', 'car', 'house', 'beetle',
    'fly', 'ant', 'bee', 'wasp', 'butterfly', 'moth', 'cricket', 'grasshopper',
    'mosquito', 'dragonfly', 'cockroach', 'termite', 'ladybug', 'centipede',
    'millipede', 'scorpion', 'tick', 'mite', 'flea', 'louse'
  ];

  return results.filter(result => {
    const label = result.label.toLowerCase();
    
    // Must contain spider-related keywords - strict requirement
    const isSpiderRelated = SPIDER_KEYWORDS.some(keyword => 
      label.includes(keyword)
    );
    
    // Check for excluded terms
    const hasExcludedTerm = excludeKeywords.some(keyword => 
      label.includes(keyword)
    );
    
    // Only keep results that are explicitly spider-related and don't contain excluded terms
    return isSpiderRelated && !hasExcludedTerm;
  });
}

// Enhanced confidence scoring based on multiple factors
function calculateEnhancedConfidence(
  results: Array<{ label: string; score: number }>, 
  topResult: { label: string; score: number }
): {
  confidence: number;
  reliability: 'very_high' | 'high' | 'medium' | 'low';
  reason: string;
} {
  const { score } = topResult;
  const label = topResult.label.toLowerCase();
  
  // Base confidence from model
  let confidence = score;
  let reason = `Base model confidence: ${(score * 100).toFixed(1)}%`;
  
  // Boost confidence for spider-specific matches
  const isSpiderSpecific = SPIDER_KEYWORDS.some(keyword => label.includes(keyword));
  if (isSpiderSpecific) {
    confidence = Math.min(0.95, confidence * 1.2);
    reason += ' + Spider-specific keyword match';
  }
  
  // Boost confidence if there's a significant gap between top 2 results
  if (results.length > 1) {
    const gap = results[0].score - results[1].score;
    if (gap > 0.3) {
      confidence = Math.min(0.98, confidence * 1.1);
      reason += ' + Clear winner (large gap)';
    }
  }
  
  // Determine reliability level
  let reliability: 'very_high' | 'high' | 'medium' | 'low';
  if (confidence >= CONFIDENCE_THRESHOLDS.VERY_HIGH) {
    reliability = 'very_high';
  } else if (confidence >= CONFIDENCE_THRESHOLDS.HIGH) {
    reliability = 'high';
  } else if (confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) {
    reliability = 'medium';
  } else {
    reliability = 'low';
  }
  
  return { confidence, reliability, reason };
}

export async function classifyImage(image: string | Blob): Promise<{
  results: Array<{ label: string; score: number }>;
  topResult: { label: string; score: number };
  confidence: {
    confidence: number;
    reliability: 'very_high' | 'high' | 'medium' | 'low';
    reason: string;
  };
}> {
  try {
    let processedImage = image;
    
    // Resize if it's a base64 string to improve performance
    if (typeof image === 'string' && image.startsWith('data:')) {
      processedImage = await resizeImage(image);
    }
    
    const classifier = await getClassifier();
    const rawOutputs = await classifier(processedImage as any, { topk: 10 });
    
    // Filter for spider-related results
    const filteredResults = filterSpiderResults(rawOutputs);
    
    // Only return spider-related results
    const results = filteredResults.slice(0, 5);
    
    if (results.length === 0) {
      throw new Error('No spider species detected in this image. Please upload an image containing a spider.');
    }
    
    const topResult = results[0];
    const confidence = calculateEnhancedConfidence(results, topResult);
    
    return {
      results,
      topResult,
      confidence
    };
  } catch (error) {
    console.error('Enhanced image classification failed:', error);
    throw new Error(`Classification failed: ${error}`);
  }
}
