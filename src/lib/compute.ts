// Server-side entry point: compute() with the same signature as always, bound
// to the full dataset. The actual engine lives in @/lib/compute-core, which is
// pure (no dataset import) so client components can run the same computation
// on fetched slices without dragging the ~18MB dataset into their bundle.
// Server pages keep importing { compute, fmtMoney, ... } from here unchanged.
import { dataset } from "./dataset";
import { computeWith, type PassportResult } from "./compute-core";
import type { PassportType } from "./types";

export { LEVEL_LABEL, fmtMoney } from "./compute-core";
export type { CombinedEdge, FomEdge, PassportResult, ComputeData } from "./compute-core";

export function compute(
  selected: string[],
  credentials: string[] = [],
  ptypesInput: Record<string, PassportType> = {},
): PassportResult {
  return computeWith(dataset, selected, credentials, ptypesInput);
}
