import { Bot, Context, session, SessionFlavor } from "grammy";
import { storage } from "./storage";

const TENANT_ID = 1;

interface SessionData {
  step: "start" | "awaiting_phone" | "verified";
  phone?: string;
  userType?: "student" | "teacher";
  studentId?: number;
  teacherId?: string;
}

type BotContext = Context & SessionFlavor<SessionData>;

let bot: Bot<BotContext> | null = null;

export async function startTelegramBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!token) {
    console.log("TELEGRAM_BOT_TOKEN topilmadi - bot ishga tushmaydi");
    return;
  }

  bot = new Bot<BotContext>(token);

  bot.use(session({
    initial: (): SessionData => ({
      step: "start",
    }),
  }));

  bot.command("start", async (ctx) => {
    ctx.session.step = "awaiting_phone";
    ctx.session.userType = undefined;
    ctx.session.studentId = undefined;
    ctx.session.teacherId = undefined;
    
    await ctx.reply(
      "Assalomu alaykum! EduCRM botiga xush kelibsiz!\n\n" +
      "O'z ma'lumotlaringizni ko'rish uchun telefon raqamingizni yuboring.\n\n" +
      "Namuna: +998901234567 yoki 901234567",
      {
        reply_markup: {
          keyboard: [[{ text: "📱 Telefon raqamni yuborish", request_contact: true }]],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      }
    );
  });

  bot.on("message:contact", async (ctx) => {
    const phone = ctx.message.contact.phone_number;
    await handlePhoneNumber(ctx, phone);
  });

  bot.on("message:text", async (ctx) => {
    if (ctx.session.step === "awaiting_phone") {
      const phone = ctx.message.text;
      await handlePhoneNumber(ctx, phone);
    } else if (ctx.session.step === "verified") {
      await handleVerifiedUser(ctx);
    } else {
      await ctx.reply("Iltimos /start buyrug'ini bosing");
    }
  });

  bot.command("balans", async (ctx) => {
    if (ctx.session.step !== "verified" || !ctx.session.studentId) {
      await ctx.reply("Bu buyruq faqat o'quvchilar uchun. /start");
      return;
    }
    await showBalance(ctx, ctx.session.studentId);
  });

  bot.command("davomat", async (ctx) => {
    if (ctx.session.step !== "verified") {
      await ctx.reply("Avval telefon raqamingizni tasdiqlang. /start");
      return;
    }
    if (ctx.session.userType === "teacher" && ctx.session.teacherId) {
      await showTeacherAttendance(ctx, ctx.session.teacherId);
    } else if (ctx.session.studentId) {
      await showAttendance(ctx, ctx.session.studentId);
    }
  });

  bot.command("guruhlar", async (ctx) => {
    if (ctx.session.step !== "verified") {
      await ctx.reply("Avval telefon raqamingizni tasdiqlang. /start");
      return;
    }
    if (ctx.session.userType === "teacher" && ctx.session.teacherId) {
      await showTeacherGroups(ctx, ctx.session.teacherId);
    } else if (ctx.session.studentId) {
      await showGroups(ctx, ctx.session.studentId);
    }
  });

  bot.command("oylik", async (ctx) => {
    if (ctx.session.step !== "verified" || ctx.session.userType !== "teacher" || !ctx.session.teacherId) {
      await ctx.reply("Bu buyruq faqat o'qituvchilar uchun.");
      return;
    }
    await showTeacherSalary(ctx, ctx.session.teacherId);
  });

  bot.catch((err) => {
    console.error("Telegram bot xatosi:", err);
  });

  try {
    await bot.start();
    console.log("Telegram bot ishga tushdi!");
  } catch (error) {
    console.error("Telegram bot ishga tushishda xatolik:", error);
  }
}

function normalizePhone(phone: string): string {
  let normalized = phone.replace(/[\s\-\+\(\)]/g, "");
  if (normalized.startsWith("998")) {
    return normalized;
  } else if (normalized.startsWith("0")) {
    return "998" + normalized.substring(1);
  } else if (normalized.length === 9) {
    return "998" + normalized;
  }
  return normalized;
}

async function handlePhoneNumber(ctx: BotContext, rawPhone: string) {
  const phone = normalizePhone(rawPhone);
  
  if (phone.length < 12) {
    await ctx.reply(
      "❌ Telefon raqami noto'g'ri formatda.\n\n" +
      "Iltimos, to'liq raqamni kiriting:\n" +
      "Namuna: +998901234567 yoki 901234567"
    );
    return;
  }

  // Check for teacher first
  const teachers = await storage.getTeachers(TENANT_ID);
  const teacher = teachers.find((t) => {
    const teacherPhone = t.phone ? normalizePhone(t.phone) : "";
    return teacherPhone === phone;
  });

  if (teacher) {
    ctx.session.step = "verified";
    ctx.session.userType = "teacher";
    ctx.session.teacherId = teacher.id;
    ctx.session.phone = phone;

    await ctx.reply(
      `✅ Xush kelibsiz, ${teacher.firstName} ${teacher.lastName}!\n\n` +
      `👨‍🏫 Siz o'qituvchi sifatida aniqlandingiz.\n\n` +
      `📊 Buyruqlar:\n` +
      `/guruhlar - Guruhlaringiz\n` +
      `/oylik - Oylik hisobi\n` +
      `/davomat - Davomat statistikasi\n`,
      {
        reply_markup: {
          keyboard: [
            [{ text: "📚 Guruhlar" }, { text: "💰 Oylik" }],
            [{ text: "📅 Davomat" }],
          ],
          resize_keyboard: true,
        },
      }
    );
    return;
  }

  // Check for student
  const students = await storage.getStudents(TENANT_ID);
  const matchingStudents = students.filter((s) => {
    const studentPhone = normalizePhone(s.phone);
    const parentPhone = s.parentPhone ? normalizePhone(s.parentPhone) : "";
    return studentPhone === phone || parentPhone === phone;
  });
  
  if (matchingStudents.length > 1) {
    await ctx.reply(
      "⚠️ Bir nechta o'quvchi topildi. Iltimos, markaz bilan bog'laning."
    );
    return;
  }
  
  const student = matchingStudents[0];

  if (student) {
    ctx.session.step = "verified";
    ctx.session.userType = "student";
    ctx.session.studentId = student.id;
    ctx.session.phone = phone;

    await ctx.reply(
      `✅ Tabriklaymiz! Siz ${student.firstName} ${student.lastName} sifatida aniqlandingiz.\n\n` +
      `📊 Buyruqlar:\n` +
      `/balans - Balansingizni ko'rish\n` +
      `/davomat - Davomat ma'lumotlari\n` +
      `/guruhlar - Guruhlaringiz\n`,
      {
        reply_markup: {
          keyboard: [
            [{ text: "💰 Balans" }, { text: "📅 Davomat" }],
            [{ text: "📚 Guruhlar" }],
          ],
          resize_keyboard: true,
        },
      }
    );
  } else {
    await ctx.reply(
      "❌ Kechirasiz, bu telefon raqami tizimda topilmadi.\n\n" +
      "Iltimos, markaz bilan bog'laning yoki boshqa raqam kiriting."
    );
  }
}

async function handleVerifiedUser(ctx: BotContext) {
  const text = ctx.message?.text?.toLowerCase() || "";
  
  if (ctx.session.userType === "teacher" && ctx.session.teacherId) {
    if (text.includes("guruh") || text.includes("📚")) {
      await showTeacherGroups(ctx, ctx.session.teacherId);
    } else if (text.includes("oylik") || text.includes("💰")) {
      await showTeacherSalary(ctx, ctx.session.teacherId);
    } else if (text.includes("davomat") || text.includes("📅")) {
      await showTeacherAttendance(ctx, ctx.session.teacherId);
    } else {
      await ctx.reply(
        "Quyidagi buyruqlardan birini tanlang:\n\n" +
        "📚 Guruhlar - Sizning guruhlaringiz\n" +
        "💰 Oylik - Oylik hisobi\n" +
        "📅 Davomat - Davomat statistikasi"
      );
    }
  } else if (ctx.session.studentId) {
    if (text.includes("balans") || text.includes("💰")) {
      await showBalance(ctx, ctx.session.studentId);
    } else if (text.includes("davomat") || text.includes("📅")) {
      await showAttendance(ctx, ctx.session.studentId);
    } else if (text.includes("guruh") || text.includes("📚")) {
      await showGroups(ctx, ctx.session.studentId);
    } else {
      await ctx.reply(
        "Quyidagi buyruqlardan birini tanlang:\n\n" +
        "💰 Balans - Hisobingizni ko'rish\n" +
        "📅 Davomat - Davomat ma'lumotlari\n" +
        "📚 Guruhlar - Guruhlaringiz"
      );
    }
  }
}

// ===== STUDENT FUNCTIONS =====

async function showBalance(ctx: BotContext, studentId: number) {
  const student = await storage.getStudent(studentId);
  if (!student) {
    await ctx.reply("Ma'lumot topilmadi");
    return;
  }

  const balance = student.balance || 0;
  const emoji = balance >= 0 ? "✅" : "⚠️";
  const status = balance >= 0 ? "Balansingiz musbat" : "Sizda qarz bor";

  await ctx.reply(
    `${emoji} <b>Balans ma'lumotlari</b>\n\n` +
    `👤 ${student.firstName} ${student.lastName}\n` +
    `💰 Balans: <b>${balance.toLocaleString()} so'm</b>\n` +
    `📊 ${status}`,
    { parse_mode: "HTML" }
  );
}

async function showAttendance(ctx: BotContext, studentId: number) {
  const student = await storage.getStudent(studentId);
  if (!student) {
    await ctx.reply("Ma'lumot topilmadi");
    return;
  }

  const now = new Date();
  const attendanceRecords = await storage.getAttendance(
    TENANT_ID,
    undefined,
    undefined,
    now.getMonth() + 1,
    now.getFullYear()
  );

  const studentAttendance = attendanceRecords.filter(a => a.studentId === studentId);
  const present = studentAttendance.filter(a => a.status === "present").length;
  const absent = studentAttendance.filter(a => a.status === "absent").length;
  const total = present + absent;
  const rate = total > 0 ? Math.round((present / total) * 100) : 0;

  await ctx.reply(
    `📅 <b>Davomat (${now.toLocaleString("uz-UZ", { month: "long" })})</b>\n\n` +
    `👤 ${student.firstName} ${student.lastName}\n` +
    `✅ Keldi: ${present} kun\n` +
    `❌ Kelmadi: ${absent} kun\n` +
    `📊 Davomat: <b>${rate}%</b>`,
    { parse_mode: "HTML" }
  );
}

async function showGroups(ctx: BotContext, studentId: number) {
  const student = await storage.getStudent(studentId);
  if (!student) {
    await ctx.reply("Ma'lumot topilmadi");
    return;
  }

  const studentGroups = await storage.getStudentGroups(studentId);
  
  if (studentGroups.length === 0) {
    await ctx.reply("Siz hozircha hech qaysi guruhga qo'shilmagansiz.");
    return;
  }

  let message = `📚 <b>Sizning guruhlaringiz</b>\n\n`;
  
  for (const sg of studentGroups) {
    const group = await storage.getGroup(sg.groupId);
    if (group) {
      message += `📖 <b>${group.name}</b>\n`;
      message += `⏰ ${group.time}\n`;
      message += `📆 ${group.days?.join(", ") || "-"}\n`;
      if (group.room) message += `🏫 Xona: ${group.room}\n`;
      message += `\n`;
    }
  }

  await ctx.reply(message, { parse_mode: "HTML" });
}

// ===== TEACHER FUNCTIONS =====

async function showTeacherGroups(ctx: BotContext, teacherId: string) {
  const teacher = await storage.getUser(teacherId);
  if (!teacher) {
    await ctx.reply("Ma'lumot topilmadi");
    return;
  }

  const groups = await storage.getGroupsByTeacher(teacherId);
  
  if (groups.length === 0) {
    await ctx.reply("Sizga hozircha guruh biriktirilmagan.");
    return;
  }

  let message = `📚 <b>Sizning guruhlaringiz</b>\n\n`;
  let totalStudents = 0;
  
  for (const group of groups) {
    const students = await storage.getStudentsByGroup(group.id);
    totalStudents += students.length;
    
    message += `📖 <b>${group.name}</b>\n`;
    message += `👥 O'quvchilar: ${students.length} ta\n`;
    message += `⏰ Vaqt: ${group.time}\n`;
    message += `📆 Kunlar: ${group.days?.join(", ") || "-"}\n`;
    if (group.room) message += `🏫 Xona: ${group.room}\n`;
    message += `\n`;
  }

  message += `━━━━━━━━━━━━━━━\n`;
  message += `📊 Jami: ${groups.length} ta guruh, ${totalStudents} ta o'quvchi`;

  await ctx.reply(message, { parse_mode: "HTML" });
}

async function showTeacherSalary(ctx: BotContext, teacherId: string) {
  const teacher = await storage.getUser(teacherId);
  if (!teacher) {
    await ctx.reply("Ma'lumot topilmadi");
    return;
  }

  const now = new Date();
  const groups = await storage.getGroupsByTeacher(teacherId);
  
  // Get all payments for this month
  const payments = await storage.getPayments(TENANT_ID);
  const monthlyPayments = payments.filter(p => {
    const paymentDate = new Date(p.createdAt);
    return paymentDate.getMonth() === now.getMonth() && 
           paymentDate.getFullYear() === now.getFullYear() &&
           p.status === "completed";
  });

  // Get students in teacher's groups
  let teacherStudentIds: number[] = [];
  for (const group of groups) {
    const students = await storage.getStudentsByGroup(group.id);
    teacherStudentIds = [...teacherStudentIds, ...students.map(s => s.id)];
  }
  teacherStudentIds = Array.from(new Set(teacherStudentIds)); // Remove duplicates

  // Calculate teacher's share
  const teacherPayments = monthlyPayments.filter(p => teacherStudentIds.includes(p.studentId));
  const totalIncome = teacherPayments.reduce((sum, p) => sum + p.amount, 0);
  const salaryPercent = teacher.salaryPercent || 30;
  const teacherSalary = Math.round(totalIncome * salaryPercent / 100);

  // Get attendance stats
  const attendanceRecords = await storage.getAttendance(
    TENANT_ID,
    undefined,
    undefined,
    now.getMonth() + 1,
    now.getFullYear()
  );
  
  let totalLessons = 0;
  for (const group of groups) {
    const groupAttendance = attendanceRecords.filter(a => a.groupId === group.id);
    const uniqueDates = new Set(groupAttendance.map(a => a.date?.toISOString().split('T')[0]));
    totalLessons += uniqueDates.size;
  }

  await ctx.reply(
    `💰 <b>Oylik hisobi (${now.toLocaleString("uz-UZ", { month: "long" })})</b>\n\n` +
    `👨‍🏫 ${teacher.firstName} ${teacher.lastName}\n\n` +
    `📊 Guruhlar: ${groups.length} ta\n` +
    `👥 O'quvchilar: ${teacherStudentIds.length} ta\n` +
    `📅 O'tilgan darslar: ${totalLessons} ta\n\n` +
    `💵 Umumiy tushum: ${totalIncome.toLocaleString()} so'm\n` +
    `📈 Sizning ulush: ${salaryPercent}%\n` +
    `━━━━━━━━━━━━━━━\n` +
    `💰 <b>Oylik: ${teacherSalary.toLocaleString()} so'm</b>`,
    { parse_mode: "HTML" }
  );
}

async function showTeacherAttendance(ctx: BotContext, teacherId: string) {
  const teacher = await storage.getUser(teacherId);
  if (!teacher) {
    await ctx.reply("Ma'lumot topilmadi");
    return;
  }

  const now = new Date();
  const groups = await storage.getGroupsByTeacher(teacherId);
  
  const attendanceRecords = await storage.getAttendance(
    TENANT_ID,
    undefined,
    undefined,
    now.getMonth() + 1,
    now.getFullYear()
  );

  let message = `📅 <b>Davomat statistikasi (${now.toLocaleString("uz-UZ", { month: "long" })})</b>\n\n`;
  
  let totalPresent = 0;
  let totalAbsent = 0;

  for (const group of groups) {
    const groupAttendance = attendanceRecords.filter(a => a.groupId === group.id);
    const present = groupAttendance.filter(a => a.status === "present").length;
    const absent = groupAttendance.filter(a => a.status === "absent").length;
    const total = present + absent;
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;
    
    totalPresent += present;
    totalAbsent += absent;

    message += `📖 <b>${group.name}</b>\n`;
    message += `✅ Keldi: ${present} | ❌ Kelmadi: ${absent} | 📊 ${rate}%\n\n`;
  }

  const overallTotal = totalPresent + totalAbsent;
  const overallRate = overallTotal > 0 ? Math.round((totalPresent / overallTotal) * 100) : 0;

  message += `━━━━━━━━━━━━━━━\n`;
  message += `📊 <b>Umumiy davomat: ${overallRate}%</b>`;

  await ctx.reply(message, { parse_mode: "HTML" });
}

export function stopTelegramBot() {
  if (bot) {
    bot.stop();
  }
}

export async function sendTelegramMessage(chatId: string | number, message: string): Promise<boolean> {
  if (!bot) {
    console.log("Telegram bot ishga tushmagan");
    return false;
  }
  
  try {
    await bot.api.sendMessage(chatId, message, { parse_mode: "HTML" });
    return true;
  } catch (error) {
    console.error("Telegram xabar yuborishda xatolik:", error);
    return false;
  }
}
