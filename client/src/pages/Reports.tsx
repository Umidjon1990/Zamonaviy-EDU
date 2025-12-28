import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useStudents, usePayments, useGroups } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { FileText, Download, Users, CreditCard, Calendar, AlertTriangle, TrendingUp, FileDown } from "lucide-react";
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
  
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedGroup, setSelectedGroup] = useState("all");

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

  // Qarzdorlar (negative balance students)
  const debtors = (students || []).filter((s: any) => s.balance < 0).sort((a: any, b: any) => a.balance - b.balance);
  const totalDebt = debtors.reduce((sum: number, s: any) => sum + Math.abs(s.balance), 0);

  // Oylik tushum
  const monthlyPayments = (payments || []).filter((p: any) => {
    const paymentDate = new Date(p.createdAt);
    return paymentDate.getMonth() + 1 === parseInt(selectedMonth) && 
           paymentDate.getFullYear() === parseInt(selectedYear) &&
           p.status === "completed";
  });
  const monthlyIncome = monthlyPayments.reduce((sum: number, p: any) => sum + p.amount, 0);

  // Faol o'quvchilar
  const activeStudents = (students || []).filter((s: any) => s.status === "active").length;
  const totalStudents = (students || []).length;

  // Davomat statistikasi
  const attendanceStats = {
    present: (attendanceData || []).filter((a: any) => a.status === "present").length,
    absent: (attendanceData || []).filter((a: any) => a.status === "absent").length,
  };
  const attendanceRate = attendanceStats.present + attendanceStats.absent > 0 
    ? Math.round((attendanceStats.present / (attendanceStats.present + attendanceStats.absent)) * 100) 
    : 0;

  // Export to CSV
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
    const monthName = months.find(m => m.value === selectedMonth)?.label || "";
    
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Hisobotlar</h1>
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
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Oylik tushum
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600" data-testid="text-monthly-income">
              {monthlyIncome.toLocaleString()} UZS
            </div>
            <p className="text-xs text-muted-foreground">{monthlyPayments.length} ta to'lov</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Jami qarz
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="text-total-debt">
              {totalDebt.toLocaleString()} UZS
            </div>
            <p className="text-xs text-muted-foreground">{debtors.length} ta qarzdor</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="w-4 h-4" /> Faol o'quvchilar
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

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Davomat
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

      <Tabs defaultValue="debtors" className="space-y-4">
        <TabsList>
          <TabsTrigger value="debtors" className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Qarzdorlar
          </TabsTrigger>
          <TabsTrigger value="payments" className="flex items-center gap-2">
            <CreditCard className="w-4 h-4" /> To'lovlar
          </TabsTrigger>
          <TabsTrigger value="attendance" className="flex items-center gap-2">
            <Calendar className="w-4 h-4" /> Davomat
          </TabsTrigger>
        </TabsList>

        <TabsContent value="debtors" className="space-y-4">
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={exportDebtors} disabled={debtors.length === 0} data-testid="button-export-debtors-excel">
              <Download className="w-4 h-4 mr-2" /> Excel
            </Button>
            <Button variant="outline" onClick={exportDebtorsPDF} disabled={debtors.length === 0} data-testid="button-export-debtors-pdf">
              <FileDown className="w-4 h-4 mr-2" /> PDF
            </Button>
          </div>
          <Card>
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

        <TabsContent value="payments" className="space-y-4">
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={exportPayments} disabled={monthlyPayments.length === 0} data-testid="button-export-payments-excel">
              <Download className="w-4 h-4 mr-2" /> Excel
            </Button>
            <Button variant="outline" onClick={exportPaymentsPDF} disabled={monthlyPayments.length === 0} data-testid="button-export-payments-pdf">
              <FileDown className="w-4 h-4 mr-2" /> PDF
            </Button>
          </div>
          <Card>
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

        <TabsContent value="attendance" className="space-y-4">
          <div className="flex gap-4">
            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
              <SelectTrigger className="w-[200px]" data-testid="select-group">
                <SelectValue placeholder="Guruhni tanlang" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Barcha guruhlar</SelectItem>
                {(groups || []).map((g: any) => (
                  <SelectItem key={g.id} value={g.id.toString()}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Davomat statistikasi</CardTitle>
              <CardDescription>
                {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="text-center p-4 bg-emerald-50 rounded-lg">
                  <div className="text-3xl font-bold text-emerald-600">{attendanceStats.present}</div>
                  <div className="text-sm text-muted-foreground">Keldi</div>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <div className="text-3xl font-bold text-red-600">{attendanceStats.absent}</div>
                  <div className="text-sm text-muted-foreground">Kelmadi</div>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-3xl font-bold text-blue-600">{attendanceRate}%</div>
                  <div className="text-sm text-muted-foreground">Davomat foizi</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
