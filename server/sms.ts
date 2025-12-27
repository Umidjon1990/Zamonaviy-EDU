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

// Test mode - Eskiz only allows these messages in test mode
// Set to false when alpha-name is approved
const TEST_MODE = false;
const TEST_MESSAGE = "Bu Eskiz dan test";

// SMS Templates
export const smsTemplates = {
  paymentReminder: (name: string, group: string, amount: number) =>
    TEST_MODE ? TEST_MESSAGE : `Hurmatli ${name}, ${group} guruhi uchun ${amount.toLocaleString()} so'm to'lov qilishingiz kerak. EduCRM`,
  
  paymentReceived: (name: string, amount: number, balance: number) =>
    TEST_MODE ? TEST_MESSAGE : `Rahmat ${name}! ${amount.toLocaleString()} so'm to'lov qabul qilindi. Balansingiz: ${balance.toLocaleString()} so'm. EduCRM`,
  
  lowBalance: (name: string, balance: number) =>
    TEST_MODE ? TEST_MESSAGE : `Hurmatli ${name}, balansingiz ${balance.toLocaleString()} so'm. Iltimos to'lovni amalga oshiring. EduCRM`,
  
  welcomeStudent: (name: string, group: string) =>
    TEST_MODE ? TEST_MESSAGE : `Xush kelibsiz ${name}! Siz ${group} guruhiga qo'shildingiz. EduCRM`,
};
