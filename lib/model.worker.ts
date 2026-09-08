/// <reference lib="webworker" />

import { env, pipeline } from '@huggingface/transformers';

import type { PreparedSegment } from './analysis';

const MODEL_ID = 'mujian2026/multilingual-ai-text-detector';

env.allowLocalModels = false;
env.useBrowserCache = true;

type PipelineOutput = Array<{ label: string; score: number }> | Array<Array<{ label: string; score: number }>>;
type Detector = (text: string, options: { top_k: null; truncation: boolean; max_length: number }) => Promise<PipelineOutput>;

let detectorPromise: Promise<Detector> | null = null;

function getDetector() {
  detectorPromise ??= pipeline('text-classification', MODEL_ID, {
    subfolder: 'q4',
    dtype: 'q4',
    device: 'wasm',
    progress_callback: (progress: { status?: string; progress?: number; file?: string }) => {
      self.postMessage({ type: 'progress', progress: Math.round(progress.progress ?? 0), file: progress.file ?? '' });
    },
  }) as Promise<Detector>;
  return detectorPromise;
}

function aiScore(output: PipelineOutput): number {
  const labels = Array.isArray(output[0]) ? output[0] as Array<{ label: string; score: number }> : output as Array<{ label: string; score: number }>;
  return labels.find((item) => item.label.toLocaleLowerCase() === 'ai')?.score ?? 0;
}

self.onmessage = async (event: MessageEvent<{ type: 'analyze'; segments: PreparedSegment[] }>) => {
  if (event.data.type !== 'analyze') return;
  try {
    const detector = await getDetector();
    self.postMessage({ type: 'ready' });
    const scored: Array<PreparedSegment & { aiProbability: number }> = [];
    for (const [index, segment] of event.data.segments.entries()) {
      const output = await detector(segment.modelText, { top_k: null, truncation: true, max_length: 384 });
      scored.push({ ...segment, aiProbability: aiScore(output as PipelineOutput) });
      self.postMessage({ type: 'segment', completed: index + 1, total: event.data.segments.length });
    }
    self.postMessage({ type: 'result', scored });
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : '模型無法載入。' });
  }
};

export {};
