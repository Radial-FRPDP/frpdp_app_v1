/**
 * Nigeria's 36 states + FCT, mapped to the 6 geopolitical zones.
 *
 * This is the canonical list for two things: the M-01 CSV intake's
 * state-of-origin -> zone derivation (matches candidates.zone's check
 * constraint in 0008_candidate_fields_and_exceptions.sql, which mirrors
 * cbt_centres.zone from 0004_multi_role.sql), and the M-02 profile
 * wizard's "State of Residence" dropdown (Section 3.4 of the design
 * reference gap analysis).
 */

export type GeopoliticalZone =
  | "South-South"
  | "South-East"
  | "South-West"
  | "North-Central"
  | "North-West"
  | "North-East";

export const ZONES: GeopoliticalZone[] = [
  "South-South",
  "South-East",
  "South-West",
  "North-Central",
  "North-West",
  "North-East",
];

/** Canonical display name for every state + FCT, used for the dropdown and for normalizing free-text input. */
export const NIGERIA_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue",
  "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu",
  "FCT", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi",
  "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun",
  "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
] as const;

const STATE_TO_ZONE: Record<string, GeopoliticalZone> = {
  Abia: "South-East",
  Adamawa: "North-East",
  "Akwa Ibom": "South-South",
  Anambra: "South-East",
  Bauchi: "North-East",
  Bayelsa: "South-South",
  Benue: "North-Central",
  Borno: "North-East",
  "Cross River": "South-South",
  Delta: "South-South",
  Ebonyi: "South-East",
  Edo: "South-South",
  Ekiti: "South-West",
  Enugu: "South-East",
  FCT: "North-Central",
  Gombe: "North-East",
  Imo: "South-East",
  Jigawa: "North-West",
  Kaduna: "North-West",
  Kano: "North-West",
  Katsina: "North-West",
  Kebbi: "North-West",
  Kogi: "North-Central",
  Kwara: "North-Central",
  Lagos: "South-West",
  Nasarawa: "North-Central",
  Niger: "North-Central",
  Ogun: "South-West",
  Ondo: "South-West",
  Osun: "South-West",
  Oyo: "South-West",
  Plateau: "North-Central",
  Rivers: "South-South",
  Sokoto: "North-West",
  Taraba: "North-East",
  Yobe: "North-East",
  Zamfara: "North-West",
};

/** Free-text spellings/abbreviations seen in NCDMB CSVs and self-entered forms, normalized to the canonical name above. */
const ALIASES: Record<string, string> = {
  "abuja": "FCT",
  "federal capital territory": "FCT",
  "fct abuja": "FCT",
  "akwaibom": "Akwa Ibom",
  "cross-river": "Cross River",
  "crossriver": "Cross River",
};

function normalize(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.,]/g, "");
}

/** Matches free-text state input (any casing, common aliases) to its canonical name, or null if unrecognized. */
export function normalizeStateName(input: string): string | null {
  if (!input) return null;
  const key = normalize(input);
  if (ALIASES[key]) return ALIASES[key];
  const match = NIGERIA_STATES.find((s) => normalize(s) === key);
  return match ?? null;
}

/** Derives the geopolitical zone for a (possibly loosely-formatted) state name. Returns null if the state isn't recognized. */
export function stateToZone(stateInput: string): GeopoliticalZone | null {
  const canonical = normalizeStateName(stateInput);
  if (!canonical) return null;
  return STATE_TO_ZONE[canonical] ?? null;
}
