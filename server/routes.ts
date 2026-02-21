import type { Express } from "express";
import { createServer, type Server } from "http";
import bcrypt from "bcrypt";
import * as XLSX from "xlsx";
import { storage, DuplicatePhoneError } from "./storage";
import { sendSMS, getBalance, smsTemplates, sendPaymentReceivedSMS, sendLowBalanceSMS, sendAbsenceSMS } from "./sms";
import { notifyStudentAttendance, notifyStudentPayment, sendPaymentReceipt } from "./telegram-bot";
import { verifyObjectPath } from "./replit_integrations/object_storage/routes";
import {
  type Student,
  insertLeadSchema,
  insertStudentSchema,
  insertSubjectSchema,
  insertGroupSchema,
  insertStudentGroupSchema,
  insertAttendanceSchema,
  insertPaymentSchema,
  insertGradeSchema,
  insertExpenseSchema,
  insertTenantSchema,
  insertSubscriptionPlanSchema,
  insertTenantSubscriptionSchema,
} from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // ===== TENANT AUTHENTICATION =====
  
  // Middleware to require tenant authentication
  const requireTenantAuth = (req: any, res: any, next: any) => {
    if (!req.session.tenantId || !req.session.userId) {
      return res.status(401).json({ error: "Avtorizatsiya talab qilinadi" });
    }
    next();
  };

  // Get tenant ID from session - throws if not authenticated
  const getTenantId = (req: any): number => {
    if (!req.session.tenantId) {
      throw new Error("Tenant ID not found in session");
    }
    return req.session.tenantId;
  };

  // Get user ID from session
  const getUserId = (req: any): string => {
    if (!req.session.userId) {
      throw new Error("User ID not found in session");
    }
    return req.session.userId;
  };

  // Get user role from session
  const getUserRole = (req: any): string => {
    return req.session.role || "";
  };

  // Check if user is teacher
  const isTeacher = (req: any): boolean => {
    return req.session.role === "teacher";
  };

  // Login for tenant admins/staff
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { phone, password } = req.body;
      if (!phone || !password) {
        return res.status(400).json({ error: "Telefon va parol kiritilishi shart" });
      }

      // Clean phone number
      const cleanPhone = phone.replace(/\D/g, '');
      
      // Find user by phone
      const user = await storage.getUserByPhone(cleanPhone);
      if (!user) {
        return res.status(401).json({ error: "Telefon yoki parol noto'g'ri" });
      }

      // Password check using bcrypt
      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        return res.status(401).json({ error: "Telefon yoki parol noto'g'ri" });
      }

      // Check if tenant is active
      const tenant = await storage.getTenant(user.tenantId);
      if (!tenant) {
        return res.status(401).json({ error: "Markaz topilmadi" });
      }
      if (tenant.status === "suspended") {
        return res.status(403).json({ error: "Markaz obunasi to'xtatilgan. Admin bilan bog'laning." });
      }

      // Set session
      req.session.userId = user.id;
      req.session.tenantId = user.tenantId;
      req.session.role = user.role;

      res.json({
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          phone: user.phone,
        },
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Tizim xatosi" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Chiqishda xato" });
      }
      res.json({ success: true });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId || !req.session.tenantId) {
      return res.status(401).json({ error: "Avtorizatsiya talab qilinadi" });
    }
    try {
      const user = await storage.getUser(req.session.userId);
      const tenant = await storage.getTenant(req.session.tenantId);
      
      if (!user || !tenant) {
        return res.status(401).json({ error: "Foydalanuvchi topilmadi" });
      }
      
      if (user.tenantId !== tenant.id) {
        req.session.destroy(() => {});
        return res.status(401).json({ error: "Session xatosi. Qayta kiring." });
      }
      
      res.json({
        userId: user.id,
        tenantId: tenant.id,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        tenantName: tenant.name,
        tenantLogo: tenant.logo,
      });
    } catch (error) {
      console.error("Auth me error:", error);
      res.status(500).json({ error: "Tizim xatosi" });
    }
  });

  // Apply requireTenantAuth to all tenant data routes
  app.use("/api/leads", requireTenantAuth);
  app.use("/api/students", requireTenantAuth);
  app.use("/api/subjects", requireTenantAuth);
  app.use("/api/groups", requireTenantAuth);
  app.use("/api/attendance", requireTenantAuth);
  app.use("/api/payments", requireTenantAuth);
  app.use("/api/grades", requireTenantAuth);
  app.use("/api/teachers", requireTenantAuth);
  app.use("/api/stats", requireTenantAuth);
  app.use("/api/tenant-sms", requireTenantAuth);

  // ===== TENANT SMS STATUS =====
  app.get("/api/tenant-sms", async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      res.json({
        smsEnabled: tenant.smsEnabled,
        smsCredits: tenant.smsCredits,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch SMS status" });
    }
  });

  // ===== TENANT BRANDING =====
  app.use("/api/branding", requireTenantAuth);

  app.get("/api/branding", async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      res.json({
        logo: tenant.logo,
        receiptTitle: tenant.receiptTitle,
        telegramChannel: tenant.telegramChannel,
        name: tenant.name,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch branding" });
    }
  });

  app.patch("/api/branding", async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      const { logo, receiptTitle, telegramChannel } = req.body;

      // Validate logo URL - must be a valid HTTPS URL or empty
      let validatedLogo = logo;
      if (logo && logo.trim() !== "") {
        const trimmedLogo = logo.trim();
        // Only allow https URLs for security
        if (!trimmedLogo.startsWith("https://") && !trimmedLogo.startsWith("http://")) {
          return res.status(400).json({ error: "Logo URL must start with https:// or http://" });
        }
        // Basic URL validation
        try {
          new URL(trimmedLogo);
          validatedLogo = trimmedLogo;
        } catch {
          return res.status(400).json({ error: "Invalid logo URL" });
        }
      } else {
        validatedLogo = null;
      }

      // Normalize and validate telegram channel
      let validatedTelegramChannel = telegramChannel;
      if (telegramChannel) {
        // Remove any HTML/script tags for security
        const sanitized = telegramChannel.replace(/<[^>]*>/g, "").trim();
        // Only allow valid telegram formats: @username, t.me/username, or https://t.me/username
        if (sanitized.startsWith("@") || sanitized.includes("t.me/") || sanitized.length === 0) {
          validatedTelegramChannel = sanitized;
        } else {
          return res.status(400).json({ error: "Invalid telegram channel format" });
        }
      }

      // Sanitize receipt title - remove any HTML tags
      const validatedReceiptTitle = receiptTitle ? receiptTitle.replace(/<[^>]*>/g, "").trim() : receiptTitle;

      const updated = await storage.updateTenant(tenantId, {
        logo: validatedLogo,
        receiptTitle: validatedReceiptTitle,
        telegramChannel: validatedTelegramChannel,
      });
      res.json({
        logo: updated?.logo,
        receiptTitle: updated?.receiptTitle,
        telegramChannel: updated?.telegramChannel,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to update branding" });
    }
  });

  // ===== LEADS =====
  app.get("/api/leads", async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      const leads = await storage.getLeads(tenantId);
      res.json(leads);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch leads" });
    }
  });

  app.get("/api/leads/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const tenantId = getTenantId(req);
      const lead = await storage.getLead(id, tenantId);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      res.json(lead);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch lead" });
    }
  });

  app.post("/api/leads", async (req, res) => {
    try {
      const data = insertLeadSchema.parse({ ...req.body, tenantId: getTenantId(req) });
      const lead = await storage.createLead(data);
      res.status(201).json(lead);
    } catch (error) {
      res.status(400).json({ error: "Invalid lead data" });
    }
  });

  app.patch("/api/leads/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const tenantId = getTenantId(req);
      const lead = await storage.getLead(id, tenantId);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      const updated = await storage.updateLead(id, tenantId, req.body);
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Failed to update lead" });
    }
  });

  app.delete("/api/leads/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const tenantId = getTenantId(req);
      const lead = await storage.getLead(id, tenantId);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      await storage.deleteLead(id, tenantId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete lead" });
    }
  });

  // ===== STUDENTS =====
  app.get("/api/students", async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      let studentList: Student[];
      
      if (isTeacher(req)) {
        studentList = await storage.getStudentsByTeacher(getUserId(req), tenantId);
      } else {
        studentList = await storage.getStudents(tenantId);
      }

      const enriched = await storage.getStudentsWithGroups(studentList, tenantId);
      res.json(enriched);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch students" });
    }
  });

  app.get("/api/students/unassigned", async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      const allStudents = await storage.getStudents(tenantId);
      const unassigned = [];
      for (const student of allStudents) {
        const groups = await storage.getStudentGroups(student.id, tenantId);
        if (groups.length === 0) {
          unassigned.push(student);
        }
      }
      res.json(unassigned);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch unassigned students" });
    }
  });

  app.get("/api/students/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const tenantId = getTenantId(req);
      const student = await storage.getStudent(id, tenantId);
      if (!student) {
        return res.status(404).json({ error: "Student not found" });
      }
      res.json(student);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch student" });
    }
  });

  app.post("/api/students", async (req, res) => {
    try {
      const data = insertStudentSchema.parse({ ...req.body, tenantId: getTenantId(req) });
      const student = await storage.createStudent(data);
      res.status(201).json(student);
    } catch (error) {
      if (error instanceof DuplicatePhoneError) {
        return res.status(409).json({ error: error.message });
      }
      res.status(400).json({ error: "Invalid student data" });
    }
  });

  app.patch("/api/students/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const tenantId = getTenantId(req);
      const existing = await storage.getStudent(id, tenantId);
      if (!existing) {
        return res.status(404).json({ error: "Student not found" });
      }
      const student = await storage.updateStudent(id, tenantId, req.body);
      res.json(student);
    } catch (error) {
      if (error instanceof DuplicatePhoneError) {
        return res.status(409).json({ error: error.message });
      }
      res.status(400).json({ error: "Failed to update student" });
    }
  });

  app.delete("/api/students/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const tenantId = getTenantId(req);
      const existing = await storage.getStudent(id, tenantId);
      if (!existing) {
        return res.status(404).json({ error: "Student not found" });
      }
      await storage.deleteStudent(id, tenantId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete student" });
    }
  });

  // ===== STUDENTS EXCEL IMPORT/EXPORT =====
  const studentTemplateColumns = ["Ism", "Familiya", "Telefon", "Ota-ona telefoni", "Guruh nomi", "Fan nomi", "Kunlari", "Vaqti", "Xonasi", "Oqituvchi"];
  const studentTemplateData = [
    { "Ism": "Marjona", "Familiya": "Abdurahimova", "Telefon": "998934980287", "Ota-ona telefoni": "", "Guruh nomi": "Ingliz tili 1-guruh", "Fan nomi": "Ingliz tili", "Kunlari": "Du-Cho-Ju", "Vaqti": "13:30", "Xonasi": "7 xona", "Oqituvchi": "Bositxon" },
    { "Ism": "Zebiniso", "Familiya": "Sodiqova", "Telefon": "998949137363", "Ota-ona telefoni": "", "Guruh nomi": "Ingliz tili 1-guruh", "Fan nomi": "Ingliz tili", "Kunlari": "Du-Cho-Ju", "Vaqti": "13:30", "Xonasi": "7 xona", "Oqituvchi": "Bositxon" },
  ];

  app.get("/api/students/excel/template-info", requireTenantAuth, (req, res) => {
    res.json({ columns: studentTemplateColumns, data: studentTemplateData });
  });

  app.get("/api/students/excel/template", requireTenantAuth, (req, res) => {
    try {
      const worksheet = XLSX.utils.json_to_sheet(studentTemplateData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Oquvchilar");
      
      worksheet["!cols"] = [{ wch: 15 }, { wch: 18 }, { wch: 15 }, { wch: 18 }, { wch: 20 }, { wch: 15 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 15 }];
      
      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
      
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=oquvchilar_shablon.xlsx");
      res.send(buffer);
    } catch (error) {
      console.error("Excel template error:", error);
      res.status(500).json({ error: "Shablon yaratishda xatolik" });
    }
  });

  app.post("/api/students/excel/import", requireTenantAuth, async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      const { data } = req.body;
      
      if (!data || !Array.isArray(data)) {
        return res.status(400).json({ error: "Ma'lumotlar topilmadi" });
      }
      
      const results = { success: 0, errors: [] as string[] };
      
      for (const row of data) {
        try {
          const firstName = row["Ism"] || row["ism"] || row["firstName"];
          const lastName = row["Familiya"] || row["familiya"] || row["lastName"];
          const phone = (row["Telefon"] || row["telefon"] || row["phone"] || "").toString().replace(/\D/g, "");
          const parentPhone = (row["Ota-ona telefoni"] || row["parentPhone"] || "").toString().replace(/\D/g, "");
          
          if (!firstName || !lastName) {
            results.errors.push(`Qator: Ism yoki familiya bo'sh`);
            continue;
          }
          
          await storage.createStudent({
            tenantId,
            firstName,
            lastName,
            phone: phone || null,
            parentPhone: parentPhone || null,
            status: "active",
            balance: 0,
          });
          results.success++;
        } catch (err: any) {
          if (err instanceof DuplicatePhoneError) {
            results.errors.push(`${row["Ism"]} ${row["Familiya"]}: Telefon raqam allaqachon mavjud`);
          } else {
            results.errors.push(`${row["Ism"]} ${row["Familiya"]}: Xatolik`);
          }
        }
      }
      
      res.json(results);
    } catch (error) {
      console.error("Excel import error:", error);
      res.status(500).json({ error: "Import qilishda xatolik" });
    }
  });

  // ===== TEACHERS EXCEL IMPORT/EXPORT =====
  const teacherTemplateColumns = ["Ism", "Familiya", "Telefon", "Email", "Oylik foizi"];
  const teacherTemplateData = [
    { "Ism": "Anvar", "Familiya": "Toshmatov", "Telefon": "901234567", "Email": "anvar@mail.uz", "Oylik foizi": 30 },
    { "Ism": "Dilnoza", "Familiya": "Rahimova", "Telefon": "901234568", "Email": "dilnoza@mail.uz", "Oylik foizi": 35 },
  ];

  app.get("/api/teachers/excel/template-info", requireTenantAuth, (req, res) => {
    res.json({ columns: teacherTemplateColumns, data: teacherTemplateData });
  });

  app.get("/api/teachers/excel/template", requireTenantAuth, (req, res) => {
    try {
      const worksheet = XLSX.utils.json_to_sheet(teacherTemplateData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Oqituvchilar");
      
      worksheet["!cols"] = [{ wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 12 }];
      
      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
      
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=oqituvchilar_shablon.xlsx");
      res.send(buffer);
    } catch (error) {
      console.error("Excel template error:", error);
      res.status(500).json({ error: "Shablon yaratishda xatolik" });
    }
  });

  app.post("/api/teachers/excel/import", requireTenantAuth, async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      const { data } = req.body;
      
      if (!data || !Array.isArray(data)) {
        return res.status(400).json({ error: "Ma'lumotlar topilmadi" });
      }
      
      const results = { success: 0, errors: [] as string[] };
      
      for (const row of data) {
        try {
          const firstName = row["Ism"] || row["ism"] || row["firstName"];
          const lastName = row["Familiya"] || row["familiya"] || row["lastName"];
          const phone = (row["Telefon"] || row["telefon"] || row["phone"] || "").toString().replace(/\D/g, "");
          const email = row["Email"] || row["email"] || "";
          const salaryPercent = parseInt(row["Oylik foizi"] || row["salaryPercent"] || "30") || 30;
          
          if (!firstName || !lastName) {
            results.errors.push(`Qator: Ism yoki familiya bo'sh`);
            continue;
          }
          
          const defaultPassword = await bcrypt.hash("123456", 10);
          
          await storage.createUser({
            tenantId,
            firstName,
            lastName,
            phone: phone || null,
            email: email || null,
            password: defaultPassword,
            salaryPercent,
            role: "teacher",
          });
          results.success++;
        } catch (err: any) {
          if (err instanceof DuplicatePhoneError) {
            results.errors.push(`${row["Ism"]} ${row["Familiya"]}: Telefon raqam allaqachon mavjud`);
          } else {
            results.errors.push(`${row["Ism"]} ${row["Familiya"]}: Xatolik`);
          }
        }
      }
      
      res.json(results);
    } catch (error) {
      console.error("Excel import error:", error);
      res.status(500).json({ error: "Import qilishda xatolik" });
    }
  });

  // ===== SUBJECTS =====
  app.get("/api/subjects", async (req, res) => {
    try {
      const subjects = await storage.getSubjects(getTenantId(req));
      res.json(subjects);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch subjects" });
    }
  });

  app.post("/api/subjects", async (req, res) => {
    try {
      const data = insertSubjectSchema.parse({ ...req.body, tenantId: getTenantId(req) });
      const subject = await storage.createSubject(data);
      res.status(201).json(subject);
    } catch (error) {
      res.status(400).json({ error: "Invalid subject data" });
    }
  });

  app.patch("/api/subjects/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const tenantId = getTenantId(req);
      const updateData = insertSubjectSchema.partial().parse(req.body);
      const subject = await storage.updateSubject(id, tenantId, updateData);
      if (!subject) {
        return res.status(404).json({ error: "Fan topilmadi" });
      }
      res.json(subject);
    } catch (error) {
      res.status(400).json({ error: "Fanni yangilashda xatolik" });
    }
  });

  app.delete("/api/subjects/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const tenantId = getTenantId(req);
      
      // Check if subject is linked to any groups
      const groups = await storage.getGroups(tenantId);
      const linkedGroups = groups.filter(g => g.subjectId === id);
      if (linkedGroups.length > 0) {
        return res.status(400).json({ 
          error: `Bu fan ${linkedGroups.length} ta guruhga bog'langan. Avval guruhlarni o'chiring yoki boshqa fanga o'tkazing.` 
        });
      }
      
      // Check if subject is linked to any teachers
      const teachers = await storage.getTeachers(tenantId);
      const linkedTeachers = teachers.filter(t => t.subjectId === id);
      if (linkedTeachers.length > 0) {
        return res.status(400).json({ 
          error: `Bu fan ${linkedTeachers.length} ta o'qituvchiga bog'langan. Avval o'qituvchilarni boshqa fanga o'tkazing.` 
        });
      }
      
      const deleted = await storage.deleteSubject(id, tenantId);
      if (!deleted) {
        return res.status(404).json({ error: "Fan topilmadi" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Fanni o'chirishda xatolik" });
    }
  });

  // ===== GROUPS =====
  app.get("/api/groups", async (req, res) => {
    try {
      // O'qituvchi faqat o'z guruhlarini ko'radi
      if (isTeacher(req)) {
        const groups = await storage.getGroupsByTeacher(getUserId(req), getTenantId(req));
        return res.json(groups);
      }
      const groups = await storage.getGroups(getTenantId(req));
      res.json(groups);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch groups" });
    }
  });

  app.get("/api/groups/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const tenantId = getTenantId(req);
      const group = await storage.getGroup(id, tenantId);
      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }
      res.json(group);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch group" });
    }
  });

  app.post("/api/groups", async (req, res) => {
    try {
      const rawData = { ...req.body, tenantId: getTenantId(req) };
      if (rawData.subjectId === "" || rawData.subjectId === undefined) {
        rawData.subjectId = null;
      }
      if (typeof rawData.subjectId === "string" && rawData.subjectId) {
        rawData.subjectId = parseInt(rawData.subjectId);
      }
      if (typeof rawData.maxStudents === "string") {
        rawData.maxStudents = parseInt(rawData.maxStudents) || 15;
      }
      if (!rawData.level) {
        rawData.level = "Beginner";
      }
      const data = insertGroupSchema.parse(rawData);
      const group = await storage.createGroup(data);
      res.status(201).json(group);
    } catch (error) {
      console.error("Group create error:", error);
      const msg = error instanceof Error ? error.message : "Guruh yaratishda xatolik";
      res.status(400).json({ error: msg });
    }
  });

  app.patch("/api/groups/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const tenantId = getTenantId(req);
      const existing = await storage.getGroup(id, tenantId);
      if (!existing) {
        return res.status(404).json({ error: "Guruh topilmadi" });
      }
      // Parse subjectId properly
      const updateData = {
        ...req.body,
        subjectId: req.body.subjectId ? parseInt(req.body.subjectId) : null,
      };
      const group = await storage.updateGroup(id, tenantId, updateData);
      res.json(group);
    } catch (error) {
      console.error("Group update error:", error);
      res.status(400).json({ error: "Guruhni yangilashda xatolik: " + (error as Error).message });
    }
  });

  app.delete("/api/groups/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const tenantId = getTenantId(req);
      const existing = await storage.getGroup(id, tenantId);
      if (!existing) {
        return res.status(404).json({ error: "Group not found" });
      }
      await storage.deleteGroup(id, tenantId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete group" });
    }
  });

  // ===== TEMPLATE IMPORT =====
  // Parse and import group with students from template format
  app.post("/api/groups/import-template", async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      const { template } = req.body;
      
      if (!template || typeof template !== "string") {
        return res.status(400).json({ error: "Shablon matni kiritilmagan" });
      }

      // Parse template
      const lines = template.split("\n").map(l => l.trim()).filter(l => l);
      
      let groupName = "";
      let subjectName = "";
      let days: string[] = [];
      let time = "";
      let room = "";
      let teacherName = "";
      let students: { firstName: string; lastName: string; phone: string }[] = [];
      
      // Day name mappings (various formats)
      const dayMappings: Record<string, string> = {
        "dushanba": "Dushanba", "du": "Dushanba",
        "seshanba": "Seshanba", "se": "Seshanba",
        "chorshanba": "Chorshanba", "chor": "Chorshanba", "cho": "Chorshanba",
        "payshanba": "Payshanba", "pay": "Payshanba", "pa": "Payshanba",
        "juma": "Juma", "ju": "Juma",
        "shanba": "Shanba", "sha": "Shanba",
        "yakshanba": "Yakshanba", "yak": "Yakshanba", "ya": "Yakshanba",
      };
      
      let parsingStudents = false;
      let pendingStudentName = "";
      
      for (const line of lines) {
        const lowerLine = line.toLowerCase();
        // Barcha apostrof turlarini standartlash
        const normalizedLine = lowerLine.replace(/[''`'ʻʼ'ʹʽ‛´]/g, "'");
        
        if (lowerLine.startsWith("guruh nomi:") || lowerLine.startsWith("guruh:")) {
          groupName = line.split(":").slice(1).join(":").trim();
        } else if (lowerLine.startsWith("fan nomi:") || lowerLine.startsWith("fan:") || lowerLine.startsWith("subject:")) {
          subjectName = line.split(":").slice(1).join(":").trim();
        } else if (lowerLine.startsWith("kunlari:") || lowerLine.startsWith("kunlar:")) {
          const daysStr = line.split(":").slice(1).join(":").trim().toLowerCase();
          // Split by / or , or space
          const dayParts = daysStr.split(/[\/,\s]+/).filter(d => d);
          days = dayParts
            .map(d => dayMappings[d.toLowerCase()])
            .filter(d => d) as string[];
        } else if (lowerLine.startsWith("vaqti:") || lowerLine.startsWith("vaqt:")) {
          time = line.split(":").slice(1).join(":").trim();
        } else if (lowerLine.startsWith("xona:") || lowerLine.startsWith("xonasi:")) {
          room = line.split(":").slice(1).join(":").trim();
        } else if (normalizedLine.startsWith("o'qituvchi") || lowerLine.startsWith("ustoz:") || lowerLine.startsWith("teacher:") || lowerLine.startsWith("oqituvchi")) {
          teacherName = line.split(":").slice(1).join(":").trim();
        } else if (normalizedLine.includes("o'quvchilar") || lowerLine.startsWith("talabalar:") || lowerLine.startsWith("students:") || lowerLine.includes("oquvchilar")) {
          parsingStudents = true;
        } else if (parsingStudents) {
          // Check if this line looks like a phone number
          const isPhoneLine = /^\+?\d[\d\s\-]+$/.test(line) || /\+998/.test(line);
          // Check if line starts with number (student name line with number)
          const hasNumber = /^\d+[\.\)]/.test(line);
          // Check if line has both name and phone
          const sameLineMatch = line.match(/^(?:\d+[\.\)]\s*)?(.+?)\s+(\+?\d[\d\s\-]+)$/);
          
          if (pendingStudentName && isPhoneLine) {
            // This is phone for pending student
            const phone = line.replace(/[\s\-]+/g, "").replace(/^\+/, "");
            const nameParts = pendingStudentName.split(/\s+/);
            let lastName = "";
            let firstName = "";
            
            if (nameParts.length >= 2) {
              lastName = nameParts[0];
              firstName = nameParts.slice(1).join(" ");
            } else {
              firstName = pendingStudentName;
            }
            
            students.push({ firstName, lastName, phone });
            pendingStudentName = "";
          } else if (sameLineMatch && sameLineMatch[2].length >= 9) {
            // Name and phone on same line
            const fullName = sameLineMatch[1].trim();
            const phone = sameLineMatch[2].replace(/[\s\-]+/g, "").replace(/^\+/, "");
            
            const nameParts = fullName.split(/\s+/);
            let lastName = "";
            let firstName = "";
            
            if (nameParts.length >= 2) {
              lastName = nameParts[0];
              firstName = nameParts.slice(1).join(" ");
            } else {
              firstName = fullName;
            }
            
            students.push({ firstName, lastName, phone });
            pendingStudentName = "";
          } else if (!isPhoneLine && line.length > 2) {
            // This looks like a name line (with or without number)
            let name = line;
            // Remove leading number if exists
            if (hasNumber) {
              const nameMatch = line.match(/^\d+[\.\)]\s*(.+)$/);
              if (nameMatch) {
                name = nameMatch[1].trim();
              }
            }
            // Only set as pending if it looks like a name (has letters)
            if (/[a-zA-Z\u0400-\u04FF]/.test(name)) {
              pendingStudentName = name;
            }
          }
        }
      }
      
      // Validate required fields
      if (!groupName) {
        return res.status(400).json({ error: "Guruh nomi topilmadi" });
      }
      
      // Find teacher by name - aniq moslik
      const teachers = await storage.getTeachers(tenantId);
      const searchName = teacherName.toLowerCase().trim();
      
      // Agar o'qituvchi nomi bo'sh bo'lsa, xato qaytarish
      if (!searchName) {
        return res.status(400).json({ 
          error: "O'qituvchi nomi kiritilmagan. Iltimos shablonga O'qituvchi: qatorini qo'shing",
          availableTeachers: teachers.map(t => `${t.firstName} ${t.lastName}`)
        });
      }
      
      // 1. Avval to'liq ism-familiya bo'yicha aniq qidirish
      let teacher = teachers.find(t => {
        const fullName = `${t.firstName} ${t.lastName}`.toLowerCase().trim();
        const fullNameReversed = `${t.lastName} ${t.firstName}`.toLowerCase().trim();
        return fullName === searchName || fullNameReversed === searchName;
      });
      
      // 2. Agar topilmasa, faqat ism bo'yicha aniq qidirish
      if (!teacher) {
        teacher = teachers.find(t => 
          t.firstName.toLowerCase().trim() === searchName ||
          t.lastName.toLowerCase().trim() === searchName
        );
      }
      
      // 3. Agar hali ham topilmasa, qisman moslik (lekin faqat bitta natija bo'lsa)
      if (!teacher) {
        const partialMatches = teachers.filter(t => {
          const fullName = `${t.firstName} ${t.lastName}`.toLowerCase();
          return fullName.includes(searchName) || 
                 t.firstName.toLowerCase().includes(searchName) ||
                 t.lastName.toLowerCase().includes(searchName);
        });
        
        if (partialMatches.length === 1) {
          teacher = partialMatches[0];
        } else if (partialMatches.length > 1) {
          return res.status(400).json({ 
            error: `"${teacherName}" - bir nechta o'qituvchi topildi. Iltimos to'liq ism-familiyani kiriting`,
            matchingTeachers: partialMatches.map(t => `${t.firstName} ${t.lastName}`)
          });
        }
      }
      
      if (!teacher) {
        return res.status(400).json({ 
          error: `O'qituvchi "${teacherName}" topilmadi`,
          availableTeachers: teachers.map(t => `${t.firstName} ${t.lastName}`)
        });
      }
      
      // Find subject by name if provided
      let subjectId = 0;
      if (subjectName) {
        const subjects = await storage.getSubjects(tenantId);
        const searchSubject = subjectName.toLowerCase().trim();
        
        const subject = subjects.find(s => 
          s.name.toLowerCase().trim() === searchSubject ||
          s.name.toLowerCase().includes(searchSubject)
        );
        
        if (subject) {
          subjectId = subject.id;
        }
      }
      
      // Create group
      const group = await storage.createGroup({
        tenantId,
        name: groupName,
        teacherId: teacher.id,
        days: days.length > 0 ? days : ["Dushanba", "Chorshanba", "Juma"],
        time: time || "09:00",
        room: room || "",
        maxStudents: 20,
        subjectId: subjectId,
        level: "Beginner",
      });
      
      // Create students and add to group
      const createdStudents: any[] = [];
      const existingStudents: any[] = [];
      const errors: string[] = [];
      
      for (const studentData of students) {
        try {
          // Check if student already exists by phone
          const allStudents = await storage.getStudents(tenantId);
          const normalizedPhone = studentData.phone.replace(/\D/g, "");
          let student = allStudents.find(s => 
            s.phone.replace(/\D/g, "") === normalizedPhone
          );
          
          if (student) {
            existingStudents.push(student);
          } else {
            // Create new student
            student = await storage.createStudent({
              tenantId,
              firstName: studentData.firstName,
              lastName: studentData.lastName,
              phone: "+" + normalizedPhone,
              parentPhone: "",
              status: "active",
              balance: 0,
            });
            createdStudents.push(student);
          }
          
          // Add student to group if not already in it
          const studentGroups = await storage.getStudentGroups(student.id, tenantId);
          const alreadyInGroup = studentGroups.some(sg => sg.groupId === group.id);
          
          if (!alreadyInGroup) {
            await storage.addStudentToGroup({
              studentId: student.id,
              groupId: group.id,
            });
          }
        } catch (err: any) {
          errors.push(`${studentData.firstName} ${studentData.lastName}: ${err.message}`);
        }
      }
      
      res.status(201).json({
        success: true,
        group,
        teacher: { id: teacher.id, name: `${teacher.firstName} ${teacher.lastName}` },
        createdStudents: createdStudents.length,
        existingStudents: existingStudents.length,
        totalStudents: createdStudents.length + existingStudents.length,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error: any) {
      console.error("Template import error:", error);
      res.status(500).json({ error: error.message || "Import xatosi" });
    }
  });

  // ===== STUDENT GROUPS =====
  app.get("/api/students/:studentId/groups", async (req, res) => {
    try {
      const studentId = parseInt(req.params.studentId);
      const tenantId = getTenantId(req);
      const student = await storage.getStudent(studentId, tenantId);
      if (!student) {
        return res.status(404).json({ error: "Student not found" });
      }
      const groups = await storage.getStudentGroups(studentId, tenantId);
      res.json(groups);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch student groups" });
    }
  });

  app.post("/api/students/:studentId/groups", async (req, res) => {
    try {
      const studentId = parseInt(req.params.studentId);
      const tenantId = getTenantId(req);
      const student = await storage.getStudent(studentId, tenantId);
      if (!student) {
        return res.status(404).json({ error: "Student not found" });
      }
      const group = await storage.getGroup(req.body.groupId, tenantId);
      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }
      const data = insertStudentGroupSchema.parse({ ...req.body, studentId });
      const studentGroup = await storage.addStudentToGroup(data);
      res.status(201).json(studentGroup);
    } catch (error) {
      res.status(400).json({ error: "Failed to add student to group" });
    }
  });

  app.delete("/api/students/:studentId/groups/:groupId", async (req, res) => {
    try {
      const studentId = parseInt(req.params.studentId);
      const groupId = parseInt(req.params.groupId);
      const tenantId = getTenantId(req);
      const student = await storage.getStudent(studentId, tenantId);
      if (!student) {
        return res.status(404).json({ error: "Student not found" });
      }
      const deleted = await storage.removeStudentFromGroup(studentId, groupId);
      if (!deleted) {
        return res.status(404).json({ error: "Student-Group relation not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to remove student from group" });
    }
  });

  // ===== ATTENDANCE =====
  app.get("/api/attendance", async (req, res) => {
    try {
      const groupId = req.query.groupId ? parseInt(req.query.groupId as string) : undefined;
      const date = req.query.date ? new Date(req.query.date as string) : undefined;
      const month = req.query.month ? parseInt(req.query.month as string) : undefined;
      const year = req.query.year ? parseInt(req.query.year as string) : undefined;
      
      // O'qituvchi faqat o'z guruhlarining davomatini ko'radi
      if (isTeacher(req)) {
        const attendance = await storage.getAttendanceByTeacher(getUserId(req), getTenantId(req), groupId, month, year);
        return res.json(attendance);
      }
      
      const attendance = await storage.getAttendance(getTenantId(req), groupId, date, month, year);
      res.json(attendance);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch attendance" });
    }
  });

  app.post("/api/attendance", async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      const data = insertAttendanceSchema.parse({ ...req.body, tenantId });
      
      // Check if attendance record already exists for this student/group/date
      const existingRecords = await storage.getAttendance(tenantId, data.groupId, new Date(data.date));
      const existingRecord = existingRecords.find((a: any) => a.studentId === data.studentId);
      
      let attendance;
      if (existingRecord) {
        // Update existing record
        attendance = await storage.updateAttendance(existingRecord.id, tenantId, { status: data.status });
      } else {
        // Create new record
        attendance = await storage.createAttendance(data);
      }
      
      // Send Telegram notification to student
      if (data.studentId && data.groupId && data.status && data.date) {
        const group = await storage.getGroup(data.groupId, tenantId);
        if (group) {
          notifyStudentAttendance(
            data.studentId, 
            group.name, 
            data.status as "present" | "absent",
            new Date(data.date)
          ).catch(err => console.error("Telegram notification error:", err));
        }
      }
      
      res.status(201).json(attendance);
    } catch (error) {
      res.status(400).json({ error: "Invalid attendance data" });
    }
  });

  app.patch("/api/attendance/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const tenantId = getTenantId(req);
      // Attendance records are created with tenantId, so we verify ownership
      const existing = await storage.getAttendanceById(id, tenantId);
      if (!existing) {
        return res.status(404).json({ error: "Attendance record not found" });
      }
      const attendance = await storage.updateAttendance(id, tenantId, req.body);
      res.json(attendance);
    } catch (error) {
      res.status(400).json({ error: "Failed to update attendance" });
    }
  });

  // ===== PAYMENTS =====
  app.get("/api/payments", async (req, res) => {
    try {
      const studentId = req.query.studentId ? parseInt(req.query.studentId as string) : undefined;
      
      // O'qituvchi faqat o'z o'quvchilarining to'lovlarini ko'radi
      if (isTeacher(req)) {
        const payments = await storage.getPaymentsByTeacher(getUserId(req), getTenantId(req));
        return res.json(payments);
      }
      
      const payments = await storage.getPayments(getTenantId(req), studentId);
      res.json(payments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payments" });
    }
  });

  app.get("/api/payments/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const tenantId = getTenantId(req);
      const payment = await storage.getPayment(id, tenantId);
      if (!payment) {
        return res.status(404).json({ error: "Payment not found" });
      }
      res.json(payment);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payment" });
    }
  });

  app.post("/api/payments", async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      const { newStudent, teacherId, amount, paymentType, status, notes, studentId: existingStudentId } = req.body;
      
      let finalStudentId = existingStudentId;
      let createdStudent = null;
      
      if (newStudent && !existingStudentId) {
        const { firstName, lastName, phone, parentPhone } = newStudent;
        if (!firstName || !lastName) {
          return res.status(400).json({ error: "Ism va familiya kiritilishi kerak" });
        }
        createdStudent = await storage.createStudent({
          tenantId,
          firstName,
          lastName,
          phone: phone || "",
          parentPhone: parentPhone || "",
          status: "active",
          balance: 0,
        });
        finalStudentId = createdStudent.id;
      }
      
      if (!finalStudentId) {
        return res.status(400).json({ error: "O'quvchi tanlanishi yoki yangi o'quvchi ma'lumotlari kiritilishi kerak" });
      }
      
      let teacherEarning = 0;
      if (teacherId && amount) {
        const teacher = await storage.getTeacher(teacherId, tenantId);
        if (teacher && teacher.salaryPercent) {
          teacherEarning = Math.round(amount * teacher.salaryPercent / 100);
        }
      }
      
      const data = insertPaymentSchema.parse({
        tenantId,
        studentId: finalStudentId,
        teacherId: teacherId || null,
        amount,
        teacherEarning,
        paymentType: paymentType || "cash",
        status: status || "completed",
        notes: notes || null,
      });
      const payment = await storage.createPayment(data);
      
      if (payment.status === 'completed') {
        const student = await storage.getStudent(payment.studentId, tenantId);
        if (student) {
          const newBalance = student.balance + payment.amount;
          await storage.updateStudent(payment.studentId, tenantId, {
            balance: newBalance,
          });
          
          notifyStudentPayment(payment.studentId, payment.amount, newBalance)
            .catch(err => console.error("Telegram notification error:", err));
        }
      }
      
      res.status(201).json({ ...payment, createdStudent });
    } catch (error: any) {
      if (error?.message?.includes("telefon raqami")) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Payment creation error:", error);
      res.status(400).json({ error: "To'lov ma'lumotlarida xatolik" });
    }
  });

  app.put("/api/payments/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const tenantId = getTenantId(req);
      
      const existingPayment = await storage.getPayment(id, tenantId);
      if (!existingPayment) {
        return res.status(404).json({ error: "Payment not found" });
      }
      
      const { amount, paymentType, notes, status } = req.body;
      const oldAmount = existingPayment.amount;
      const newAmount = amount !== undefined ? amount : oldAmount;
      
      const updatedPayment = await storage.updatePayment(id, tenantId, {
        amount: newAmount,
        paymentType: paymentType || existingPayment.paymentType,
        notes: notes !== undefined ? notes : existingPayment.notes,
        status: status || existingPayment.status,
      });
      
      if (updatedPayment && existingPayment.status === 'completed' && newAmount !== oldAmount) {
        const student = await storage.getStudent(existingPayment.studentId, tenantId);
        if (student) {
          const balanceDiff = newAmount - oldAmount;
          await storage.updateStudent(existingPayment.studentId, tenantId, {
            balance: student.balance + balanceDiff,
          });
        }
      }
      
      res.json(updatedPayment);
    } catch (error) {
      res.status(400).json({ error: "Failed to update payment" });
    }
  });

  app.delete("/api/payments/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const tenantId = getTenantId(req);
      
      const existingPayment = await storage.getPayment(id, tenantId);
      if (!existingPayment) {
        return res.status(404).json({ error: "Payment not found" });
      }
      
      // Revert student balance if payment was completed
      if (existingPayment.status === 'completed') {
        const student = await storage.getStudent(existingPayment.studentId, tenantId);
        if (student) {
          await storage.updateStudent(existingPayment.studentId, tenantId, {
            balance: student.balance - existingPayment.amount,
          });
        }
      }
      
      await storage.deletePayment(id, tenantId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete payment" });
    }
  });

  // ===== TEACHER SALARY =====
  app.get("/api/teacher/salary", async (req, res) => {
    try {
      if (!isTeacher(req)) {
        return res.status(403).json({ error: "Faqat o'qituvchilar uchun" });
      }
      
      const month = req.query.month ? parseInt(req.query.month as string) : new Date().getMonth() + 1;
      const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();
      
      const salary = await storage.getTeacherSalary(getUserId(req), getTenantId(req), month, year);
      res.json(salary);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch teacher salary" });
    }
  });

  // ===== EXPENSES =====
  app.get("/api/expenses", async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      const month = req.query.month ? parseInt(req.query.month as string) : undefined;
      const year = req.query.year ? parseInt(req.query.year as string) : undefined;
      const expenses = await storage.getExpenses(tenantId, month, year);
      res.json(expenses);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch expenses" });
    }
  });

  app.post("/api/expenses", async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      const body = { ...req.body, tenantId };
      if (body.date && typeof body.date === "string") {
        body.date = new Date(body.date);
      }
      const data = insertExpenseSchema.parse(body);
      const expense = await storage.createExpense(data);
      res.status(201).json(expense);
    } catch (error: any) {
      console.error("Expense creation error:", error?.message || error);
      res.status(400).json({ error: error?.message || "Invalid expense data" });
    }
  });

  app.put("/api/expenses/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const tenantId = getTenantId(req);
      const { title, amount, category, notes, date } = req.body;
      const parsedDate = date && typeof date === "string" ? new Date(date) : date;
      const updated = await storage.updateExpense(id, tenantId, { title, amount, category, notes, date: parsedDate });
      if (!updated) return res.status(404).json({ error: "Expense not found" });
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Failed to update expense" });
    }
  });

  app.delete("/api/expenses/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const tenantId = getTenantId(req);
      const deleted = await storage.deleteExpense(id, tenantId);
      if (!deleted) return res.status(404).json({ error: "Expense not found" });
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete expense" });
    }
  });

  // ===== GRADES =====
  app.get("/api/grades", async (req, res) => {
    try {
      const groupId = req.query.groupId ? parseInt(req.query.groupId as string) : undefined;
      const studentId = req.query.studentId ? parseInt(req.query.studentId as string) : undefined;
      const date = req.query.date ? new Date(req.query.date as string) : undefined;
      const month = req.query.month ? parseInt(req.query.month as string) : undefined;
      const year = req.query.year ? parseInt(req.query.year as string) : undefined;
      const grades = await storage.getGrades(getTenantId(req), groupId, studentId, date, month, year);
      res.json(grades);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch grades" });
    }
  });

  app.post("/api/grades", async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      const data = insertGradeSchema.parse({ ...req.body, tenantId });
      
      // Check if grade record already exists for this student/group/date
      const existingRecords = await storage.getGrades(tenantId, data.groupId, data.studentId, new Date(data.date));
      const existingRecord = existingRecords.length > 0 ? existingRecords[0] : null;
      
      let grade;
      if (existingRecord) {
        // Update existing record
        grade = await storage.updateGrade(existingRecord.id, tenantId, { grade: data.grade, topic: data.topic });
      } else {
        // Create new record
        grade = await storage.createGrade(data);
      }
      
      res.status(201).json(grade);
    } catch (error) {
      res.status(400).json({ error: "Invalid grade data" });
    }
  });

  app.patch("/api/grades/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const tenantId = getTenantId(req);
      const existing = await storage.getGradeById(id, tenantId);
      if (!existing) {
        return res.status(404).json({ error: "Grade not found" });
      }
      const grade = await storage.updateGrade(id, tenantId, req.body);
      res.json(grade);
    } catch (error) {
      res.status(400).json({ error: "Failed to update grade" });
    }
  });

  app.delete("/api/grades/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const tenantId = getTenantId(req);
      const existing = await storage.getGradeById(id, tenantId);
      if (!existing) {
        return res.status(404).json({ error: "Grade not found" });
      }
      const deleted = await storage.deleteGrade(id, tenantId);
      if (!deleted) {
        return res.status(404).json({ error: "Grade not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete grade" });
    }
  });

  // ===== TEACHERS =====
  app.get("/api/teachers", async (req, res) => {
    try {
      const teachers = await storage.getTeachers(getTenantId(req));
      res.json(teachers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch teachers" });
    }
  });

  app.post("/api/teachers", async (req, res) => {
    try {
      const { firstName, lastName, email, password, phone, salaryPercent } = req.body;
      const hashedPassword = await bcrypt.hash(password || "password123", 10);
      const teacher = await storage.createUser({
        tenantId: getTenantId(req),
        firstName,
        lastName,
        email: email || null,
        password: hashedPassword,
        phone,
        salaryPercent: salaryPercent || 0,
        role: "teacher",
      });
      res.status(201).json(teacher);
    } catch (error) {
      if (error instanceof DuplicatePhoneError) {
        return res.status(409).json({ error: error.message });
      }
      res.status(400).json({ error: "Failed to create teacher" });
    }
  });

  app.patch("/api/teachers/:id", async (req, res) => {
    try {
      const teacherId = req.params.id;
      const tenantId = getTenantId(req);
      const teacher = await storage.getTeacher(teacherId, tenantId);
      if (!teacher) {
        return res.status(404).json({ error: "Teacher not found" });
      }
      
      const { firstName, lastName, email, password, phone, salaryPercent } = req.body;
      const updateData: any = {};
      
      if (firstName !== undefined) updateData.firstName = firstName;
      if (lastName !== undefined) updateData.lastName = lastName;
      if (email !== undefined) updateData.email = email;
      if (phone !== undefined) updateData.phone = phone;
      if (salaryPercent !== undefined) updateData.salaryPercent = salaryPercent;
      
      if (password && password.trim() !== "") {
        updateData.password = await bcrypt.hash(password, 10);
      }
      
      const updated = await storage.updateTeacher(teacherId, tenantId, updateData);
      res.json(updated);
    } catch (error) {
      if (error instanceof DuplicatePhoneError) {
        return res.status(409).json({ error: error.message });
      }
      res.status(400).json({ error: "Failed to update teacher" });
    }
  });

  // Get teacher's groups (xavfsiz - faqat o'z guruhlarini)
  app.get("/api/teacher/:teacherId/groups", requireTenantAuth, async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      // O'qituvchi faqat o'z guruhlarini ko'ra oladi
      const teacherId = isTeacher(req) ? getUserId(req) : req.params.teacherId;
      const teacher = await storage.getTeacher(teacherId, tenantId);
      if (!teacher) {
        return res.status(404).json({ error: "Teacher not found" });
      }
      const groups = await storage.getGroupsByTeacher(teacherId, tenantId);
      res.json(groups);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch groups" });
    }
  });

  // Get students in a group
  app.get("/api/groups/:groupId/students", requireTenantAuth, async (req, res) => {
    try {
      const groupId = parseInt(req.params.groupId);
      const tenantId = getTenantId(req);
      const group = await storage.getGroup(groupId, tenantId);
      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }
      // O'qituvchi faqat o'z guruhidagi o'quvchilarni ko'ra oladi
      if (isTeacher(req) && group.teacherId !== getUserId(req)) {
        return res.status(403).json({ error: "Access denied" });
      }
      const students = await storage.getStudentsByGroup(groupId, tenantId);
      res.json(students);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch students" });
    }
  });

  // Get all students for a teacher (across all their groups) - xavfsiz
  app.get("/api/teacher/:teacherId/students", requireTenantAuth, async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      // O'qituvchi faqat o'z o'quvchilarini ko'ra oladi
      const teacherId = isTeacher(req) ? getUserId(req) : req.params.teacherId;
      const teacher = await storage.getTeacher(teacherId, tenantId);
      if (!teacher) {
        return res.status(404).json({ error: "Teacher not found" });
      }
      const students = await storage.getStudentsByTeacher(teacherId, tenantId);
      res.json(students);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch students" });
    }
  });

  // Teacher creates a student - xavfsiz
  app.post("/api/teacher/students", requireTenantAuth, async (req, res) => {
    try {
      if (!isTeacher(req)) {
        return res.status(403).json({ error: "Faqat o'qituvchilar uchun" });
      }
      const tenantId = getTenantId(req);
      const { firstName, lastName, phone, parentPhone, groupId } = req.body;
      
      // Guruh o'qituvchiga tegishliligini tekshirish
      if (groupId) {
        const group = await storage.getGroup(parseInt(groupId), tenantId);
        if (!group || group.teacherId !== getUserId(req)) {
          return res.status(403).json({ error: "Bu guruhga o'quvchi qo'sha olmaysiz" });
        }
      }
      
      const student = await storage.createStudent({
        tenantId,
        firstName,
        lastName,
        phone,
        parentPhone,
        balance: 0,
        status: "active",
      });
      
      if (groupId) {
        await storage.addStudentToGroup({
          studentId: student.id,
          groupId: parseInt(groupId),
        });
      }
      
      res.status(201).json(student);
    } catch (error) {
      res.status(400).json({ error: "Failed to create student" });
    }
  });

  // Teacher updates a student (no delete allowed) - xavfsiz
  app.patch("/api/teacher/students/:id", requireTenantAuth, async (req, res) => {
    try {
      if (!isTeacher(req)) {
        return res.status(403).json({ error: "Faqat o'qituvchilar uchun" });
      }
      const id = parseInt(req.params.id);
      const tenantId = getTenantId(req);
      const { firstName, lastName, phone, parentPhone } = req.body;
      
      // O'quvchi o'qituvchiga tegishliligini tekshirish
      const teacherStudents = await storage.getStudentsByTeacher(getUserId(req), tenantId);
      const isOwnStudent = teacherStudents.some(s => s.id === id);
      if (!isOwnStudent) {
        return res.status(403).json({ error: "Bu o'quvchini tahrirlay olmaysiz" });
      }
      
      const student = await storage.updateStudent(id, tenantId, { firstName, lastName, phone, parentPhone });
      res.json(student);
    } catch (error) {
      res.status(400).json({ error: "Failed to update student" });
    }
  });

  // Teacher moves student between groups
  app.post("/api/teacher/move-student", async (req, res) => {
    try {
      const { studentId, fromGroupId, toGroupId } = req.body;
      const tenantId = getTenantId(req);
      // Verify student belongs to this tenant
      const student = await storage.getStudent(studentId, tenantId);
      if (!student) {
        return res.status(404).json({ error: "Student not found" });
      }
      // Verify both groups belong to this tenant
      const fromGroup = await storage.getGroup(fromGroupId, tenantId);
      const toGroup = await storage.getGroup(toGroupId, tenantId);
      if (!fromGroup || !toGroup) {
        return res.status(404).json({ error: "Group not found" });
      }
      await storage.removeStudentFromGroup(studentId, fromGroupId);
      await storage.addStudentToGroup({ studentId, groupId: toGroupId });
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Failed to move student" });
    }
  });

  app.delete("/api/teachers/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const tenantId = getTenantId(req);
      const deleted = await storage.deleteUser(id, tenantId);
      if (!deleted) {
        return res.status(404).json({ error: "Teacher not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete teacher" });
    }
  });

  // ===== STATISTICS =====
  app.get("/api/stats", async (req, res) => {
    try {
      const stats = await storage.getStats(getTenantId(req));
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch statistics" });
    }
  });

  // ===== SMS =====
  app.get("/api/sms/balance", async (req, res) => {
    try {
      const result = await getBalance();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to get SMS balance" });
    }
  });

  app.post("/api/sms/send", async (req, res) => {
    try {
      const { phone, message } = req.body;
      if (!phone || !message) {
        return res.status(400).json({ error: "phone va message kerak" });
      }
      const result = await sendSMS(phone, message);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to send SMS" });
    }
  });

  // Low balance reminder (approved template 2)
  app.post("/api/sms/low-balance", async (req, res) => {
    try {
      const { studentId } = req.body;
      const tenantId = getTenantId(req);
      const student = await storage.getStudent(studentId, tenantId);
      
      if (!student) {
        return res.status(404).json({ error: "O'quvchi topilmadi" });
      }

      const phone = student.parentPhone || student.phone;
      if (!phone) {
        return res.status(400).json({ error: "Telefon raqami yo'q" });
      }

      const fullName = `${student.lastName} ${student.firstName}`;
      const result = await sendLowBalanceSMS(phone, fullName, student.balance || 0);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to send low balance reminder" });
    }
  });

  // Payment received (approved template 1)
  app.post("/api/sms/payment-received", async (req, res) => {
    try {
      const { studentId, amount, groupId } = req.body;
      const tenantId = getTenantId(req);
      const student = await storage.getStudent(studentId, tenantId);
      
      if (!student) {
        return res.status(404).json({ error: "O'quvchi topilmadi" });
      }

      const phone = student.parentPhone || student.phone;
      if (!phone) {
        return res.status(400).json({ error: "Telefon raqami yo'q" });
      }

      let courseName = "umumiy kursi";
      
      // If groupId provided, use it; otherwise find student's first group
      let group = groupId ? await storage.getGroup(groupId, tenantId) : null;
      if (!group) {
        const studentGroupsList = await storage.getStudentGroups(studentId, tenantId);
        if (studentGroupsList.length > 0) {
          group = await storage.getGroup(studentGroupsList[0].groupId, tenantId);
        }
      }
      
      if (group) {
        const groupName = group.name.trim();
        courseName = groupName.toLowerCase().includes("kurs") ? groupName : groupName + " kursi";
      }
      
      const result = await sendPaymentReceivedSMS(phone, student.firstName.trim(), courseName, amount);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to send payment confirmation" });
    }
  });

  // Absence notification (approved template 3)
  app.post("/api/sms/absence", async (req, res) => {
    try {
      const { studentId, groupId, time } = req.body;
      const tenantId = getTenantId(req);
      const student = await storage.getStudent(studentId, tenantId);
      const group = await storage.getGroup(groupId, tenantId);
      
      if (!student || !group) {
        return res.status(404).json({ error: "O'quvchi yoki guruh topilmadi" });
      }

      const phone = student.parentPhone || student.phone;
      if (!phone) {
        return res.status(400).json({ error: "Telefon raqami yo'q" });
      }

      const subject = group.subjectId ? await storage.getSubject(group.subjectId, tenantId) : null;
      const subjectName = subject?.name || "dars";
      const classTime = time || group.time?.split(" - ")[0] || "00:00";
      
      const result = await sendAbsenceSMS(phone, student.firstName, group.name, classTime, subjectName);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to send absence notification" });
    }
  });

  // Test SMS endpoint
  app.post("/api/sms/test", async (req, res) => {
    try {
      const { phone, template, params } = req.body;
      if (!phone || !template) {
        return res.status(400).json({ error: "phone va template kerak" });
      }

      let message: string;
      switch (template) {
        case "paymentReceived":
          message = smsTemplates.paymentReceived(
            params?.name || "Test",
            params?.course || "Test kursi",
            params?.amount || 100000
          );
          break;
        case "lowBalance":
          message = smsTemplates.lowBalance(
            params?.fullName || "Test Foydalanuvchi",
            params?.balance || 50000
          );
          break;
        case "absence":
          message = smsTemplates.absenceNotification(
            params?.name || "Test",
            params?.group || "Test-1",
            params?.time || "10:00",
            params?.subject || "Ingliz tili"
          );
          break;
        default:
          return res.status(400).json({ error: "Noma'lum template" });
      }

      const result = await sendSMS(phone, message);
      res.json({ ...result, message });
    } catch (error) {
      res.status(500).json({ error: "Failed to send test SMS" });
    }
  });

  // ===== TELEGRAM NOTIFICATIONS =====
  app.post("/api/telegram/send-receipt", requireTenantAuth, async (req: any, res) => {
    try {
      const { studentId, paymentId, amount, groupName } = req.body;
      const tenantId = getTenantId(req);
      
      if (!studentId || !paymentId || !amount) {
        return res.status(400).json({ error: "studentId, paymentId va amount kerak" });
      }
      
      // Validate student belongs to this tenant
      const student = await storage.getStudent(studentId, tenantId);
      if (!student) {
        return res.status(403).json({ success: false, error: "O'quvchi topilmadi yoki ruxsat yo'q" });
      }
      
      const result = await sendPaymentReceipt(studentId, paymentId, amount, groupName);
      res.json(result);
    } catch (error) {
      console.error("Telegram receipt error:", error);
      res.status(500).json({ success: false, error: "Telegram xabar yuborishda xatolik" });
    }
  });

  // ===== SUPER ADMIN: AUTHENTICATION =====
  const SUPER_ADMIN_USERNAME = process.env.SUPER_ADMIN_USERNAME;
  const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD;
  const SUPER_ADMIN_TOKEN_SECRET = process.env.SUPER_ADMIN_TOKEN_SECRET;

  function generateToken(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return Buffer.from(`${timestamp}:${random}:${SUPER_ADMIN_TOKEN_SECRET}`).toString('base64');
  }

  function verifyToken(token: string): boolean {
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf-8');
      const parts = decoded.split(':');
      if (parts.length !== 3) return false;
      const timestamp = parseInt(parts[0]);
      const secret = parts[2];
      // Token expires after 24 hours
      if (Date.now() - timestamp > 24 * 60 * 60 * 1000) return false;
      if (secret !== SUPER_ADMIN_TOKEN_SECRET) return false;
      return true;
    } catch {
      return false;
    }
  }

  app.post("/api/super-admin/login", (req, res) => {
    if (!SUPER_ADMIN_USERNAME || !SUPER_ADMIN_PASSWORD || !SUPER_ADMIN_TOKEN_SECRET) {
      return res.status(500).json({ error: "Super admin sozlanmagan" });
    }
    const { username, password } = req.body;
    if (username === SUPER_ADMIN_USERNAME && password === SUPER_ADMIN_PASSWORD) {
      const token = generateToken();
      res.json({ success: true, token });
    } else {
      res.status(401).json({ error: "Login yoki parol noto'g'ri" });
    }
  });

  app.get("/api/super-admin/verify", (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ valid: false });
    }
    const token = authHeader.substring(7);
    const valid = verifyToken(token);
    res.json({ valid });
  });

  // Middleware to protect super admin routes
  const requireSuperAdmin = (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Avtorizatsiya talab qilinadi" });
    }
    const token = authHeader.substring(7);
    if (!verifyToken(token)) {
      return res.status(401).json({ error: "Token yaroqsiz yoki muddati o'tgan" });
    }
    next();
  };

  // ===== SUPER ADMIN: SUBSCRIPTION PLANS =====
  app.get("/api/admin/plans", async (req, res) => {
    try {
      const plans = await storage.getSubscriptionPlans();
      res.json(plans);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch plans" });
    }
  });

  app.post("/api/admin/plans", async (req, res) => {
    try {
      const data = insertSubscriptionPlanSchema.parse(req.body);
      const plan = await storage.createSubscriptionPlan(data);
      res.status(201).json(plan);
    } catch (error) {
      res.status(400).json({ error: "Invalid plan data" });
    }
  });

  app.patch("/api/admin/plans/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const plan = await storage.updateSubscriptionPlan(id, req.body);
      if (!plan) {
        return res.status(404).json({ error: "Plan not found" });
      }
      res.json(plan);
    } catch (error) {
      res.status(400).json({ error: "Failed to update plan" });
    }
  });

  app.delete("/api/admin/plans/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      // Soft delete - just mark as inactive
      const plan = await storage.updateSubscriptionPlan(id, { isActive: false });
      if (!plan) {
        return res.status(404).json({ error: "Plan not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete plan" });
    }
  });

  // ===== SUPER ADMIN: TENANTS MANAGEMENT =====
  app.get("/api/admin/tenants", async (req, res) => {
    try {
      const tenants = await storage.getTenants();
      res.json(tenants);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tenants" });
    }
  });

  app.get("/api/admin/tenants/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const tenant = await storage.getTenant(id);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      res.json(tenant);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tenant" });
    }
  });

  app.post("/api/admin/tenants", async (req, res) => {
    try {
      const { adminFirstName, adminLastName, adminPhone, adminPassword, trialDays, subscriptionEndsAt, ...tenantData } = req.body;
      
      // Calculate trialEndsAt from trialDays
      let calculatedTrialEndsAt = null;
      if (trialDays && trialDays > 0) {
        calculatedTrialEndsAt = new Date();
        calculatedTrialEndsAt.setDate(calculatedTrialEndsAt.getDate() + trialDays);
      }
      
      // Parse subscriptionEndsAt if provided
      let parsedSubscriptionEndsAt = null;
      if (subscriptionEndsAt) {
        parsedSubscriptionEndsAt = new Date(subscriptionEndsAt);
      }
      
      const data = insertTenantSchema.parse({
        ...tenantData,
        trialEndsAt: calculatedTrialEndsAt,
        subscriptionEndsAt: parsedSubscriptionEndsAt,
      });
      const tenant = await storage.createTenant(data);
      
      // Create admin user for this tenant
      if (adminPhone && adminPassword) {
        const adminEmail = `admin-${tenant.id}@${tenant.slug || 'tenant'}.educrm.uz`;
        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        await storage.createUser({
          tenantId: tenant.id,
          email: adminEmail,
          password: hashedPassword,
          firstName: adminFirstName || "Admin",
          lastName: adminLastName || "",
          phone: adminPhone.replace(/\D/g, ''), // Remove non-digits
          role: "markaz_admin",
        });
      }
      
      res.status(201).json(tenant);
    } catch (error) {
      console.error("Error creating tenant:", error);
      res.status(400).json({ error: "Invalid tenant data" });
    }
  });

  app.patch("/api/admin/tenants/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const tenant = await storage.updateTenant(id, req.body);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      res.json(tenant);
    } catch (error) {
      res.status(400).json({ error: "Failed to update tenant" });
    }
  });

  // ===== SUPER ADMIN: TENANT SUBSCRIPTIONS =====
  app.get("/api/admin/tenants/:tenantId/subscriptions", async (req, res) => {
    try {
      const tenantId = parseInt(req.params.tenantId);
      const subscriptions = await storage.getTenantSubscriptions(tenantId);
      res.json(subscriptions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch subscriptions" });
    }
  });

  app.post("/api/admin/tenants/:tenantId/subscriptions", async (req, res) => {
    try {
      const tenantId = parseInt(req.params.tenantId);
      const data = insertTenantSubscriptionSchema.parse({ ...req.body, tenantId });
      const subscription = await storage.createTenantSubscription(data);
      
      // Update tenant's current subscription
      await storage.updateTenant(tenantId, { 
        planId: data.planId,
        subscriptionEndsAt: data.endDate
      });
      
      res.status(201).json(subscription);
    } catch (error) {
      res.status(400).json({ error: "Invalid subscription data" });
    }
  });

  // ===== SUPER ADMIN: SMS SETTINGS =====
  app.get("/api/admin/tenants/:tenantId/sms", async (req, res) => {
    try {
      const tenantId = parseInt(req.params.tenantId);
      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      res.json({
        smsEnabled: tenant.smsEnabled,
        smsCredits: tenant.smsCredits,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch SMS settings" });
    }
  });

  app.post("/api/admin/tenants/:tenantId/sms", async (req, res) => {
    try {
      const tenantId = parseInt(req.params.tenantId);
      const { smsEnabled, addCredits } = req.body;
      
      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }

      const updateData: any = {};
      if (typeof smsEnabled === 'boolean') {
        updateData.smsEnabled = smsEnabled;
      }
      if (typeof addCredits === 'number' && addCredits > 0) {
        updateData.smsCredits = tenant.smsCredits + addCredits;
      }

      const updatedTenant = await storage.updateTenant(tenantId, updateData);
      res.json({
        smsEnabled: updatedTenant!.smsEnabled,
        smsCredits: updatedTenant!.smsCredits,
      });
    } catch (error) {
      res.status(400).json({ error: "Failed to update SMS settings" });
    }
  });

  // ===== SUPER ADMIN: STATISTICS =====
  app.get("/api/admin/stats", async (req, res) => {
    try {
      const tenants = await storage.getTenants();
      const plans = await storage.getSubscriptionPlans();
      
      const activeCount = tenants.filter(t => t.status === 'active').length;
      const trialCount = tenants.filter(t => t.status === 'trial').length;
      const suspendedCount = tenants.filter(t => t.status === 'suspended').length;
      
      res.json({
        totalTenants: tenants.length,
        activeTenants: activeCount,
        trialTenants: trialCount,
        suspendedTenants: suspendedCount,
        totalPlans: plans.length,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch admin stats" });
    }
  });

  // ===== TENANT RESOLUTION (for multi-tenant) =====
  app.get("/api/tenant/:slug", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      res.json({
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        logo: tenant.logo,
        status: tenant.status
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tenant" });
    }
  });

  return httpServer;
}
