import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { DollarSign, TrendingUp, Users, Percent } from "lucide-react";

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

  const { data: salary, isLoading } = useQuery({
    queryKey: ["/api/teacher/salary", month, year],
    queryFn: async () => {
      const res = await fetch(`/api/teacher/salary?month=${month}&year=${year}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch salary");
      return res.json();
    },
  });

  const { data: students } = useQuery({
    queryKey: ["/api/students"],
    queryFn: async () => {
      const res = await fetch("/api/students", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch students");
      return res.json();
    },
  });

  const { data: payments } = useQuery({
    queryKey: ["/api/payments"],
    queryFn: async () => {
      const res = await fetch("/api/payments", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch payments");
      return res.json();
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("uz-UZ").format(amount) + " so'm";
  };

  const years = [
    String(currentDate.getFullYear() - 1),
    String(currentDate.getFullYear()),
    String(currentDate.getFullYear() + 1),
  ];

  const debtStudents = students?.filter((s: any) => s.balance <= 0) || [];
  const paidStudents = students?.filter((s: any) => s.balance > 0) || [];

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
              {months.find(m => m.value === month)?.label} oyi uchun
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
              {students?.length || 0}
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
            <CardTitle className="text-lg">Qarzdor o'quvchilar</CardTitle>
            <CardDescription>To'lov qilmagan o'quvchilar ro'yxati</CardDescription>
          </CardHeader>
          <CardContent>
            {debtStudents.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Qarzdor o'quvchilar yo'q</p>
            ) : (
              <div className="space-y-2">
                {debtStudents.map((student: any) => (
                  <div key={student.id} className="flex justify-between items-center p-2 rounded-lg bg-red-50 dark:bg-red-900/20" data-testid={`row-debt-student-${student.id}`}>
                    <div>
                      <p className="font-medium">{student.firstName} {student.lastName}</p>
                      <p className="text-sm text-muted-foreground">{student.phone}</p>
                    </div>
                    <div className="text-red-600 font-semibold">
                      {formatCurrency(Math.abs(student.balance))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-paid-students">
          <CardHeader>
            <CardTitle className="text-lg">To'lov qilgan o'quvchilar</CardTitle>
            <CardDescription>Balansda qoldig'i bor o'quvchilar</CardDescription>
          </CardHeader>
          <CardContent>
            {paidStudents.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Hali to'lov qilgan o'quvchilar yo'q</p>
            ) : (
              <div className="space-y-2">
                {paidStudents.map((student: any) => (
                  <div key={student.id} className="flex justify-between items-center p-2 rounded-lg bg-green-50 dark:bg-green-900/20" data-testid={`row-paid-student-${student.id}`}>
                    <div>
                      <p className="font-medium">{student.firstName} {student.lastName}</p>
                      <p className="text-sm text-muted-foreground">{student.phone}</p>
                    </div>
                    <div className="text-green-600 font-semibold">
                      {formatCurrency(student.balance)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
