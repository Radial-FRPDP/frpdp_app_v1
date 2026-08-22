import type { NinVerificationInput, NinVerificationProvider, NinVerificationResult } from "./provider";

const SANDBOX_BASE_URL = "https://sandbox.dojah.io/api/v1";
const PRODUCTION_BASE_URL = "https://api.dojah.io/api/v1";

function namesRoughlyMatch(a: string, b: string): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z\s]/g, "")
      .split(/\s+/)
      .filter(Boolean)
      .sort();
  const na = norm(a);
  const nb = norm(b);
  if (na.length === 0 || nb.length === 0) return false;
  // Every token the candidate typed should appear somewhere in what the
  // provider returned — order-independent, tolerant of a missing middle name.
  return na.every((tok) => nb.includes(tok));
}

export class DojahProvider implements NinVerificationProvider {
  name = "dojah";

  private appId: string;
  private secretKey: string;
  private baseUrl: string;

  constructor() {
    this.appId = process.env.DOJAH_APP_ID ?? "";
    this.secretKey = process.env.DOJAH_SECRET_KEY ?? "";
    this.baseUrl = process.env.DOJAH_ENV === "production" ? PRODUCTION_BASE_URL : SANDBOX_BASE_URL;

    if (!this.appId || !this.secretKey) {
      // Fail loudly at construction time rather than on the first real
      // request — this is a config problem, not a candidate-facing error.
      throw new Error(
        "DOJAH_APP_ID / DOJAH_SECRET_KEY are not set. Add them to your environment before calling verifyNin()."
      );
    }
  }

  async verifyNin(input: NinVerificationInput): Promise<NinVerificationResult> {
    try {
      const url = `${this.baseUrl}/kyc/nin?nin=${encodeURIComponent(input.nin)}`;
      const res = await fetch(url, {
        method: "GET",
        headers: {
          AppId: this.appId,
          Authorization: this.secretKey,
        },
        // NIN checks should never hang the profile submission indefinitely.
        signal: AbortSignal.timeout(15_000),
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        return {
          status: "error",
          matched: false,
          providerReference: null,
          raw: body,
          errorMessage: body?.error ?? `Dojah returned HTTP ${res.status}`,
        };
      }

      const entity = body?.entity ?? {};
      const returnedName = [entity.first_name, entity.middle_name, entity.last_name]
        .filter(Boolean)
        .join(" ");
      const matched = returnedName ? namesRoughlyMatch(input.fullName, returnedName) : false;

      return {
        status: matched ? "verified" : "failed",
        matched,
        providerReference: entity?.nin ?? null,
        raw: body,
      };
    } catch (err) {
      return {
        status: "error",
        matched: false,
        providerReference: null,
        raw: {},
        errorMessage: err instanceof Error ? err.message : "Unknown error calling Dojah",
      };
    }
  }
}
