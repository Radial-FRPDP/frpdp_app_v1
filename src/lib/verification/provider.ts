/**
 * Verification-provider interface. The Profile service (M02) calls this
 * and never talks to Dojah/VerifyMe/etc directly — so switching providers,
 * or adding a fallback, is a config change (NIN_PROVIDER env var) plus one
 * new file, not a change to any candidate-facing code.
 */

export interface NinVerificationInput {
  nin: string;
  fullName: string;
  dateOfBirth: string; // ISO date, "YYYY-MM-DD"
}

export interface NinVerificationResult {
  status: "verified" | "failed" | "error";
  /** True if the provider's returned name/DOB match what the candidate submitted. */
  matched: boolean;
  providerReference: string | null;
  /** Raw provider response, stored for audit — never include card/bank fields here. */
  raw: Record<string, unknown>;
  errorMessage?: string;
}

export interface NinVerificationProvider {
  name: string;
  verifyNin(input: NinVerificationInput): Promise<NinVerificationResult>;
}
