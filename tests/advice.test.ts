import { describe, expect, it } from 'vitest';

import { buildWritingAdvice } from '../lib/advice';

describe('writing advice', () => {
  it('flags formulaic wording and low specificity', () => {
    const text = `In today's world, technology affects many people. Moreover, technology creates change. Furthermore, technology can be useful. In conclusion, technology is important. ${'General discussion continues without evidence. '.repeat(15)}`;
    const ids = buildWritingAdvice(text).map((item) => item.id);
    expect(ids).toContain('formulaic');
    expect(ids).toContain('specificity');
  });

  it('finds Chinese template phrases', () => {
    expect(buildWritingAdvice('在當今社會，科技快速發展。值得注意的是，影響十分廣泛。綜上所述，我們應該重視。').map((item) => item.id)).toContain('formulaic');
  });

  it('returns a useful clean-state message', () => {
    const advice = buildWritingAdvice('I observed three different outcomes in the 2024 trial. The first case improved, while the second remained unchanged.');
    expect(advice.length).toBeGreaterThan(0);
  });
});
