import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import {
  type User,
  type InsertUser,
  type Tenant,
  type InsertTenant,
  type Lead,
  type InsertLead,
  type Student,
  type InsertStudent,
  type Subject,
  type InsertSubject,
  type Group,
  type InsertGroup,
  type StudentGroup,
  type InsertStudentGroup,
  type Attendance,
  type InsertAttendance,
  type Payment,
  type InsertPayment,
  type Grade,
  type InsertGrade,
  type Expense,
  type InsertExpense,
  type SubscriptionPlan,
  type InsertSubscriptionPlan,
  type TenantSubscription,
  type InsertTenantSubscription,
  type CashReceipt,
  type InsertCashReceipt,
  type CashReceiptLog,
  type InsertCashReceiptLog,
  users,
  tenants,
  leads,
  students,
  subjects,
  groups,
  studentGroups,
  attendance,
  payments,
  grades,
  expenses,
  subscriptionPlans,
  tenantSubscriptions,
  cashReceipts,
  cashReceiptLogs,
} from "@shared/schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

// Telefon raqamini normalizatsiya qilish (faqat raqamlar)
export function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return "";
  return phone.replace(/\D/g, "");
}

// Duplicate phone error class
export class DuplicatePhoneError extends Error {
  constructor(public entityType: "student" | "teacher", public phone: string) {
    super(`${entityType === "student" ? "O'quvchi" : "O'qituvchi"} telefon raqami (${phone}) allaqachon mavjud`);
    this.name = "DuplicatePhoneError";
  }
}

export interface IStorage {
  // Subscription Plans
  getSubscriptionPlans(): Promise<SubscriptionPlan[]>;
  getSubscriptionPlan(id: number): Promise<SubscriptionPlan | undefined>;
  createSubscriptionPlan(plan: InsertSubscriptionPlan): Promise<SubscriptionPlan>;
  updateSubscriptionPlan(id: number, plan: Partial<InsertSubscriptionPlan>): Promise<SubscriptionPlan | undefined>;
  
  // Tenants
  getTenants(): Promise<Tenant[]>;
  getTenant(id: number): Promise<Tenant | undefined>;
  getTenantBySlug(slug: string): Promise<Tenant | undefined>;
  createTenant(tenant: InsertTenant): Promise<Tenant>;
  updateTenant(id: number, tenant: Partial<InsertTenant>): Promise<Tenant | undefined>;
  decrementSmsCredits(tenantId: number): Promise<boolean>;
  
  // Tenant Subscriptions
  getTenantSubscriptions(tenantId: number): Promise<TenantSubscription[]>;
  createTenantSubscription(subscription: InsertTenantSubscription): Promise<TenantSubscription>;
  updateTenantSubscription(id: number, subscription: Partial<InsertTenantSubscription>): Promise<TenantSubscription | undefined>;
  
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByPhone(phone: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  deleteUser(id: string, tenantId: number): Promise<boolean>;
  getTeachers(tenantId: number): Promise<User[]>;
  getTeacher(id: string, tenantId: number): Promise<User | undefined>;
  updateTeacher(id: string, tenantId: number, teacher: Partial<InsertUser>): Promise<User | undefined>;
  getAdmins(tenantId: number): Promise<User[]>;
  getManagers(tenantId: number): Promise<User[]>;
  
  // Leads
  getLeads(tenantId: number): Promise<Lead[]>;
  getLead(id: number, tenantId: number): Promise<Lead | undefined>;
  createLead(lead: InsertLead): Promise<Lead>;
  updateLead(id: number, tenantId: number, lead: Partial<InsertLead>): Promise<Lead | undefined>;
  deleteLead(id: number, tenantId: number): Promise<boolean>;
  
  // Students
  getStudents(tenantId: number): Promise<Student[]>;
  getStudent(id: number, tenantId: number): Promise<Student | undefined>;
  getStudentsWithGroups(studentList: Student[], tenantId: number): Promise<any[]>;
  createStudent(student: InsertStudent): Promise<Student>;
  updateStudent(id: number, tenantId: number, student: Partial<InsertStudent>): Promise<Student | undefined>;
  deleteStudent(id: number, tenantId: number): Promise<boolean>;
  bulkDeleteStudents(studentIds: number[], tenantId: number): Promise<number>;
  
  // Subjects
  getSubjects(tenantId: number): Promise<Subject[]>;
  getSubject(id: number, tenantId: number): Promise<Subject | undefined>;
  createSubject(subject: InsertSubject): Promise<Subject>;
  updateSubject(id: number, tenantId: number, data: Partial<InsertSubject>): Promise<Subject | undefined>;
  deleteSubject(id: number, tenantId: number): Promise<boolean>;
  
  // Groups
  getGroups(tenantId: number): Promise<Group[]>;
  getGroup(id: number, tenantId: number): Promise<Group | undefined>;
  getGroupsByTeacher(teacherId: string, tenantId: number): Promise<Group[]>;
  getStudentsByGroup(groupId: number, tenantId: number): Promise<Student[]>;
  getStudentsByTeacher(teacherId: string, tenantId: number): Promise<Student[]>;
  getPaymentsByTeacher(teacherId: string, tenantId: number): Promise<Payment[]>;
  getAttendanceByTeacher(teacherId: string, tenantId: number, groupId?: number, month?: number, year?: number): Promise<Attendance[]>;
  getTeacherSalary(teacherId: string, tenantId: number, month: number, year: number): Promise<{ totalPayments: number; salaryPercent: number; salary: number }>;
  createGroup(group: InsertGroup): Promise<Group>;
  updateGroup(id: number, tenantId: number, group: Partial<InsertGroup>): Promise<Group | undefined>;
  deleteGroup(id: number, tenantId: number): Promise<boolean>;
  
  // Student Groups
  getStudentGroups(studentId: number, tenantId: number): Promise<StudentGroup[]>;
  addStudentToGroup(studentGroup: InsertStudentGroup): Promise<StudentGroup>;
  removeStudentFromGroup(studentId: number, groupId: number): Promise<boolean>;
  
  // Attendance
  getAttendance(tenantId: number, groupId?: number, date?: Date, month?: number, year?: number): Promise<Attendance[]>;
  getAttendanceById(id: number, tenantId: number): Promise<Attendance | undefined>;
  createAttendance(attendance: InsertAttendance): Promise<Attendance>;
  updateAttendance(id: number, tenantId: number, attendance: Partial<InsertAttendance>): Promise<Attendance | undefined>;
  
  // Payments
  getPayments(tenantId: number, studentId?: number): Promise<Payment[]>;
  getPayment(id: number, tenantId: number): Promise<Payment | undefined>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePayment(id: number, tenantId: number, data: Partial<InsertPayment>): Promise<Payment | undefined>;
  deletePayment(id: number, tenantId: number): Promise<boolean>;
  
  // Grades
  getGrades(tenantId: number, groupId?: number, studentId?: number, date?: Date, month?: number, year?: number): Promise<Grade[]>;
  getGradeById(id: number, tenantId: number): Promise<Grade | undefined>;
  createGrade(grade: InsertGrade): Promise<Grade>;
  updateGrade(id: number, tenantId: number, grade: Partial<InsertGrade>): Promise<Grade | undefined>;
  deleteGrade(id: number, tenantId: number): Promise<boolean>;
  
  // Expenses
  getExpenses(tenantId: number, month?: number, year?: number): Promise<Expense[]>;
  getExpensesByTeacher(teacherId: string, tenantId: number, startDate: Date, endDate: Date): Promise<Expense[]>;
  createExpense(expense: InsertExpense): Promise<Expense>;
  updateExpense(id: number, tenantId: number, data: Partial<InsertExpense>): Promise<Expense | undefined>;
  deleteExpense(id: number, tenantId: number): Promise<boolean>;

  // Statistics
  getStats(tenantId: number): Promise<{
    totalStudents: number;
    activeGroups: number;
    newLeads: number;
    monthlyIncome: number;
  }>;
  
  // Cash Receipts
  getCashReceipts(tenantId: number, filters?: { month?: number; year?: number; status?: string; submittedBy?: string }): Promise<CashReceipt[]>;
  getCashReceipt(id: number, tenantId: number): Promise<CashReceipt | undefined>;
  createCashReceipt(receipt: InsertCashReceipt): Promise<CashReceipt>;
  updateCashReceipt(id: number, tenantId: number, data: Partial<CashReceipt>): Promise<CashReceipt | undefined>;
  createCashReceiptLog(log: InsertCashReceiptLog): Promise<CashReceiptLog>;
  getCashReceiptLogs(cashReceiptId: number): Promise<CashReceiptLog[]>;

  // Finance Dashboard
  getFinanceDashboard(tenantId: number, month: number, year: number): Promise<{
    monthlyIncome: number;
    monthlyExpenses: number;
    netProfit: number;
    totalDebt: number;
    debtorCount: number;
    activeStudents: number;
    totalStudents: number;
    attendancePresent: number;
    attendanceAbsent: number;
    paymentCount: number;
    expenseCount: number;
  }>;
  
  // Telegram
  updateStudentTelegramChatId(studentId: number, chatId: string): Promise<void>;
  updateUserTelegramChatId(userId: string, chatId: string): Promise<void>;
  getStudentByTelegramChatId(chatId: string): Promise<Student | undefined>;
  getUserByTelegramChatId(chatId: string): Promise<User | undefined>;
}

export class DatabaseStorage implements IStorage {
  // Subscription Plans
  async getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    return await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.isActive, true));
  }

  async getSubscriptionPlan(id: number): Promise<SubscriptionPlan | undefined> {
    const result = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, id)).limit(1);
    return result[0];
  }

  async createSubscriptionPlan(plan: InsertSubscriptionPlan): Promise<SubscriptionPlan> {
    const result = await db.insert(subscriptionPlans).values(plan).returning();
    return result[0];
  }

  async updateSubscriptionPlan(id: number, plan: Partial<InsertSubscriptionPlan>): Promise<SubscriptionPlan | undefined> {
    const result = await db.update(subscriptionPlans).set(plan).where(eq(subscriptionPlans.id, id)).returning();
    return result[0];
  }

  // Tenants
  async getTenants(): Promise<Tenant[]> {
    return await db.select().from(tenants).orderBy(desc(tenants.createdAt));
  }

  async getTenant(id: number): Promise<Tenant | undefined> {
    const result = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
    return result[0];
  }

  async getTenantBySlug(slug: string): Promise<Tenant | undefined> {
    const result = await db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1);
    return result[0];
  }

  async createTenant(tenant: InsertTenant): Promise<Tenant> {
    const result = await db.insert(tenants).values(tenant).returning();
    return result[0];
  }

  async updateTenant(id: number, tenant: Partial<InsertTenant>): Promise<Tenant | undefined> {
    const result = await db.update(tenants).set(tenant).where(eq(tenants.id, id)).returning();
    return result[0];
  }

  async decrementSmsCredits(tenantId: number): Promise<boolean> {
    // Atomic update with concurrency-safe condition
    const result = await db.update(tenants)
      .set({ smsCredits: sql`${tenants.smsCredits} - 1` })
      .where(and(
        eq(tenants.id, tenantId),
        eq(tenants.smsEnabled, true),
        sql`${tenants.smsCredits} > 0`
      ))
      .returning();
    return result.length > 0;
  }

  // Tenant Subscriptions
  async getTenantSubscriptions(tenantId: number): Promise<TenantSubscription[]> {
    return await db.select().from(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, tenantId)).orderBy(desc(tenantSubscriptions.createdAt));
  }

  async createTenantSubscription(subscription: InsertTenantSubscription): Promise<TenantSubscription> {
    const result = await db.insert(tenantSubscriptions).values(subscription).returning();
    return result[0];
  }

  async updateTenantSubscription(id: number, subscription: Partial<InsertTenantSubscription>): Promise<TenantSubscription | undefined> {
    const result = await db.update(tenantSubscriptions).set(subscription).where(eq(tenantSubscriptions.id, id)).returning();
    return result[0];
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    // Clean the phone number - remove all non-digits
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Try different phone formats for matching
    const phoneVariants = [
      cleanPhone,                              // Full number: 998913609020
      cleanPhone.replace(/^998/, ''),          // Without country code: 913609020
      cleanPhone.replace(/^8/, ''),            // If starts with 8
      `+998${cleanPhone.replace(/^998/, '')}`, // With +998 prefix
      `998${cleanPhone.replace(/^998/, '')}`,  // With 998 prefix
    ];
    
    for (const variant of phoneVariants) {
      const result = await db.select().from(users).where(eq(users.phone, variant)).limit(1);
      if (result[0]) {
        return result[0];
      }
    }
    
    return undefined;
  }

  async createUser(user: InsertUser): Promise<User> {
    // O'qituvchi uchun telefon raqamini tekshirish
    if (user.role === 'teacher' && user.phone && user.tenantId) {
      const normalizedPhone = normalizePhone(user.phone);
      if (normalizedPhone) {
        const existing = await db.select().from(users).where(
          and(
            eq(users.tenantId, user.tenantId),
            eq(users.role, 'teacher'),
            sql`REGEXP_REPLACE(${users.phone}, '[^0-9]', '', 'g') = ${normalizedPhone}`
          )
        ).limit(1);
        if (existing.length > 0) {
          throw new DuplicatePhoneError("teacher", user.phone);
        }
      }
    }
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  async deleteUser(id: string, tenantId: number): Promise<boolean> {
    const result = await db.delete(users).where(and(eq(users.id, id), eq(users.tenantId, tenantId)));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getTeachers(tenantId: number): Promise<User[]> {
    return await db.select().from(users).where(and(eq(users.tenantId, tenantId), eq(users.role, 'teacher')));
  }

  async getManagers(tenantId: number): Promise<User[]> {
    return await db.select().from(users).where(and(eq(users.tenantId, tenantId), eq(users.role, 'manager')));
  }

  async getTeacher(id: string, tenantId: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(and(eq(users.id, id), eq(users.role, 'teacher'), eq(users.tenantId, tenantId))).limit(1);
    return result[0];
  }

  async updateTeacher(id: string, tenantId: number, teacher: Partial<InsertUser>): Promise<User | undefined> {
    // Telefon raqamini tekshirish (o'zidan boshqa)
    if (teacher.phone) {
      const normalizedPhone = normalizePhone(teacher.phone);
      if (normalizedPhone) {
        const existing = await db.select().from(users).where(
          and(
            eq(users.tenantId, tenantId),
            eq(users.role, 'teacher'),
            sql`${users.id} != ${id}`,
            sql`REGEXP_REPLACE(${users.phone}, '[^0-9]', '', 'g') = ${normalizedPhone}`
          )
        ).limit(1);
        if (existing.length > 0) {
          throw new DuplicatePhoneError("teacher", teacher.phone);
        }
      }
    }
    const result = await db.update(users).set(teacher).where(and(eq(users.id, id), eq(users.tenantId, tenantId), eq(users.role, 'teacher'))).returning();
    return result[0];
  }
  
  async getAdmins(tenantId: number): Promise<User[]> {
    return await db.select().from(users).where(and(eq(users.tenantId, tenantId), eq(users.role, 'markaz_admin')));
  }

  // Leads
  async getLeads(tenantId: number): Promise<Lead[]> {
    return await db.select().from(leads).where(eq(leads.tenantId, tenantId)).orderBy(desc(leads.createdAt));
  }

  async getLead(id: number, tenantId: number): Promise<Lead | undefined> {
    const result = await db.select().from(leads).where(and(eq(leads.id, id), eq(leads.tenantId, tenantId))).limit(1);
    return result[0];
  }

  async createLead(lead: InsertLead): Promise<Lead> {
    const result = await db.insert(leads).values(lead).returning();
    return result[0];
  }

  async updateLead(id: number, tenantId: number, lead: Partial<InsertLead>): Promise<Lead | undefined> {
    const result = await db.update(leads).set({ ...lead, updatedAt: new Date() }).where(and(eq(leads.id, id), eq(leads.tenantId, tenantId))).returning();
    return result[0];
  }

  async deleteLead(id: number, tenantId: number): Promise<boolean> {
    const result = await db.delete(leads).where(and(eq(leads.id, id), eq(leads.tenantId, tenantId)));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Students
  async getStudents(tenantId: number): Promise<Student[]> {
    return await db.select().from(students).where(eq(students.tenantId, tenantId)).orderBy(desc(students.createdAt));
  }

  async getStudent(id: number, tenantId: number): Promise<Student | undefined> {
    const result = await db.select().from(students).where(and(eq(students.id, id), eq(students.tenantId, tenantId))).limit(1);
    return result[0];
  }

  async getStudentsWithGroups(studentList: Student[], tenantId: number): Promise<any[]> {
    if (studentList.length === 0) return [];
    
    const studentIds = studentList.map(s => s.id);
    
    const sgRows = await db
      .select({
        studentId: studentGroups.studentId,
        groupName: groups.name,
        subjectName: subjects.name,
        teacherFirstName: users.firstName,
        teacherLastName: users.lastName,
      })
      .from(studentGroups)
      .innerJoin(groups, and(eq(studentGroups.groupId, groups.id), eq(groups.tenantId, tenantId)))
      .leftJoin(subjects, eq(groups.subjectId, subjects.id))
      .leftJoin(users, eq(groups.teacherId, users.id))
      .where(inArray(studentGroups.studentId, studentIds));

    const groupMap = new Map<number, { groups: string[]; subjects: string[]; teachers: string[] }>();
    for (const row of sgRows) {
      if (!groupMap.has(row.studentId)) {
        groupMap.set(row.studentId, { groups: [], subjects: [], teachers: [] });
      }
      const entry = groupMap.get(row.studentId)!;
      if (row.groupName) entry.groups.push(row.groupName);
      entry.subjects.push(row.subjectName || '');
      const teacherName = [row.teacherFirstName, row.teacherLastName].filter(Boolean).join(' ');
      if (teacherName && !entry.teachers.includes(teacherName)) entry.teachers.push(teacherName);
    }

    return studentList.map(student => ({
      ...student,
      groupNames: groupMap.get(student.id)?.groups || [],
      subjectNames: groupMap.get(student.id)?.subjects || [],
      teacherNames: groupMap.get(student.id)?.teachers || [],
    }));
  }

  async createStudent(student: InsertStudent): Promise<Student> {
    // Telefon raqamini tekshirish
    if (student.phone) {
      const normalizedPhone = normalizePhone(student.phone);
      if (normalizedPhone) {
        const existing = await db.select().from(students).where(
          and(
            eq(students.tenantId, student.tenantId),
            sql`REGEXP_REPLACE(${students.phone}, '[^0-9]', '', 'g') = ${normalizedPhone}`
          )
        ).limit(1);
        if (existing.length > 0) {
          throw new DuplicatePhoneError("student", student.phone);
        }
      }
    }
    const result = await db.insert(students).values(student).returning();
    return result[0];
  }

  async updateStudent(id: number, tenantId: number, student: Partial<InsertStudent>): Promise<Student | undefined> {
    // Telefon raqamini tekshirish (o'zidan boshqa)
    if (student.phone) {
      const normalizedPhone = normalizePhone(student.phone);
      if (normalizedPhone) {
        const existing = await db.select().from(students).where(
          and(
            eq(students.tenantId, tenantId),
            sql`${students.id} != ${id}`,
            sql`REGEXP_REPLACE(${students.phone}, '[^0-9]', '', 'g') = ${normalizedPhone}`
          )
        ).limit(1);
        if (existing.length > 0) {
          throw new DuplicatePhoneError("student", student.phone);
        }
      }
    }
    const result = await db.update(students).set({ ...student, updatedAt: new Date() }).where(and(eq(students.id, id), eq(students.tenantId, tenantId))).returning();
    return result[0];
  }

  async deleteStudent(id: number, tenantId: number): Promise<boolean> {
    const result = await db.delete(students).where(and(eq(students.id, id), eq(students.tenantId, tenantId)));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async bulkDeleteStudents(studentIds: number[], tenantId: number): Promise<number> {
    if (studentIds.length === 0) return 0;
    const tenantStudents = await db.select({ id: students.id }).from(students).where(and(inArray(students.id, studentIds), eq(students.tenantId, tenantId)));
    const validIds = tenantStudents.map(s => s.id);
    if (validIds.length === 0) return 0;
    await db.delete(studentGroups).where(inArray(studentGroups.studentId, validIds));
    const result = await db.delete(students).where(inArray(students.id, validIds));
    return result.rowCount || 0;
  }

  // Subjects
  async getSubjects(tenantId: number): Promise<Subject[]> {
    return await db.select().from(subjects).where(eq(subjects.tenantId, tenantId));
  }

  async getSubject(id: number, tenantId: number): Promise<Subject | undefined> {
    const result = await db.select().from(subjects).where(and(eq(subjects.id, id), eq(subjects.tenantId, tenantId))).limit(1);
    return result[0];
  }

  async createSubject(subject: InsertSubject): Promise<Subject> {
    const result = await db.insert(subjects).values(subject).returning();
    return result[0];
  }

  async updateSubject(id: number, tenantId: number, data: Partial<InsertSubject>): Promise<Subject | undefined> {
    const result = await db.update(subjects).set(data).where(and(eq(subjects.id, id), eq(subjects.tenantId, tenantId))).returning();
    return result[0];
  }

  async deleteSubject(id: number, tenantId: number): Promise<boolean> {
    const result = await db.delete(subjects).where(and(eq(subjects.id, id), eq(subjects.tenantId, tenantId)));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Groups
  async getGroups(tenantId: number): Promise<Group[]> {
    return await db.select().from(groups).where(eq(groups.tenantId, tenantId)).orderBy(desc(groups.createdAt));
  }

  async getGroup(id: number, tenantId: number): Promise<Group | undefined> {
    const result = await db.select().from(groups).where(and(eq(groups.id, id), eq(groups.tenantId, tenantId))).limit(1);
    return result[0];
  }

  async getGroupsByTeacher(teacherId: string, tenantId: number): Promise<Group[]> {
    return await db.select().from(groups).where(and(eq(groups.teacherId, teacherId), eq(groups.tenantId, tenantId))).orderBy(desc(groups.createdAt));
  }

  async getStudentsByGroup(groupId: number, tenantId: number): Promise<Student[]> {
    const result = await db
      .select({ student: students })
      .from(studentGroups)
      .innerJoin(students, eq(studentGroups.studentId, students.id))
      .where(and(eq(studentGroups.groupId, groupId), eq(students.tenantId, tenantId)));
    return result.map(r => r.student);
  }

  async getStudentsByTeacher(teacherId: string, tenantId: number): Promise<Student[]> {
    const teacherGroups = await this.getGroupsByTeacher(teacherId, tenantId);
    const groupIds = teacherGroups.map(g => g.id);
    if (groupIds.length === 0) return [];
    
    const result = await db
      .selectDistinct({ student: students })
      .from(studentGroups)
      .innerJoin(students, eq(studentGroups.studentId, students.id))
      .where(and(inArray(studentGroups.groupId, groupIds), eq(students.tenantId, tenantId)));
    return result.map(r => r.student);
  }

  async getPaymentsByTeacher(teacherId: string, tenantId: number): Promise<Payment[]> {
    const teacherStudents = await this.getStudentsByTeacher(teacherId, tenantId);
    const studentIds = teacherStudents.map(s => s.id);
    if (studentIds.length === 0) return [];
    
    return await db.select().from(payments)
      .where(and(inArray(payments.studentId, studentIds), eq(payments.tenantId, tenantId)))
      .orderBy(desc(payments.createdAt));
  }

  async getAttendanceByTeacher(teacherId: string, tenantId: number, groupId?: number, month?: number, year?: number): Promise<Attendance[]> {
    const teacherGroups = await this.getGroupsByTeacher(teacherId, tenantId);
    const groupIds = groupId ? [groupId] : teacherGroups.map(g => g.id);
    if (groupIds.length === 0) return [];
    
    const conditions = [inArray(attendance.groupId, groupIds), eq(attendance.tenantId, tenantId)];
    
    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      endDate.setHours(23, 59, 59, 999);
      conditions.push(sql`${attendance.date} >= ${startDate}`);
      conditions.push(sql`${attendance.date} <= ${endDate}`);
    }
    
    return await db.select().from(attendance).where(and(...conditions)).orderBy(desc(attendance.date));
  }

  async getTeacherSalary(teacherId: string, tenantId: number, month: number, year: number): Promise<{ totalPayments: number; salaryPercent: number; salary: number }> {
    const teacher = await this.getTeacher(teacherId, tenantId);
    const salaryPercent = teacher?.salaryPercent || 0;
    
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    endDate.setHours(23, 59, 59, 999);
    
    const result = await db.select({
      total: sql<number>`COALESCE(SUM(${payments.amount}), 0)`,
      totalEarning: sql<number>`COALESCE(SUM(${payments.teacherEarning}), 0)`,
    })
      .from(payments)
      .where(and(
        eq(payments.teacherId, teacherId),
        eq(payments.tenantId, tenantId),
        eq(payments.status, 'completed'),
        sql`${payments.createdAt} >= ${startDate}`,
        sql`${payments.createdAt} <= ${endDate}`
      ));
    
    const totalPayments = Number(result[0]?.total || 0);
    const salary = Number(result[0]?.totalEarning || 0) || Math.round(totalPayments * salaryPercent / 100);
    
    return { totalPayments, salaryPercent, salary };
  }

  async createGroup(group: InsertGroup): Promise<Group> {
    const result = await db.insert(groups).values(group).returning();
    return result[0];
  }

  async updateGroup(id: number, tenantId: number, group: Partial<InsertGroup>): Promise<Group | undefined> {
    const result = await db.update(groups).set(group).where(and(eq(groups.id, id), eq(groups.tenantId, tenantId))).returning();
    return result[0];
  }

  async deleteGroup(id: number, tenantId: number): Promise<boolean> {
    const result = await db.delete(groups).where(and(eq(groups.id, id), eq(groups.tenantId, tenantId)));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Student Groups
  async getStudentGroups(studentId: number, tenantId: number): Promise<StudentGroup[]> {
    const student = await this.getStudent(studentId, tenantId);
    if (!student) return [];
    return await db.select().from(studentGroups).where(eq(studentGroups.studentId, studentId));
  }

  async addStudentToGroup(studentGroup: InsertStudentGroup): Promise<StudentGroup> {
    const result = await db.insert(studentGroups).values(studentGroup).returning();
    return result[0];
  }

  async removeStudentFromGroup(studentId: number, groupId: number): Promise<boolean> {
    const result = await db.delete(studentGroups)
      .where(and(eq(studentGroups.studentId, studentId), eq(studentGroups.groupId, groupId)));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Attendance
  async getAttendance(tenantId: number, groupId?: number, date?: Date, month?: number, year?: number): Promise<Attendance[]> {
    const conditions = [eq(attendance.tenantId, tenantId)];
    
    if (groupId) {
      conditions.push(eq(attendance.groupId, groupId));
    }
    
    if (date) {
      conditions.push(eq(attendance.date, date));
    }
    
    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      endDate.setHours(23, 59, 59, 999);
      conditions.push(sql`${attendance.date} >= ${startDate}`);
      conditions.push(sql`${attendance.date} <= ${endDate}`);
    }
    
    return await db.select().from(attendance).where(and(...conditions)).orderBy(desc(attendance.date));
  }

  async getAttendanceById(id: number, tenantId: number): Promise<Attendance | undefined> {
    const result = await db.select().from(attendance).where(and(eq(attendance.id, id), eq(attendance.tenantId, tenantId))).limit(1);
    return result[0];
  }

  async createAttendance(att: InsertAttendance): Promise<Attendance> {
    const result = await db.insert(attendance).values(att).returning();
    return result[0];
  }

  async updateAttendance(id: number, tenantId: number, att: Partial<InsertAttendance>): Promise<Attendance | undefined> {
    const result = await db.update(attendance).set(att).where(and(eq(attendance.id, id), eq(attendance.tenantId, tenantId))).returning();
    return result[0];
  }

  // Payments
  async getPayments(tenantId: number, studentId?: number): Promise<Payment[]> {
    const conditions = [eq(payments.tenantId, tenantId)];
    
    if (studentId) {
      conditions.push(eq(payments.studentId, studentId));
    }
    
    return await db.select().from(payments).where(and(...conditions)).orderBy(desc(payments.createdAt));
  }

  async getPayment(id: number, tenantId: number): Promise<Payment | undefined> {
    const result = await db.select().from(payments).where(and(eq(payments.id, id), eq(payments.tenantId, tenantId))).limit(1);
    return result[0];
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    const result = await db.insert(payments).values(payment).returning();
    return result[0];
  }

  async updatePayment(id: number, tenantId: number, data: Partial<InsertPayment>): Promise<Payment | undefined> {
    const result = await db.update(payments).set(data).where(and(eq(payments.id, id), eq(payments.tenantId, tenantId))).returning();
    return result[0];
  }

  async deletePayment(id: number, tenantId: number): Promise<boolean> {
    const result = await db.delete(payments).where(and(eq(payments.id, id), eq(payments.tenantId, tenantId))).returning();
    return result.length > 0;
  }

  // Grades
  async getGrades(tenantId: number, groupId?: number, studentId?: number, date?: Date, month?: number, year?: number): Promise<Grade[]> {
    const conditions = [eq(grades.tenantId, tenantId)];
    
    if (groupId) {
      conditions.push(eq(grades.groupId, groupId));
    }
    
    if (studentId) {
      conditions.push(eq(grades.studentId, studentId));
    }
    
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      conditions.push(sql`${grades.date} >= ${startOfDay}`);
      conditions.push(sql`${grades.date} <= ${endOfDay}`);
    }
    
    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      endDate.setHours(23, 59, 59, 999);
      conditions.push(sql`${grades.date} >= ${startDate}`);
      conditions.push(sql`${grades.date} <= ${endDate}`);
    }
    
    return await db.select().from(grades).where(and(...conditions)).orderBy(desc(grades.date));
  }

  async getGradeById(id: number, tenantId: number): Promise<Grade | undefined> {
    const result = await db.select().from(grades).where(and(eq(grades.id, id), eq(grades.tenantId, tenantId))).limit(1);
    return result[0];
  }

  async createGrade(grade: InsertGrade): Promise<Grade> {
    const result = await db.insert(grades).values(grade).returning();
    return result[0];
  }

  async updateGrade(id: number, tenantId: number, grade: Partial<InsertGrade>): Promise<Grade | undefined> {
    const result = await db.update(grades).set(grade).where(and(eq(grades.id, id), eq(grades.tenantId, tenantId))).returning();
    return result[0];
  }

  async deleteGrade(id: number, tenantId: number): Promise<boolean> {
    const result = await db.delete(grades).where(and(eq(grades.id, id), eq(grades.tenantId, tenantId)));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Statistics
  async getStats(tenantId: number): Promise<{
    totalStudents: number;
    activeGroups: number;
    newLeads: number;
    monthlyIncome: number;
  }> {
    const totalStudents = await db.select({ count: sql<number>`count(*)::int` })
      .from(students)
      .where(and(eq(students.tenantId, tenantId), eq(students.status, 'active')));

    const activeGroups = await db.select({ count: sql<number>`count(*)::int` })
      .from(groups)
      .where(eq(groups.tenantId, tenantId));

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const newLeads = await db.select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .where(and(eq(leads.tenantId, tenantId), sql`${leads.createdAt} >= ${thirtyDaysAgo}`));

    const monthlyIncome = await db.select({ sum: sql<number>`COALESCE(SUM(${payments.amount}), 0)::int` })
      .from(payments)
      .where(and(
        eq(payments.tenantId, tenantId),
        eq(payments.status, 'completed'),
        sql`${payments.createdAt} >= ${thirtyDaysAgo}`
      ));

    return {
      totalStudents: totalStudents[0]?.count || 0,
      activeGroups: activeGroups[0]?.count || 0,
      newLeads: newLeads[0]?.count || 0,
      monthlyIncome: monthlyIncome[0]?.sum || 0,
    };
  }
  
  // Telegram
  async updateStudentTelegramChatId(studentId: number, chatId: string): Promise<void> {
    await db.update(students).set({ telegramChatId: chatId }).where(eq(students.id, studentId));
  }
  
  async updateUserTelegramChatId(userId: string, chatId: string): Promise<void> {
    await db.update(users).set({ telegramChatId: chatId }).where(eq(users.id, userId));
  }
  
  async getStudentByTelegramChatId(chatId: string): Promise<Student | undefined> {
    const result = await db.select().from(students).where(eq(students.telegramChatId, chatId)).limit(1);
    return result[0];
  }
  
  async getUserByTelegramChatId(chatId: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.telegramChatId, chatId)).limit(1);
    return result[0];
  }

  async getExpenses(tenantId: number, month?: number, year?: number): Promise<Expense[]> {
    const conditions = [eq(expenses.tenantId, tenantId)];
    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      endDate.setHours(23, 59, 59, 999);
      conditions.push(sql`${expenses.date} >= ${startDate}`);
      conditions.push(sql`${expenses.date} <= ${endDate}`);
    }
    return await db.select().from(expenses).where(and(...conditions)).orderBy(desc(expenses.date));
  }

  async getExpensesByTeacher(teacherId: string, tenantId: number, startDate: Date, endDate: Date): Promise<Expense[]> {
    return await db.select().from(expenses).where(
      and(
        eq(expenses.tenantId, tenantId),
        eq(expenses.teacherId, teacherId),
        eq(expenses.category, 'salary'),
        sql`${expenses.date} >= ${startDate}`,
        sql`${expenses.date} <= ${endDate}`
      )
    ).orderBy(desc(expenses.date));
  }

  async createExpense(expense: InsertExpense): Promise<Expense> {
    const result = await db.insert(expenses).values(expense).returning();
    return result[0];
  }

  async updateExpense(id: number, tenantId: number, data: Partial<InsertExpense>): Promise<Expense | undefined> {
    const result = await db.update(expenses).set(data).where(and(eq(expenses.id, id), eq(expenses.tenantId, tenantId))).returning();
    return result[0];
  }

  async deleteExpense(id: number, tenantId: number): Promise<boolean> {
    const result = await db.delete(expenses).where(and(eq(expenses.id, id), eq(expenses.tenantId, tenantId))).returning();
    return result.length > 0;
  }

  // Cash Receipts
  async getCashReceipts(tenantId: number, filters?: { month?: number; year?: number; status?: string; submittedBy?: string }): Promise<CashReceipt[]> {
    const conditions = [eq(cashReceipts.tenantId, tenantId)];
    if (filters?.status) {
      conditions.push(eq(cashReceipts.status, filters.status));
    }
    if (filters?.submittedBy) {
      conditions.push(eq(cashReceipts.submittedBy, filters.submittedBy));
    }
    if (filters?.month && filters?.year) {
      const startDate = new Date(filters.year, filters.month - 1, 1);
      const endDate = new Date(filters.year, filters.month, 0);
      endDate.setHours(23, 59, 59, 999);
      conditions.push(sql`${cashReceipts.submittedAt} >= ${startDate}`);
      conditions.push(sql`${cashReceipts.submittedAt} <= ${endDate}`);
    }
    return await db.select().from(cashReceipts).where(and(...conditions)).orderBy(desc(cashReceipts.submittedAt));
  }

  async getCashReceipt(id: number, tenantId: number): Promise<CashReceipt | undefined> {
    const result = await db.select().from(cashReceipts).where(and(eq(cashReceipts.id, id), eq(cashReceipts.tenantId, tenantId))).limit(1);
    return result[0];
  }

  async createCashReceipt(receipt: InsertCashReceipt): Promise<CashReceipt> {
    const result = await db.insert(cashReceipts).values(receipt).returning();
    return result[0];
  }

  async updateCashReceipt(id: number, tenantId: number, data: Partial<CashReceipt>): Promise<CashReceipt | undefined> {
    const result = await db.update(cashReceipts).set({ ...data, updatedAt: new Date() }).where(and(eq(cashReceipts.id, id), eq(cashReceipts.tenantId, tenantId))).returning();
    return result[0];
  }

  async createCashReceiptLog(log: InsertCashReceiptLog): Promise<CashReceiptLog> {
    const result = await db.insert(cashReceiptLogs).values(log).returning();
    return result[0];
  }

  async getCashReceiptLogs(cashReceiptId: number): Promise<CashReceiptLog[]> {
    return await db.select().from(cashReceiptLogs).where(eq(cashReceiptLogs.cashReceiptId, cashReceiptId)).orderBy(desc(cashReceiptLogs.createdAt));
  }

  // Finance Dashboard
  async getFinanceDashboard(tenantId: number, month: number, year: number): Promise<{
    monthlyIncome: number;
    monthlyExpenses: number;
    netProfit: number;
    totalDebt: number;
    debtorCount: number;
    activeStudents: number;
    totalStudents: number;
    attendancePresent: number;
    attendanceAbsent: number;
    paymentCount: number;
    expenseCount: number;
  }> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    endDate.setHours(23, 59, 59, 999);

    const incomeResult = await db.select({
      total: sql<number>`COALESCE(SUM(${payments.amount}), 0)::int`,
      count: sql<number>`COUNT(*)::int`,
    }).from(payments).where(and(
      eq(payments.tenantId, tenantId),
      eq(payments.status, 'completed'),
      sql`${payments.createdAt} >= ${startDate}`,
      sql`${payments.createdAt} <= ${endDate}`
    ));

    const expenseResult = await db.select({
      total: sql<number>`COALESCE(SUM(${expenses.amount}), 0)::int`,
      count: sql<number>`COUNT(*)::int`,
    }).from(expenses).where(and(
      eq(expenses.tenantId, tenantId),
      sql`${expenses.date} >= ${startDate}`,
      sql`${expenses.date} <= ${endDate}`
    ));

    const debtResult = await db.select({
      totalDebt: sql<number>`COALESCE(SUM(ABS(${students.balance})), 0)::int`,
      debtorCount: sql<number>`COUNT(*)::int`,
    }).from(students).where(and(
      eq(students.tenantId, tenantId),
      sql`${students.balance} <= 0`
    ));

    const studentCounts = await db.select({
      active: sql<number>`COUNT(*) FILTER (WHERE ${students.status} = 'active')::int`,
      total: sql<number>`COUNT(*)::int`,
    }).from(students).where(eq(students.tenantId, tenantId));

    const attendResult = await db.select({
      present: sql<number>`COUNT(*) FILTER (WHERE ${attendance.status} = 'present')::int`,
      absent: sql<number>`COUNT(*) FILTER (WHERE ${attendance.status} = 'absent')::int`,
    }).from(attendance).where(and(
      eq(attendance.tenantId, tenantId),
      sql`${attendance.date} >= ${startDate}`,
      sql`${attendance.date} <= ${endDate}`
    ));

    const mi = Number(incomeResult[0]?.total || 0);
    const me = Number(expenseResult[0]?.total || 0);

    return {
      monthlyIncome: mi,
      monthlyExpenses: me,
      netProfit: mi - me,
      totalDebt: Number(debtResult[0]?.totalDebt || 0),
      debtorCount: Number(debtResult[0]?.debtorCount || 0),
      activeStudents: Number(studentCounts[0]?.active || 0),
      totalStudents: Number(studentCounts[0]?.total || 0),
      attendancePresent: Number(attendResult[0]?.present || 0),
      attendanceAbsent: Number(attendResult[0]?.absent || 0),
      paymentCount: Number(incomeResult[0]?.count || 0),
      expenseCount: Number(expenseResult[0]?.count || 0),
    };
  }
}

export const storage = new DatabaseStorage();
