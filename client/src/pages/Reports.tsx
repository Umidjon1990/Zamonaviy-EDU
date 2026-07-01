import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useStudents, usePayments, useGroups, useTeachers, useExpenses } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { 
  FileText, Download, Users, CreditCard, Calendar, AlertTriangle, 
  TrendingUp, FileDown, Wallet, Send, Printer, CheckCircle2, XCircle,
  GraduationCap, Banknote, HandCoins, Clock, ThumbsUp, ThumbsDown, Plus, History
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const months = [
  { value: "1", label: "Yanvar" },
  { value: "2", label: "Fevral" },
  { value: "3", label: "Mart" },
  { value: "4", label: "Aprel" },
  { value: "5", label: "May" },
  { value: "6", label: "Iyun" },
  { value: "7", label: "Iyul" },
  { value: "8", label: "Avgust" },
  { value: "9", label: "Sentyabr" },
  { value: "10", label: "Oktyabr" },
  { value: "11", label: "Noyabr" },
  { value: "12", label: "Dekabr" },
];

const currentMonth = (new Date().getMonth() + 1).toString();
const currentYear = new Date().getFullYear().toString();

export default function Reports() {
  const { data: students, isLoading: studentsLoading } = useStudents();
  const { data: payments, isLoading: paymentsLoading } = usePayments();
  const { data: groups } = useGroups();
  const { data: teachers } = useTeachers();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedGroup, setSelectedGroup] = useState("all");
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("");
  const [salaryFromMonth, setSalaryFromMonth] = useState(currentMonth);
  const [salaryToMonth, setSalaryToMonth] = useState(currentMonth);
  const [salaryYear, setSalaryYear] = useState(currentYear);
  const [cardTransfer, setCardTransfer] = useState(0);
  const [notEntered, setNotEntered] = useState(0);
  const [printMode, setPrintMode] = useState<'report_only' | 'with_students'>('report_only');
  const printRef = useRef<HTMLDivElement>(null);

  // Kassa state
  const [cashFormOpen, setCashFormOpen] = useState(false);
  const [cashAmount, setCashAmount] = useState("");
  const [cashNote, setCashNote] = useState("");
  const [cashPaymentType, setCashPaymentType] = useState("cash");
  const [cashStatusFilter, setCashStatusFilter] = useState("all");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReceiptId, setRejectReceiptId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const userRole = (() => {
    try {
      const stored = document.cookie.split(';').find(c => c.trim().startsWith('role='));
      return stored ? stored.split('=')[1] : '';
    } catch { return ''; }
  })();

  const { data: expensesData } = useExpenses(parseInt(selectedMonth), parseInt(selectedYear));

  // Finance Dashboard from server (TASK 1 FIX)
  const { data: dashboardData, isLoading: dashboardLoading } = useQuery({
    queryKey: ["finance-dashboard", selectedMonth, selectedYear],
    queryFn: async () => {
      const res = await fetch(`/api/finance/dashboard?month=${selectedMonth}&year=${selectedYear}`, { credentials: "include" });
      if (!res.ok) throw new Error("Moliya ma'lumotlarini olishda xatolik");
      return res.json();
    },
  });

  const { data: salaryData } = useQuery({
    queryKey: ["teacher-salary-detail", selectedTeacherId, salaryFromMonth, salaryToMonth, salaryYear],
    queryFn: async () => {
      if (!selectedTeacherId) return null;
      const res = await fetch(
        `/api/teacher-salary/${selectedTeacherId}?fromMonth=${salaryFromMonth}&toMonth=${salaryToMonth}&year=${salaryYear}&includeStudents=true`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Oylik ma'lumotlarini olishda xatolik");
      return res.json();
    },
    enabled: !!selectedTeacherId,
  });

  // Cash receipts data
  const { data: cashReceipts, isLoading: cashLoading } = useQuery({
    queryKey: ["cash-receipts", selectedMonth, selectedYear, cashStatusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ month: selectedMonth, year: selectedYear });
      if (cashStatusFilter !== "all") params.append("status", cashStatusFilter);
      const res = await fetch(`/api/cash-receipts?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Kassa ma'lumotlarini olishda xatolik");
      return res.json();
    },
  });

  const { data: cashStats } = useQuery({
    queryKey: ["cash-receipts-stats", selectedMonth, selectedYear],
    queryFn: async () => {
      const res = await fetch(`/api/cash-receipts/stats/summary?month=${selectedMonth}&year=${selectedYear}`, { credentials: "include" });
      if (!res.ok) throw new Error("Kassa statistikasini olishda xatolik");
      return res.json();
    },
  });

  const createCashReceiptMutation = useMutation({
    mutationFn: async (data: { amount: number; note: string; paymentType: string }) => {
      const res = await fetch("/api/cash-receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Xatolik");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cash-receipts"] });
      queryClient.invalidateQueries({ queryKey: ["cash-receipts-stats"] });
      setCashFormOpen(false);
      setCashAmount("");
      setCashNote("");
      setCashPaymentType("cash");
      toast({ title: "Muvaffaqiyatli", description: "Pul topshirish yaratildi" });
    },
    onError: (err: Error) => {
      toast({ title: "Xatolik", description: err.message, variant: "destructive" });
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/cash-receipts/${id}/accept`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Xatolik");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cash-receipts"] });
      queryClient.invalidateQueries({ queryKey: ["cash-receipts-stats"] });
      queryClient.invalidateQueries({ queryKey: ["finance-dashboard"] });
      toast({ title: "Qabul qilindi", description: "Pul topshirish tasdiqlandi" });
    },
    onError: (err: Error) => {
      toast({ title: "Xatolik", description: err.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      const res = await fetch(`/api/cash-receipts/${id}/reject`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Xatolik");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cash-receipts"] });
      queryClient.invalidateQueries({ queryKey: ["cash-receipts-stats"] });
      setRejectDialogOpen(false);
      setRejectReceiptId(null);
      setRejectReason("");
      toast({ title: "Rad etildi", description: "Pul topshirish rad etildi" });
    },
    onError: (err: Error) => {
      toast({ title: "Xatolik", description: err.message, variant: "destructive" });
    },
  });

  if (studentsLoading || paymentsLoading || dashboardLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  // Use server-computed dashboard data for cards
  const monthlyIncome = dashboardData?.monthlyIncome || 0;
  const monthlyExpenses = dashboardData?.monthlyExpenses || 0;
  const netProfit = dashboardData?.netProfit || 0;
  const totalDebt = dashboardData?.totalDebt || 0;
  const debtorCount = dashboardData?.debtorCount || 0;
  const activeStudents = dashboardData?.activeStudents || 0;
  const totalStudents = dashboardData?.totalStudents || 0;
  const attendancePresent = dashboardData?.attendancePresent || 0;
  const attendanceAbsent = dashboardData?.attendanceAbsent || 0;
  const paymentCount = dashboardData?.paymentCount || 0;
  const expenseCount = dashboardData?.expenseCount || 0;
  const attendanceRate = attendancePresent + attendanceAbsent > 0
    ? Math.round((attendancePresent / (attendancePresent + attendanceAbsent)) * 100)
    : 0;

  // For debtors tab and payments tab, still use client data
  const debtors = (students || []).filter((s: any) => s.balance <= 0).sort((a: any, b: any) => a.balance - b.balance);

  const monthlyPayments = (payments || []).filter((p: any) => {
    const paymentDate = new Date(p.createdAt);
    return paymentDate.getMonth() + 1 === parseInt(selectedMonth) && 
           paymentDate.getFullYear() === parseInt(selectedYear) &&
           p.status === "completed";
  });

  const exportToCSV = (data: any[], filename: string) => {
    if (!data.length) return;
    const headers = Object.keys(data[0]).join(",");
    const rows = data.map(row => Object.values(row).join(",")).join("\n");
    const csv = headers + "\n" + rows;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${selectedMonth}_${selectedYear}.csv`;
    link.click();
  };

  const exportDebtors = () => {
    const data = debtors.map((s: any) => ({
      "Ism": s.firstName,
      "Familiya": s.lastName,
      "Telefon": s.phone,
      "Ota-ona telefon": s.parentPhone,
      "Qarz (UZS)": Math.abs(s.balance),
    }));
    exportToCSV(data, "qarzdorlar");
  };

  const exportPayments = () => {
    const data = monthlyPayments.map((p: any) => {
      const student = (students || []).find((s: any) => s.id === p.studentId);
      return {
        "Sana": new Date(p.createdAt).toLocaleDateString("uz-UZ"),
        "O'quvchi": student ? `${student.firstName} ${student.lastName}` : `#${p.studentId}`,
        "Summa (UZS)": p.amount,
        "To'lov turi": p.paymentType === "cash" ? "Naqd" : p.paymentType === "card" ? "Karta" : "Bank",
        "Izoh": p.notes || "",
      };
    });
    exportToCSV(data, "tolovlar");
  };

  const exportDebtorsPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Qarzdorlar ro'yxati", 14, 20);
    doc.setFontSize(10);
    doc.text(`Sana: ${new Date().toLocaleDateString("uz-UZ")}`, 14, 28);
    doc.text(`Jami qarz: ${totalDebt.toLocaleString()} UZS`, 14, 34);
    const tableData = debtors.map((s: any, idx: number) => [
      idx + 1,
      `${s.firstName} ${s.lastName}`,
      s.phone || "-",
      s.parentPhone || "-",
      `${Math.abs(s.balance).toLocaleString()} UZS`
    ]);
    autoTable(doc, {
      head: [["#", "O'quvchi", "Telefon", "Ota-ona", "Qarz"]],
      body: tableData,
      startY: 42,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [220, 53, 69] },
    });
    doc.save(`qarzdorlar_${selectedMonth}_${selectedYear}.pdf`);
  };

  const exportPaymentsPDF = () => {
    const doc = new jsPDF();
    const monthName = months.find(m => m.value === selectedMonth)?.label || "";
    doc.setFontSize(16);
    doc.text(`To'lovlar hisoboti - ${monthName} ${selectedYear}`, 14, 20);
    doc.setFontSize(10);
    doc.text(`Jami tushum: ${monthlyIncome.toLocaleString()} UZS`, 14, 28);
    doc.text(`To'lovlar soni: ${monthlyPayments.length} ta`, 14, 34);
    const tableData = monthlyPayments.map((p: any, idx: number) => {
      const student = (students || []).find((s: any) => s.id === p.studentId);
      return [
        idx + 1,
        new Date(p.createdAt).toLocaleDateString("uz-UZ"),
        student ? `${student.firstName} ${student.lastName}` : `#${p.studentId}`,
        p.paymentType === "cash" ? "Naqd" : p.paymentType === "card" ? "Karta" : "Bank",
        `${p.amount.toLocaleString()} UZS`
      ];
    });
    autoTable(doc, {
      head: [["#", "Sana", "O'quvchi", "Turi", "Summa"]],
      body: tableData,
      startY: 42,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [16, 185, 129] },
    });
    doc.save(`tolovlar_${monthName}_${selectedYear}.pdf`);
  };

  const selectedTeacher = (teachers || []).find((t: any) => t.id.toString() === selectedTeacherId);
  const teacherGroups = selectedTeacher 
    ? (groups || []).filter((g: any) => g.teacherId === selectedTeacher.id)
    : [];

  const salaryTeacher = salaryData?.teacher;
  const teacherIncome = salaryData?.totalPayments || 0;
  const salaryPercent = salaryData?.teacher?.salaryPercent || 0;
  const salaryStudents = salaryData?.students || [];
  const paidStudentsList = salaryStudents.filter((s: any) => s.balance > 0);
  const debtorStudentsList = salaryStudents.filter((s: any) => s.balance <= 0);
  const totalAdvance = salaryData?.totalAdvance || 0;
  const advanceExpenses = salaryData?.advanceExpenses || [];

  // notEntered avval umumiy daromadga qo'shiladi, keyin foiz hisoblanadi
  const adjustedIncome = teacherIncome + notEntered;
  const calculatedSalary = salaryPercent > 0
    ? Math.round(adjustedIncome * salaryPercent / 100)
    : (salaryData?.calculatedSalary || 0);
  const teacherSalary = calculatedSalary - totalAdvance;
  const cashInHand = teacherSalary - cardTransfer - notEntered;

  const getPeriodLabel = () => {
    const from = months.find(m => m.value === salaryFromMonth)?.label || "";
    const to = months.find(m => m.value === salaryToMonth)?.label || "";
    if (salaryFromMonth === salaryToMonth) return `${from} ${salaryYear}`;
    return `${from} - ${to} ${salaryYear}`;
  };

  const generateSalaryPDF = (withStudents = false) => {
    if (!salaryData) return;
    
    const doc = new jsPDF();
    const periodLabel = getPeriodLabel();
    
    doc.setFillColor(102, 126, 234);
    doc.rect(0, 0, 210, 50, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text("OYLIK CHEKI", 105, 25, { align: "center" });
    doc.setFontSize(12);
    doc.text(periodLabel, 105, 35, { align: "center" });
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.text("O'qituvchi ma'lumotlari", 14, 65);
    doc.setFontSize(11);
    
    const info = [
      ["O'qituvchi:", `${salaryTeacher.firstName} ${salaryTeacher.lastName}`],
      ["Telefon:", salaryTeacher.phone || "-"],
      ["Guruhlar:", `${teacherGroups.length} ta`],
      ["O'quvchilar:", `${salaryStudents.length} ta`],
    ];
    
    let y = 75;
    info.forEach(([label, value]) => {
      doc.setTextColor(120, 120, 120);
      doc.text(label, 14, y);
      doc.setTextColor(40, 40, 40);
      doc.text(value, 55, y);
      y += 8;
    });
    
    doc.setDrawColor(200, 200, 200);
    doc.line(14, y + 3, 196, y + 3);
    
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text("Moliyaviy ma'lumotlar", 14, y + 15);
    
    y += 25;
    doc.setFontSize(11);
    const financeInfo = [
      ["To'lov qilganlar:", `${paidStudentsList.length} ta`],
      ["Qarzdorlar:", `${debtorStudentsList.length} ta`],
      ["Umumiy tushum:", `${adjustedIncome.toLocaleString()} UZS${notEntered > 0 ? ` (${teacherIncome.toLocaleString()} + ${notEntered.toLocaleString()})` : ''}`],
      ["Oylik foizi:", `${salaryPercent}%`],
      ["Hisoblangan oylik:", `${calculatedSalary.toLocaleString()} UZS`],
    ];

    if (totalAdvance > 0) {
      financeInfo.push(["Avans:", `-${totalAdvance.toLocaleString()} UZS`]);
    }
    
    financeInfo.push(["Yakuniy oylik:", `${teacherSalary.toLocaleString()} UZS`]);
    
    if (cardTransfer > 0) {
      financeInfo.push(["Kartaga tushgan:", `-${cardTransfer.toLocaleString()} UZS`]);
    }
    if (notEntered > 0) {
      financeInfo.push(["CRM ga kiritilmagan:", `-${notEntered.toLocaleString()} UZS`]);
    }

    financeInfo.forEach(([label, value]) => {
      doc.setTextColor(120, 120, 120);
      doc.text(label, 14, y);
      doc.setTextColor(40, 40, 40);
      if (label === "Avans:" || label === "Kartaga tushgan:" || label === "CRM ga kiritilmagan:") {
        doc.setTextColor(234, 88, 12);
      }
      if (label === "Yakuniy oylik:") {
        doc.setTextColor(22, 163, 74);
        doc.setFont(undefined!, "bold");
      }
      doc.text(value, 75, y);
      doc.setFont(undefined!, "normal");
      y += 8;
    });
    
    doc.setDrawColor(200, 200, 200);
    doc.line(14, y + 3, 196, y + 3);
    
    doc.setFillColor(240, 253, 244);
    const hasDeductions = cardTransfer > 0 || notEntered > 0;
    const boxHeight = hasDeductions ? 35 : 25;
    doc.roundedRect(14, y + 8, 182, boxHeight, 3, 3, 'F');
    doc.setFontSize(12);
    doc.setTextColor(22, 163, 74);
    doc.text("Qo'lga tegishi:", 24, y + 24);
    doc.setFontSize(18);
    doc.text(`${cashInHand.toLocaleString()} UZS`, 75, y + 24);
    
    if (hasDeductions) {
      const deductParts = [];
      if (cardTransfer > 0) deductParts.push(`${cardTransfer.toLocaleString()} karta`);
      if (notEntered > 0) deductParts.push(`${notEntered.toLocaleString()} kiritilmagan`);
      doc.setFontSize(9);
      doc.setTextColor(150, 150, 150);
      doc.text(`(${teacherSalary.toLocaleString()} oylik - ${deductParts.join(' - ')})`, 75, y + 31);
    }
    
    if (withStudents && salaryStudents.length > 0) {
      y += 45;
      
      if (y > 240) {
        doc.addPage();
        y = 20;
      }
      
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text("O'quvchilar ro'yxati", 14, y);
      
      const studentTableData = salaryStudents.map((s: any, idx: number) => [
        idx + 1,
        `${s.firstName} ${s.lastName}`,
        s.phone || "-",
        `${s.totalPaid.toLocaleString()} UZS`,
        s.paymentCount,
        s.balance > 0 ? "To'langan" : `${Math.abs(s.balance).toLocaleString()} qarz`,
      ]);
      
      autoTable(doc, {
        head: [["#", "O'quvchi", "Telefon", "To'lagan", "Nechta", "Holati"]],
        body: studentTableData,
        startY: y + 5,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [102, 126, 234] },
      });
    }
    
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Sana: ${new Date().toLocaleDateString("uz-UZ")}`, 14, 285);
      doc.text("Zamonaviy-Edu", 196, 285, { align: "right" });
    }
    
    const suffix = withStudents ? "_oquvchilar" : "";
    doc.save(`oylik_${salaryTeacher.firstName}_${salaryTeacher.lastName}_${salaryFromMonth}-${salaryToMonth}_${salaryYear}${suffix}.pdf`);
    
    toast({ title: "PDF yuklandi", description: "Oylik cheki muvaffaqiyatli yuklandi" });
  };

  const shareToTelegram = () => {
    if (!salaryData) return;
    const periodLabel = getPeriodLabel();
    const advanceText = totalAdvance > 0 
      ? `\n- Avans: -${totalAdvance.toLocaleString()} UZS` 
      : "";
    const cardText = cardTransfer > 0
      ? `\n- Kartaga tushgan: -${cardTransfer.toLocaleString()} UZS`
      : "";
    const notEnteredText = notEntered > 0
      ? `\n- CRM ga kiritilmagan: -${notEntered.toLocaleString()} UZS`
      : "";
    const message = `
OYLIK CHEKI
${periodLabel}

O'qituvchi: ${salaryTeacher.firstName} ${salaryTeacher.lastName}
Telefon: ${salaryTeacher.phone || "-"}

Ma'lumotlar:
- Guruhlar: ${teacherGroups.length} ta
- O'quvchilar: ${salaryStudents.length} ta
- To'lov qilganlar: ${paidStudentsList.length} ta
- Qarzdorlar: ${debtorStudentsList.length} ta

Moliya:
- Umumiy tushum: ${adjustedIncome.toLocaleString()} UZS${notEntered > 0 ? ` (${teacherIncome.toLocaleString()} + ${notEntered.toLocaleString()} kiritilmagan)` : ''}
- Oylik foizi: ${salaryPercent}%
- Hisoblangan oylik: ${calculatedSalary.toLocaleString()} UZS${advanceText}
- Yakuniy oylik: ${teacherSalary.toLocaleString()} UZS${cardText}${notEnteredText}
- Qo'lga tegishi: ${cashInHand.toLocaleString()} UZS

Zamonaviy-Edu
    `.trim();
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://t.me/share/url?text=${encodedMessage}`, "_blank");
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <h1 className="text-3xl font-bold tracking-tight text-gradient">Moliya</h1>
        <div className="flex gap-2">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[140px]" data-testid="select-month">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[100px]" data-testid="select-year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2024">2024</SelectItem>
              <SelectItem value="2025">2025</SelectItem>
              <SelectItem value="2026">2026</SelectItem>
              <SelectItem value="2027">2027</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6 no-print">
        <Card className="card-modern hover-lift">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" /> Oylik tushum
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600" data-testid="text-monthly-income">
              {monthlyIncome.toLocaleString()} UZS
            </div>
            <p className="text-xs text-muted-foreground">{paymentCount} ta to'lov</p>
          </CardContent>
        </Card>

        <Card className="card-modern hover-lift">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wallet className="w-4 h-4 text-red-500" /> Xarajatlar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="text-monthly-expenses">
              {monthlyExpenses.toLocaleString()} UZS
            </div>
            <p className="text-xs text-muted-foreground">{expenseCount} ta xarajat</p>
          </CardContent>
        </Card>

        <Card className="card-modern hover-lift">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Banknote className="w-4 h-4 text-blue-500" /> Sof foyda
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${netProfit >= 0 ? "text-emerald-600" : "text-red-600"}`} data-testid="text-net-profit">
              {netProfit.toLocaleString()} UZS
            </div>
            <p className="text-xs text-muted-foreground">Tushum - Xarajat</p>
          </CardContent>
        </Card>

        <Card className="card-modern hover-lift">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" /> Jami qarz
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="text-total-debt">
              {totalDebt.toLocaleString()} UZS
            </div>
            <p className="text-xs text-muted-foreground">{debtorCount} ta qarzdor</p>
          </CardContent>
        </Card>

        <Card className="card-modern hover-lift">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500" /> Faol o'quvchilar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-active-students">
              {activeStudents} / {totalStudents}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalStudents > 0 ? Math.round((activeStudents / totalStudents) * 100) : 0}% faol
            </p>
          </CardContent>
        </Card>

        <Card className="card-modern hover-lift">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4 text-purple-500" /> Davomat
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-attendance-rate">
              {attendanceRate}%
            </div>
            <p className="text-xs text-muted-foreground">
              {attendancePresent} keldi / {attendanceAbsent} kelmadi
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="salary" className="space-y-4 no-print">
        <TabsList className="bg-muted/50 p-1 h-auto flex-wrap">
          <TabsTrigger value="salary" className="flex items-center gap-2 text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg px-4 py-2">
            <Banknote className="w-4 h-4" /> Oylik
          </TabsTrigger>
          <TabsTrigger value="debtors" className="flex items-center gap-2 text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg px-4 py-2">
            <AlertTriangle className="w-4 h-4" /> Qarzdorlar
          </TabsTrigger>
          <TabsTrigger value="payments" className="flex items-center gap-2 text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg px-4 py-2">
            <CreditCard className="w-4 h-4" /> To'lovlar
          </TabsTrigger>
          <TabsTrigger value="kassa" className="flex items-center gap-2 text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg px-4 py-2">
            <HandCoins className="w-4 h-4" /> Kassa
          </TabsTrigger>
        </TabsList>

        <TabsContent value="salary" className="space-y-4 animate-slide-up">
          <Card className="card-modern">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-primary" />
                O'qituvchi oyligini hisoblash
              </CardTitle>
              <CardDescription>
                O'qituvchini va oylarni tanlang, oylik chekini yarating
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label>O'qituvchini tanlang</Label>
                  <Select value={selectedTeacherId} onValueChange={(v) => { setSelectedTeacherId(v); setCardTransfer(0); setNotEntered(0); }}>
                    <SelectTrigger data-testid="select-teacher-salary">
                      <SelectValue placeholder="O'qituvchini tanlang..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(teachers || []).map((t: any) => (
                        <SelectItem key={t.id} value={t.id.toString()}>
                          {t.firstName} {t.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Boshlanish oyi</Label>
                  <Select value={salaryFromMonth} onValueChange={(v) => {
                    setSalaryFromMonth(v);
                    if (parseInt(v) > parseInt(salaryToMonth)) setSalaryToMonth(v);
                  }}>
                    <SelectTrigger data-testid="select-salary-from-month">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {months.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Tugash oyi</Label>
                  <Select value={salaryToMonth} onValueChange={setSalaryToMonth}>
                    <SelectTrigger data-testid="select-salary-to-month">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {months.filter(m => parseInt(m.value) >= parseInt(salaryFromMonth)).map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Yil</Label>
                  <Select value={salaryYear} onValueChange={setSalaryYear}>
                    <SelectTrigger data-testid="select-salary-year">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2024">2024</SelectItem>
                      <SelectItem value="2025">2025</SelectItem>
                      <SelectItem value="2026">2026</SelectItem>
                      <SelectItem value="2027">2027</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {salaryData && selectedTeacher && (
                <div className="space-y-6">
                  <div className="relative overflow-hidden rounded-2xl gradient-hero p-6 text-white">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -mr-24 -mt-24 blur-2xl" />
                    <div className="relative z-10">
                      <div className="flex items-center gap-4 mb-2">
                        <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-xl font-bold">
                          {salaryTeacher?.firstName?.[0]}{salaryTeacher?.lastName?.[0]}
                        </div>
                        <div>
                          <h3 className="text-xl font-bold">{salaryTeacher?.firstName} {salaryTeacher?.lastName}</h3>
                          <p className="text-white/70 text-sm">{salaryTeacher?.phone} | {getPeriodLabel()}</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                        <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 text-center">
                          <GraduationCap className="w-5 h-5 mx-auto mb-1" />
                          <p className="text-xl font-bold">{salaryData?.groupCount ?? teacherGroups.length}</p>
                          <p className="text-xs text-white/70">Guruhlar</p>
                        </div>
                        <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 text-center">
                          <Users className="w-5 h-5 mx-auto mb-1" />
                          <p className="text-xl font-bold">{salaryData?.totalStudentCount ?? salaryStudents.length}</p>
                          <p className="text-xs text-white/70">O'quvchilar</p>
                        </div>
                        <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 text-center">
                          <CheckCircle2 className="w-5 h-5 mx-auto mb-1" />
                          <p className="text-xl font-bold">{paidStudentsList.length}</p>
                          <p className="text-xs text-white/70">To'lagan</p>
                        </div>
                        <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 text-center">
                          <XCircle className="w-5 h-5 mx-auto mb-1" />
                          <p className="text-xl font-bold">{debtorStudentsList.length}</p>
                          <p className="text-xs text-white/70">Qarzdor</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Card className="card-modern border-l-4 border-l-blue-500">
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground mb-1">Umumiy tushum</p>
                        <p className="text-2xl font-bold text-blue-600" data-testid="text-teacher-income">{adjustedIncome.toLocaleString()} UZS</p>
                        {notEntered > 0 && (
                          <p className="text-xs text-muted-foreground">{teacherIncome.toLocaleString()} + {notEntered.toLocaleString()} kiritilmagan</p>
                        )}
                      </CardContent>
                    </Card>
                    <Card className="card-modern border-l-4 border-l-purple-500">
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground mb-1">Hisoblangan oylik ({salaryPercent}%)</p>
                        <p className="text-2xl font-bold text-purple-600" data-testid="text-calculated-salary">{calculatedSalary.toLocaleString()} UZS</p>
                        {notEntered > 0 && (
                          <p className="text-xs text-muted-foreground">{adjustedIncome.toLocaleString()} × {salaryPercent}%</p>
                        )}
                      </CardContent>
                    </Card>
                    <Card className="card-modern border-l-4 border-l-orange-500">
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground mb-1">Avans</p>
                        <p className="text-2xl font-bold text-orange-600" data-testid="text-total-advance">
                          {totalAdvance > 0 ? `-${totalAdvance.toLocaleString()}` : "0"} UZS
                        </p>
                        {advanceExpenses.length > 0 && (
                          <p className="text-xs text-muted-foreground">{advanceExpenses.length} ta avans</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="card-modern border-l-4 border-l-emerald-500">
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground mb-1">Yakuniy oylik</p>
                        <p className="text-2xl font-bold text-emerald-600" data-testid="text-final-salary">{teacherSalary.toLocaleString()} UZS</p>
                        {(totalAdvance > 0) && (
                          <p className="text-xs text-muted-foreground">{calculatedSalary.toLocaleString()} - {totalAdvance.toLocaleString()} avans</p>
                        )}
                      </CardContent>
                    </Card>
                    <Card className="card-modern border-l-4 border-l-sky-500">
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground mb-1">Kartaga tushgan</p>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={cardTransfer || ""}
                            onChange={(e) => setCardTransfer(parseInt(e.target.value) || 0)}
                            placeholder="0"
                            className="text-lg font-bold h-9"
                            data-testid="input-card-transfer"
                          />
                          <span className="text-sm text-muted-foreground whitespace-nowrap">UZS</span>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="card-modern border-l-4 border-l-amber-500">
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground mb-1">CRM ga kiritilmagan</p>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={notEntered || ""}
                            onChange={(e) => setNotEntered(parseInt(e.target.value) || 0)}
                            placeholder="0"
                            className="text-lg font-bold h-9"
                            data-testid="input-not-entered"
                          />
                          <span className="text-sm text-muted-foreground whitespace-nowrap">UZS</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Kiritilmay qolgan to'lovlar</p>
                      </CardContent>
                    </Card>
                    <Card className="card-modern border-l-4 border-l-green-600 shadow-glow-success">
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground mb-1">Qo'lga tegishi</p>
                        <p className="text-2xl font-bold text-green-700" data-testid="text-cash-in-hand">{cashInHand.toLocaleString()} UZS</p>
                        {(cardTransfer > 0 || notEntered > 0) && (
                          <p className="text-xs text-muted-foreground">
                            {teacherSalary.toLocaleString()}
                            {cardTransfer > 0 && ` - ${cardTransfer.toLocaleString()} karta`}
                            {notEntered > 0 && ` - ${notEntered.toLocaleString()} kiritilmagan`}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {salaryStudents.length > 0 && printMode === 'with_students' && (
                    <Card className="card-modern">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Users className="w-4 h-4" /> O'quvchilar ro'yxati ({salaryStudents.length} ta)
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>#</TableHead>
                              <TableHead>O'quvchi</TableHead>
                              <TableHead>Telefon</TableHead>
                              <TableHead className="text-right">To'lagan</TableHead>
                              <TableHead className="text-right">Balans</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {salaryStudents.map((s: any, idx: number) => (
                              <TableRow key={s.id} data-testid={`row-salary-student-${s.id}`}>
                                <TableCell>{idx + 1}</TableCell>
                                <TableCell className="font-medium">{s.firstName} {s.lastName}</TableCell>
                                <TableCell>{s.phone || "-"}</TableCell>
                                <TableCell className="text-right">{s.totalPaid.toLocaleString()} UZS</TableCell>
                                <TableCell className="text-right">
                                  <Badge variant={s.balance > 0 ? "secondary" : "destructive"} className="font-mono">
                                    {s.balance > 0 ? "+" : ""}{s.balance.toLocaleString()}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  )}

                  <div className="space-y-3">
                    <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-fit">
                      <button
                        onClick={() => setPrintMode('report_only')}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${printMode === 'report_only' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        data-testid="btn-print-mode-report-only"
                      >
                        Faqat hisobot
                      </button>
                      <button
                        onClick={() => setPrintMode('with_students')}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${printMode === 'with_students' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        data-testid="btn-print-mode-with-students"
                      >
                        Hisobot + O'quvchilar
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Button onClick={() => generateSalaryPDF(printMode === 'with_students')} className="gradient-primary hover-lift" data-testid="button-download-salary-pdf">
                        <FileDown className="w-4 h-4 mr-2" /> PDF yuklash
                      </Button>
                      <Button onClick={shareToTelegram} variant="outline" className="hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300" data-testid="button-share-telegram">
                        <Send className="w-4 h-4 mr-2" /> Telegram'ga ulashish
                      </Button>
                      <Button onClick={handlePrint} variant="outline" data-testid="button-print-salary">
                        <Printer className="w-4 h-4 mr-2" /> Chop etish
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {!selectedTeacher && (
                <div className="text-center py-12 text-muted-foreground">
                  <Wallet className="w-16 h-16 mx-auto mb-4 opacity-20" />
                  <p>Oylik hisoblash uchun o'qituvchini tanlang</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="debtors" className="space-y-4 animate-slide-up">
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={exportDebtors} disabled={debtors.length === 0} data-testid="button-export-debtors-excel">
              <Download className="w-4 h-4 mr-2" /> Excel
            </Button>
            <Button variant="outline" onClick={exportDebtorsPDF} disabled={debtors.length === 0} data-testid="button-export-debtors-pdf">
              <FileDown className="w-4 h-4 mr-2" /> PDF
            </Button>
          </div>
          <Card className="card-modern">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>O'quvchi</TableHead>
                    <TableHead>Telefon</TableHead>
                    <TableHead>Ota-ona telefon</TableHead>
                    <TableHead className="text-right">Qarz</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {debtors.length > 0 ? (
                    debtors.map((student: any) => (
                      <TableRow key={student.id} data-testid={`row-debtor-${student.id}`}>
                        <TableCell className="font-medium">{student.firstName} {student.lastName}</TableCell>
                        <TableCell>{student.phone}</TableCell>
                        <TableCell>{student.parentPhone}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="destructive" className="font-mono">
                            {Math.abs(student.balance).toLocaleString()} UZS
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        Qarzdorlar yo'q
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4 animate-slide-up">
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={exportPayments} disabled={monthlyPayments.length === 0} data-testid="button-export-payments-excel">
              <Download className="w-4 h-4 mr-2" /> Excel
            </Button>
            <Button variant="outline" onClick={exportPaymentsPDF} disabled={monthlyPayments.length === 0} data-testid="button-export-payments-pdf">
              <FileDown className="w-4 h-4 mr-2" /> PDF
            </Button>
          </div>
          <Card className="card-modern">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sana</TableHead>
                    <TableHead>O'quvchi</TableHead>
                    <TableHead>To'lov turi</TableHead>
                    <TableHead className="text-right">Summa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthlyPayments.length > 0 ? (
                    monthlyPayments.map((payment: any) => {
                      const student = (students || []).find((s: any) => s.id === payment.studentId);
                      return (
                        <TableRow key={payment.id} data-testid={`row-payment-${payment.id}`}>
                          <TableCell>{new Date(payment.createdAt).toLocaleDateString("uz-UZ")}</TableCell>
                          <TableCell className="font-medium">
                            {student ? `${student.firstName} ${student.lastName}` : `#${payment.studentId}`}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {payment.paymentType === "cash" ? "Naqd" : payment.paymentType === "card" ? "Karta" : "Bank"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-emerald-600">
                            +{payment.amount.toLocaleString()} UZS
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        Bu oyda to'lovlar yo'q
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kassa" className="space-y-4 animate-slide-up">
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            <Card className="card-modern border-l-4 border-l-blue-500">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Umumiy tushum</p>
                <p className="text-xl font-bold text-blue-600" data-testid="text-kassa-total">
                  {monthlyIncome.toLocaleString()} UZS
                </p>
                <p className="text-xs text-muted-foreground">Oylik tushum</p>
              </CardContent>
            </Card>
            <Card className="card-modern border-l-4 border-l-red-500">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Xarajatlar</p>
                <p className="text-xl font-bold text-red-600" data-testid="text-kassa-expenses">
                  {monthlyExpenses.toLocaleString()} UZS
                </p>
                <p className="text-xs text-muted-foreground">Oylik xarajat</p>
              </CardContent>
            </Card>
            <Card className="card-modern border-l-4 border-l-orange-500">
              <CardContent className="p-4">
                {(() => {
                  const mustSubmit = monthlyIncome - monthlyExpenses;
                  const remaining = mustSubmit - (cashStats?.totalAccepted || 0);
                  return (
                    <>
                      <p className="text-xs text-muted-foreground mb-1">Topshirilishi kerak</p>
                      <p className={`text-xl font-bold ${remaining > 0 ? 'text-orange-600' : remaining < 0 ? 'text-red-600' : 'text-green-600'}`} data-testid="text-kassa-remaining">
                        {remaining > 0 ? `${remaining.toLocaleString()} UZS` : remaining < 0 ? `${Math.abs(remaining).toLocaleString()} UZS ortiqcha` : "0 UZS"}
                      </p>
                      <hr className="my-2 border-dashed" />
                      <p className="text-[11px] text-muted-foreground">
                        Jami: {mustSubmit.toLocaleString()} - Tasdiqlangan: {(cashStats?.totalAccepted || 0).toLocaleString()}
                      </p>
                    </>
                  );
                })()}
              </CardContent>
            </Card>
            <Card className="card-modern border-l-4 border-l-yellow-500">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Topshirildi (kutilmoqda)</p>
                <p className="text-xl font-bold text-yellow-600" data-testid="text-kassa-pending">
                  {(cashStats?.pendingAmount || 0).toLocaleString()} UZS
                </p>
                <p className="text-xs text-muted-foreground">{cashStats?.pendingCount || 0} ta topshiriq</p>
              </CardContent>
            </Card>
            <Card className="card-modern border-l-4 border-l-emerald-500">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Tasdiqlangan</p>
                <p className="text-xl font-bold text-emerald-600" data-testid="text-kassa-accepted">
                  {(cashStats?.totalAccepted || 0).toLocaleString()} UZS
                </p>
                <p className="text-xs text-muted-foreground">Rahbar tasdiqlagan</p>
              </CardContent>
            </Card>
          </div>

          {monthlyExpenses > 0 && (
            <Card className="card-modern">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Wallet className="w-4 h-4 text-red-500" />
                  <h3 className="font-semibold text-sm">Oylik xarajatlar ro'yxati</h3>
                  <Badge variant="secondary" className="ml-auto">{(expensesData || []).length} ta</Badge>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sana</TableHead>
                        <TableHead>Nomi</TableHead>
                        <TableHead>Kategoriya</TableHead>
                        <TableHead className="text-right">Summa</TableHead>
                        <TableHead>Izoh</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(expensesData || []).map((e: any) => (
                        <TableRow key={e.id}>
                          <TableCell className="whitespace-nowrap text-sm">{new Date(e.date).toLocaleDateString("uz-UZ")}</TableCell>
                          <TableCell className="font-medium text-sm">{e.title}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">
                              {e.category === "rent" ? "Ijara" : e.category === "salary" ? "O'qituvchi oyligi" : e.category === "staff_salary" ? "Xodim oyligi" : e.category === "supplies" ? "Jihozlar" : e.category === "utilities" ? "Kommunal" : e.category === "marketing" ? "Reklama" : "Boshqa"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium text-red-600 text-sm">{e.amount.toLocaleString()} UZS</TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{e.notes || "-"}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50 font-bold">
                        <TableCell colSpan={3}>Jami xarajat</TableCell>
                        <TableCell className="text-right text-red-600">{monthlyExpenses.toLocaleString()} UZS</TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex gap-2 items-center">
              <Select value={cashStatusFilter} onValueChange={setCashStatusFilter}>
                <SelectTrigger className="w-[160px]" data-testid="select-cash-status-filter">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Barchasi</SelectItem>
                  <SelectItem value="pending">Kutilayotgan</SelectItem>
                  <SelectItem value="accepted">Tasdiqlangan</SelectItem>
                  <SelectItem value="rejected">Rad etilgan</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Dialog open={cashFormOpen} onOpenChange={setCashFormOpen}>
              <DialogTrigger asChild>
                <Button className="gradient-primary hover-lift" data-testid="button-create-cash-receipt">
                  <Plus className="w-4 h-4 mr-2" /> Pul topshirish
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Pul topshirish</DialogTitle>
                  <DialogDescription>Yig'ilgan pulni topshirish uchun ma'lumotlarni kiriting</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Summa (UZS)</Label>
                    <Input
                      type="number"
                      value={cashAmount}
                      onChange={(e) => setCashAmount(e.target.value)}
                      placeholder="0"
                      min="1"
                      data-testid="input-cash-amount"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>To'lov turi</Label>
                    <Select value={cashPaymentType} onValueChange={setCashPaymentType}>
                      <SelectTrigger data-testid="select-cash-payment-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Naqd</SelectItem>
                        <SelectItem value="card">Karta</SelectItem>
                        <SelectItem value="bank_transfer">Bank o'tkazmasi</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Izoh</Label>
                    <Textarea
                      value={cashNote}
                      onChange={(e) => setCashNote(e.target.value)}
                      placeholder="Qo'shimcha izoh..."
                      data-testid="input-cash-note"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCashFormOpen(false)}>Bekor qilish</Button>
                  <Button
                    onClick={() => {
                      const amt = parseInt(cashAmount);
                      if (!amt || amt <= 0) {
                        toast({ title: "Xatolik", description: "Summa musbat bo'lishi kerak", variant: "destructive" });
                        return;
                      }
                      createCashReceiptMutation.mutate({ amount: amt, note: cashNote, paymentType: cashPaymentType });
                    }}
                    disabled={createCashReceiptMutation.isPending}
                    data-testid="button-submit-cash-receipt"
                  >
                    {createCashReceiptMutation.isPending ? "Yuborilmoqda..." : "Topshirish"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Card className="card-modern">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Sana</TableHead>
                    <TableHead>Summa</TableHead>
                    <TableHead>Topshirgan</TableHead>
                    <TableHead>To'lov turi</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Qabul qilgan</TableHead>
                    <TableHead>Izoh</TableHead>
                    <TableHead className="text-right">Holat</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cashLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8">
                        <Skeleton className="h-6 w-48 mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : (cashReceipts || []).length > 0 ? (
                    (cashReceipts || []).map((r: any) => (
                      <TableRow key={r.id} data-testid={`row-cash-receipt-${r.id}`}>
                        <TableCell className="font-mono text-sm">#{r.id}</TableCell>
                        <TableCell>{new Date(r.submittedAt).toLocaleDateString("uz-UZ")}</TableCell>
                        <TableCell className="font-bold">{r.amount.toLocaleString()} UZS</TableCell>
                        <TableCell>
                          {r.submittedByUser ? `${r.submittedByUser.firstName} ${r.submittedByUser.lastName}` : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {r.paymentType === "cash" ? "Naqd" : r.paymentType === "card" ? "Karta" : "Bank"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={r.status === "accepted" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}
                            className={r.status === "accepted" ? "bg-emerald-100 text-emerald-800" : r.status === "pending" ? "bg-orange-100 text-orange-800" : ""}>
                            {r.status === "pending" ? "Kutilmoqda" : r.status === "accepted" ? "Tasdiqlangan" : "Rad etilgan"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {r.acceptedByUser ? `${r.acceptedByUser.firstName} ${r.acceptedByUser.lastName}` : 
                           r.rejectedByUser ? `${r.rejectedByUser.firstName} ${r.rejectedByUser.lastName}` : "-"}
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate" title={r.note || r.rejectionReason || ""}>
                          {r.rejectionReason || r.note || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {r.status === "pending" && (
                            <Badge variant="secondary" className="bg-orange-50 text-orange-600">
                              <Clock className="w-3 h-3 mr-1" /> Rahbar kutmoqda
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        <HandCoins className="w-12 h-12 mx-auto mb-2 opacity-20" />
                        Pul topshirishlar topilmadi
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Rad etish</DialogTitle>
                <DialogDescription>Rad etish sababini kiriting</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <Textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Sabab..."
                  data-testid="input-reject-reason"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Bekor qilish</Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (rejectReceiptId !== null) {
                      rejectMutation.mutate({ id: rejectReceiptId, reason: rejectReason });
                    }
                  }}
                  disabled={rejectMutation.isPending}
                  data-testid="button-confirm-reject"
                >
                  {rejectMutation.isPending ? "Rad etilmoqda..." : "Rad etish"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

      </Tabs>

      {salaryData && selectedTeacher && (
        <div ref={printRef} className="print-receipt" style={{ display: "none" }}>
          <div style={{ maxWidth: "700px", margin: "0 auto", fontFamily: "Arial, sans-serif" }}>
            <div style={{ textAlign: "center", borderBottom: "2px solid #667eea", paddingBottom: "15px", marginBottom: "20px" }}>
              <h1 style={{ fontSize: "24px", color: "#667eea", margin: "0 0 5px" }}>OYLIK CHEKI</h1>
              <p style={{ fontSize: "14px", color: "#666", margin: 0 }}>{getPeriodLabel()}</p>
            </div>

            <table style={{ width: "100%", marginBottom: "20px", borderCollapse: "collapse" }}>
              <tbody>
                <tr>
                  <td style={{ padding: "6px 0", color: "#888", width: "40%" }}>O'qituvchi:</td>
                  <td style={{ padding: "6px 0", fontWeight: "bold" }}>{salaryTeacher?.firstName} {salaryTeacher?.lastName}</td>
                </tr>
                <tr>
                  <td style={{ padding: "6px 0", color: "#888" }}>Telefon:</td>
                  <td style={{ padding: "6px 0" }}>{salaryTeacher?.phone || "-"}</td>
                </tr>
                <tr>
                  <td style={{ padding: "6px 0", color: "#888" }}>Guruhlar:</td>
                  <td style={{ padding: "6px 0" }}>{teacherGroups.length} ta</td>
                </tr>
                <tr>
                  <td style={{ padding: "6px 0", color: "#888" }}>O'quvchilar:</td>
                  <td style={{ padding: "6px 0" }}>{salaryStudents.length} ta</td>
                </tr>
              </tbody>
            </table>

            <div style={{ borderTop: "1px solid #eee", paddingTop: "15px", marginBottom: "20px" }}>
              <h3 style={{ fontSize: "16px", marginBottom: "10px" }}>Moliyaviy ma'lumotlar</h3>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  <tr>
                    <td style={{ padding: "6px 0", color: "#888", width: "40%" }}>To'lov qilganlar:</td>
                    <td style={{ padding: "6px 0", color: "#22c55e", fontWeight: "bold" }}>{paidStudentsList.length} ta</td>
                  </tr>
                  <tr>
                    <td style={{ padding: "6px 0", color: "#888" }}>Qarzdorlar:</td>
                    <td style={{ padding: "6px 0", color: "#ef4444", fontWeight: "bold" }}>{debtorStudentsList.length} ta</td>
                  </tr>
                  <tr>
                    <td style={{ padding: "6px 0", color: "#888" }}>Umumiy tushum:</td>
                    <td style={{ padding: "6px 0", fontWeight: "bold" }}>
                      {adjustedIncome.toLocaleString()} UZS
                      {notEntered > 0 && <span style={{ fontSize: "10px", color: "#888", marginLeft: "4px" }}>({teacherIncome.toLocaleString()} + {notEntered.toLocaleString()})</span>}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: "6px 0", color: "#888" }}>Oylik foizi:</td>
                    <td style={{ padding: "6px 0", fontWeight: "bold" }}>{salaryPercent}%</td>
                  </tr>
                  <tr>
                    <td style={{ padding: "6px 0", color: "#888" }}>Hisoblangan oylik:</td>
                    <td style={{ padding: "6px 0", fontWeight: "bold" }}>{calculatedSalary.toLocaleString()} UZS</td>
                  </tr>
                  {totalAdvance > 0 && (
                    <tr>
                      <td style={{ padding: "6px 0", color: "#ea580c" }}>Avans:</td>
                      <td style={{ padding: "6px 0", fontWeight: "bold", color: "#ea580c" }}>-{totalAdvance.toLocaleString()} UZS</td>
                    </tr>
                  )}
                  <tr>
                    <td style={{ padding: "6px 0", color: "#16a34a", fontWeight: "bold" }}>Yakuniy oylik:</td>
                    <td style={{ padding: "6px 0", fontWeight: "bold", color: "#16a34a" }}>{teacherSalary.toLocaleString()} UZS</td>
                  </tr>
                  {cardTransfer > 0 && (
                    <tr>
                      <td style={{ padding: "6px 0", color: "#ea580c" }}>Kartaga tushgan:</td>
                      <td style={{ padding: "6px 0", fontWeight: "bold", color: "#ea580c" }}>-{cardTransfer.toLocaleString()} UZS</td>
                    </tr>
                  )}
                  {notEntered > 0 && (
                    <tr>
                      <td style={{ padding: "6px 0", color: "#d97706" }}>CRM ga kiritilmagan:</td>
                      <td style={{ padding: "6px 0", fontWeight: "bold", color: "#d97706" }}>-{notEntered.toLocaleString()} UZS</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ background: "#f0fdf4", border: "2px solid #22c55e", borderRadius: "8px", padding: "15px", textAlign: "center", marginBottom: "20px" }}>
              <p style={{ color: "#888", margin: "0 0 5px", fontSize: "14px" }}>Qo'lga tegishi</p>
              <p style={{ fontSize: "28px", fontWeight: "bold", color: "#16a34a", margin: 0 }}>{cashInHand.toLocaleString()} UZS</p>
              {(cardTransfer > 0 || notEntered > 0) && (
                <p style={{ color: "#888", margin: "5px 0 0", fontSize: "12px" }}>
                  {teacherSalary.toLocaleString()} oylik
                  {cardTransfer > 0 && ` - ${cardTransfer.toLocaleString()} karta`}
                  {notEntered > 0 && ` - ${notEntered.toLocaleString()} kiritilmagan`}
                </p>
              )}
            </div>

            {salaryStudents.length > 0 && printMode === 'with_students' && (
              <div style={{ marginBottom: "20px" }}>
                <h3 style={{ fontSize: "16px", marginBottom: "10px" }}>O'quvchilar ({salaryStudents.length} ta)</h3>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #667eea" }}>
                      <th style={{ padding: "8px 4px", textAlign: "left" }}>#</th>
                      <th style={{ padding: "8px 4px", textAlign: "left" }}>O'quvchi</th>
                      <th style={{ padding: "8px 4px", textAlign: "right" }}>To'lagan</th>
                      <th style={{ padding: "8px 4px", textAlign: "right" }}>Holati</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salaryStudents.map((s: any, idx: number) => (
                      <tr key={s.id} style={{ borderBottom: "1px solid #eee" }}>
                        <td style={{ padding: "6px 4px" }}>{idx + 1}</td>
                        <td style={{ padding: "6px 4px" }}>{s.firstName} {s.lastName}</td>
                        <td style={{ padding: "6px 4px", textAlign: "right" }}>{s.totalPaid.toLocaleString()}</td>
                        <td style={{ padding: "6px 4px", textAlign: "right", color: s.balance > 0 ? "#22c55e" : "#ef4444" }}>
                          {s.balance > 0 ? "To'langan" : `${Math.abs(s.balance).toLocaleString()} qarz`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ borderTop: "1px solid #eee", paddingTop: "10px", fontSize: "11px", color: "#aaa", display: "flex", justifyContent: "space-between" }}>
              <span>Sana: {new Date().toLocaleDateString("uz-UZ")}</span>
              <span>Zamonaviy-Edu</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
