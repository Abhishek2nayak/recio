/**
 * AI transcript + summary. Inert until DEEPGRAM_API_KEY is set (ASR); ANTHROPIC_API_KEY
 * additionally enables an AI title + summary. The provider fetches the recording from
 * our playback proxy URL, so nothing is re-uploaded.
 *
 * Gated + metered: each generation consumes ceil(duration/60) AI minutes against the
 * owner's monthly allowance (entitlements.aiMinutesIncluded).
 */
import type { Prisma, Recording } from "@prisma/client";
import { ErrorCode, type CaptionCue, type TranscriptDTO } from "@flowcap/shared";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";
import { resolveEntitlements } from "../lib/entitlements.js";
import { getPlaybackUrl } from "./storage-service.js";
import { addAiMinutes, getAiMinutes } from "./usage-service.js";

export function aiEnabled(): boolean {
  return env.DEEPGRAM_API_KEY.length > 0;
}

function toDTO(t: {
  status: string;
  language: string | null;
  title: string | null;
  summary: string | null;
  text: string | null;
  words?: unknown;
  error: string | null;
}): TranscriptDTO {
  return {
    status: t.status as TranscriptDTO["status"],
    language: t.language,
    title: t.title,
    summary: t.summary,
    text: t.text,
    words: (t.words as TranscriptDTO["words"]) ?? null,
    error: t.error,
  };
}

export async function getTranscript(recordingId: string): Promise<TranscriptDTO | null> {
  const t = await prisma.transcript.findUnique({ where: { recordingId } });
  return t ? toDTO(t) : null;
}

export interface TranscriptWord {
  word: string;
  start: number;
  end: number;
}

/** ASR via Deepgram (it fetches the remote URL itself). Captures word timestamps. */
async function transcribe(
  audioUrl: string,
): Promise<{ text: string; language: string | null; words: TranscriptWord[] }> {
  const res = await fetch(
    "https://api.deepgram.com/v1/listen?smart_format=true&punctuate=true&detect_language=true",
    {
      method: "POST",
      headers: { Authorization: `Token ${env.DEEPGRAM_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url: audioUrl }),
    },
  );
  if (!res.ok) throw new Error(`Transcription failed (${res.status}).`);
  const json = (await res.json()) as {
    results?: {
      channels?: {
        detected_language?: string;
        alternatives?: { transcript?: string; words?: { word: string; start: number; end: number }[] }[];
      }[];
    };
  };
  const alt = json.results?.channels?.[0]?.alternatives?.[0];
  return {
    text: alt?.transcript ?? "",
    language: json.results?.channels?.[0]?.detected_language ?? null,
    words: (alt?.words ?? []).map((w) => ({ word: w.word, start: w.start, end: w.end })),
  };
}

/** AI title + summary via Anthropic (optional — skipped if no key). */
async function summarize(text: string): Promise<{ title: string | null; summary: string | null }> {
  if (!env.ANTHROPIC_API_KEY || !text.trim()) return { title: null, summary: null };
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      messages: [
        {
          role: "user",
          content:
            "From this screen-recording transcript, return ONLY JSON " +
            '{"title": "...", "summary": "..."} — a punchy <=60-char title and a 2-3 sentence summary.\n\n' +
            text.slice(0, 12000),
        },
      ],
    }),
  });
  if (!res.ok) return { title: null, summary: null };
  const json = (await res.json()) as { content?: { text?: string }[] };
  const raw = json.content?.[0]?.text ?? "";
  try {
    const parsed = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)) as {
      title?: string;
      summary?: string;
    };
    return { title: parsed.title ?? null, summary: parsed.summary ?? null };
  } catch {
    return { title: null, summary: raw.trim() || null };
  }
}

// ── Caption translation (viewer-facing, cached per recording+language) ──────────

const CUE_MAX_WORDS = 7;
const CUE_MAX_SECONDS = 4;
const CUE_GAP_BREAK = 0.8;

/** Group word timestamps into readable caption cues (mirrors the client VTT builder). */
function groupWordsIntoCues(words: TranscriptWord[]): CaptionCue[] {
  const cues: CaptionCue[] = [];
  let group: TranscriptWord[] = [];
  const flush = () => {
    if (!group.length) return;
    const start = group[0]!.start;
    const end = Math.max(group[group.length - 1]!.end, start + 0.3);
    cues.push({ start, end, text: group.map((w) => w.word).join(" ") });
    group = [];
  };
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    const prev = words[i - 1];
    const gap = prev ? w.start - prev.end : 0;
    if (group.length && (group.length >= CUE_MAX_WORDS || w.end - group[0]!.start > CUE_MAX_SECONDS || gap > CUE_GAP_BREAK)) {
      flush();
    }
    group.push(w);
  }
  flush();
  return cues;
}

/** Translate a batch of cue strings into `langLabel` via Claude; falls back to source on any issue. */
async function translateBatch(lines: string[], langLabel: string): Promise<string[]> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4000,
      messages: [
        {
          role: "user",
          content:
            `Translate each string in this JSON array into ${langLabel}. ` +
            "Return ONLY a JSON array of the same length and order — translated strings, no notes.\n\n" +
            JSON.stringify(lines),
        },
      ],
    }),
  });
  if (!res.ok) return lines;
  const json = (await res.json()) as { content?: { text?: string }[] };
  const raw = json.content?.[0]?.text ?? "";
  try {
    const arr = JSON.parse(raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1)) as string[];
    return arr.length === lines.length ? arr : lines;
  } catch {
    return lines;
  }
}

/**
 * Return AI-translated caption cues for a recording, building + caching them on first
 * request for each language. Public/viewer-facing; safe to call without auth.
 */
export async function getOrCreateTranslation(recordingId: string, lang: string, langLabel: string): Promise<CaptionCue[]> {
  const cached = await prisma.transcriptTranslation.findUnique({
    where: { recordingId_lang: { recordingId, lang } },
  });
  if (cached) return cached.cues as unknown as CaptionCue[];

  const t = await prisma.transcript.findUnique({ where: { recordingId } });
  if (!t || t.status !== "READY" || !t.words) {
    throw new HttpError(ErrorCode.NOT_FOUND, "No captions available to translate yet.");
  }
  if (!env.ANTHROPIC_API_KEY) {
    throw new HttpError(ErrorCode.INTERNAL_ERROR, "Translation isn't enabled.");
  }

  const cues = groupWordsIntoCues(t.words as unknown as TranscriptWord[]);
  if (!cues.length) return [];

  const texts = cues.map((c) => c.text);
  const translated: string[] = [];
  const BATCH = 60;
  for (let i = 0; i < texts.length; i += BATCH) {
    translated.push(...(await translateBatch(texts.slice(i, i + BATCH), langLabel)));
  }
  const out = cues.map((c, i) => ({ ...c, text: translated[i] ?? c.text }));

  // Cache (ignore races on the unique key).
  await prisma.transcriptTranslation
    .create({ data: { recordingId, lang, cues: out as unknown as Prisma.InputJsonValue } })
    .catch(() => undefined);
  return out;
}

/** Generate (or regenerate) a transcript + summary for an owned recording. */
export async function generateTranscript(userId: string, recording: Recording): Promise<TranscriptDTO> {
  if (!aiEnabled()) {
    throw new HttpError(ErrorCode.INTERNAL_ERROR, "AI transcription isn't enabled yet.");
  }

  // Gate + meter against the monthly AI-minute allowance.
  const minutes = Math.max(1, Math.ceil(recording.duration / 60));
  const { aiMinutesIncluded } = resolveEntitlements(
    (await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } }))?.plan ?? "FREE",
  );
  const used = await getAiMinutes(userId);
  if (used + minutes > aiMinutesIncluded) {
    throw new HttpError(
      ErrorCode.UPGRADE_REQUIRED,
      "You've used your AI transcript minutes for this month. Upgrade for more.",
    );
  }

  await prisma.transcript.upsert({
    where: { recordingId: recording.id },
    create: { recordingId: recording.id, status: "PROCESSING" },
    update: { status: "PROCESSING", error: null },
  });

  try {
    const audioUrl = await getPlaybackUrl(
      recording.userId,
      recording.storageProvider,
      recording.storageFileId,
      recording.id,
    );
    const { text, language, words } = await transcribe(audioUrl);
    const { title, summary } = await summarize(text);

    const saved = await prisma.transcript.update({
      where: { recordingId: recording.id },
      data: {
        status: "READY",
        text,
        language,
        title,
        summary,
        words: words as unknown as Prisma.InputJsonValue,
        error: null,
      },
    });
    await addAiMinutes(userId, minutes);
    return toDTO(saved);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Transcription failed.";
    await prisma.transcript.update({
      where: { recordingId: recording.id },
      data: { status: "FAILED", error: message },
    });
    throw new HttpError(ErrorCode.INTERNAL_ERROR, message);
  }
}
