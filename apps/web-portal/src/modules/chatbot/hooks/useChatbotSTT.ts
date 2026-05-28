'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Speech-to-Text qua Web Speech API (browser native, không cần backend STT).
 * Hỗ trợ tốt nhất trên Chrome/Edge desktop & Android Chrome. Safari/Firefox hỗ trợ kém.
 *
 *   const { supported, recording, start, stop } = useChatbotSTT({
 *     lang: 'vi-VN',
 *     onResult: (text, isFinal) => { ... },
 *   });
 */

// Web Speech API chưa có trong @types/dom mặc định — khai báo tối giản tự đặt.
interface SpeechRecognitionEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
  resultIndex: number;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface UseChatbotSTTArgs {
  /** BCP-47 language tag — mặc định 'vi-VN'. */
  lang?: string;
  /** Gọi mỗi lần có transcript mới (interim + final). */
  onResult?: (text: string, isFinal: boolean) => void;
  /** Gọi khi user nói xong (transcript cuối). */
  onFinal?: (text: string) => void;
}

export function useChatbotSTT({
  lang = 'vi-VN',
  onResult,
  onFinal,
}: UseChatbotSTTArgs = {}) {
  const [supported, setSupported] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  // Stash callbacks vào ref để recognition lifecycle không re-bind mỗi render
  const onResultRef = useRef(onResult);
  const onFinalRef  = useRef(onFinal);
  useEffect(() => { onResultRef.current = onResult; }, [onResult]);
  useEffect(() => { onFinalRef.current  = onFinal;  }, [onFinal]);

  useEffect(() => {
    setSupported(getRecognitionCtor() !== null);
  }, []);

  // Cleanup khi unmount
  useEffect(() => () => { recRef.current?.abort(); }, []);

  const start = useCallback(() => {
    setError(null);
    if (recRef.current) {
      // đang chạy → ignore
      return;
    }
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setError('Trình duyệt không hỗ trợ Speech Recognition.');
      return;
    }
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = false;     // 1 lần nói rồi dừng (mode phổ biến)
    rec.interimResults = true;  // emit cả transcript tạm thời

    rec.onresult = (event) => {
      let finalText = '';
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (!r) continue;
        const seg = r[0]?.transcript ?? '';
        if (r.isFinal) finalText += seg;
        else           interim   += seg;
      }
      const text = (finalText || interim).trim();
      const isFinal = Boolean(finalText);
      if (text) onResultRef.current?.(text, isFinal);
      if (isFinal) onFinalRef.current?.(finalText.trim());
    };

    rec.onerror = (e) => {
      setError(e.error || 'speech-recognition-error');
      setRecording(false);
      recRef.current = null;
    };

    rec.onend = () => {
      setRecording(false);
      recRef.current = null;
    };

    try {
      rec.start();
      recRef.current = rec;
      setRecording(true);
    } catch (e: unknown) {
      setError((e as Error).message);
    }
  }, [lang]);

  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  const abort = useCallback(() => {
    recRef.current?.abort();
    recRef.current = null;
    setRecording(false);
  }, []);

  return { supported, recording, error, start, stop, abort };
}
