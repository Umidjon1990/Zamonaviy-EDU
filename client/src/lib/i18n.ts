// Uzbek language translations for the UI

export const translations = {
  common: {
    save: "Saqlash",
    cancel: "Bekor qilish",
    delete: "O‘chirish",
    edit: "Tahrirlash",
    add: "Qo‘shish",
    search: "Qidirish...",
    filter: "Filtrlash",
    view: "Ko‘rish",
    loading: "Yuklanmoqda...",
    actions: "Amallar",
    status: "Holat",
    date: "Sana",
    back: "Orqaga",
  },
  nav: {
    dashboard: "Bosh sahifa",
    leads: "Lidlar",
    students: "O‘quvchilar",
    groups: "Guruhlar",
    schedule: "Dars jadvali",
    attendance: "Davomat",
    payments: "To‘lovlar",
    settings: "Sozlamalar",
    logout: "Chiqish",
  },
  dashboard: {
    title: "Markaz ko‘rsatkichlari",
    totalStudents: "Jami o‘quvchilar",
    activeGroups: "Faol guruhlar",
    newLeads: "Yangi lidlar",
    monthlyIncome: "Oylik tushum",
    attendanceRate: "Davomat foizi",
    recentActivity: "So‘nggi faolliklar",
  },
  leads: {
    title: "Lidlar ro‘yxati",
    addLead: "Yangi lid qo‘shish",
    status: {
      new: "Yangi",
      contacted: "Qo‘ng‘iroq qilindi",
      trial: "Sinov darsi",
      converted: "O‘qishga o‘tdi",
      lost: "Yopilgan",
    },
    columns: {
      name: "Ism Familiya",
      phone: "Telefon",
      source: "Manba",
      interest: "Qiziqish",
      date: "Sana",
    },
  },
  students: {
    title: "O‘quvchilar",
    addStudent: "O‘quvchi qo‘shish",
    status: {
      active: "Faol",
      paused: "Muzlatilgan",
      left: "Ketgan",
    },
  },
  groups: {
    title: "Guruhlar",
    addGroup: "Guruh qo‘shish",
    columns: {
      name: "Guruh nomi",
      teacher: "O‘qituvchi",
      subject: "Fan",
      level: "Daraja",
      students: "O‘quvchilar",
      schedule: "Vaqt",
    },
  },
  attendance: {
    title: "Davomat",
    present: "Bor",
    absent: "Yo‘q",
    late: "Kech",
    mark: "Belgilash",
  },
};

export type Translations = typeof translations;
