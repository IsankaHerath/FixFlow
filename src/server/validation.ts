import { z } from "zod";
const text = z.string().trim().min(1).max(500);
const amount = z.number().int().min(0).max(1_000_000_000);
export const vehicleInput = z.object({
  registration: z
    .string()
    .trim()
    .min(4)
    .max(20)
    .transform((v) => v.toUpperCase().replace(/[^A-Z0-9]/g, ""))
    .refine((v) => v.length >= 4),
  make: text,
  model: text,
  year: z
    .number()
    .int()
    .min(1900)
    .max(new Date().getFullYear() + 1),
  category: z.enum([
    "Car",
    "SUV",
    "Van",
    "Motorcycle",
    "Three-wheeler",
    "Pickup",
    "Other",
  ]),
  fuel: z.enum(["Petrol", "Diesel", "Hybrid", "Electric", "Other"]),
  transmission: z.enum(["Automatic", "Manual", "Other"]),
  mileage: z.number().int().min(0).max(3_000_000),
  color: z.string().max(50).default(""),
  notes: z.string().max(2000).default(""),
  vin: z.string().max(50).nullish(),
  engineNumber: z.string().max(50).nullish(),
});
export const bookingInput = z.object({
  vehicleId: text,
  centerId: text,
  serviceId: text,
  startsAt: z.iso.datetime(),
  description: z.string().trim().min(5).max(2000),
  requestKey: z.uuid(),
});
export const estimateInput = z.object({
  items: z
    .array(
      z.object({
        description: text,
        kind: z.enum(["PART", "LABOR"]),
        quantity: z.number().int().min(1).max(10000),
        unitPrice: amount,
      }),
    )
    .min(1)
    .max(100),
  discount: amount.default(0),
  taxBps: z.number().int().min(0).max(10000).default(0),
  notes: z.string().max(2000).default(""),
  expiresAt: z.iso.datetime(),
});
export const centerInput = z
  .object({
    name: text,
    address: text,
    district: text,
    province: text.default("Western"),
    phone: text,
    email: z.email(),
    description: z.string().max(2000).default(""),
    timezone: z
      .string()
      .refine((v) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: v });
          return true;
        } catch {
          return false;
        }
      })
      .default("Asia/Colombo"),
    openHour: z.number().int().min(0).max(23).default(8),
    closeHour: z.number().int().min(1).max(24).default(17),
    openDays: z
      .array(z.number().int().min(0).max(6))
      .min(1)
      .default([1, 2, 3, 4, 5, 6]),
    capacity: z.number().int().min(1).max(100).default(3),
    closures: z
      .array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
      .max(366)
      .default([]),
  })
  .refine(
    (v) => v.closeHour > v.openHour,
    "Closing time must follow opening time.",
  );
export const serviceInput = z.object({
  name: text,
  category: text,
  description: z.string().max(2000).default(""),
  duration: z
    .number()
    .int()
    .min(30)
    .max(480)
    .refine((v) => v % 30 === 0),
  startingPrice: amount,
  intervalKm: z.number().int().min(100).max(100000).nullable().default(null),
  intervalMonths: z.number().int().min(1).max(120).nullable().default(null),
  active: z.boolean().default(true),
});
export const partInput = z.object({
  sku: text,
  name: text,
  cost: amount,
  price: amount,
  reorderLevel: z.number().int().min(0).max(100000),
  supplier: z.string().max(500).default(""),
});
