// Per-destination visa-process notes for cases the by-nationality access level
// can't capture on its own - e.g. a residence-based application system. Shown
// on corridor pages so the classification is understood correctly.
//
// Nationality-aware: a prior version described BOTH the direct-self-service
// group and the accredited-agency group in one blob, opening with "you apply
// through the Japanese embassy/consulate (or its accredited visa centre)" -
// which reads as embassy-first even for nationalities (India, China, the
// Philippines, Vietnam) who cannot go to the embassy at all and must apply
// via VFS Global. Each nationality now sees only the sentence that applies
// to it, and the accredited-agency path leads with VFS, not the embassy.
const JPN_EVISA_SELF_SERVICE = new Set(["AUS", "CAN", "GBR", "USA", "SAU"]);
// India, China and the Philippines are explicitly confirmed as VFS Global
// intake countries in data/visa-fees/JPN.json's own vfs note; Vietnam is
// grouped with them by the same research but without that same explicit
// per-country confirmation, so its note stays hedged ("typically").
const JPN_EVISA_VFS_CONFIRMED = new Set(["IND", "CHN", "PHL"]);
const JPN_EVISA_VFS_HEDGED = new Set(["VNM"]);
const jpnVfsNote = (hedge: boolean) =>
  `Japan's online eVISA is based on your country of residence, not your nationality. You cannot self-apply online: the eVISA is only available through a government-accredited visa centre${hedge ? ", typically" : ""} VFS Global, not directly at the embassy. Japan has no visa on arrival or eTA.`;
const JPN_EVISA_SELF_SERVICE_NOTE =
  "Japan's online eVISA is based on your country of residence, not your nationality. Residents of some jurisdictions (Australia, Canada, the UK, USA, Saudi Arabia) get direct self-service access to the eVISA online, without going through an embassy or visa centre. Japan has no visa on arrival or eTA.";
const JPN_EVISA_OTHER_NOTE =
  "Japan's online eVISA is based on your country of residence, not your nationality. Some residents get direct self-service access to the eVISA online; others - including India, China, the Philippines and Vietnam - cannot self-apply and must go through a government-accredited visa centre (most apply via VFS Global) rather than the embassy directly. Check which group covers where you actually live, not just your passport. Japan has no visa on arrival or eTA.";

export function applicationNoteFor(destIso3: string, natIso3?: string): string | null {
  if (destIso3 === "JPN") {
    if (natIso3 && JPN_EVISA_VFS_CONFIRMED.has(natIso3)) return jpnVfsNote(false);
    if (natIso3 && JPN_EVISA_VFS_HEDGED.has(natIso3)) return jpnVfsNote(true);
    if (natIso3 && JPN_EVISA_SELF_SERVICE.has(natIso3)) return JPN_EVISA_SELF_SERVICE_NOTE;
    return JPN_EVISA_OTHER_NOTE;
  }
  return null;
}
