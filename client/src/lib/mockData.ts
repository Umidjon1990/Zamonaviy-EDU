export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  parentPhone: string;
  status: "active" | "paused" | "left";
  balance: number;
  groups: string[];
}

export interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  status: "new" | "contacted" | "trial" | "converted" | "lost";
  source: string;
  interest: string;
  createdAt: string;
}

export interface Group {
  id: string;
  name: string;
  teacher: string;
  subject: string;
  level: string;
  days: string[];
  time: string;
  room: string;
  studentsCount: number;
  maxStudents: number;
}

export const mockStudents: Student[] = [
  { id: "1", firstName: "Aziz", lastName: "Rahimov", phone: "+998 90 123 45 67", parentPhone: "+998 90 111 22 33", status: "active", balance: 500000, groups: ["G-101"] },
  { id: "2", firstName: "Malika", lastName: "Karimova", phone: "+998 91 987 65 43", parentPhone: "+998 91 222 33 44", status: "active", balance: -100000, groups: ["G-102"] },
  { id: "3", firstName: "Jasur", lastName: "Tursunov", phone: "+998 93 555 66 77", parentPhone: "+998 93 444 55 66", status: "paused", balance: 0, groups: ["G-101"] },
  { id: "4", firstName: "Dilnoza", lastName: "Aliyeva", phone: "+998 99 888 99 00", parentPhone: "+998 99 777 88 99", status: "active", balance: 1200000, groups: ["G-103"] },
  { id: "5", firstName: "Otabek", lastName: "Usmonov", phone: "+998 97 123 12 12", parentPhone: "+998 97 321 32 32", status: "left", balance: 0, groups: [] },
];

export const mockLeads: Lead[] = [
  { id: "1", firstName: "Sardor", lastName: "Komilov", phone: "+998 90 123 45 00", status: "new", source: "Instagram", interest: "General English", createdAt: "2025-12-25" },
  { id: "2", firstName: "Zarina", lastName: "Yusupova", phone: "+998 91 987 65 00", status: "contacted", source: "Telegram", interest: "IELTS", createdAt: "2025-12-26" },
  { id: "3", firstName: "Bekzod", lastName: "Nurmatov", phone: "+998 93 555 66 00", status: "trial", source: "Walk-in", interest: "Math", createdAt: "2025-12-24" },
  { id: "4", firstName: "Laylo", lastName: "Sharipova", phone: "+998 99 888 99 00", status: "converted", source: "Referral", interest: "Russian", createdAt: "2025-12-20" },
  { id: "5", firstName: "Jamshid", lastName: "Qodirov", phone: "+998 97 123 12 00", status: "lost", source: "Instagram", interest: "Coding", createdAt: "2025-12-15" },
];

export const mockGroups: Group[] = [
  { id: "G-101", name: "English A1", teacher: "Dilshod aka", subject: "English", level: "Beginner", days: ["Du", "Chor", "Juma"], time: "14:00 - 15:30", room: "Xona 1", studentsCount: 10, maxStudents: 12 },
  { id: "G-102", name: "IELTS Pro", teacher: "Elena op", subject: "English", level: "Advanced", days: ["Se", "Pay", "Shan"], time: "16:00 - 18:00", room: "Xona 3", studentsCount: 8, maxStudents: 10 },
  { id: "G-103", name: "Matematika", teacher: "Sanjar aka", subject: "Math", level: "School", days: ["Du", "Chor", "Juma"], time: "10:00 - 11:30", room: "Xona 2", studentsCount: 15, maxStudents: 15 },
];

export const mockStats = {
  totalStudents: 124,
  activeGroups: 12,
  newLeads: 45,
  monthlyIncome: 35000000,
  attendanceRate: 92,
};

export const mockSchedule = [
  { time: "09:00", mon: "G-103", tue: "", wed: "G-103", thu: "", fri: "G-103", sat: "" },
  { time: "14:00", mon: "G-101", tue: "", wed: "G-101", thu: "", fri: "G-101", sat: "" },
  { time: "16:00", mon: "", tue: "G-102", wed: "", thu: "G-102", fri: "", sat: "G-102" },
];
