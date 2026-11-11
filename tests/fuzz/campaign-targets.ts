/**
 * Entry point the fuzz driver bundles: the six original parser targets (targets.ts, whose list the unit tests pin)
 * plus the newer hostile-input parsers (targets-hostile.ts). Only the driver imports this module, through esbuild,
 * which loads the committed golden archival frame fixture as text.
 */
import goldenFrameHex from '../archival/golden-v1.hex';
import { UnalteredError } from '../../src/core/errors';
import { parseProof } from '../../src/core/ots/codec';
import * as original from './targets';
import { HOSTILE_TARGETS, hostileSeeds, repairHostileCase, runHostileCase, type HostileSeed, type HostileTarget } from './targets-hostile';

export { crc32 } from './targets';
export type CampaignTarget = original.Target | HostileTarget;

export const TARGETS: readonly CampaignTarget[] = [...original.TARGETS, ...HOSTILE_TARGETS];
const isHostile = (target: CampaignTarget): target is HostileTarget => (HOSTILE_TARGETS as readonly string[]).includes(target);

/** Rejections are ordinary outcomes; oracle failures throw, or reject for the asynchronous frame recovery. */
export function runCase(target: CampaignTarget, bytes: Uint8Array): original.CaseResult | Promise<original.CaseResult> {
  return isHostile(target) ? runHostileCase(target, bytes) : original.runCase(target, bytes);
}

/** Synthetic seeds only: the committed reference proofs, the committed golden frame and generated data. */
export async function seedCases(proofs: Uint8Array[]): Promise<(original.SeedCase | HostileSeed)[]> {
  const parsed = proofs.filter((bytes) => {
    try { parseProof(bytes); return true; } catch (error) { if (error instanceof UnalteredError) return false; throw error; }
  });
  return [...original.seedCases(proofs), ...await hostileSeeds(parsed, goldenFrameHex)];
}

export const repairCase = repairHostileCase;
