/**
 * AI transcript + summary. Inert until DEEPGRAM_API_KEY is set (ASR); ANTHROPIC_API_KEY
 * additionally enables an AI title + summary. The provider fetches the recording from
 * our playback proxy URL, so nothing is re-uploaded.
 *
 * Gated + metered: each generation consumes ceil(duration/60) AI minutes against the
 * owner's monthly allowance (entitlements.aiMinutesIncluded).
 */
import type { Recording } from "@prisma/client";
import { ErrorCode, type TranscriptDTO } from "@flowcap/shared";
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
  error: string | null;
}): TranscriptDTO {
  return {
    status: t.status as TranscriptDTO["status"],
    language: t.language,
    title: t.title,
    summary: t.summary,
    text: t.text,
    error: t.error,
  };
}

export async function getTranscript(recordingId: string): Promise<TranscriptDTO | null> {
  const t = await prisma.transcript.findUnique({ where: { recordingId } });
  return t ? toDTO(t) : null;
}

/** ASR via Deepgram (it fetches the remote URL itself). */
async function transcribe(audioUrl: string): Promise<{ text: string; language: string | null }> {
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
    results?: { channels?: { detected_language?: string; alternatives?: { transcript?: string }[] }[] };
  };
  const channel = json.results?.channels?.[0];
  return {
    text: channel?.alternatives?.[0]?.transcript ?? "",
    language: channel?.detected_language ?? null,
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
    const { text, language } = await transcribe(audioUrl);
    const { title, summary } = await summarize(text);

    const saved = await prisma.transcript.update({
      where: { recordingId: recording.id },
      data: { status: "READY", text, language, title, summary, error: null },
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
