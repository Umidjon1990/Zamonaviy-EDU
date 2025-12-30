import { sql } from "drizzle-orm";
import { pgTable, text, serial, integer, timestamp, varchar, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Subscription Plans (Tarif rejalari)
export const subscriptionPlans = pgTable("subscription_plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // Starter, Professional, Enterprise
  price: integer("price").notNull(), // Oylik narx (so'm)
  maxStudents: integer("max_students").notNull(), // Maksimal o'quvchilar soni
  maxTeachers: integer("max_teachers").notNull(), // Maksimal o'qituvchilar soni
  maxGroups: integer("max_groups").notNull(), // Maksimal guruhlar soni
  features: text("features").array(), // ["sms", "telegram", "reports", "api"]
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlans).omit({
  id: true,
  createdAt: true,
});
export type InsertSubscriptionPlan = z.infer<typeof insertSubscriptionPlanSchema>;
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;

// Tenants (Markazlar)
export const tenants = pgTable("tenants", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug"), // URL uchun: markaz-nomi (unique bo'ladi)
  phone: text("phone").notNull(),
  email: text("email"),
  address: text("address"),
  logo: text("logo"), // Logo URL
  status: text("status").default("active").notNull(), // active, suspended, trial
  planId: integer("plan_id"), // Hozirgi tarif
  trialEndsAt: timestamp("trial_ends_at"), // Sinov muddati
  subscriptionEndsAt: timestamp("subscription_ends_at"), // Obuna muddati
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTenantSchema = createInsertSchema(tenants).omit({
  id: true,
  createdAt: true,
});
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Tenant = typeof tenants.$inferSelect;

// Tenant Subscriptions (Obuna tarixi)
export const tenantSubscriptions = pgTable("tenant_subscriptions", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  planId: integer("plan_id").notNull(),
  status: text("status").notNull(), // active, expired, cancelled
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  amount: integer("amount").notNull(), // To'langan summa
  paymentMethod: text("payment_method"), // payme, click, cash
  paymentId: text("payment_id"), // Tashqi to'lov ID
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTenantSubscriptionSchema = createInsertSchema(tenantSubscriptions).omit({
  id: true,
  createdAt: true,
});
export type InsertTenantSubscription = z.infer<typeof insertTenantSubscriptionSchema>;
export type TenantSubscription = typeof tenantSubscriptions.$inferSelect;

// Users (Foydalanuvchilar)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: integer("tenant_id").notNull(),
  email: text("email"),
  password: text("password").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  role: text("role").notNull(), // super_admin, markaz_admin, teacher, manager, student, parent
  phone: text("phone"),
  salaryPercent: integer("salary_percent").default(0), // O'qituvchi oylik foizi (masalan 30%)
  telegramChatId: text("telegram_chat_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Leads (Potentsial mijozlar)
export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone").notNull(),
  status: text("status").notNull(), // new, contacted, trial, converted, lost
  source: text("source").notNull(), // Instagram, Telegram, Walk-in, Referral
  interest: text("interest").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;

// Students (O'quvchilar)
export const students = pgTable("students", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone").notNull(),
  parentPhone: text("parent_phone").notNull(),
  status: text("status").notNull(), // active, paused, left
  balance: integer("balance").default(0).notNull(),
  telegramChatId: text("telegram_chat_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertStudentSchema = createInsertSchema(students).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type Student = typeof students.$inferSelect;

// Subjects (Fanlar)
export const subjects = pgTable("subjects", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSubjectSchema = createInsertSchema(subjects).omit({
  id: true,
  createdAt: true,
});
export type InsertSubject = z.infer<typeof insertSubjectSchema>;
export type Subject = typeof subjects.$inferSelect;

// Groups (Guruhlar)
export const groups = pgTable("groups", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  name: text("name").notNull(),
  subjectId: integer("subject_id").notNull(),
  teacherId: varchar("teacher_id").notNull(),
  level: text("level").notNull(), // Beginner, Intermediate, Advanced, A1, A2, B1, B2, C1, C2
  days: text("days").array().notNull(), // ["Du", "Chor", "Juma"]
  time: text("time").notNull(), // "14:00 - 15:30"
  room: text("room"),
  maxStudents: integer("max_students").default(15).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertGroupSchema = createInsertSchema(groups).omit({
  id: true,
  createdAt: true,
});
export type InsertGroup = z.infer<typeof insertGroupSchema>;
export type Group = typeof groups.$inferSelect;

// Student Groups (O'quvchi-Guruh aloqasi)
export const studentGroups = pgTable("student_groups", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull(),
  groupId: integer("group_id").notNull(),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

export const insertStudentGroupSchema = createInsertSchema(studentGroups).omit({
  id: true,
  joinedAt: true,
});
export type InsertStudentGroup = z.infer<typeof insertStudentGroupSchema>;
export type StudentGroup = typeof studentGroups.$inferSelect;

// Attendance (Davomat)
export const attendance = pgTable("attendance", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  studentId: integer("student_id").notNull(),
  groupId: integer("group_id").notNull(),
  date: timestamp("date").notNull(),
  status: text("status").notNull(), // present, absent, late
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAttendanceSchema = createInsertSchema(attendance).omit({
  id: true,
  createdAt: true,
});
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type Attendance = typeof attendance.$inferSelect;

// Payments (To'lovlar)
export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  studentId: integer("student_id").notNull(),
  amount: integer("amount").notNull(),
  paymentType: text("payment_type").notNull(), // cash, card, bank_transfer
  status: text("status").notNull(), // completed, pending, failed
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true,
});
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof payments.$inferSelect;
