'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { AnalysisResult, PreparedSegment } from './analysis';
import { summarizeAnalysis } from './analysis';

export type DetectorStatus = 'idle' | 'loading' | 'analyzing' | 'complete' | 'error';

export function useDetector() {
  const workerRef = useRef<Worker | null>(null);
  const textRef = useRef('');
  const [status, setStatus] = useState<DetectorStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => () => workerRef.current?.terminate(), []);

  const analyze = useCallback((text: string, segments: PreparedSegment[]): Promise<AnalysisResult> => new Promise((resolve, reject) => {
    workerRef.current?.terminate();
    textRef.current = text;
    setResult(null);
    setError('');
    setProgress(0);
    setProgressLabel('正在準備本機模型…');
    setStatus('loading');
    if (window.__TURNITHUMAN_TEST_MODEL__) {
      setProgress(100);
      setProgressLabel('測試模型已就緒');
      setStatus('analyzing');
      window.setTimeout(() => {
        const scored = segments.map((segment, index) => ({ ...segment, aiProbability: index % 2 === 0 ? 0.82 : 0.48 }));
        const analysis = summarizeAnalysis(text, scored);
        setResult(analysis);
        setStatus('complete');
        setProgressLabel('分析完成');
        resolve(analysis);
      }, 40);
      return;
    }
    const worker = new Worker(new URL('./model.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    worker.onmessage = (event) => {
      const data = event.data;
      if (data.type === 'progress') {
        setProgress(Math.max(0, Math.min(100, data.progress ?? 0)));
        setProgressLabel(data.file ? `首次下載模型：${data.file}` : '正在準備本機模型…');
      } else if (data.type === 'ready') {
        setStatus('analyzing');
        setProgress(0);
        setProgressLabel('模型已就緒，正在分析段落…');
      } else if (data.type === 'segment') {
        setProgress(Math.round((data.completed / data.total) * 100));
        setProgressLabel(`正在分析第 ${data.completed} / ${data.total} 段`);
      } else if (data.type === 'result') {
        const analysis = summarizeAnalysis(textRef.current, data.scored);
        setResult(analysis);
        setStatus('complete');
        setProgress(100);
        setProgressLabel('分析完成');
        resolve(analysis);
      } else if (data.type === 'error') {
        const message = navigator.onLine ? `分析失敗：${data.message}` : '目前離線，而且模型尚未快取。請連線後再試一次。';
        setError(message);
        setStatus('error');
        reject(new Error(message));
      }
    };
    worker.onerror = () => {
      setError('模型工作程序發生錯誤，請重新整理後再試。');
      setStatus('error');
      reject(new Error('模型工作程序發生錯誤，請重新整理後再試。'));
    };
    worker.postMessage({ type: 'analyze', segments });
  }), []);

  const reset = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    setStatus('idle');
    setProgress(0);
    setProgressLabel('');
    setResult(null);
    setError('');
  }, []);

  return { analyze, reset, status, progress, progressLabel, result, error };
}
