import { z } from "zod";
import {
  addDays,
  differenceInCalendarDays,
  format,
  isValid,
  parseISO,
} from "date-fns";
export type Role = "owner" | "pharmacist" | "technician" | "super_admin";
export type Row = {
  id: string;
  pharmacy_id?: string;
  created_at?: string;
  [key: string]: unknown;
};
export const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) => isValid(parseISO(v)) && format(parseISO(v), "yyyy-MM-dd") === v,
    "Invalid calendar date",
  );
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Baghdad",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const shiftDate = (date: string, days: number) =>
  format(addDays(parseISO(dateOnly.parse(date)), days), "yyyy-MM-dd");
export const clinical = (role: Role) =>
  role === "owner" || role === "pharmacist";
export const phone = z
  .string()
  .trim()
  .transform((v) =>
    v
      .replace(/[\s()-]/g, "")
      .replace(/^00964/, "+964")
      .replace(/^07/, "+9647"),
  )
  .refine(
    (v) => /^\+9647\d{9}$/.test(v),
    "Enter an Iraqi mobile number, e.g. 07701234567",
  );
export const patientSchema = z.object({
  full_name: z.string().trim().min(2).max(160),
  phone,
  city: z.string().trim().max(100),
  date_of_birth: dateOnly.or(z.literal("")),
  conditions: z.string().max(1000),
  notes: z.string().max(4000),
  communication_consent: z.boolean(),
});
export const dispensingSchema = z
  .object({
    dispensed_on: dateOnly,
    quantity: z.coerce.number().positive().max(100000),
    days_supply: z.coerce.number().int().min(1).max(730),
    lead_days: z.coerce.number().int().min(0).max(60),
    carry_days: z.coerce.number().int().min(0).max(730),
    carry_reviewed: z.boolean().default(false),
    correction_of: z.string().uuid().optional(),
    correction_reason: z.string().optional(),
  })
  .refine(
    (v) => v.carry_days === 0 || v.carry_reviewed,
    "Carrying supply forward requires explicit pharmacist review",
  )
  .refine(
    (v) => !v.correction_of || (v.correction_reason?.trim().length ?? 0) >= 5,
    "A correction reason is required",
  );
export function projection(input: unknown, asOf = today()) {
  const v = dispensingSchema.parse(input);
  const lastCovered = shiftDate(
    v.dispensed_on,
    v.days_supply + v.carry_days - 1,
  );
  const contactOn = shiftDate(lastCovered, -v.lead_days);
  const delta = differenceInCalendarDays(
    parseISO(lastCovered),
    parseISO(dateOnly.parse(asOf)),
  );
  return {
    last_covered_on: lastCovered,
    next_uncovered_on: shiftDate(lastCovered, 1),
    contact_on: contactOn,
    remaining: Math.max(0, delta + 1),
    status:
      delta < 0
        ? "overdue"
        : asOf === contactOn
          ? "due_today"
          : asOf > contactOn
            ? "due_soon"
            : "on_track",
  };
}
export function calculateSupply(
  quantity: number,
  unitsPerDose: number,
  dailyFrequency: number | null,
  explicit?: number,
) {
  if (explicit !== undefined)
    return {
      days: z.number().int().positive().parse(explicit),
      method: "confirmed" as const,
      fractional: false,
    };
  if (
    !dailyFrequency ||
    quantity <= 0 ||
    unitsPerDose <= 0 ||
    dailyFrequency > 12
  )
    throw new Error("Confirm days supply for PRN or irregular schedules.");
  const raw = quantity / (unitsPerDose * dailyFrequency);
  if (raw < 1)
    throw new Error("Less than one complete day: pharmacist review required.");
  return {
    days: Math.floor(raw),
    method: "estimated_floor" as const,
    fractional: raw !== Math.floor(raw),
  };
}
export const normalizeName = (s: string) =>
  s
    .normalize("NFKC")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/[\u064B-\u065F\u0640]/g, "")
    .toLocaleLowerCase()
    .trim();
export function whatsapp(number: string) {
  return `https://wa.me/${phone.parse(number).slice(1)}?text=${encodeURIComponent("Hello, please contact your pharmacy. مرحباً، يرجى التواصل مع الصيدلية.")}`;
}
export function csv(rows: Row[]) {
  const keys = [...new Set(rows.flatMap(Object.keys))];
  const escape = (v: unknown) => {
    let s = String(v ?? "");
    if (/^[=+@\-\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replaceAll('"', '""')}"`;
  };
  return (
    "\uFEFF" +
    [keys, ...rows.map((r) => keys.map((k) => r[k]))]
      .map((row) => row.map(escape).join(","))
      .join("\r\n")
  );
}
