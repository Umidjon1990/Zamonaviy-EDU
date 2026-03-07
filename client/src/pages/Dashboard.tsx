import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStudents, usePayments, useGroups, useLeads, useTeachers } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Users, GraduationCap, Wallet, TrendingUp, BookOpen, Clock, UserPlus, ArrowUpRight, ArrowDownRight, Sparkles, CalendarDays, Target, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";

interface DashboardStats {
  totalStudents: number;
  activeGroups: number;
  monthlyIncome: number;
  newLeads: number;
}

const monthNames = [
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

export default function Dashboard() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState((now.getMonth() + 1).toString());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear().toString());
  const [attendancePeriod, setAttendancePeriod] = useState<'day' | 'week' | 'month'>('day');
  const [attendanceDate, setAttendanceDate] = useState(now.toISOString().split('T')[0]);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["stats", selectedMonth, selectedYear],
    queryFn: async () => {
      const res = await fetch(`/api/stats?month=${selectedMonth}&year=${selectedYear}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  }) as { data: DashboardStats | undefined; isLoading: boolean };
  const { data: students } = useStudents();
  const { data: payments } = usePayments();
  const { data: groups } = useGroups();
  const { data: leads } = useLeads();
  const { data: teachers } = useTeachers();

  const { data: attendanceData } = useQuery({
    queryKey: ["dashboard-attendance", selectedMonth, selectedYear],
    queryFn: async () => {
      const res = await fetch(`/api/attendance?month=${selectedMonth}&year=${selectedYear}`, { credentials: "include" });
      return res.json();
    },
  });

  const { data: teacherAttendanceSummary } = useQuery({
    queryKey: ["teacher-attendance-summary", attendancePeriod, attendanceDate, selectedMonth, selectedYear],
    queryFn: async () => {
      let url = `/api/attendance/teacher-summary?period=${attendancePeriod}`;
      if (attendancePeriod === 'day' || attendancePeriod === 'week') {
        url += `&date=${attendanceDate}`;
      } else {
        url += `&month=${selectedMonth}&year=${selectedYear}`;
      }
      const res = await fetch(url, { credentials: "include" });
      return res.json();
    },
  });

  const studentsList = Array.isArray(students) ? students : [];
  const paymentsList = Array.isArray(payments) ? payments : [];
  const groupsList = Array.isArray(groups) ? groups : [];
  const leadsList = Array.isArray(leads) ? leads : [];
  const teachersList = Array.isArray(teachers) ? teachers : [];
  const attendanceList = Array.isArray(attendanceData) ? attendanceData : [];

  const selMonth = parseInt(selectedMonth);
  const selYear = parseInt(selectedYear);

  const getMonthlyData = () => {
    const monthLabels = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyun', 'Iyul', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];
    const data = [];
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(selYear, selMonth - 1 - i, 1);
      const month = date.getMonth();
      const year = date.getFullYear();
      
      const monthPayments = paymentsList.filter((p: any) => {
        const pDate = new Date(p.createdAt);
        return pDate.getMonth() === month && pDate.getFullYear() === year && p.status === 'completed';
      });
      
      const total = monthPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
      data.push({ name: monthLabels[month], total });
    }
    
    return data;
  };

  const getAttendanceStats = () => {
    const present = attendanceList.filter((a: any) => a.status === 'present').length;
    const absent = attendanceList.filter((a: any) => a.status === 'absent').length;
    const excused = attendanceList.filter((a: any) => a.status === 'excused' || a.status === 'late').length;
    const total = present + absent + excused;
    
    if (total === 0) {
      return [
        { name: "Bor", value: 0, color: "#22c55e" },
        { name: "Yo'q", value: 0, color: "#ef4444" },
        { name: "Sababli", value: 0, color: "#f59e0b" },
      ];
    }
    
    return [
      { name: "Bor", value: Math.round((present / total) * 100), color: "#22c55e" },
      { name: "Yo'q", value: Math.round((absent / total) * 100), color: "#ef4444" },
      { name: "Sababli", value: Math.round((excused / total) * 100), color: "#f59e0b" },
    ];
  };

  const getPerformanceMetrics = () => {
    const totalAtt = attendanceList.length;
    const presentAtt = attendanceList.filter((a: any) => a.status === 'present').length;
    const attendanceRate = totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : 0;
    
    const monthPayments = paymentsList.filter((p: any) => {
      const d = new Date(p.createdAt);
      return d.getMonth() + 1 === selMonth && d.getFullYear() === selYear && p.status === 'completed';
    });
    const paidStudentIds = new Set(monthPayments.map((p: any) => p.studentId));
    const activeStudentCount = studentsList.filter((s: any) => s.status === 'active').length;
    const paymentRate = activeStudentCount > 0 ? Math.round((paidStudentIds.size / activeStudentCount) * 100) : 0;
    
    const convertedLeads = leadsList.filter((l: any) => l.status === 'converted').length;
    const conversionRate = leadsList.length > 0 ? Math.round((convertedLeads / leadsList.length) * 100) : 0;
    
    const retentionRate = studentsList.length > 0 ? Math.round((activeStudentCount / studentsList.length) * 100) : 0;
    
    return { attendanceRate, paymentRate, conversionRate, retentionRate };
  };

  const getFinancialSummary = () => {
    const monthlyPaymentsFiltered = paymentsList.filter((p: any) => {
      const pDate = new Date(p.createdAt);
      return pDate.getMonth() + 1 === selMonth && pDate.getFullYear() === selYear && p.status === 'completed';
    });
    const monthlyIncome = monthlyPaymentsFiltered.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
    
    const totalDebt = studentsList
      .filter((s: any) => s.balance < 0)
      .reduce((sum: number, s: any) => sum + Math.abs(s.balance), 0);
    
    const debtorCount = studentsList.filter((s: any) => s.balance <= 0).length;
    const avgGroupPrice = groupsList.length > 0 
      ? groupsList.reduce((sum: number, g: any) => sum + (g.price || 0), 0) / groupsList.length 
      : 500000;
    const expectedPayments = debtorCount * avgGroupPrice;
    
    const avgPayment = monthlyPaymentsFiltered.length > 0 
      ? Math.round(monthlyIncome / monthlyPaymentsFiltered.length)
      : 0;
    
    return { monthlyIncome, totalDebt, expectedPayments, avgPayment };
  };


  if (statsLoading) {
    return (
      <div className="space-y-6 p-2">
        <Skeleton className="h-12 w-80" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  const monthlyData = getMonthlyData();
  const attendancePieData = getAttendanceStats();
  const metrics = getPerformanceMetrics();
  const financial = getFinancialSummary();


  const selectedMonthPaymentCount = paymentsList.filter((p: any) => {
    const d = new Date(p.createdAt);
    return d.getMonth() + 1 === selMonth && d.getFullYear() === selYear && p.status === 'completed';
  }).length;

  const statsCards = [
    {
      title: "Jami o'quvchilar",
      value: stats?.totalStudents || studentsList.length || 0,
      change: `${studentsList.filter((s: any) => s.status === 'active').length} faol`,
      changeType: "up",
      icon: Users,
      iconBg: "bg-blue-500/10",
      iconColor: "text-blue-500",
      description: "Barcha o'quvchilar",
    },
    {
      title: "Faol guruhlar",
      value: stats?.activeGroups || groupsList.length || 0,
      change: `${groupsList.filter((g: any) => g.status === 'active').length} ta`,
      changeType: "up",
      icon: GraduationCap,
      iconBg: "bg-purple-500/10",
      iconColor: "text-purple-500",
      description: "Hozirda davom etmoqda",
    },
    {
      title: "Oylik tushum",
      value: `${((stats?.monthlyIncome || financial.monthlyIncome) / 1000000).toFixed(1)}M`,
      change: `${selectedMonthPaymentCount} ta to'lov`,
      changeType: "up",
      icon: Wallet,
      iconBg: "bg-emerald-500/10",
      iconColor: "text-emerald-500",
      description: monthNames.find(m => m.value === selectedMonth)?.label || "",
    },
    {
      title: "Yangi lidlar",
      value: stats?.newLeads || leadsList.filter((l: any) => l.status === 'new').length || 0,
      change: `${leadsList.length} jami`,
      changeType: "up",
      icon: UserPlus,
      iconBg: "bg-amber-500/10",
      iconColor: "text-amber-500",
      description: "Kutilmoqda",
    },
  ];

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Xayrli tong";
    if (hour < 18) return "Xayrli kun";
    return "Xayrli kech";
  };

  const formatMoney = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
    return value.toString();
  };

  return (
    <div className="space-y-6 p-2">
      <div className="relative overflow-hidden rounded-2xl gradient-hero p-6 md:p-8 text-white animate-slide-up">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full -ml-24 -mb-24 blur-2xl" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-yellow-300" />
              <span className="text-white/80 text-sm">{getGreeting()}</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold">
              Boshqaruv paneli
            </h1>
            <p className="text-white/70 mt-1">
              Markaz ko'rsatkichlari va statistika
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-2 rounded-xl">
              <CalendarDays className="h-4 w-4" />
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[110px] border-0 bg-transparent text-white h-7 p-0 focus:ring-0" data-testid="select-dashboard-month">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthNames.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[70px] border-0 bg-transparent text-white h-7 p-0 focus:ring-0" data-testid="select-dashboard-year">
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
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((stat, index) => (
          <Card 
            key={index} 
            className="card-modern relative overflow-hidden hover-lift animate-slide-up" 
            style={{ animationDelay: `${index * 100}ms` }}
            data-testid={`card-stat-${index}`}
          >
            <div className="absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8 rounded-full bg-gradient-to-br from-primary/5 to-primary/10" />
            <CardContent className="p-6 relative">
              <div className="flex items-start justify-between">
                <div className={`p-3 rounded-xl ${stat.iconBg} shadow-lg`}>
                  <stat.icon className={`h-6 w-6 ${stat.iconColor}`} />
                </div>
                <div className={`flex items-center gap-1 text-sm font-medium px-2 py-1 rounded-full ${stat.changeType === 'up' ? 'text-emerald-600 bg-emerald-50' : 'text-red-600 bg-red-50'}`}>
                  {stat.changeType === 'up' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {stat.change}
                </div>
              </div>
              <div className="mt-4">
                <p className="text-3xl font-bold tracking-tight animate-count-up">{stat.value}</p>
                <p className="text-sm font-medium text-muted-foreground mt-1">{stat.title}</p>
              </div>
              <p className="text-xs text-muted-foreground/70 mt-2">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-7">
        <Card className="lg:col-span-4 card-modern animate-slide-up" style={{ animationDelay: '200ms' }}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold">Oylik tushum</CardTitle>
                <p className="text-sm text-muted-foreground">So'nggi 6 oy statistikasi</p>
              </div>
              <div className="flex items-center gap-2 text-emerald-500 text-sm font-medium">
                <TrendingUp className="h-4 w-4" />
                {formatMoney(financial.monthlyIncome)} bu oy
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} barSize={40}>
                  <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value / 1000000}M`} />
                  <Tooltip 
                    cursor={{fill: 'rgba(0,0,0,0.05)', radius: 8}}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.12)', padding: '12px 16px' }}
                    formatter={(value: number) => [`${(value / 1000000).toFixed(1)}M so'm`, "Tushum"]}
                  />
                  <Bar dataKey="total" fill="url(#colorGradient)" radius={[8, 8, 0, 0]} />
                  <defs>
                    <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={1}/>
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.6}/>
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 card-modern animate-slide-up" style={{ animationDelay: '300ms' }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">Davomat statistikasi</CardTitle>
            <p className="text-sm text-muted-foreground">{monthNames.find(m => m.value === String(selMonth))?.label} {selYear} ({attendanceList.length} ta yozuv)</p>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={attendancePieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="value">
                    {attendancePieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.12)' }}
                    formatter={(value: number) => [`${value}%`, ""]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 mt-4">
              {attendancePieData.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-sm text-muted-foreground">{item.name}: {item.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Darslar va Davomat - birlashtirilgan */}
      <Card className="card-modern animate-slide-up" style={{ animationDelay: '350ms' }}>
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-500/10">
                <BookOpen className="h-5 w-5 text-indigo-500" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Darslar va Davomat</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {attendancePeriod === 'day'
                    ? (() => {
                        const d = new Date(attendanceDate + 'T12:00:00');
                        const today = new Date(); today.setHours(12,0,0,0);
                        const isToday = d.toDateString() === today.toDateString();
                        return isToday ? 'Bugun' : d.toLocaleDateString('uz-UZ', { weekday: 'long', day: 'numeric', month: 'long' });
                      })()
                    : attendancePeriod === 'week' ? 'Shu hafta'
                    : `${monthNames.find(m => m.value === selectedMonth)?.label} ${selectedYear}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex bg-muted rounded-lg p-0.5">
                {[
                  { key: 'day' as const, label: 'Kun' },
                  { key: 'week' as const, label: 'Hafta' },
                  { key: 'month' as const, label: 'Oy' },
                ].map(p => (
                  <button
                    key={p.key}
                    onClick={() => setAttendancePeriod(p.key)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                      attendancePeriod === p.key
                        ? 'bg-background shadow-sm text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    data-testid={`btn-period-${p.key}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              {(attendancePeriod === 'day' || attendancePeriod === 'week') && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      const d = new Date(attendanceDate);
                      d.setDate(d.getDate() - (attendancePeriod === 'week' ? 7 : 1));
                      setAttendanceDate(d.toISOString().split('T')[0]);
                    }}
                    className="p-1.5 rounded-md hover:bg-muted transition-colors"
                    data-testid="btn-prev-date"
                  >←</button>
                  <input
                    type="date"
                    value={attendanceDate}
                    onChange={e => setAttendanceDate(e.target.value)}
                    className="text-xs border rounded-md px-2 py-1.5 bg-background w-[130px]"
                    data-testid="input-attendance-date"
                  />
                  <button
                    onClick={() => {
                      const d = new Date(attendanceDate);
                      d.setDate(d.getDate() + (attendancePeriod === 'week' ? 7 : 1));
                      setAttendanceDate(d.toISOString().split('T')[0]);
                    }}
                    className="p-1.5 rounded-md hover:bg-muted transition-colors"
                    data-testid="btn-next-date"
                  >→</button>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-3">
          {(() => {
            const summaryList = Array.isArray(teacherAttendanceSummary) ? teacherAttendanceSummary : [];
            const groupRows: any[] = [];
            summaryList.forEach((t: any) => {
              if (t.groupDetails?.length > 0) {
                t.groupDetails.forEach((g: any) => {
                  groupRows.push({
                    teacherId: t.teacherId,
                    teacherName: t.teacherName,
                    teacherInitials: t.teacherName?.split(' ').map((n: string) => n[0]).join('').slice(0, 2),
                    groupId: g.id,
                    groupName: g.name,
                    groupTime: g.time,
                    groupRoom: g.room,
                    present: g.present,
                    absent: g.absent,
                    total: g.total,
                    rate: g.total > 0 ? Math.round((g.present / g.total) * 100) : 0,
                    classStarted: g.classStarted !== undefined ? g.classStarted : t.classStarted,
                    hasTodayClass: t.hasTodayClass,
                  });
                });
              } else if (t.hasTodayClass) {
                t.todayGroups?.forEach((tg: any) => {
                  groupRows.push({
                    teacherId: t.teacherId,
                    teacherName: t.teacherName,
                    teacherInitials: t.teacherName?.split(' ').map((n: string) => n[0]).join('').slice(0, 2),
                    groupId: `${t.teacherId}-${tg.name}`,
                    groupName: tg.name,
                    groupTime: tg.time,
                    groupRoom: tg.room,
                    present: 0,
                    absent: 0,
                    total: 0,
                    rate: 0,
                    classStarted: t.classStarted,
                    hasTodayClass: true,
                  });
                });
              }
            });

            const completedRows = groupRows.filter((r: any) => r.total > 0);
            const waitingRows = groupRows.filter((r: any) => r.total === 0 && r.classStarted === false);
            const notTakenRows = groupRows.filter((r: any) => r.total === 0 && r.classStarted !== false);

            if (groupRows.length === 0) {
              return (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Ma'lumot topilmadi</p>
                </div>
              );
            }

            const renderGroupRow = (r: any) => (
              <div key={r.groupId} className="flex items-center justify-between p-3 rounded-xl border hover:bg-muted/30 transition-colors" data-testid={`group-attendance-${r.groupId}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold ${
                    r.total > 0 ? 'bg-gradient-to-br from-emerald-500 to-teal-500' :
                    r.classStarted === false ? 'bg-gradient-to-br from-blue-400 to-blue-500' :
                    'bg-gradient-to-br from-amber-500 to-orange-500'
                  }`}>
                    {r.teacherInitials}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{r.groupName}</p>
                      <span className="text-xs text-muted-foreground">{r.groupTime}</span>
                      {r.groupRoom && <span className="text-xs text-muted-foreground">({r.groupRoom})</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">{r.teacherName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  {r.total > 0 ? (
                    <>
                      <span className="text-xs font-semibold text-emerald-600">✓{r.present}</span>
                      <span className="text-xs font-semibold text-red-500">✗{r.absent}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        r.rate >= 80 ? 'bg-emerald-100 text-emerald-700' :
                        r.rate >= 50 ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>{r.rate}%</span>
                    </>
                  ) : r.classStarted === false ? (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700">Kutilmoqda</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">Olinmagan</span>
                  )}
                </div>
              </div>
            );

            return (
              <div className="space-y-4">
                {completedRows.length > 0 && (
                  <div className="space-y-2">
                    {completedRows.map(renderGroupRow)}
                  </div>
                )}

                {waitingRows.length > 0 && (
                  <div className="space-y-2">
                    {completedRows.length > 0 && <div className="border-t my-1" />}
                    {waitingRows.map(renderGroupRow)}
                  </div>
                )}

                {notTakenRows.length > 0 && attendancePeriod === 'day' && (
                  <div className="pt-2 border-t">
                    <p className="text-xs font-semibold text-red-600 mb-2 flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5" />
                      Davomat olinmagan ({notTakenRows.length})
                    </p>
                    <div className="space-y-1.5">
                      {notTakenRows.map((r: any) => (
                        <div key={r.groupId} className="flex items-center justify-between px-3 py-2 rounded-lg bg-red-50 border border-red-100 text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-red-200 flex items-center justify-center text-red-700 text-[10px] font-bold">
                              {r.teacherInitials}
                            </div>
                            <span className="font-medium text-red-700">{r.groupName}</span>
                            <span className="text-red-500">{r.groupTime}</span>
                          </div>
                          <span className="text-red-500">{r.teacherName}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {groupRows.length === 0 && (
                  <div className="text-center py-6 text-muted-foreground">
                    <CalendarDays className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Bu {attendancePeriod === 'day' ? 'kunda' : attendancePeriod === 'week' ? 'haftada' : 'oyda'} darslar yo'q</p>
                  </div>
                )}
              </div>
            );
          })()}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">

        <Card className="card-modern animate-slide-up" style={{ animationDelay: '500ms' }}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <TrendingUp className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Samaradorlik</CardTitle>
                <p className="text-sm text-muted-foreground">Asosiy ko'rsatkichlar</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Davomat</span>
                <span className="text-sm text-muted-foreground">{metrics.attendanceRate}%</span>
              </div>
              <Progress value={metrics.attendanceRate} className="h-2" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">To'lov yig'ilishi</span>
                <span className="text-sm text-muted-foreground">{metrics.paymentRate}%</span>
              </div>
              <Progress value={metrics.paymentRate} className="h-2" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Lid konversiyasi</span>
                <span className="text-sm text-muted-foreground">{metrics.conversionRate}%</span>
              </div>
              <Progress value={metrics.conversionRate} className="h-2" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">O'quvchi saqlanishi</span>
                <span className="text-sm text-muted-foreground">{metrics.retentionRate}%</span>
              </div>
              <Progress value={metrics.retentionRate} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card className="card-modern animate-slide-up" style={{ animationDelay: '600ms' }}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <Wallet className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Moliyaviy xulosa</CardTitle>
                <p className="text-sm text-muted-foreground">{monthNames.find(m => m.value === selectedMonth)?.label} {selectedYear}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
              <span className="text-sm text-muted-foreground">Jami tushum</span>
              <span className="font-bold text-emerald-500">{formatMoney(financial.monthlyIncome)}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
              <span className="text-sm text-muted-foreground">Kutilayotgan to'lov</span>
              <span className="font-bold text-amber-500">{formatMoney(financial.expectedPayments)}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 border border-red-500/10">
              <span className="text-sm text-muted-foreground">Qarzdorlik</span>
              <span className="font-bold text-red-500">{formatMoney(financial.totalDebt)}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
              <span className="text-sm text-muted-foreground">O'rtacha to'lov</span>
              <span className="font-bold text-blue-500">{formatMoney(financial.avgPayment)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
