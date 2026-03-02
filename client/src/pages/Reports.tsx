import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useStudents, usePayments, useGroups, useTeachers, useExpenses } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { 
  FileText, Download, Users, CreditCard, Calendar, AlertTriangle, 
  TrendingUp, FileDown, Wallet, Send, Printer, CheckCircle2, XCircle,
  GraduationCap, Banknote
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
  
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedGroup, setSelectedGroup] = useState("all");
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("");
  const [salaryFromMonth, setSalaryFromMonth] = useState(currentMonth);
  const [salaryToMonth, setSalaryToMonth] = useState(currentMonth);
  const [salaryYear, setSalaryYear] = useState(currentYear);
  const printRef = useRef<HTMLDivElement>(null);

  const { data: expensesData } = useExpenses(parseInt(selectedMonth), parseInt(selectedYear));

  const { data: attendanceData } = useQuery({
    queryKey: ["attendance-report", selectedMonth, selectedYear, selectedGroup],
    queryFn: async () => {
      const url = selectedGroup === "all" 
        ? `/api/attendance?month=${selectedMonth}&year=${selectedYear}`
        : `/api/attendance?groupId=${selectedGroup}&month=${selectedMonth}&year=${selectedYear}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Davomat ma'lumotlarini olishda xatolik");
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

  if (studentsLoading || paymentsLoading) {
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

  const debtors = (students || []).filter((s: any) => s.balance <= 0).sort((a: any, b: any) => a.balance - b.balance);
  const totalDebt = debtors.reduce((sum: number, s: any) => sum + Math.abs(s.balance), 0);

  const monthlyPayments = (payments || []).filter((p: any) => {
    const paymentDate = new Date(p.createdAt);
    return paymentDate.getMonth() + 1 === parseInt(selectedMonth) && 
           paymentDate.getFullYear() === parseInt(selectedYear) &&
           p.status === "completed";
  });
  const monthlyIncome = monthlyPayments.reduce((sum: number, p: any) => sum + p.amount, 0);

  const monthlyExpenses = (expensesData || []).reduce((sum: number, e: any) => sum + e.amount, 0);
  const netProfit = monthlyIncome - monthlyExpenses;

  const activeStudents = (students || []).filter((s: any) => s.status === "active").length;
  const totalStudents = (students || []).length;

  const attendanceStats = {
    present: (attendanceData || []).filter((a: any) => a.status === "present").length,
    absent: (attendanceData || []).filter((a: any) => a.status === "absent").length,
  };
  const attendanceRate = attendanceStats.present + attendanceStats.absent > 0 
    ? Math.round((attendanceStats.present / (attendanceStats.present + attendanceStats.absent)) * 100) 
    : 0;

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
  const teacherSalary = salaryData?.salary || 0;
  const teacherIncome = salaryData?.totalPayments || 0;
  const salaryPercent = salaryData?.teacher?.salaryPercent || 0;
  const salaryStudents = salaryData?.students || [];
  const paidStudentsList = salaryStudents.filter((s: any) => s.balance >= 0);
  const debtorStudentsList = salaryStudents.filter((s: any) => s.balance < 0);
  const totalAdvance = salaryData?.totalAdvance || 0;
  const calculatedSalary = salaryData?.calculatedSalary || 0;
  const advanceExpenses = salaryData?.advanceExpenses || [];

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
      ["Umumiy tushum:", `${teacherIncome.toLocaleString()} UZS`],
      ["Oylik foizi:", `${salaryPercent}%`],
      ["Hisoblangan oylik:", `${calculatedSalary.toLocaleString()} UZS`],
    ];

    if (totalAdvance > 0) {
      financeInfo.push(["Avans:", `-${totalAdvance.toLocaleString()} UZS`]);
    }
    
    financeInfo.forEach(([label, value]) => {
      doc.setTextColor(120, 120, 120);
      doc.text(label, 14, y);
      doc.setTextColor(40, 40, 40);
      if (label === "Avans:") {
        doc.setTextColor(234, 88, 12);
      }
      doc.text(value, 65, y);
      y += 8;
    });
    
    doc.setDrawColor(200, 200, 200);
    doc.line(14, y + 3, 196, y + 3);
    
    doc.setFillColor(240, 253, 244);
    doc.roundedRect(14, y + 8, 182, 25, 3, 3, 'F');
    doc.setFontSize(12);
    doc.setTextColor(22, 163, 74);
    doc.text("Yakuniy oylik:", 24, y + 24);
    doc.setFontSize(18);
    doc.text(`${teacherSalary.toLocaleString()} UZS`, 75, y + 24);
    
    if (totalAdvance > 0) {
      doc.setFontSize(9);
      doc.setTextColor(150, 150, 150);
      doc.text(`(${calculatedSalary.toLocaleString()} - ${totalAdvance.toLocaleString()} avans)`, 75, y + 31);
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
        s.balance >= 0 ? "To'langan" : `${Math.abs(s.balance).toLocaleString()} qarz`,
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
- Umumiy tushum: ${teacherIncome.toLocaleString()} UZS
- Oylik foizi: ${salaryPercent}%
- Hisoblangan oylik: ${calculatedSalary.toLocaleString()} UZS${advanceText}
- Yakuniy oylik: ${teacherSalary.toLocaleString()} UZS

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
            <p className="text-xs text-muted-foreground">{monthlyPayments.length} ta to'lov</p>
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
            <p className="text-xs text-muted-foreground">{(expensesData || []).length} ta xarajat</p>
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
            <p className="text-xs text-muted-foreground">{debtors.length} ta qarzdor</p>
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
              {attendanceStats.present} keldi / {attendanceStats.absent} kelmadi
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
                  <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
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
                          <p className="text-xl font-bold">{teacherGroups.length}</p>
                          <p className="text-xs text-white/70">Guruhlar</p>
                        </div>
                        <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 text-center">
                          <Users className="w-5 h-5 mx-auto mb-1" />
                          <p className="text-xl font-bold">{salaryStudents.length}</p>
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

                  <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="card-modern border-l-4 border-l-blue-500">
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground mb-1">Umumiy tushum</p>
                        <p className="text-2xl font-bold text-blue-600" data-testid="text-teacher-income">{teacherIncome.toLocaleString()} UZS</p>
                      </CardContent>
                    </Card>
                    <Card className="card-modern border-l-4 border-l-purple-500">
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground mb-1">Hisoblangan oylik ({salaryPercent}%)</p>
                        <p className="text-2xl font-bold text-purple-600" data-testid="text-calculated-salary">{calculatedSalary.toLocaleString()} UZS</p>
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
                    <Card className="card-modern border-l-4 border-l-emerald-500 shadow-glow-success">
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground mb-1">Yakuniy oylik</p>
                        <p className="text-2xl font-bold text-emerald-600" data-testid="text-final-salary">{teacherSalary.toLocaleString()} UZS</p>
                        {totalAdvance > 0 && (
                          <p className="text-xs text-muted-foreground">{calculatedSalary.toLocaleString()} - {totalAdvance.toLocaleString()}</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {salaryStudents.length > 0 && (
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
                                  <Badge variant={s.balance >= 0 ? "secondary" : "destructive"} className="font-mono">
                                    {s.balance >= 0 ? "+" : ""}{s.balance.toLocaleString()}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  )}

                  <div className="flex flex-wrap gap-3">
                    <Button onClick={() => generateSalaryPDF(false)} className="gradient-primary hover-lift" data-testid="button-download-salary-pdf">
                      <FileDown className="w-4 h-4 mr-2" /> PDF yuklash
                    </Button>
                    <Button onClick={() => generateSalaryPDF(true)} variant="outline" className="hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300" data-testid="button-download-salary-pdf-students">
                      <FileDown className="w-4 h-4 mr-2" /> PDF + O'quvchilar
                    </Button>
                    <Button onClick={shareToTelegram} variant="outline" className="hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300" data-testid="button-share-telegram">
                      <Send className="w-4 h-4 mr-2" /> Telegram'ga ulashish
                    </Button>
                    <Button onClick={handlePrint} variant="outline" data-testid="button-print-salary">
                      <Printer className="w-4 h-4 mr-2" /> Chop etish
                    </Button>
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
                    <td style={{ padding: "6px 0", fontWeight: "bold" }}>{teacherIncome.toLocaleString()} UZS</td>
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
                </tbody>
              </table>
            </div>

            <div style={{ background: "#f0fdf4", border: "2px solid #22c55e", borderRadius: "8px", padding: "15px", textAlign: "center", marginBottom: "20px" }}>
              <p style={{ color: "#888", margin: "0 0 5px", fontSize: "14px" }}>Yakuniy oylik</p>
              <p style={{ fontSize: "28px", fontWeight: "bold", color: "#16a34a", margin: 0 }}>{teacherSalary.toLocaleString()} UZS</p>
              {totalAdvance > 0 && (
                <p style={{ color: "#888", margin: "5px 0 0", fontSize: "12px" }}>
                  {calculatedSalary.toLocaleString()} - {totalAdvance.toLocaleString()} avans
                </p>
              )}
            </div>

            {salaryStudents.length > 0 && (
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
                        <td style={{ padding: "6px 4px", textAlign: "right", color: s.balance >= 0 ? "#22c55e" : "#ef4444" }}>
                          {s.balance >= 0 ? "To'langan" : `${Math.abs(s.balance).toLocaleString()} qarz`}
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
