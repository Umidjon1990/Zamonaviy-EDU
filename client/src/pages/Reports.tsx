import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useStudents, usePayments, useGroups, useTeachers } from "@/lib/api";
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

  const { data: attendanceData } = useQuery({
    queryKey: ["attendance-report", selectedMonth, selectedYear, selectedGroup],
    queryFn: async () => {
      const url = selectedGroup === "all" 
        ? `/api/attendance?month=${selectedMonth}&year=${selectedYear}`
        : `/api/attendance?groupId=${selectedGroup}&month=${selectedMonth}&year=${selectedYear}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error("Davomat ma'lumotlarini olishda xatolik");
      }
      return res.json();
    },
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
  
  const teacherStudentIds = new Set<number>();
  teacherGroups.forEach((g: any) => {
    (students || []).forEach((s: any) => {
      if (s.groupIds?.includes(g.id)) {
        teacherStudentIds.add(s.id);
      }
    });
  });
  
  const teacherStudents = (students || []).filter((s: any) => teacherStudentIds.has(s.id));
  const paidStudents = teacherStudents.filter((s: any) => s.balance >= 0);
  const debtorStudents = teacherStudents.filter((s: any) => s.balance < 0);
  
  const teacherPayments = monthlyPayments.filter((p: any) => teacherStudentIds.has(p.studentId));
  const teacherIncome = teacherPayments.reduce((sum: number, p: any) => sum + p.amount, 0);
  
  const salaryPercentage = selectedTeacher?.salaryPercentage || 40;
  const teacherSalary = Math.round(teacherIncome * (salaryPercentage / 100));

  const generateSalaryPDF = () => {
    if (!selectedTeacher) return;
    
    const doc = new jsPDF();
    const monthName = months.find(m => m.value === selectedMonth)?.label || "";
    
    doc.setFillColor(102, 126, 234);
    doc.rect(0, 0, 210, 50, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text("OYLIK CHEKI", 105, 25, { align: "center" });
    doc.setFontSize(12);
    doc.text(`${monthName} ${selectedYear}`, 105, 35, { align: "center" });
    
    doc.setTextColor(0, 0, 0);
    
    doc.setFontSize(14);
    doc.text("O'qituvchi ma'lumotlari", 14, 65);
    
    doc.setFontSize(11);
    doc.setTextColor(80, 80, 80);
    
    const info = [
      ["O'qituvchi ismi:", `${selectedTeacher.firstName} ${selectedTeacher.lastName}`],
      ["Telefon:", selectedTeacher.phone || "-"],
      ["Nechta guruhi bor:", `${teacherGroups.length} ta`],
      ["O'quvchilar soni:", `${teacherStudents.length} ta`],
    ];
    
    let y = 75;
    info.forEach(([label, value]) => {
      doc.setTextColor(120, 120, 120);
      doc.text(label, 14, y);
      doc.setTextColor(40, 40, 40);
      doc.text(value, 60, y);
      y += 8;
    });
    
    doc.setDrawColor(200, 200, 200);
    doc.line(14, y + 5, 196, y + 5);
    
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text("Moliyaviy ma'lumotlar", 14, y + 18);
    
    y += 28;
    doc.setFontSize(11);
    
    const financeInfo = [
      ["Nechtasi to'lov qildi:", `${paidStudents.length} ta`, "#22c55e"],
      ["Nechtasi qarzdor:", `${debtorStudents.length} ta`, "#ef4444"],
      ["Umumiy tushum:", `${teacherIncome.toLocaleString()} UZS`, "#3b82f6"],
      ["Oylik foizi:", `${salaryPercentage}%`, "#8b5cf6"],
    ];
    
    financeInfo.forEach(([label, value, color]) => {
      doc.setTextColor(120, 120, 120);
      doc.text(label, 14, y);
      doc.setTextColor(40, 40, 40);
      doc.text(value, 80, y);
      y += 8;
    });
    
    doc.setDrawColor(200, 200, 200);
    doc.line(14, y + 5, 196, y + 5);
    
    doc.setFillColor(240, 253, 244);
    doc.roundedRect(14, y + 12, 182, 30, 3, 3, 'F');
    
    doc.setFontSize(12);
    doc.setTextColor(22, 163, 74);
    doc.text("Oyligi:", 24, y + 30);
    doc.setFontSize(18);
    doc.text(`${teacherSalary.toLocaleString()} UZS`, 80, y + 30);
    
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text(`Chek yaratilgan sana: ${new Date().toLocaleDateString("uz-UZ")}`, 14, 280);
    doc.text("Zamonaviy-Edu", 196, 280, { align: "right" });
    
    doc.save(`oylik_${selectedTeacher.firstName}_${selectedTeacher.lastName}_${monthName}_${selectedYear}.pdf`);
    
    toast({
      title: "PDF yuklandi",
      description: "Oylik cheki muvaffaqiyatli yuklandi",
    });
  };

  const shareToTelegram = () => {
    if (!selectedTeacher) return;
    
    const monthName = months.find(m => m.value === selectedMonth)?.label || "";
    
    const message = `
📋 *OYLIK CHEKI*
📅 ${monthName} ${selectedYear}

👤 *O'qituvchi ismi:* ${selectedTeacher.firstName} ${selectedTeacher.lastName}
📱 Telefon: ${selectedTeacher.phone || "-"}

📊 *Ma'lumotlar:*
• Nechta guruhi bor: ${teacherGroups.length} ta
• O'quvchilar soni: ${teacherStudents.length} ta
• ✅ Nechtasi to'lov qildi: ${paidStudents.length} ta
• ❌ Nechtasi qarzdor: ${debtorStudents.length} ta

💰 *Moliya:*
• Umumiy tushum: ${teacherIncome.toLocaleString()} UZS
• Oylik foizi: ${salaryPercentage}%
• 💵 *Oyligi: ${teacherSalary.toLocaleString()} UZS*

_Zamonaviy-Edu_
    `.trim();
    
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://t.me/share/url?text=${encodedMessage}`, "_blank");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
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

      <Tabs defaultValue="salary" className="space-y-4">
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
                O'qituvchini tanlang va oylik chekini yarating
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>O'qituvchini tanlang</Label>
                <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
                  <SelectTrigger className="w-full max-w-md" data-testid="select-teacher-salary">
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

              {selectedTeacher && (
                <div className="space-y-6">
                  <div className="relative overflow-hidden rounded-2xl gradient-hero p-6 text-white">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -mr-24 -mt-24 blur-2xl" />
                    <div className="relative z-10">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl font-bold">
                          {selectedTeacher.firstName?.[0]}{selectedTeacher.lastName?.[0]}
                        </div>
                        <div>
                          <h3 className="text-xl font-bold">{selectedTeacher.firstName} {selectedTeacher.lastName}</h3>
                          <p className="text-white/70">{selectedTeacher.phone}</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 text-center">
                          <GraduationCap className="w-6 h-6 mx-auto mb-2" />
                          <p className="text-2xl font-bold">{teacherGroups.length}</p>
                          <p className="text-xs text-white/70">Guruhlar</p>
                        </div>
                        <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 text-center">
                          <Users className="w-6 h-6 mx-auto mb-2" />
                          <p className="text-2xl font-bold">{teacherStudents.length}</p>
                          <p className="text-xs text-white/70">O'quvchilar</p>
                        </div>
                        <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 text-center">
                          <CheckCircle2 className="w-6 h-6 mx-auto mb-2" />
                          <p className="text-2xl font-bold">{paidStudents.length}</p>
                          <p className="text-xs text-white/70">To'lov qilgan</p>
                        </div>
                        <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 text-center">
                          <XCircle className="w-6 h-6 mx-auto mb-2" />
                          <p className="text-2xl font-bold">{debtorStudents.length}</p>
                          <p className="text-xs text-white/70">Qarzdor</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    <Card className="card-modern border-l-4 border-l-blue-500">
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground mb-1">Umumiy tushum</p>
                        <p className="text-2xl font-bold text-blue-600">{teacherIncome.toLocaleString()} UZS</p>
                      </CardContent>
                    </Card>
                    <Card className="card-modern border-l-4 border-l-purple-500">
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground mb-1">Oylik foizi</p>
                        <p className="text-2xl font-bold text-purple-600">{salaryPercentage}%</p>
                      </CardContent>
                    </Card>
                    <Card className="card-modern border-l-4 border-l-emerald-500 shadow-glow-success">
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground mb-1">Oylik summasi</p>
                        <p className="text-2xl font-bold text-emerald-600">{teacherSalary.toLocaleString()} UZS</p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button onClick={generateSalaryPDF} className="gradient-primary hover-lift" data-testid="button-download-salary-pdf">
                      <FileDown className="w-4 h-4 mr-2" /> PDF yuklash
                    </Button>
                    <Button onClick={shareToTelegram} variant="outline" className="hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300" data-testid="button-share-telegram">
                      <Send className="w-4 h-4 mr-2" /> Telegram'ga ulashish
                    </Button>
                    <Button onClick={() => window.print()} variant="outline" data-testid="button-print-salary">
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
                        Qarzdorlar yo'q 🎉
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
    </div>
  );
}
