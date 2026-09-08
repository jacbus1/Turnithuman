export const MODEL_VERSION = 'mujian2026/multilingual-ai-text-detector@60be618-q4';
export const AI_THRESHOLD = 0.65;
export const HUMAN_THRESHOLD = 0.35;
export const MAX_MODEL_TOKENS = 384;
export const CONTEXT_TOKENS = 32;

export type Language = 'en' | 'zh' | 'mixed' | 'unknown';
export type SegmentLabel = 'likely-human' | 'uncertain' | 'likely-ai';

export interface PreparedSegment {
  id: string;
  text: string;
  modelText: string;
  tokenWeight: number;
  sourceLabel?: string;
}

export interface ScoredSegment extends PreparedSegment {
  aiProbability: number;
  label: SegmentLabel;
}

export interface AnalysisResult {
  language: Language;
  modelAiScore: number;
  estimatedAiShare: number;
  segments: ScoredSegment[];
  wordCount: number;
  characterCount: number;
  warnings: string[];
  modelVersion: string;
}

const CJK_PATTERN = /[\u3400-\u9fff\uf900-\ufaff]/g;

export function detectLanguage(text: string): Language {
  const cjk = text.match(CJK_PATTERN)?.length ?? 0;
  const latin = text.match(/[A-Za-z]/g)?.length ?? 0;
  if (cjk === 0 && latin === 0) return 'unknown';
  if (cjk > 0 && latin > 0 && Math.min(cjk, latin) / Math.max(cjk, latin) > 0.12) return 'mixed';
  return cjk > latin * 0.2 ? 'zh' : 'en';
}

export function countWords(text: string): number {
  return text.match(/[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}

export function estimateTokens(text: string): number {
  const cjk = text.match(CJK_PATTERN)?.length ?? 0;
  const nonCjkWords = text.replace(CJK_PATTERN, ' ').match(/[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu)?.length ?? 0;
  return Math.max(1, Math.ceil(cjk * 1.35 + nonCjkWords * 1.3));
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?。！？；;])\s*|\n+/u)
    .map((part) => part.trim())
    .filter(Boolean);
}

function hardSplit(text: string, maxTokens: number): string[] {
  const ratio = detectLanguage(text) === 'zh' ? 0.72 : 3.2;
  const maxChars = Math.max(120, Math.floor(maxTokens * ratio));
  const chunks: string[] = [];
  for (let cursor = 0; cursor < text.length; cursor += maxChars) {
    chunks.push(text.slice(cursor, cursor + maxChars).trim());
  }
  return chunks.filter(Boolean);
}

function chunkParagraph(paragraph: string): string[] {
  if (estimateTokens(paragraph) <= MAX_MODEL_TOKENS - CONTEXT_TOKENS) return [paragraph];
  const sentences = splitSentences(paragraph).flatMap((sentence) =>
    estimateTokens(sentence) > MAX_MODEL_TOKENS - CONTEXT_TOKENS
      ? hardSplit(sentence, MAX_MODEL_TOKENS - CONTEXT_TOKENS)
      : [sentence],
  );
  const result: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (current && estimateTokens(candidate) > MAX_MODEL_TOKENS - CONTEXT_TOKENS) {
      result.push(current);
      current = sentence;
    } else {
      current = candidate;
    }
  }
  if (current) result.push(current);
  return result;
}

function contextTail(text: string): string {
  const words = text.split(/\s+/u);
  if (detectLanguage(text) === 'zh') return text.slice(-Math.floor(CONTEXT_TOKENS * 0.72));
  return words.slice(-CONTEXT_TOKENS).join(' ');
}

export function prepareSegments(text: string): PreparedSegment[] {
  const normalized = text.replace(/\r\n?/g, '\n').replace(/[\t\u00a0]+/g, ' ').trim();
  if (!normalized) return [];
  const paragraphs = normalized.split(/\n{2,}/u).map((part) => part.trim()).filter(Boolean);
  const segments: PreparedSegment[] = [];
  let previous = '';
  for (const paragraph of paragraphs) {
    for (const chunk of chunkParagraph(paragraph)) {
      const context = previous ? contextTail(previous) : '';
      segments.push({
        id: `segment-${segments.length + 1}`,
        text: chunk,
        modelText: context ? `${context}\n${chunk}` : chunk,
        tokenWeight: estimateTokens(chunk),
      });
      previous = chunk;
    }
  }
  return segments;
}

export function labelProbability(aiProbability: number): SegmentLabel {
  if (aiProbability >= AI_THRESHOLD) return 'likely-ai';
  if (aiProbability >= HUMAN_THRESHOLD) return 'uncertain';
  return 'likely-human';
}

export function summarizeAnalysis(text: string, scored: Array<PreparedSegment & { aiProbability: number }>): AnalysisResult {
  const segments = scored.map((segment) => ({ ...segment, label: labelProbability(segment.aiProbability) }));
  const totalWeight = segments.reduce((sum, segment) => sum + segment.tokenWeight, 0) || 1;
  const modelAiScore = segments.reduce((sum, segment) => sum + segment.aiProbability * segment.tokenWeight, 0) / totalWeight;
  const aiWeight = segments.filter((segment) => segment.label === 'likely-ai').reduce((sum, segment) => sum + segment.tokenWeight, 0);
  const language = detectLanguage(text);
  const wordCount = countWords(text);
  const characterCount = text.replace(/\s/gu, '').length;
  const warnings: string[] = [];
  if ((language === 'en' && wordCount < 100) || ((language === 'zh' || language === 'mixed') && characterCount < 300)) {
    warnings.push('內容較短，模型結果的波動會更大，請勿單獨依賴此分數。');
  }
  if (language === 'zh' || language === 'mixed') warnings.push('中文與混合語言偵測仍屬實驗功能。');
  return {
    language,
    modelAiScore,
    estimatedAiShare: aiWeight / totalWeight,
    segments,
    wordCount,
    characterCount,
    warnings,
    modelVersion: MODEL_VERSION,
  };
}
