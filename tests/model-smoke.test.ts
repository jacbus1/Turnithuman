import { describe, expect, it } from 'vitest';

describe('real q4 model smoke test', () => {
  it('loads and classifies short English and Chinese samples', async () => {
    const { env, pipeline } = await import('@huggingface/transformers');
    env.allowLocalModels = false;
    // Vitest runs in Node, where Cache Storage is unavailable. The production
    // worker enables browser caching; this smoke test validates model loading
    // and inference using Transformers.js's Node download cache instead.
    env.useBrowserCache = false;
    env.remotePathTemplate = '{model}/resolve/{revision}/q4/';
    const detector = await pipeline('text-classification', 'mujian2026/multilingual-ai-text-detector', {
      dtype: 'q4',
    });
    const results = await Promise.all([
      detector('I reviewed my notes and corrected two claims after checking the source.'),
      detector('我回到原始訪談錄音，核對了兩個日期與受訪者的語氣。'),
    ]);
    expect(results).toHaveLength(2);
    for (const result of results) expect(result).toBeTruthy();
  }, 300_000);
});
