// Per-destination visa-process notes for cases the by-nationality access level
// can't capture on its own - e.g. a residence-based application system. Shown
// on corridor pages so the classification is understood correctly.
export const APPLICATION_NOTES: Record<string, string> = {
  JPN: "Japan's online eVISA is based on your country of residence, not your nationality: you apply through the Japanese embassy/consulate (or its accredited visa centre) that covers where you live. A direct self-service eVISA is offered to residents of some jurisdictions (e.g. Australia, Canada, the UK, USA, Saudi Arabia); residents of others - including India, China, the Philippines and Vietnam - can only get the eVISA through a government-accredited travel agency, and most apply in person via VFS Global. Japan has no visa on arrival or ETA.",
};

export function applicationNoteFor(destIso3: string): string | null {
  return APPLICATION_NOTES[destIso3] ?? null;
}
