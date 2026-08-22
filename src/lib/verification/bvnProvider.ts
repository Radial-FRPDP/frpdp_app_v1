/**
 * BVN verification via Paystack, mirroring the NIN provider pattern in
 * ./provider.ts — the Profile service calls this interface, never
 * Paystack directly.
 */

export interface BvnVerificationInput {
  bvn: string;
  fullName: string;
}

export interface BvnVerificationResult {
  status: "verified" | "failed" | "error";
  matched: boolean;
  accountName: string | null;
  /** Only the last 4 digits are ever persisted — see 0004_multi_role.sql. */
  bankAccountLast4: string | null;
  bankName: string | null;
  providerReference: string | null;
  raw: Record<string, unknown>;
  errorMessage?: string;
}

export interface BvnVerificationProvider {
  name: string;
  verifyBvn(input: BvnVerificationInput): Promise<BvnVerificationResult>;
}

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
  return na.every((tok) => nb.includes(tok));
}

const BASE_URL = "https://api.paystack.co";

export class PaystackBvnProvider implements BvnVerificationProvider {
  name = "paystack";
  private secretKey: string;

  constructor() {
    this.secretKey = process.env.PAYSTACK_SECRET_KEY ?? "";
    if (!this.secretKey) {
      throw new Error("PAYSTACK_SECRET_KEY is not set. Add it to your environment before calling verifyBvn().");
    }
  }

  async verifyBvn(input: BvnVerificationInput): Promise<BvnVerificationResult> {
    try {
      // Paystack's BVN resolve endpoint — requires an approved use case on
      // the account (Identity products are gated). Returns the BVN owner's
      // registered name, which we match against what the candidate typed.
      const res = await fetch(`${BASE_URL}/bank/resolve_bvn/${encodeURIComponent(input.bvn)}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${this.secretKey}` },
        signal: AbortSignal.timeout(15_000),
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        return {
          status: "error",
          matched: false,
          accountName: null,
          bankAccountLast4: null,
          bankName: null,
          providerReference: null,
          raw: body,
          errorMessage: body?.message ?? `Paystack returned HTTP ${res.status}`,
        };
      }

      const data = body?.data ?? {};
      const returnedName = [data.first_name, data.middle_name, data.last_name].filter(Boolean).join(" ");
      const matched = returnedName ? namesRoughlyMatch(input.fullName, returnedName) : false;

      return {
        status: matched ? "verified" : "failed",
        matched,
        accountName: returnedName || null,
        bankAccountLast4: null,
        bankName: null,
        providerReference: input.bvn,
        raw: { ...data, mobile: undefined, bvn: undefined }, // strip anything sensitive before it's stored
      };
    } catch (err) {
      return {
        status: "error",
        matched: false,
        accountName: null,
        bankAccountLast4: null,
        bankName: null,
        providerReference: null,
        raw: {},
        errorMessage: err instanceof Error ? err.message : "Unknown error calling Paystack",
      };
    }
  }
}

export function getBvnProvider(): BvnVerificationProvider {
  return new PaystackBvnProvider();
}
