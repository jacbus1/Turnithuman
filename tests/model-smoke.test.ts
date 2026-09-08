import { describe, expect, it } from 'vitest';

const enabled = process.env.REAL_MODEL_TEST === '1';

describe.skipIf(!enabled)('real q4 model smoke test', () => {
  it('loads and classifies short English and Chinese samples', async () => {
    const { env, pipeline } = await import('@huggingface/transformers');
    env.allowLocalModels = false;
    env.useBrowserCache = true;
    const detector = await pipeline('text-classification', 'mujian2026/multilingual-ai-text-detector', {
      subfolder: 'q4',
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
