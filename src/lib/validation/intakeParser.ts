import Papa from "papaparse";
import ExcelJS from "exceljs";

export interface ParsedRow {
  rowNumber: number; // 1-indexed, matches what a coordinator sees in the spreadsheet
  fullName: string;
  email: string;
  phone: string;
  jqsNumber: string;
  gender: string;
  discipline: string;
  stateOfOrigin: string;
  dateOfBirth: string; // ISO yyyy-mm-dd, or "" if unparseable
  age: number | null;
  raw: Record<string, unknown>;
  problems: string[];
  isDuplicate: boolean;
  isAgeIneligible: boolean;
  isMissingEmail: boolean;
}

export interface ParseResult {
  rows: ParsedRow[];
  totalRows: number;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Loose Nigerian phone check: optional +234 / 0 prefix, 10-11 digits after.
const PHONE_RE = /^(\+?234|0)?[7-9][01]\d{8}$/;
const MAX_AGE = 30;

function pick(row: Record<string, unknown>, keys: string[]): string {
  for (const key of Object.keys(row)) {
    const norm = key.trim().toLowerCase().replace(/[\s_-]+/g, "");
    if (keys.includes(norm)) {
      const val = row[key];
      return val == null ? "" : String(val).trim();
    }
  }
  return "";
}

function parseDob(raw: string): { iso: string; age: number | null } {
  if (!raw) return { iso: "", age: null };
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return { iso: "", age: null };
  const iso = d.toISOString().slice(0, 10);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const monthDiff = now.getMonth() - d.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < d.getDate())) age--;
  return { iso, age };
}

function validateRow(rowNumber: number, raw: Record<string, unknown>): ParsedRow {
  const fullName = pick(raw, ["fullname", "name", "candidatename"]);
  const email = pick(raw, ["email", "emailaddress"]);
  const phone = pick(raw, ["phone", "phonenumber", "mobile", "mobilenumber"]);
  const jqsNumber = pick(raw, ["jqsnumber", "jqs", "jqsno"]).toUpperCase();
  const gender = pick(raw, ["gender", "sex"]);
  const discipline = pick(raw, ["discipline", "disciplinetrack", "track"]);
  const stateOfOrigin = pick(raw, ["stateoforigin", "state"]);
  const dobRaw = pick(raw, ["dateofbirth", "dob", "birthdate"]);
  const { iso: dateOfBirth, age } = parseDob(dobRaw);

  const problems: string[] = [];
  if (!fullName) problems.push("missing full name");
  if (!jqsNumber) problems.push("missing JQS number");
  if (!email) problems.push("missing email");
  else if (!EMAIL_RE.test(email)) problems.push("invalid email format");
  if (phone && !PHONE_RE.test(phone.replace(/\s+/g, ""))) problems.push("invalid phone format");

  const isMissingEmail = !email || !EMAIL_RE.test(email);
  const isAgeIneligible = age !== null && age > MAX_AGE;
  if (isAgeIneligible) problems.push(`age-ineligible (${age} years, over ${MAX_AGE})`);

  return {
    rowNumber,
    fullName,
    email: email.toLowerCase(),
    phone,
    jqsNumber,
    gender,
    discipline,
    stateOfOrigin,
    dateOfBirth,
    age,
    raw,
    problems,
    isDuplicate: false,
    isAgeIneligible,
    isMissingEmail,
  };
}

/** Marks rows sharing a JQS number (or, failing that, email) as duplicates of the first occurrence. */
function flagDuplicates(rows: ParsedRow[]): void {
  const seenJqs = new Map<string, number>();
  const seenEmail = new Map<string, number>();
  rows.forEach((row, idx) => {
    if (row.jqsNumber) {
      const firstIdx = seenJqs.get(row.jqsNumber);
      if (firstIdx === undefined) {
        seenJqs.set(row.jqsNumber, idx);
      } else {
        row.problems.push(`duplicate JQS number of row ${rows[firstIdx].rowNumber}`);
        row.isDuplicate = true;
        return;
      }
    }
    if (row.email) {
      const firstIdx = seenEmail.get(row.email);
      if (firstIdx === undefined) {
        seenEmail.set(row.email, idx);
      } else {
        row.problems.push(`duplicate email of row ${rows[firstIdx].rowNumber}`);
        row.isDuplicate = true;
      }
    }
  });
}

export async function parseCsv(fileText: string): Promise<ParseResult> {
  const { data } = Papa.parse<Record<string, unknown>>(fileText, {
    header: true,
    skipEmptyLines: true,
  });

  const rows = data.map((raw, i) => validateRow(i + 1, raw));
  flagDuplicates(rows);
  return { rows, totalRows: rows.length };
}

export async function parseXlsx(buffer: ArrayBuffer): Promise<ParseResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return { rows: [], totalRows: 0 };

  const headerRow = worksheet.getRow(1).values as unknown[];
  const headers = headerRow.map((h) => (h == null ? "" : String(h)));

  const rows: ParsedRow[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header
    const raw: Record<string, unknown> = {};
    const values = row.values as unknown[];
    headers.forEach((header, i) => {
      if (!header) return;
      raw[header] = values[i];
    });
    if (Object.values(raw).every((v) => v == null || v === "")) return; // skip blank rows
    rows.push(validateRow(rowNumber - 1, raw));
  });

  flagDuplicates(rows);
  return { rows, totalRows: rows.length };
}

export function isXlsxFile(filename: string): boolean {
  return /\.xlsx?$/i.test(filename);
}
