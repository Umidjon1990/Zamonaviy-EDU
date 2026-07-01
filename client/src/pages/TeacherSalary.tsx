import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { DollarSign, TrendingUp, Users, Percent, CheckCircle2, XCircle, Phone, Calendar, Wallet } from "lucide-react";

const months = [
  { value: "1", label: "Yanvar" },
  { value: "2", label: "Fevral" },
  { value: "3", label: "Mart" },
  { value: "4", label: "Aprel" },
  { value: "5", label: "May" },
  { value: "6", label: "Iyun" },
  { value: "7", label: "Iyul" },
  { value: "8", label: "Avgust" },
  { value: "9", label: "Sentabr" },
  { value: "10", label: "Oktabr" },
  { value: "11", label: "Noyabr" },
  { value: "12", label: "Dekabr" },
];

export default function TeacherSalary() {
  const currentDate = new Date();
  const [month, setMonth] = useState(String(currentDate.getMonth() + 1));
  const [year, setYear] = useState(String(currentDate.getFullYear()));
  const [selectedStudent, setSelectedStudent] = useState<any>(null);

  const { data: salary, isLoading } = useQuery({
    queryKey: ["/api/teacher/salary", month, year],
    queryFn: async () => {
      const res = await fetch(`/api/teacher/salary?month=${month}&year=${year}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
  });

  const { data: studentsRaw } = useQuery({
    queryKey: ["/api/students"],
    queryFn: async () => {
      const res = await fetch("/api/students", { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });
  const students = (Array.isArray(studentsRaw) ? studentsRaw : []) as any[];

  const { data: paymentsRaw } = useQuery({
    queryKey: ["/api/payments"],
    queryFn: async () => {
      const res = await fetch("/api/payments", { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });
  const payments = (Array.isArray(paymentsRaw) ? paymentsRaw : []) as any[];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("uz-UZ").format(amount) + " so'm";
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat("uz-UZ", { day: "2-digit", month: "long", year: "numeric" }).format(d);
  };

  const years = [
    String(currentDate.getFullYear() - 1),
    String(currentDate.getFullYear()),
    String(currentDate.getFullYear() + 1),
  ];

  // Tanlangan oy uchun tugallangan to'lovlar
  const monthNum = parseInt(month);
  const yearNum = parseInt(year);
  const completedPayments = payments.filter((p: any) => p.status === "completed");
  const monthPayments = completedPayments.filter((p: any) => {
    const d = new Date(p.createdAt);
    if (isNaN(d.getTime())) return false;
    return d.getMonth() + 1 === monthNum && d.getFullYear() === yearNum;
  });

  // O'quvchi shu oyda to'lagan summasi
  const studentMonthTotal = (studentId: number) =>
    monthPayments
      .filter((p: any) => p.studentId === studentId)
      .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

  // O'quvchining oxirgi to'lovi
  const studentLastPayment = (studentId: number) => {
    const list = completedPayments
      .filter((p: any) => p.studentId === studentId)
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return list[0] || null;
  };

  const paidStudentIds = new Set(monthPayments.map((p: any) => p.studentId));
  const paidStudents = students.filter((s: any) => paidStudentIds.has(s.id));
  const unpaidStudents = students.filter((s: any) => !paidStudentIds.has(s.id));

  const selectedMonthLabel = months.find((m) => m.value === month)?.label || "";

  // Tanlangan o'quvchining barcha to'lovlari (dialog uchun)
  const selectedStudentPayments = selectedStudent
    ? completedPayments
        .filter((p: any) => p.studentId === selectedStudent.id)
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    : [];
  const selectedStudentMonthPaid = selectedStudent ? studentMonthTotal(selectedStudent.id) : 0;
  const selectedStudentLast = selectedStudent ? studentLastPayment(selectedStudent.id) : null;

  return (
    <div className="space-y-6" data-testid="page-teacher-salary">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Oylik hisoboti</h1>
          <p className="text-muted-foreground">Sizning oylik hisobotingiz</p>
        </div>
        <div className="flex gap-2">
          <Select value={month} onValueChange={setMonth} data-testid="select-month">
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Oy" />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={year} onValueChange={setYear} data-testid="select-year">
            <SelectTrigger className="w-24">
              <SelectValue placeholder="Yil" />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card data-testid="card-salary">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Oylik</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-salary">
              {isLoading ? "..." : formatCurrency(salary?.salary || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedMonthLabel} oyi uchun
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-total-payments">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Jami to'lovlar</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-payments">
              {isLoading ? "..." : formatCurrency(salary?.totalPayments || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              O'quvchilardan tushgan
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-percent">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Foiz</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-percent">
              {isLoading ? "..." : `${salary?.salaryPercent || 0}%`}
            </div>
            <p className="text-xs text-muted-foreground">
              Sizning ulushingiz
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-students">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">O'quvchilar</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-students-count">
              {students.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Jami sizning o'quvchilaringiz
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card data-testid="card-debt-students">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-500" />
                  To'lov qilmagan
                </CardTitle>
                <CardDescription>{selectedMonthLabel} oyida to'lamagan o'quvchilar</CardDescription>
              </div>
              <Badge variant="destructive" data-testid="badge-unpaid-count">{unpaidStudents.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {unpaidStudents.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Barcha o'quvchilar to'lov qilgan</p>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {unpaidStudents.map((student: any) => (
                  <button
                    key={student.id}
                    onClick={() => setSelectedStudent(student)}
                    className="w-full flex justify-between items-center p-3 rounded-lg bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors text-left"
                    data-testid={`row-unpaid-student-${student.id}`}
                  >
                    <div>
                      <p className="font-medium">{student.firstName} {student.lastName}</p>
                      <p className="text-sm text-muted-foreground">{student.phone}</p>
                    </div>
                    <Badge variant="outline" className="text-red-600 border-red-300">Qilinmagan</Badge>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-paid-students">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  To'lov qilgan
                </CardTitle>
                <CardDescription>{selectedMonthLabel} oyida to'lagan o'quvchilar</CardDescription>
              </div>
              <Badge className="bg-green-600" data-testid="badge-paid-count">{paidStudents.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {paidStudents.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Bu oyda hali to'lov qilgan o'quvchilar yo'q</p>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {paidStudents.map((student: any) => (
                  <button
                    key={student.id}
                    onClick={() => setSelectedStudent(student)}
                    className="w-full flex justify-between items-center p-3 rounded-lg bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors text-left"
                    data-testid={`row-paid-student-${student.id}`}
                  >
                    <div>
                      <p className="font-medium">{student.firstName} {student.lastName}</p>
                      <p className="text-sm text-muted-foreground">{student.phone}</p>
                    </div>
                    <div className="text-green-600 font-semibold">
                      {formatCurrency(studentMonthTotal(student.id))}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedStudent} onOpenChange={(open) => !open && setSelectedStudent(null)}>
        <DialogContent className="max-w-md" data-testid="dialog-student-detail">
          {selectedStudent && (
            <>
              <DialogHeader>
                <DialogTitle data-testid="text-dialog-student-name">
                  {selectedStudent.firstName} {selectedStudent.lastName}
                </DialogTitle>
                <DialogDescription className="flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" />
                  {selectedStudent.phone}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className={`rounded-lg p-3 ${selectedStudentMonthPaid > 0 ? "bg-green-50 dark:bg-green-900/20" : "bg-red-50 dark:bg-red-900/20"}`}>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                      <Wallet className="h-3.5 w-3.5" />
                      {selectedMonthLabel} to'lovi
                    </div>
                    <p className={`font-bold ${selectedStudentMonthPaid > 0 ? "text-green-600" : "text-red-600"}`} data-testid="text-dialog-month-paid">
                      {selectedStudentMonthPaid > 0 ? formatCurrency(selectedStudentMonthPaid) : "To'lanmagan"}
                    </p>
                  </div>
                  <div className="rounded-lg p-3 bg-muted/50">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                      <Calendar className="h-3.5 w-3.5" />
                      Oxirgi to'lov
                    </div>
                    <p className="font-bold text-sm" data-testid="text-dialog-last-payment">
                      {selectedStudentLast ? formatDate(selectedStudentLast.createdAt) : "Yo'q"}
                    </p>
                    {selectedStudentLast && (
                      <p className="text-xs text-green-600 mt-0.5">{formatCurrency(selectedStudentLast.amount)}</p>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium mb-2">To'lovlar tarixi</p>
                  {selectedStudentPayments.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">To'lovlar tarixi yo'q</p>
                  ) : (
                    <div className="space-y-2 max-h-[240px] overflow-y-auto">
                      {selectedStudentPayments.map((p: any) => (
                        <div
                          key={p.id}
                          className="flex justify-between items-center p-2.5 rounded-lg border bg-card"
                          data-testid={`row-payment-history-${p.id}`}
                        >
                          <div>
                            <p className="text-sm font-medium">{formatDate(p.createdAt)}</p>
                            <p className="text-xs text-muted-foreground capitalize">{p.paymentType || "—"}</p>
                          </div>
                          <p className="text-sm font-semibold text-green-600">{formatCurrency(p.amount || 0)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
