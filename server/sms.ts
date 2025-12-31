import { storage } from "./storage";

const ESKIZ_API_URL = "https://notify.eskiz.uz/api";

interface EskizToken {
  token: string;
  expiresAt: number;
}

let cachedToken: EskizToken | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const email = process.env.ESKIZ_EMAIL;
  const password = process.env.ESKIZ_PASSWORD;

  if (!email || !password) {
    throw new Error("ESKIZ_EMAIL va ESKIZ_PASSWORD sozlanmagan");
  }

  const response = await fetch(`${ESKIZ_API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error("Eskiz autentifikatsiya xatosi");
  }

  const data = await response.json();
  cachedToken = {
    token: data.data.token,
    expiresAt: Date.now() + 29 * 24 * 60 * 60 * 1000, // 29 days
  };

  return cachedToken.token;
}

export async function sendSMS(phone: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const token = await getToken();
    
    // Format phone number (remove + and spaces)
    let formattedPhone = phone.replace(/[\s\-\+]/g, "");
    if (!formattedPhone.startsWith("998")) {
      formattedPhone = "998" + formattedPhone.replace(/^0/, "");
    }

    console.log(`SMS yuborilmoqda: ${formattedPhone}`);
    console.log(`Xabar: ${message}`);

    const response = await fetch(`${ESKIZ_API_URL}/message/sms/send`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mobile_phone: formattedPhone,
        message: message,
        from: "4546",
      }),
    });

    const data = await response.json();
    console.log("Eskiz javob:", JSON.stringify(data));

    if (data.status === "success" || data.status === "waiting") {
      return { success: true, messageId: data.id };
    } else {
      return { success: false, error: data.message || "SMS yuborishda xatolik" };
    }
  } catch (error: any) {
    console.error("SMS yuborishda xatolik:", error);
    return { success: false, error: error.message };
  }
}

export async function getBalance(): Promise<{ balance: number; error?: string }> {
  try {
    const token = await getToken();

    const response = await fetch(`${ESKIZ_API_URL}/user/get-limit`, {
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    });

    const data = await response.json();
    return { balance: data.data?.balance || 0 };
  } catch (error: any) {
    return { balance: 0, error: error.message };
  }
}

// Format number with commas (e.g., 300000 -> "300,000") - matching Eskiz approved template
function formatAmount(amount: number): string {
  return amount.toLocaleString('en-US');
}

// SMS Templates - exactly matching Eskiz approved templates
export const smsTemplates = {
  // Template 1: To'lov qabul qilindi
  // "Assalomu alaykum, {name} ! Sizning {course} uchun {amount} so'm to'lovingiz qabul qilindi. Hurmat bilan, Zamonaviy Ta'lim Markazi."
  paymentReceived: (name: string, course: string, amount: number) =>
    `Assalomu alaykum, ${name} ! Sizning ${course} uchun ${formatAmount(amount)} so'm to'lovingiz qabul qilindi. Hurmat bilan, Zamonaviy Ta'lim Markazi.`,
  
  // Template 2: Kam balans eslatma
  // "Hurmatli {fullName}! Hisobingizda {balance} so'm qoldi. To'lovni o'z vaqtida amalga oshiringizni so'raymiz. Hurmat bilan, Zamonaviy Ta'lim Markazi."
  lowBalance: (fullName: string, balance: number) =>
    `Hurmatli ${fullName}! Hisobingizda ${formatAmount(balance)} so'm qoldi. To'lovni o'z vaqtida amalga oshiringizni so'raymiz. Hurmat bilan, Zamonaviy Ta'lim Markazi.`,
  
  // Template 3: Darsga kelmadi
  // "Assalomu alaykum, {name} ! Siz {group} guruhida soat {time} da {subject} darsiga qatnashmadingiz. Hurmat bilan, Zamonaviy Ta'lim Markazi."
  absenceNotification: (name: string, group: string, time: string, subject: string) =>
    `Assalomu alaykum, ${name} ! Siz ${group} guruhida soat ${time} da ${subject} darsiga qatnashmadingiz. Hurmat bilan, Zamonaviy Ta'lim Markazi.`,
};

// Check if tenant can send SMS (enabled and has credits)
export async function canSendSMS(tenantId: number): Promise<{ canSend: boolean; reason?: string }> {
  const tenant = await storage.getTenant(tenantId);
  if (!tenant) {
    return { canSend: false, reason: "Tenant topilmadi" };
  }
  if (!tenant.smsEnabled) {
    return { canSend: false, reason: "SMS xizmati yoqilmagan" };
  }
  if (tenant.smsCredits <= 0) {
    return { canSend: false, reason: "SMS krediti tugagan" };
  }
  return { canSend: true };
}

// Send SMS with tenant credit deduction
export async function sendTenantSMS(
  tenantId: number,
  phone: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  // Check if tenant can send SMS
  const { canSend, reason } = await canSendSMS(tenantId);
  if (!canSend) {
    return { success: false, error: reason };
  }

  // Send the SMS
  const result = await sendSMS(phone, message);

  // Decrement credits only if SMS was sent successfully
  if (result.success) {
    await storage.decrementSmsCredits(tenantId);
  }

  return result;
}

// Send payment received SMS (tenant-aware)
export async function sendPaymentReceivedSMS(phone: string, name: string, course: string, amount: number, tenantId?: number) {
  const message = smsTemplates.paymentReceived(name, course, amount);
  if (tenantId) {
    return sendTenantSMS(tenantId, phone, message);
  }
  return sendSMS(phone, message);
}

// Send low balance reminder SMS (tenant-aware)
export async function sendLowBalanceSMS(phone: string, fullName: string, balance: number, tenantId?: number) {
  const message = smsTemplates.lowBalance(fullName, balance);
  if (tenantId) {
    return sendTenantSMS(tenantId, phone, message);
  }
  return sendSMS(phone, message);
}

// Send absence notification SMS (tenant-aware)
export async function sendAbsenceSMS(phone: string, name: string, group: string, time: string, subject: string, tenantId?: number) {
  const message = smsTemplates.absenceNotification(name, group, time, subject);
  if (tenantId) {
    return sendTenantSMS(tenantId, phone, message);
  }
  return sendSMS(phone, message);
}
