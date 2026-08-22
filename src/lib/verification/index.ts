import type { NinVerificationProvider } from "./provider";
import { DojahProvider } from "./dojah";

/**
 * Factory: picks the NIN verification provider from NIN_PROVIDER.
 * Add a new file (e.g. verifyme.ts) implementing NinVerificationProvider
 * and one more case here to switch or add a fallback — nothing else in
 * the app needs to change.
 */
export function getNinProvider(): NinVerificationProvider {
  const providerName = process.env.NIN_PROVIDER ?? "dojah";

  switch (providerName) {
    case "dojah":
      return new DojahProvider();
    default:
      throw new Error(`Unknown NIN_PROVIDER "${providerName}"`);
  }
}

export type { NinVerificationInput, NinVerificationProvider, NinVerificationResult } from "./provider";
