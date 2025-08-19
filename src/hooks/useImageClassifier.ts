import { pipeline } from "@huggingface/transformers";

let classifierPromise: Promise<any> | null = null;

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

export async function classifyImage(image: string | Blob) {
  try {
    let processedImage = image;
    
    // Resize if it's a base64 string to improve performance
    if (typeof image === 'string' && image.startsWith('data:')) {
      processedImage = await resizeImage(image);
    }
    
    const classifier = await getClassifier();
    const outputs = await classifier(processedImage as any, { topk: 5 });
    return outputs as Array<{ label: string; score: number }>;
  } catch (error) {
    console.error('Image classification failed:', error);
    throw new Error(`Classification failed: ${error}`);
  }
}
