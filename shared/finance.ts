import { z } from "zod";
export const moneySchema = z.number().int().positive().max(1_000_000_000);
export const periodSchema = z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/);
export const paymentStatusSchema = z.enum(["completed", "pending", "cancelled", "failed"]);
export const paymentTypeSchema = z.enum(["cash", "card", "bank_transfer"]);
export const paymentCreateSchema = z.object({
  studentId: z.coerce.number().int().positive().optional(),
  newStudent: z.object({firstName:z.string().trim().min(1).max(100), lastName:z.string().trim().min(1).max(100), phone:z.string().max(30).default(""), parentPhone:z.string().max(30).default("")}).optional(),
  teacherId: z.string().min(1).max(100), groupId:z.coerce.number().int().positive().optional(),
  paymentPeriod: periodSchema.optional(), amount:moneySchema, paymentType:paymentTypeSchema.default("cash"),
  status:paymentStatusSchema.default("completed"), notes:z.string().max(2000).nullable().optional(),
  sendSms:z.boolean().default(false),
}).refine(v => !!v.studentId !== !!v.newStudent, "O‘quvchini tanlang yoki yangi o‘quvchi kiriting");
export const paymentUpdateSchema = z.object({
  amount:moneySchema.optional(), paymentType:paymentTypeSchema.optional(), status:paymentStatusSchema.optional(),
  notes:z.string().max(2000).nullable().optional(), paymentPeriod:periodSchema.optional(),
}).strict();
export const collectionSchema = z.object({
  studentId:z.coerce.number().int().positive(), groupId:z.coerce.number().int().positive(),
  amount:z.coerce.number().pipe(moneySchema), paymentType:paymentTypeSchema.default("cash"),
  paymentPeriod:periodSchema.optional(), notes:z.string().max(2000).nullable().optional(),
});
export const balanceEffect = (amount:number, status:string) => status === "completed" ? amount : 0;
export function currentPaymentPeriod(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {timeZone:"Asia/Tashkent",year:"numeric",month:"2-digit"}).formatToParts(date);
  return `${parts.find(p=>p.type==='year')!.value}-${parts.find(p=>p.type==='month')!.value}`;
}
export function paymentMatchesGroup(payment:{groupId?:number|null;studentId:number;teacherId?:string|null}, group:{id:number;teacherId?:string|null}, memberships:Map<number,number[]>, teacherGroupIds:number[]) {
  if (payment.groupId != null) return payment.groupId === group.id;
  // Only use a legacy record when current membership resolves it without ambiguity.
  const candidates = (memberships.get(payment.studentId) || []).filter(id=>teacherGroupIds.includes(id));
  return payment.teacherId === group.teacherId && candidates.length === 1 && candidates[0] === group.id;
}
