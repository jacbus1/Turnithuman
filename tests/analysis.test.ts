import { describe, expect, it } from 'vitest';

import {
  detectLanguage,
  estimateTokens,
  labelProbability,
  prepareSegments,
  summarizeAnalysis,
} from '../lib/analysis';

describe('language and segmentation', () => {
  it('detects English, Chinese, mixed, and unknown text', () => {
    expect(detectLanguage('A clear English sentence.')).toBe('en');
    expect(detectLanguage('這是一段完整的中文文字。')).toBe('zh');
    expect(detectLanguage('This paragraph 同時包含英文和中文內容。')).toBe('mixed');
    expect(detectLanguage('1234 !!!')).toBe('unknown');
  });

  it('splits long prose and keeps each model window bounded', () => {
    const longText = Array.from({ length: 120 }, (_, index) => `Sentence ${index} explains one concrete point in a longer discussion.`).join(' ');
    const segments = prepareSegments(longText);
    expect(segments.length).toBeGreaterThan(1);
    expect(segments.every((segment) => estimateTokens(segment.modelText) <= 420)).toBe(true);
    expect(segments.slice(1).every((segment) => segment.modelText.length > segment.text.length)).toBe(true);
  });

  it('preserves paragraph boundaries for short content', () => {
    expect(prepareSegments('First paragraph.\n\nSecond paragraph.').map((segment) => segment.text)).toEqual(['First paragraph.', 'Second paragraph.']);
    expect(prepareSegments('   ')).toEqual([]);
  });
});

describe('scoring', () => {
  it('applies the documented probability boundaries', () => {
    expect(labelProbability(0.349)).toBe('likely-human');
    expect(labelProbability(0.35)).toBe('uncertain');
    expect(labelProbability(0.649)).toBe('uncertain');
    expect(labelProbability(0.65)).toBe('likely-ai');
  });

  it('weights the model score and flagged share by core tokens', () => {
    const source = 'A human paragraph.\n\nAn AI-like paragraph.';
    const prepared = prepareSegments(source);
    prepared[0].tokenWeight = 25;
    prepared[1].tokenWeight = 75;
    const result = summarizeAnalysis(source, [
      { ...prepared[0], aiProbability: 0.2 },
      { ...prepared[1], aiProbability: 0.8 },
    ]);
    expect(result.modelAiScore).toBeCloseTo(0.65);
    expect(result.estimatedAiShare).toBeCloseTo(0.75);
    expect(result.warnings).toContain('內容較短，模型結果的波動會更大，請勿單獨依賴此分數。');
  });

  it('marks Chinese output experimental', () => {
    const text = '這是一段很短的中文測試內容。';
    const segment = prepareSegments(text)[0];
    const result = summarizeAnalysis(text, [{ ...segment, aiProbability: 0.5 }]);
    expect(result.language).toBe('zh');
    expect(result.warnings).toContain('中文與混合語言偵測仍屬實驗功能。');
  });
});
