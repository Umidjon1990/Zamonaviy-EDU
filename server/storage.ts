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
  type SubscriptionPlan,
  type InsertSubscriptionPlan,
  type TenantSubscription,
  type InsertTenantSubscription,
  users,
  tenants,
  leads,
  students,
  subjects,
  groups,
  studentGroups,
  attendance,
  payments,
  subscriptionPlans,
  tenantSubscriptions,
} from "@shared/schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

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
  
  // Tenant Subscriptions
  getTenantSubscriptions(tenantId: number): Promise<TenantSubscription[]>;
  createTenantSubscription(subscription: InsertTenantSubscription): Promise<TenantSubscription>;
  updateTenantSubscription(id: number, subscription: Partial<InsertTenantSubscription>): Promise<TenantSubscription | undefined>;
  
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByPhone(phone: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  deleteUser(id: string): Promise<boolean>;
  getTeachers(tenantId: number): Promise<User[]>;
  getTeacher(id: string): Promise<User | undefined>;
  getAdmins(tenantId: number): Promise<User[]>;
  
  // Leads
  getLeads(tenantId: number): Promise<Lead[]>;
  getLead(id: number): Promise<Lead | undefined>;
  createLead(lead: InsertLead): Promise<Lead>;
  updateLead(id: number, lead: Partial<InsertLead>): Promise<Lead | undefined>;
  deleteLead(id: number): Promise<boolean>;
  
  // Students
  getStudents(tenantId: number): Promise<Student[]>;
  getStudent(id: number): Promise<Student | undefined>;
  createStudent(student: InsertStudent): Promise<Student>;
  updateStudent(id: number, student: Partial<InsertStudent>): Promise<Student | undefined>;
  deleteStudent(id: number): Promise<boolean>;
  
  // Subjects
  getSubjects(tenantId: number): Promise<Subject[]>;
  getSubject(id: number): Promise<Subject | undefined>;
  createSubject(subject: InsertSubject): Promise<Subject>;
  
  // Groups
  getGroups(tenantId: number): Promise<Group[]>;
  getGroup(id: number): Promise<Group | undefined>;
  getGroupsByTeacher(teacherId: string): Promise<Group[]>;
  getStudentsByGroup(groupId: number): Promise<Student[]>;
  getStudentsByTeacher(teacherId: string): Promise<Student[]>;
  createGroup(group: InsertGroup): Promise<Group>;
  updateGroup(id: number, group: Partial<InsertGroup>): Promise<Group | undefined>;
  deleteGroup(id: number): Promise<boolean>;
  
  // Student Groups
  getStudentGroups(studentId: number): Promise<StudentGroup[]>;
  addStudentToGroup(studentGroup: InsertStudentGroup): Promise<StudentGroup>;
  removeStudentFromGroup(studentId: number, groupId: number): Promise<boolean>;
  
  // Attendance
  getAttendance(tenantId: number, groupId?: number, date?: Date, month?: number, year?: number): Promise<Attendance[]>;
  getAttendanceById(id: number): Promise<Attendance | undefined>;
  createAttendance(attendance: InsertAttendance): Promise<Attendance>;
  updateAttendance(id: number, attendance: Partial<InsertAttendance>): Promise<Attendance | undefined>;
  
  // Payments
  getPayments(tenantId: number, studentId?: number): Promise<Payment[]>;
  getPayment(id: number): Promise<Payment | undefined>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  
  // Statistics
  getStats(tenantId: number): Promise<{
    totalStudents: number;
    activeGroups: number;
    newLeads: number;
    monthlyIncome: number;
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
    const result = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getTeachers(tenantId: number): Promise<User[]> {
    return await db.select().from(users).where(and(eq(users.tenantId, tenantId), eq(users.role, 'teacher')));
  }

  async getTeacher(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(and(eq(users.id, id), eq(users.role, 'teacher'))).limit(1);
    return result[0];
  }
  
  async getAdmins(tenantId: number): Promise<User[]> {
    return await db.select().from(users).where(and(eq(users.tenantId, tenantId), eq(users.role, 'markaz_admin')));
  }

  // Leads
  async getLeads(tenantId: number): Promise<Lead[]> {
    return await db.select().from(leads).where(eq(leads.tenantId, tenantId)).orderBy(desc(leads.createdAt));
  }

  async getLead(id: number): Promise<Lead | undefined> {
    const result = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
    return result[0];
  }

  async createLead(lead: InsertLead): Promise<Lead> {
    const result = await db.insert(leads).values(lead).returning();
    return result[0];
  }

  async updateLead(id: number, lead: Partial<InsertLead>): Promise<Lead | undefined> {
    const result = await db.update(leads).set({ ...lead, updatedAt: new Date() }).where(eq(leads.id, id)).returning();
    return result[0];
  }

  async deleteLead(id: number): Promise<boolean> {
    const result = await db.delete(leads).where(eq(leads.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Students
  async getStudents(tenantId: number): Promise<Student[]> {
    return await db.select().from(students).where(eq(students.tenantId, tenantId)).orderBy(desc(students.createdAt));
  }

  async getStudent(id: number): Promise<Student | undefined> {
    const result = await db.select().from(students).where(eq(students.id, id)).limit(1);
    return result[0];
  }

  async createStudent(student: InsertStudent): Promise<Student> {
    const result = await db.insert(students).values(student).returning();
    return result[0];
  }

  async updateStudent(id: number, student: Partial<InsertStudent>): Promise<Student | undefined> {
    const result = await db.update(students).set({ ...student, updatedAt: new Date() }).where(eq(students.id, id)).returning();
    return result[0];
  }

  async deleteStudent(id: number): Promise<boolean> {
    const result = await db.delete(students).where(eq(students.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Subjects
  async getSubjects(tenantId: number): Promise<Subject[]> {
    return await db.select().from(subjects).where(eq(subjects.tenantId, tenantId));
  }

  async getSubject(id: number): Promise<Subject | undefined> {
    const result = await db.select().from(subjects).where(eq(subjects.id, id)).limit(1);
    return result[0];
  }

  async createSubject(subject: InsertSubject): Promise<Subject> {
    const result = await db.insert(subjects).values(subject).returning();
    return result[0];
  }

  // Groups
  async getGroups(tenantId: number): Promise<Group[]> {
    return await db.select().from(groups).where(eq(groups.tenantId, tenantId)).orderBy(desc(groups.createdAt));
  }

  async getGroup(id: number): Promise<Group | undefined> {
    const result = await db.select().from(groups).where(eq(groups.id, id)).limit(1);
    return result[0];
  }

  async getGroupsByTeacher(teacherId: string): Promise<Group[]> {
    return await db.select().from(groups).where(eq(groups.teacherId, teacherId)).orderBy(desc(groups.createdAt));
  }

  async getStudentsByGroup(groupId: number): Promise<Student[]> {
    const result = await db
      .select({ student: students })
      .from(studentGroups)
      .innerJoin(students, eq(studentGroups.studentId, students.id))
      .where(eq(studentGroups.groupId, groupId));
    return result.map(r => r.student);
  }

  async getStudentsByTeacher(teacherId: string): Promise<Student[]> {
    const teacherGroups = await this.getGroupsByTeacher(teacherId);
    const groupIds = teacherGroups.map(g => g.id);
    if (groupIds.length === 0) return [];
    
    const result = await db
      .selectDistinct({ student: students })
      .from(studentGroups)
      .innerJoin(students, eq(studentGroups.studentId, students.id))
      .where(inArray(studentGroups.groupId, groupIds));
    return result.map(r => r.student);
  }

  async createGroup(group: InsertGroup): Promise<Group> {
    const result = await db.insert(groups).values(group).returning();
    return result[0];
  }

  async updateGroup(id: number, group: Partial<InsertGroup>): Promise<Group | undefined> {
    const result = await db.update(groups).set(group).where(eq(groups.id, id)).returning();
    return result[0];
  }

  async deleteGroup(id: number): Promise<boolean> {
    const result = await db.delete(groups).where(eq(groups.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Student Groups
  async getStudentGroups(studentId: number): Promise<StudentGroup[]> {
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

  async getAttendanceById(id: number): Promise<Attendance | undefined> {
    const result = await db.select().from(attendance).where(eq(attendance.id, id)).limit(1);
    return result[0];
  }

  async createAttendance(att: InsertAttendance): Promise<Attendance> {
    const result = await db.insert(attendance).values(att).returning();
    return result[0];
  }

  async updateAttendance(id: number, att: Partial<InsertAttendance>): Promise<Attendance | undefined> {
    const result = await db.update(attendance).set(att).where(eq(attendance.id, id)).returning();
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

  async getPayment(id: number): Promise<Payment | undefined> {
    const result = await db.select().from(payments).where(eq(payments.id, id)).limit(1);
    return result[0];
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    const result = await db.insert(payments).values(payment).returning();
    return result[0];
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
}

export const storage = new DatabaseStorage();
