'use client';

import { ChangeEvent, type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  FileCheck2,
  FileUp,
  GitFork,
  Info,
  Languages,
  Lightbulb,
  LoaderCircle,
  LockKeyhole,
  RotateCcw,
  ScanText,
  Sparkles,
  Trash2,
} from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress, ProgressLabel } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { buildWritingAdvice } from '@/lib/advice';
import { prepareSegments, type AnalysisResult, type SegmentLabel } from '@/lib/analysis';
import { parseFile } from '@/lib/parsers';
import { useDetector } from '@/lib/use-detector';

type UiLanguage = 'zh' | 'en';

const copy = {
  zh: {
    title: '看見文字裡的寫作訊號',
    intro: '貼上內容或匯入文件。分析只在你的瀏覽器內完成，不會上傳原文。',
    placeholder: '在這裡貼上英文或中文內容…',
    import: '匯入文件',
    analyze: '開始分析',
    clear: '清除',
    private: '本機處理',
    source: '開放原始碼',
    characters: '字元',
    words: '詞數',
    emptyTitle: '分析會顯示在這裡',
    emptyBody: '完成首次模型下載後，你會看到整體訊號、疑似 AI 文字占比和逐段結果。',
    score: '模型 AI 分數',
    share: '疑似 AI 占比',
    signals: '段落訊號',
    advice: '自然寫作建議',
    caveat: '請把百分比當成線索',
    caveatBody: '它不是 Turnitin 分數，也不能證明文字的作者身分。',
    recheck: '重新分析修改稿',
  },
  en: {
    title: 'See the writing signals in your text',
    intro: 'Paste writing or import a document. Analysis happens only in your browser; your text is never uploaded.',
    placeholder: 'Paste English or Chinese writing here…',
    import: 'Import file',
    analyze: 'Analyze writing',
    clear: 'Clear',
    private: 'Local only',
    source: 'Open source',
    characters: 'characters',
    words: 'words',
    emptyTitle: 'Your analysis will appear here',
    emptyBody: 'After the one-time model download, you will see document signals, estimated AI share, and paragraph-level results.',
    score: 'Model AI score',
    share: 'Estimated AI share',
    signals: 'Segment signals',
    advice: 'Writing advice',
    caveat: 'Treat the percentage as a signal',
    caveatBody: 'It is not a Turnitin score and cannot prove who wrote a text.',
    recheck: 'Analyze edited draft',
  },
} as const;

const labelCopy: Record<SegmentLabel, { zh: string; en: string }> = {
  'likely-human': { zh: '較像人類', en: 'Likely human' },
  uncertain: { zh: '不確定', en: 'Uncertain' },
  'likely-ai': { zh: '疑似 AI', en: 'Likely AI' },
};

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export default function Home() {
  const [uiLanguage, setUiLanguage] = useState<UiLanguage>('zh');
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileError, setFileError] = useState('');
  const [adviceVisible, setAdviceVisible] = useState(false);
  const [lastAnalyzedText, setLastAnalyzedText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const detector = useDetector();
  const { analyze } = detector;
  const t = copy[uiLanguage];
  const advice = useMemo(() => (adviceVisible && text.trim() ? buildWritingAdvice(text) : []), [adviceVisible, text]);
  const wordCount = useMemo(() => text.match(/[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu)?.length ?? 0, [text]);
  const characterCount = useMemo(() => text.replace(/\s/gu, '').length, [text]);

  const runAnalysis = useCallback(async (value: string): Promise<AnalysisResult> => {
    const prepared = prepareSegments(value);
    if (!prepared.length || value.trim().length < 20) throw new Error(uiLanguage === 'zh' ? '請輸入至少 20 個字元。' : 'Enter at least 20 characters.');
    if (value.length > 100_000) throw new Error(uiLanguage === 'zh' ? '文字上限為 100,000 字元。' : 'The text limit is 100,000 characters.');
    setFileError('');
    setAdviceVisible(true);
    const result = await analyze(value, prepared);
    setLastAnalyzedText(value);
    return result;
  }, [analyze, uiLanguage]);

  const handleAnalyze = async () => {
    try {
      await runAnalysis(text);
    } catch (error) {
      setFileError(error instanceof Error ? error.message : 'Unable to analyze this text.');
    }
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    detector.reset();
    setLastAnalyzedText('');
    setFileError('');
    setAdviceVisible(false);
    setLastAnalyzedText('');
    try {
      const parsed = await parseFile(file);
      setText(parsed.text);
      setFileName(`${parsed.name} · ${parsed.format.toUpperCase()}`);
    } catch (error) {
      setFileName('');
      setFileError(error instanceof Error ? error.message : '無法讀取文件。');
    }
  };

  const clearAll = () => {
    detector.reset();
    setText('');
    setFileName('');
    setFileError('');
    setAdviceVisible(false);
  };

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(context.registerTool({
        name: 'analyze_writing_signals',
        title: 'Analyze writing signals',
        description: 'Analyze supplied English or Chinese writing locally and show the same result in the visible Turnithuman workspace.',
        inputSchema: {
          type: 'object',
          properties: { text: { type: 'string', minLength: 20, maxLength: 100000 } },
          required: ['text'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        async execute(input) {
          const value = typeof input === 'object' && input !== null && 'text' in input ? (input as { text: unknown }).text : null;
          if (typeof value !== 'string' || value.trim().length < 20 || value.length > 100_000) throw new Error('Text must contain 20–100,000 characters.');
          setText(value);
          setFileName('WebMCP input');
          const result = await runAnalysis(value);
          return { modelAiScore: result.modelAiScore, estimatedAiShare: result.estimatedAiShare, language: result.language, warnings: result.warnings };
        },
      }, { signal: lifecycle.signal })).catch(() => undefined);
    } catch {
      // WebMCP is optional and still experimental in most browsers.
    }
    return () => lifecycle.abort();
  }, [runAnalysis]);

  const busy = detector.status === 'loading' || detector.status === 'analyzing';

  return (
    <main className="min-h-screen">
      <header className="border-b border-white/8 bg-[#081719]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-4 lg:px-9">
          <div className="flex items-center gap-3">
            <span className="brand-mark" aria-hidden="true"><ScanText /></span>
            <div><p className="font-heading text-lg font-semibold tracking-[-0.03em] text-white">Turnithuman</p><p className="text-xs text-[#8ba6a8]">Local writing signal lab</p></div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <Button variant="ghost" className="text-[#b8cccd] hover:bg-white/7 hover:text-white" onClick={() => setUiLanguage(uiLanguage === 'zh' ? 'en' : 'zh')} aria-label="Switch interface language"><Languages /> {uiLanguage === 'zh' ? 'EN' : '中文'}</Button>
            <a href="https://github.com/jacbus1/Turnithuman" target="_blank" rel="noreferrer" className="source-link"><GitFork /><span className="hidden sm:inline">{t.source}</span></a>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-[1440px] gap-6 px-5 py-7 lg:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.75fr)] lg:px-9 lg:py-9">
        <div className="workspace-panel">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#dce5e3] px-5 py-5 sm:px-7">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#597274]"><span className="status-dot" />Private by design</div>
              <h1 className="font-heading text-2xl font-semibold tracking-[-0.035em] text-[#0b2427] sm:text-3xl">{t.title}</h1>
              <p className="mt-2 max-w-2xl text-[15px] leading-6 text-[#5c7072]">{t.intro}</p>
            </div>
            <Badge className="border-[#cfe0dc] bg-[#f0f7f4] text-[#3d6668]"><LockKeyhole /> {t.private}</Badge>
          </div>

          <div className="p-5 sm:p-7">
            {fileName && <div className="mb-4 flex items-center gap-2 rounded-xl border border-[#d6e3df] bg-[#edf5f2] px-3 py-2 text-sm text-[#416467]"><FileCheck2 className="size-4" /><span className="truncate">{fileName}</span></div>}
            <Textarea value={text} onChange={(event) => setText(event.target.value)} disabled={busy} className="min-h-[360px] resize-y border-0 bg-transparent p-0 font-[var(--font-editor)] text-[17px] leading-8 text-[#183639] shadow-none placeholder:text-[#9aa9a8] focus-visible:ring-0 disabled:opacity-60" placeholder={t.placeholder} aria-label="Text to analyze" spellCheck />

            {(fileError || detector.error) && <Alert variant="destructive" className="mt-4 border-[#efc5c1] bg-[#fff2f0]"><AlertTriangle /><AlertTitle>{uiLanguage === 'zh' ? '目前無法繼續' : 'Unable to continue'}</AlertTitle><AlertDescription>{fileError || detector.error}</AlertDescription></Alert>}

            {busy && <div className="mt-5 rounded-xl border border-[#d8e5e1] bg-[#eff6f3] p-4"><Progress value={detector.progress} className="grid grid-cols-[1fr_auto] text-[#34595c]"><ProgressLabel className="truncate pr-3">{detector.progressLabel}</ProgressLabel><span className="text-sm tabular-nums text-[#597274]">{detector.progress}%</span></Progress><p className="mt-2 text-xs leading-5 text-[#708486]">{detector.status === 'loading' ? (uiLanguage === 'zh' ? '首次使用需下載約 198 MB；完成後瀏覽器會快取模型。' : 'First use downloads about 198 MB; your browser caches it afterward.') : (uiLanguage === 'zh' ? '分析在背景執行，頁面仍可正常操作。' : 'Analysis runs in the background so the page remains responsive.')}</p></div>}

            <div className="mt-5 flex flex-col justify-between gap-4 border-t border-[#dce5e3] pt-5 sm:flex-row sm:items-center">
              <div className="flex flex-wrap items-center gap-2">
                <input ref={inputRef} type="file" className="sr-only" accept=".txt,.md,.docx,.pdf,.pptx,text/plain,text/markdown,application/pdf" onChange={handleFile} />
                <Button variant="outline" className="h-10 border-[#cad9d6] bg-white text-[#26494c] hover:bg-[#eef6f3]" onClick={() => inputRef.current?.click()} disabled={busy}><FileUp /> {t.import}</Button>
                {text && <Button variant="ghost" className="h-10 text-[#667d7f] hover:bg-[#eef4f2] hover:text-[#25484b]" onClick={clearAll} disabled={busy}><Trash2 /> {t.clear}</Button>}
                <span className="hidden text-xs text-[#718486] xl:inline">TXT · MD · DOCX · PDF · PPTX</span>
              </div>
              <Button className="h-11 bg-[#d3ff78] px-5 font-semibold text-[#173033] shadow-[0_8px_24px_rgba(108,150,43,.2)] hover:bg-[#c4f066]" onClick={handleAnalyze} disabled={busy || !text.trim()}>{busy ? <LoaderCircle className="animate-spin" /> : detector.result ? <RotateCcw /> : <Sparkles />}{detector.result ? t.recheck : t.analyze}</Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-[#7a8c8e]"><span>{characterCount.toLocaleString()} {t.characters}</span><span>{wordCount.toLocaleString()} {t.words}</span>{detector.result && text !== lastAnalyzedText ? <span className="font-semibold text-[#9a6a22]">{uiLanguage === 'zh' ? '修改尚未分析' : 'Edits not analyzed yet'}</span> : null}<span className="ml-auto">20 MB max</span></div>
          </div>
        </div>

        <aside className="insight-panel" aria-live="polite">
          {!detector.result ? <EmptyAnalysis t={t} /> : <AnalysisPanel result={detector.result} advice={advice} uiLanguage={uiLanguage} t={t} />}
        </aside>
      </section>

      <footer className="mx-auto flex max-w-[1440px] flex-col gap-2 px-5 pb-8 text-xs leading-5 text-[#769092] sm:flex-row sm:items-center sm:justify-between lg:px-9">
        <p>Not affiliated with or endorsed by Turnitin. · MIT License</p>
        <p>{uiLanguage === 'zh' ? '結果僅供寫作反思，不應用於紀律或評分決策。' : 'For writing reflection only — not disciplinary or grading decisions.'}</p>
      </footer>
    </main>
  );
}

function EmptyAnalysis({ t }: { t: typeof copy.zh | typeof copy.en }) {
  return <><div className="border-b border-white/10 p-6"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#78989a]">Analysis</p><h2 className="mt-2 font-heading text-xl font-semibold tracking-[-0.03em] text-white">{t.emptyTitle}</h2><p className="mt-2 text-sm leading-6 text-[#91aaac]">{t.emptyBody}</p></div><div className="grid gap-3 p-6"><div className="empty-stat"><span>{t.score}</span><strong>—</strong></div><div className="empty-stat"><span>{t.share}</span><strong>—</strong></div><div className="caveat-card"><Info /><div><span>{t.caveat}</span><p>{t.caveatBody}</p></div></div></div></>;
}

function AnalysisPanel({ result, advice, uiLanguage, t }: { result: AnalysisResult; advice: ReturnType<typeof buildWritingAdvice>; uiLanguage: UiLanguage; t: typeof copy.zh | typeof copy.en }) {
  const languageLabel = result.language === 'zh' || result.language === 'mixed' ? (uiLanguage === 'zh' ? '中文 · 實驗性' : 'Chinese · experimental') : 'English';
  return <Tabs defaultValue="overview" className="gap-0"><div className="border-b border-white/10 p-5 pb-0"><div className="flex items-start justify-between gap-3 pb-4"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#78989a]">Analysis complete</p><p className="mt-1 text-sm text-[#a5babb]">{result.segments.length} segments</p></div><div className="flex items-center gap-2"><Badge className="result-language">{languageLabel}</Badge><CheckCircle2 className="size-5 text-[#d3ff78]" /></div></div><TabsList variant="line" className="h-9 text-[#90aaac]"><TabsTrigger value="overview" className="px-3 text-[#90aaac] data-active:text-white">{t.signals}</TabsTrigger><TabsTrigger value="advice" className="px-3 text-[#90aaac] data-active:text-white">{t.advice}</TabsTrigger></TabsList></div>
    <TabsContent value="overview" className="p-5">
      <div className="score-grid"><ScoreRing value={result.modelAiScore} label={t.score} /><ScoreRing value={result.estimatedAiShare} label={t.share} /></div>
      {result.warnings.map((warning) => <div key={warning} className="warning-row"><AlertTriangle />{warning}</div>)}
      <div className="risk-legend" aria-label={uiLanguage === 'zh' ? '風險分類門檻' : 'Risk thresholds'}><span className="risk-key" style={{ '--risk-color': '#6ec7a0' } as CSSProperties}>&lt; 35% {labelCopy['likely-human'][uiLanguage]}</span><span className="risk-key" style={{ '--risk-color': '#e6bd66' } as CSSProperties}>35–65% {labelCopy.uncertain[uiLanguage]}</span><span className="risk-key" style={{ '--risk-color': '#ef8d7e' } as CSSProperties}>≥ 65% {labelCopy['likely-ai'][uiLanguage]}</span></div>
      <div className="mt-5 space-y-3">{result.segments.map((segment, index) => <article key={segment.id} className={`segment-card segment-${segment.label}`}><div className="mb-2 flex items-center justify-between gap-3"><Badge className="segment-badge">{labelCopy[segment.label][uiLanguage]}</Badge><span className="text-xs tabular-nums text-[#7f989a]">#{index + 1} · {percent(segment.aiProbability)}</span></div><p>{segment.text}</p></article>)}</div>
      <div className="caveat-card mt-5"><Info /><div><span>{t.caveat}</span><p>{t.caveatBody}</p><p className="mt-2 break-all text-[10px] text-[#78989a]">{result.modelVersion}</p></div></div>
    </TabsContent>
    <TabsContent value="advice" className="p-5"><p className="mb-4 text-sm leading-6 text-[#9db2b3]">{uiLanguage === 'zh' ? '以下建議只改善清晰度與個人表達，不會自動改寫，也不保證改變偵測結果。' : 'These suggestions improve clarity and personal expression. They do not rewrite text or promise a different detector result.'}</p><div className="space-y-3">{advice.map((item) => <article key={item.id} className="advice-card"><Lightbulb /><div><div className="flex items-center gap-2"><h3>{item.title}</h3>{item.count ? <Badge className="bg-[#23484a] text-[#c7dad8]">{item.count}</Badge> : null}</div><p>{item.detail}</p></div><ChevronRight /></article>)}</div></TabsContent>
  </Tabs>;
}

function ScoreRing({ value, label }: { value: number; label: string }) {
  const degrees = Math.round(value * 360);
  return <div className="score-card"><div className="score-ring" style={{ background: `conic-gradient(#d3ff78 ${degrees}deg, #244347 ${degrees}deg)` }}><div>{percent(value)}</div></div><span>{label}</span></div>;
}
