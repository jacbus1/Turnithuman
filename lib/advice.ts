import { detectLanguage } from './analysis';

export interface WritingAdvice {
  id: string;
  title: string;
  detail: string;
  count?: number;
}

const FORMULAIC_EN = ['in conclusion', 'it is important to note', 'moreover', 'furthermore', 'in today\'s world', 'delve into'];
const FORMULAIC_ZH = ['綜上所述', '值得注意的是', '不可否認的是', '在當今社會', '由此可見', '此外'];

export function buildWritingAdvice(text: string): WritingAdvice[] {
  const advice: WritingAdvice[] = [];
  const language = detectLanguage(text);
  const sentences = text.split(/(?<=[.!?。！？])\s*/u).map((item) => item.trim()).filter(Boolean);
  const lengths = sentences.map((sentence) => sentence.replace(/\s/gu, '').length);
  if (lengths.length >= 4) {
    const mean = lengths.reduce((sum, value) => sum + value, 0) / lengths.length;
    const variance = lengths.reduce((sum, value) => sum + (value - mean) ** 2, 0) / lengths.length;
    if (Math.sqrt(variance) / Math.max(mean, 1) < 0.22) {
      advice.push({ id: 'rhythm', title: '句子節奏較一致', detail: '可依內容重要性自然調整句長；讓重點句更直接，解釋句保留必要細節。' });
    }
  }

  const starters = sentences.map((sentence) => sentence.toLocaleLowerCase().split(/[\s，,]/u).slice(0, 3).join(' '));
  const starterCounts = new Map<string, number>();
  starters.filter((item) => item.length > 2).forEach((item) => starterCounts.set(item, (starterCounts.get(item) ?? 0) + 1));
  const repeatedStarters = [...starterCounts.values()].filter((count) => count >= 3).reduce((sum, count) => sum + count, 0);
  if (repeatedStarters) advice.push({ id: 'openers', title: '部分句子以相似方式開始', detail: '檢查段落間的邏輯關係，刪除不必要的連接語，或直接從具體主體開始。', count: repeatedStarters });

  const normalized = text.toLocaleLowerCase();
  const formulaic = (language === 'zh' ? FORMULAIC_ZH : [...FORMULAIC_EN, ...FORMULAIC_ZH]).filter((phrase) => normalized.includes(phrase.toLocaleLowerCase()));
  if (formulaic.length) advice.push({ id: 'formulaic', title: '找到模板式措辭', detail: `檢查「${formulaic.slice(0, 3).join('」、「')}」是否真的提供資訊；若沒有，可刪除或換成具體論點。`, count: formulaic.length });

  const concreteSignals = text.match(/\d|例如|比如|for example|according to|研究|資料|案例/giu)?.length ?? 0;
  if (text.length > 600 && concreteSignals < 2) advice.push({ id: 'specificity', title: '可以加入更具體的依據', detail: '考慮補上親身觀察、例子、數據或可查證來源，並確認引用格式。' });

  const paragraphs = text.split(/\n{2,}/u).filter((item) => item.trim());
  if (paragraphs.some((paragraph) => paragraph.length > (language === 'zh' ? 600 : 1200))) {
    advice.push({ id: 'paragraphs', title: '有段落承載太多內容', detail: '每段保留一個中心意思；轉換論點、證據或時間線時另起一段。' });
  }

  if (!advice.length) advice.push({ id: 'clean', title: '結構與節奏暫未出現明顯問題', detail: '最後再核對事實、引用與是否保留了你自己的判斷。' });
  return advice;
}
