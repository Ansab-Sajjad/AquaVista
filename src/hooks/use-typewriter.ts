"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const TYPING_SPEED_MS = 12;
const CHARS_PER_TICK = 2;

type QueueItem = { id: string; content: string };

/**
 * Streams text content character-by-character to produce a typewriter effect.
 *
 * The hook maintains an internal queue so multiple messages (e.g. a narrative
 * answer followed by a table/chart caption) animate sequentially rather than
 * all at once. Callers enqueue messages via `enqueue` and read back the
 * partial content via `getDisplayedContent`. A message is considered "done"
 * once `isTyping(id)` returns false AND it has been enqueued before.
 */
export function useTypewriter() {
  const [typingIds, setTypingIds] = useState<Set<string>>(new Set());
  const [queuedIds, setQueuedIds] = useState<Set<string>>(new Set());
  const [displayedLengths, setDisplayedLengths] = useState<Record<string, number>>({});
  const displayedLengthsRef = useRef<Record<string, number>>({});
  const queueRef = useRef<QueueItem[]>([]);
  const currentRef = useRef<QueueItem | null>(null);

  useEffect(() => {
    displayedLengthsRef.current = displayedLengths;
  }, [displayedLengths]);

  useEffect(() => {
    const interval = setInterval(() => {
      const current = currentRef.current;
      if (!current) {
        const next = queueRef.current.shift();
        if (next) {
          currentRef.current = next;
          setTypingIds((prev) => new Set(prev).add(next.id));
          setQueuedIds((prev) => {
            const nextSet = new Set(prev);
            nextSet.delete(next.id);
            return nextSet;
          });
          setDisplayedLengths((prev) => ({ ...prev, [next.id]: 0 }));
        }
        return;
      }

      const currentLen = displayedLengthsRef.current[current.id] ?? 0;
      const nextLen = currentLen + CHARS_PER_TICK;

      if (nextLen >= current.content.length) {
        const finishedId = current.id;
        setDisplayedLengths((prev) => ({ ...prev, [finishedId]: current.content.length }));
        currentRef.current = null;
        setTypingIds((prev) => {
          const next = new Set(prev);
          next.delete(finishedId);
          return next;
        });
      } else {
        setDisplayedLengths((prev) => ({ ...prev, [current.id]: nextLen }));
      }
    }, TYPING_SPEED_MS);

    return () => clearInterval(interval);
  }, []);

  const enqueue = useCallback((items: QueueItem[]) => {
    const valid = items.filter((item) => item.content.length > 0);
    queueRef.current.push(...valid);
    if (valid.length > 0) {
      setQueuedIds((prev) => {
        const next = new Set(prev);
        valid.forEach((item) => next.add(item.id));
        return next;
      });
    }
  }, []);

  const getDisplayedContent = useCallback(
    (id: string, fullContent: string) => {
      if (!typingIds.has(id)) return fullContent;
      const len = displayedLengths[id] ?? 0;
      return fullContent.slice(0, len);
    },
    [typingIds, displayedLengths],
  );

  const isTyping = useCallback((id: string) => typingIds.has(id), [typingIds]);

  /**
   * True while a message is either waiting in the queue or actively streaming.
   * Use this to decide whether to render streaming-friendly (plain) content
   * vs. the final rendered form (e.g. markdown).
   */
  const isStreaming = useCallback((id: string) => typingIds.has(id) || queuedIds.has(id), [typingIds, queuedIds]);

  /** Total number of characters currently displayed across all streaming messages. */
  const progress = Object.values(displayedLengths).reduce((sum, len) => sum + len, 0);

  const reset = useCallback(() => {
    queueRef.current = [];
    currentRef.current = null;
    setTypingIds(new Set());
    setQueuedIds(new Set());
    setDisplayedLengths({});
  }, []);

  return { enqueue, getDisplayedContent, isTyping, isStreaming, reset, progress };
}
