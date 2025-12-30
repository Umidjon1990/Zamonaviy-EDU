import type { Express } from "express";
import { createServer, type Server } from "http";
import bcrypt from "bcrypt";
import { storage } from "./storage";
import { sendSMS, getBalance, smsTemplates, sendPaymentReceivedSMS, sendLowBalanceSMS, sendAbsenceSMS } from "./sms";
import { notifyStudentAttendance, notifyStudentPayment } from "./telegram-bot";
import {
  insertLeadSchema,
  insertStudentSchema,
  insertSubjectSchema,
  insertGroupSchema,
  insertStudentGroupSchema,
  insertAttendanceSchema,
  insertPaymentSchema,
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

  app.get("/api/auth/me", (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Avtorizatsiya talab qilinadi" });
    }
    res.json({
      userId: req.session.userId,
      tenantId: req.session.tenantId,
      role: req.session.role,
    });
  });

  // Apply requireTenantAuth to all tenant data routes
  app.use("/api/leads", requireTenantAuth);
  app.use("/api/students", requireTenantAuth);
  app.use("/api/subjects", requireTenantAuth);
  app.use("/api/groups", requireTenantAuth);
  app.use("/api/attendance", requireTenantAuth);
  app.use("/api/payments", requireTenantAuth);
  app.use("/api/teachers", requireTenantAuth);
  app.use("/api/stats", requireTenantAuth);

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
      const lead = await storage.getLead(id);
      if (!lead || lead.tenantId !== tenantId) {
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
      const lead = await storage.getLead(id);
      if (!lead || lead.tenantId !== tenantId) {
        return res.status(404).json({ error: "Lead not found" });
      }
      const updated = await storage.updateLead(id, req.body);
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Failed to update lead" });
    }
  });

  app.delete("/api/leads/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const tenantId = getTenantId(req);
      const lead = await storage.getLead(id);
      if (!lead || lead.tenantId !== tenantId) {
        return res.status(404).json({ error: "Lead not found" });
      }
      await storage.deleteLead(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete lead" });
    }
  });

  // ===== STUDENTS =====
  app.get("/api/students", async (req, res) => {
    try {
      const students = await storage.getStudents(getTenantId(req));
      res.json(students);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch students" });
    }
  });

  app.get("/api/students/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const tenantId = getTenantId(req);
      const student = await storage.getStudent(id);
      if (!student || student.tenantId !== tenantId) {
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
      res.status(400).json({ error: "Invalid student data" });
    }
  });

  app.patch("/api/students/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const tenantId = getTenantId(req);
      const existing = await storage.getStudent(id);
      if (!existing || existing.tenantId !== tenantId) {
        return res.status(404).json({ error: "Student not found" });
      }
      const student = await storage.updateStudent(id, req.body);
      res.json(student);
    } catch (error) {
      res.status(400).json({ error: "Failed to update student" });
    }
  });

  app.delete("/api/students/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const tenantId = getTenantId(req);
      const existing = await storage.getStudent(id);
      if (!existing || existing.tenantId !== tenantId) {
        return res.status(404).json({ error: "Student not found" });
      }
      await storage.deleteStudent(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete student" });
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

  // ===== GROUPS =====
  app.get("/api/groups", async (req, res) => {
    try {
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
      const group = await storage.getGroup(id);
      if (!group || group.tenantId !== tenantId) {
        return res.status(404).json({ error: "Group not found" });
      }
      res.json(group);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch group" });
    }
  });

  app.post("/api/groups", async (req, res) => {
    try {
      const data = insertGroupSchema.parse({ ...req.body, tenantId: getTenantId(req) });
      const group = await storage.createGroup(data);
      res.status(201).json(group);
    } catch (error) {
      res.status(400).json({ error: "Invalid group data" });
    }
  });

  app.patch("/api/groups/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const tenantId = getTenantId(req);
      const existing = await storage.getGroup(id);
      if (!existing || existing.tenantId !== tenantId) {
        return res.status(404).json({ error: "Group not found" });
      }
      const group = await storage.updateGroup(id, req.body);
      res.json(group);
    } catch (error) {
      res.status(400).json({ error: "Failed to update group" });
    }
  });

  app.delete("/api/groups/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const tenantId = getTenantId(req);
      const existing = await storage.getGroup(id);
      if (!existing || existing.tenantId !== tenantId) {
        return res.status(404).json({ error: "Group not found" });
      }
      await storage.deleteGroup(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete group" });
    }
  });

  // ===== STUDENT GROUPS =====
  app.get("/api/students/:studentId/groups", async (req, res) => {
    try {
      const studentId = parseInt(req.params.studentId);
      const tenantId = getTenantId(req);
      const student = await storage.getStudent(studentId);
      if (!student || student.tenantId !== tenantId) {
        return res.status(404).json({ error: "Student not found" });
      }
      const groups = await storage.getStudentGroups(studentId);
      res.json(groups);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch student groups" });
    }
  });

  app.post("/api/students/:studentId/groups", async (req, res) => {
    try {
      const studentId = parseInt(req.params.studentId);
      const tenantId = getTenantId(req);
      const student = await storage.getStudent(studentId);
      if (!student || student.tenantId !== tenantId) {
        return res.status(404).json({ error: "Student not found" });
      }
      const group = await storage.getGroup(req.body.groupId);
      if (!group || group.tenantId !== tenantId) {
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
      const student = await storage.getStudent(studentId);
      if (!student || student.tenantId !== tenantId) {
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
      const attendance = await storage.getAttendance(getTenantId(req), groupId, date, month, year);
      res.json(attendance);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch attendance" });
    }
  });

  app.post("/api/attendance", async (req, res) => {
    try {
      const data = insertAttendanceSchema.parse({ ...req.body, tenantId: getTenantId(req) });
      const attendance = await storage.createAttendance(data);
      
      // Send Telegram notification to student
      if (data.studentId && data.groupId && data.status && data.date) {
        const group = await storage.getGroup(data.groupId);
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
      const existing = await storage.getAttendanceById(id);
      if (!existing || existing.tenantId !== tenantId) {
        return res.status(404).json({ error: "Attendance record not found" });
      }
      const attendance = await storage.updateAttendance(id, req.body);
      res.json(attendance);
    } catch (error) {
      res.status(400).json({ error: "Failed to update attendance" });
    }
  });

  // ===== PAYMENTS =====
  app.get("/api/payments", async (req, res) => {
    try {
      const studentId = req.query.studentId ? parseInt(req.query.studentId as string) : undefined;
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
      const payment = await storage.getPayment(id);
      if (!payment || payment.tenantId !== tenantId) {
        return res.status(404).json({ error: "Payment not found" });
      }
      res.json(payment);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payment" });
    }
  });

  app.post("/api/payments", async (req, res) => {
    try {
      const data = insertPaymentSchema.parse({ ...req.body, tenantId: getTenantId(req) });
      const payment = await storage.createPayment(data);
      
      // Update student balance
      if (payment.status === 'completed') {
        const student = await storage.getStudent(payment.studentId);
        if (student) {
          const newBalance = student.balance + payment.amount;
          await storage.updateStudent(payment.studentId, {
            balance: newBalance,
          });
          
          // Send Telegram notification to student
          notifyStudentPayment(payment.studentId, payment.amount, newBalance)
            .catch(err => console.error("Telegram notification error:", err));
          
          // Send SMS notification
          const phone = student.parentPhone || student.phone;
          if (phone) {
            // Find student's group to get course name
            const studentGroupsList = await storage.getStudentGroups(payment.studentId);
            let courseName = "umumiy kursi"; // Default fallback matching Eskiz template format
            if (studentGroupsList.length > 0) {
              const group = await storage.getGroup(studentGroupsList[0].groupId);
              if (group) {
                // Eskiz template requires "... kursi" format
                courseName = group.name.toLowerCase().includes("kurs") ? group.name : group.name + " kursi";
              }
            }
            
            sendPaymentReceivedSMS(phone, student.firstName, courseName, payment.amount)
              .catch(err => console.error("SMS notification error:", err));
          }
        }
      }
      
      res.status(201).json(payment);
    } catch (error) {
      res.status(400).json({ error: "Invalid payment data" });
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
      res.status(400).json({ error: "Failed to create teacher" });
    }
  });

  // Teacher login
  app.post("/api/auth/teacher-login", async (req, res) => {
    try {
      const { email, password } = req.body;
      const user = await storage.getUserByEmail(email);
      
      if (!user || user.role !== "teacher") {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      if (user.password !== password) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      res.json({
        token: `teacher_${user.id}_${Date.now()}`,
        teacher: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Login failed" });
    }
  });

  // Get teacher's groups
  app.get("/api/teacher/:teacherId/groups", async (req, res) => {
    try {
      const teacherId = req.params.teacherId;
      const groups = await storage.getGroupsByTeacher(teacherId);
      res.json(groups);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch groups" });
    }
  });

  // Get students in a group
  app.get("/api/groups/:groupId/students", async (req, res) => {
    try {
      const groupId = parseInt(req.params.groupId);
      const tenantId = getTenantId(req);
      const group = await storage.getGroup(groupId);
      if (!group || group.tenantId !== tenantId) {
        return res.status(404).json({ error: "Group not found" });
      }
      const students = await storage.getStudentsByGroup(groupId);
      res.json(students);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch students" });
    }
  });

  // Get all students for a teacher (across all their groups)
  app.get("/api/teacher/:teacherId/students", async (req, res) => {
    try {
      const teacherId = req.params.teacherId;
      const tenantId = getTenantId(req);
      const teacher = await storage.getTeacher(teacherId);
      if (!teacher || teacher.tenantId !== tenantId) {
        return res.status(404).json({ error: "Teacher not found" });
      }
      const students = await storage.getStudentsByTeacher(teacherId);
      res.json(students);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch students" });
    }
  });

  // Teacher creates a student
  app.post("/api/teacher/students", async (req, res) => {
    try {
      const { firstName, lastName, phone, parentPhone, groupId } = req.body;
      const student = await storage.createStudent({
        tenantId: getTenantId(req),
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

  // Teacher updates a student (no delete allowed)
  app.patch("/api/teacher/students/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { firstName, lastName, phone, parentPhone } = req.body;
      const student = await storage.updateStudent(id, { firstName, lastName, phone, parentPhone });
      res.json(student);
    } catch (error) {
      res.status(400).json({ error: "Failed to update student" });
    }
  });

  // Teacher moves student between groups
  app.post("/api/teacher/move-student", async (req, res) => {
    try {
      const { studentId, fromGroupId, toGroupId } = req.body;
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
      const deleted = await storage.deleteUser(id);
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
      const student = await storage.getStudent(studentId);
      
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
      const student = await storage.getStudent(studentId);
      const group = groupId ? await storage.getGroup(groupId) : null;
      
      if (!student) {
        return res.status(404).json({ error: "O'quvchi topilmadi" });
      }

      const phone = student.parentPhone || student.phone;
      if (!phone) {
        return res.status(400).json({ error: "Telefon raqami yo'q" });
      }

      const courseName = group?.name || "kurs";
      const result = await sendPaymentReceivedSMS(phone, student.firstName, courseName, amount);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to send payment confirmation" });
    }
  });

  // Absence notification (approved template 3)
  app.post("/api/sms/absence", async (req, res) => {
    try {
      const { studentId, groupId, time } = req.body;
      const student = await storage.getStudent(studentId);
      const group = await storage.getGroup(groupId);
      
      if (!student || !group) {
        return res.status(404).json({ error: "O'quvchi yoki guruh topilmadi" });
      }

      const phone = student.parentPhone || student.phone;
      if (!phone) {
        return res.status(400).json({ error: "Telefon raqami yo'q" });
      }

      const subject = await storage.getSubject(group.subjectId);
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
