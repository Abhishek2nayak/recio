/**
 * Build a WebVTT captions track from word-level transcript timestamps. Words are
 * grouped into readable cues (~7 words / ~4s, broken early on speech gaps), and the
 * result is exposed as a blob URL for a <track> element.
 */
import type { TranscriptWord } from "@flowcap/shared";

const MAX_WORDS_PER_CUE = 7;
const MAX_CUE_SECONDS = 4;
const GAP_BREAK_SECONDS = 0.8;

function ts(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.round((sec % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

export function buildVtt(words: TranscriptWord[]): string {
  const cues: string[] = [];
  let group: TranscriptWord[] = [];

  const flush = () => {
    if (!group.length) return;
    const start = group[0]!.start;
    const end = Math.max(group[group.length - 1]!.end, start + 0.3);
    cues.push(`${ts(start)} --> ${ts(end)}\n${group.map((w) => w.word).join(" ")}`);
    group = [];
  };

  for (const w of words) {
    const first = group[0];
    const prev = group[group.length - 1];
    const tooLong = first && (group.length >= MAX_WORDS_PER_CUE || w.end - first.start > MAX_CUE_SECONDS);
    const bigGap = prev && w.start - prev.end > GAP_BREAK_SECONDS;
    if (tooLong || bigGap) flush();
    group.push(w);
  }
  flush();

  return `WEBVTT\n\n${cues.join("\n\n")}\n`;
}

/** Blob URL for a <track src>; caller revokes it when done. */
export function vttUrl(words: TranscriptWord[]): string {
  return URL.createObjectURL(new Blob([buildVtt(words)], { type: "text/vtt" }));
}

/** Build a WebVTT track from pre-grouped cues (e.g. AI-translated captions). */
export function buildVttFromCues(cues: { start: number; end: number; text: string }[]): string {
  const body = cues
    .map((c) => `${ts(c.start)} --> ${ts(Math.max(c.end, c.start + 0.3))}\n${c.text}`)
    .join("\n\n");
  return `WEBVTT\n\n${body}\n`;
}

export function vttUrlFromCues(cues: { start: number; end: number; text: string }[]): string {
  return URL.createObjectURL(new Blob([buildVttFromCues(cues)], { type: "text/vtt" }));
}
