import { Bot, Context, session, SessionFlavor } from "grammy";
import { storage } from "./storage";

const TENANT_ID = 1;

interface SessionData {
  step: "start" | "awaiting_phone" | "verified";
  phone?: string;
  studentId?: number;
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
    } else if (ctx.session.step === "verified" && ctx.session.studentId) {
      await handleVerifiedUser(ctx);
    } else {
      await ctx.reply("Iltimos /start buyrug'ini bosing");
    }
  });

  bot.command("balans", async (ctx) => {
    if (ctx.session.step !== "verified" || !ctx.session.studentId) {
      await ctx.reply("Avval telefon raqamingizni tasdiqlang. /start");
      return;
    }
    await showBalance(ctx, ctx.session.studentId);
  });

  bot.command("davomat", async (ctx) => {
    if (ctx.session.step !== "verified" || !ctx.session.studentId) {
      await ctx.reply("Avval telefon raqamingizni tasdiqlang. /start");
      return;
    }
    await showAttendance(ctx, ctx.session.studentId);
  });

  bot.command("guruhlar", async (ctx) => {
    if (ctx.session.step !== "verified" || !ctx.session.studentId) {
      await ctx.reply("Avval telefon raqamingizni tasdiqlang. /start");
      return;
    }
    await showGroups(ctx, ctx.session.studentId);
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

async function handlePhoneNumber(ctx: BotContext, rawPhone: string) {
  let phone = rawPhone.replace(/[\s\-\+\(\)]/g, "");
  
  if (phone.startsWith("998")) {
    phone = phone;
  } else if (phone.startsWith("0")) {
    phone = "998" + phone.substring(1);
  } else if (phone.length === 9) {
    phone = "998" + phone;
  }

  const students = await storage.getStudents(TENANT_ID);
  const student = students.find((s) => {
    const studentPhone = s.phone.replace(/[\s\-\+\(\)]/g, "");
    const parentPhone = s.parentPhone?.replace(/[\s\-\+\(\)]/g, "") || "";
    return studentPhone.includes(phone) || phone.includes(studentPhone) ||
           parentPhone.includes(phone) || phone.includes(parentPhone);
  });

  if (student) {
    ctx.session.step = "verified";
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
  
  if (text.includes("balans") || text.includes("💰")) {
    await showBalance(ctx, ctx.session.studentId!);
  } else if (text.includes("davomat") || text.includes("📅")) {
    await showAttendance(ctx, ctx.session.studentId!);
  } else if (text.includes("guruh") || text.includes("📚")) {
    await showGroups(ctx, ctx.session.studentId!);
  } else {
    await ctx.reply(
      "Quyidagi buyruqlardan birini tanlang:\n\n" +
      "💰 Balans - Hisobingizni ko'rish\n" +
      "📅 Davomat - Davomat ma'lumotlari\n" +
      "📚 Guruhlar - Guruhlaringiz"
    );
  }
}

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
