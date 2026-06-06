/**
 * Smart cleanup: derive non-destructive "skip" segments (filler words + long
 * silences) from a recording's transcript word timestamps, and store them on the
 * recording. Players jump over the cuts — the file in the user's cloud is untouched.
 */
import { ErrorCode, type CleanupResultDTO, type CutSegment } from "@flowcap/shared";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";

interface Word {
  word: string;
  start: number;
  end: number;
}

// Conservative single-word fillers (multi-word ones need phrase matching).
const FILLERS = new Set(["um", "uh", "uhh", "umm", "uhm", "erm", "hmm", "mm", "mmm", "er", "ah"]);
const SILENCE_GAP = 2.0; // gaps longer than this get trimmed
const SILENCE_KEEP = 0.35; // breathing room left on each side of a cut silence
const PAD = 0.05;

export async function computeCleanup(recordingId: string): Promise<CleanupResultDTO> {
  const transcript = await prisma.transcript.findUnique({ where: { recordingId } });
  const words = (transcript?.words as unknown as Word[] | null) ?? null;
  if (!words || words.length === 0) {
    throw new HttpError(ErrorCode.BAD_REQUEST, "Generate a transcript first, then run cleanup.");
  }

  const raw: { start: number; end: number; kind: "filler" | "silence" }[] = [];

  for (const w of words) {
    const clean = w.word.toLowerCase().replace(/[^a-z]/g, "");
    if (FILLERS.has(clean)) raw.push({ start: Math.max(0, w.start - PAD), end: w.end + PAD, kind: "filler" });
  }
  for (let i = 1; i < words.length; i++) {
    const prev = words[i - 1];
    const cur = words[i];
    if (!prev || !cur) continue;
    const gap = cur.start - prev.end;
    if (gap > SILENCE_GAP) {
      const start = prev.end + SILENCE_KEEP;
      const end = cur.start - SILENCE_KEEP;
      if (end - start > 0.4) raw.push({ start, end, kind: "silence" });
    }
  }

  const removedFiller = raw.filter((r) => r.kind === "filler").length;
  const removedSilences = raw.filter((r) => r.kind === "silence").length;

  // Merge overlapping / adjacent ranges.
  const sorted = raw.map(({ start, end }) => ({ start, end })).sort((a, b) => a.start - b.start);
  const cuts: CutSegment[] = [];
  for (const c of sorted) {
    const last = cuts[cuts.length - 1];
    if (last && c.start <= last.end + 0.1) last.end = Math.max(last.end, c.end);
    else cuts.push({ ...c });
  }

  const savedSec = Math.round(cuts.reduce((sum, c) => sum + (c.end - c.start), 0));
  await prisma.recording.update({
    where: { id: recordingId },
    data: { cuts: cuts as unknown as Prisma.InputJsonValue },
  });
  return { cuts, removedFiller, removedSilences, savedSec };
}

export async function clearCleanup(recordingId: string): Promise<void> {
  await prisma.recording.update({
    where: { id: recordingId },
    data: { cuts: Prisma.DbNull },
  });
}
