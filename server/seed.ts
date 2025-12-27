import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;
import {
  tenants,
  users,
  leads,
  students,
  subjects,
  groups,
  studentGroups,
  payments,
} from "../shared/schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

async function seed() {
  try {
    console.log("🌱 Boshlang'ich ma'lumotlarni yuklash boshlandi...");

    // 1. Create Tenant
    const [tenant] = await db
      .insert(tenants)
      .values({
        name: "EduCRM O'quv Markazi",
        phone: "+998 90 123 45 67",
        address: "Toshkent sh., Yunusobod t., 12-uy",
      })
      .onConflictDoNothing()
      .returning();

    const tenantId = tenant?.id || 1;
    console.log("✅ Markaz yaratildi:", tenant?.name);

    // 2. Create Users (Teachers)
    const teacherIds: string[] = [];
    const teacherData = [
      { email: "dilshod@educrm.uz", firstName: "Dilshod", lastName: "Umarov" },
      { email: "elena@educrm.uz", firstName: "Elena", lastName: "Petrova" },
      { email: "sanjar@educrm.uz", firstName: "Sanjar", lastName: "Karimov" },
    ];

    for (const teacher of teacherData) {
      const [user] = await db
        .insert(users)
        .values({
          tenantId,
          email: teacher.email,
          password: "password123", // In production, hash this!
          firstName: teacher.firstName,
          lastName: teacher.lastName,
          role: "teacher",
          phone: "+998 90 000 00 00",
        })
        .onConflictDoNothing()
        .returning();
      
      if (user) teacherIds.push(user.id);
    }
    console.log("✅ O'qituvchilar yaratildi:", teacherIds.length);

    // 3. Create Subjects
    const subjectNames = ["English", "Math", "Russian", "IELTS"];
    const subjectIds: number[] = [];

    for (const name of subjectNames) {
      const [subject] = await db
        .insert(subjects)
        .values({
          tenantId,
          name,
          description: `${name} fanidan darslar`,
        })
        .onConflictDoNothing()
        .returning();
      
      if (subject) subjectIds.push(subject.id);
    }
    console.log("✅ Fanlar yaratildi:", subjectIds.length);

    // 4. Create Leads
    const leadData = [
      { firstName: "Sardor", lastName: "Komilov", phone: "+998 90 123 45 00", status: "new", source: "Instagram", interest: "English" },
      { firstName: "Zarina", lastName: "Yusupova", phone: "+998 91 987 65 00", status: "contacted", source: "Telegram", interest: "IELTS" },
      { firstName: "Bekzod", lastName: "Nurmatov", phone: "+998 93 555 66 00", status: "trial", source: "Walk-in", interest: "Math" },
      { firstName: "Laylo", lastName: "Sharipova", phone: "+998 99 888 99 00", status: "converted", source: "Referral", interest: "Russian" },
      { firstName: "Jamshid", lastName: "Qodirov", phone: "+998 97 123 12 00", status: "lost", source: "Instagram", interest: "English" },
    ];

    for (const lead of leadData) {
      await db.insert(leads).values({
        tenantId,
        ...lead,
        notes: "Test lid",
      }).onConflictDoNothing();
    }
    console.log("✅ Lidlar yaratildi:", leadData.length);

    // 5. Create Students
    const studentData = [
      { firstName: "Aziz", lastName: "Rahimov", phone: "+998 90 111 22 33", parentPhone: "+998 90 111 22 34", status: "active", balance: 500000 },
      { firstName: "Malika", lastName: "Karimova", phone: "+998 91 222 33 44", parentPhone: "+998 91 222 33 45", status: "active", balance: -100000 },
      { firstName: "Jasur", lastName: "Tursunov", phone: "+998 93 444 55 66", parentPhone: "+998 93 444 55 67", status: "paused", balance: 0 },
      { firstName: "Dilnoza", lastName: "Aliyeva", phone: "+998 99 777 88 99", parentPhone: "+998 99 777 88 00", status: "active", balance: 1200000 },
      { firstName: "Otabek", lastName: "Usmonov", phone: "+998 97 321 32 32", parentPhone: "+998 97 321 32 33", status: "left", balance: 0 },
    ];

    const studentIds: number[] = [];
    for (const student of studentData) {
      const [created] = await db.insert(students).values({
        tenantId,
        ...student,
      }).onConflictDoNothing().returning();
      
      if (created) studentIds.push(created.id);
    }
    console.log("✅ O'quvchilar yaratildi:", studentIds.length);

    // 6. Create Groups
    const groupData = [
      {
        name: "English Beginners A1",
        subjectId: subjectIds[0],
        teacherId: teacherIds[0] || "default-teacher-id",
        level: "Beginner",
        days: ["Dushanba", "Chorshanba", "Juma"],
        time: "14:00 - 15:30",
        room: "Xona 1",
        maxStudents: 12,
      },
      {
        name: "IELTS Preparation",
        subjectId: subjectIds[3] || subjectIds[0],
        teacherId: teacherIds[1] || "default-teacher-id",
        level: "Advanced",
        days: ["Seshanba", "Payshanba", "Shanba"],
        time: "16:00 - 18:00",
        room: "Xona 3",
        maxStudents: 10,
      },
      {
        name: "Math School Program",
        subjectId: subjectIds[1],
        teacherId: teacherIds[2] || "default-teacher-id",
        level: "Intermediate",
        days: ["Dushanba", "Chorshanba", "Juma"],
        time: "10:00 - 11:30",
        room: "Xona 2",
        maxStudents: 15,
      },
    ];

    const groupIds: number[] = [];
    for (const group of groupData) {
      const [created] = await db.insert(groups).values({
        tenantId,
        ...group,
      }).onConflictDoNothing().returning();
      
      if (created) groupIds.push(created.id);
    }
    console.log("✅ Guruhlar yaratildi:", groupIds.length);

    // 7. Assign students to groups
    if (studentIds.length > 0 && groupIds.length > 0) {
      await db.insert(studentGroups).values([
        { studentId: studentIds[0], groupId: groupIds[0] },
        { studentId: studentIds[1], groupId: groupIds[1] },
        { studentId: studentIds[2], groupId: groupIds[0] },
        { studentId: studentIds[3], groupId: groupIds[2] },
      ]).onConflictDoNothing();
      console.log("✅ O'quvchilar guruhlarga biriktirildi");
    }

    // 8. Create Payments
    if (studentIds.length > 0) {
      const paymentData = [
        { studentId: studentIds[0], amount: 500000, paymentType: "cash", status: "completed" },
        { studentId: studentIds[1], amount: 450000, paymentType: "card", status: "completed" },
        { studentId: studentIds[2], amount: 500000, paymentType: "card", status: "pending" },
        { studentId: studentIds[3], amount: 1200000, paymentType: "bank_transfer", status: "completed" },
      ];

      for (const payment of paymentData) {
        await db.insert(payments).values({
          tenantId,
          ...payment,
          notes: "Oylik to'lov",
        }).onConflictDoNothing();
      }
      console.log("✅ To'lovlar yaratildi:", paymentData.length);
    }

    console.log("🎉 Boshlang'ich ma'lumotlar muvaffaqiyatli yuklandi!");
  } catch (error) {
    console.error("❌ Xatolik:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

seed();
