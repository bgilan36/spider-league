import { pipeline } from "@huggingface/transformers";

let classifierPromise: Promise<any> | null = null;

async function getClassifier() {
  if (!classifierPromise) {
    classifierPromise = pipeline(
      "image-classification",
      "onnx-community/mobilenetv4_conv_small.e2400_r224_in1k",
      { device: "webgpu" }
    );
  }
  return classifierPromise;
}

export async function classifyImage(image: string | Blob) {
  const classifier = await getClassifier();
  const outputs = await classifier(image as any, { topk: 5 });
  return outputs as Array<{ label: string; score: number }>;
}
