import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { translations } from "@/lib/i18n";
import { useStats } from "@/lib/api";
import { Users, GraduationCap, Wallet, TrendingUp, BookOpen, Clock, UserPlus, ArrowUpRight, ArrowDownRight, Sparkles, CalendarDays, Target } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, AreaChart, Area } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";

const monthlyData = [
  { name: "Yan", total: 15000000 },
  { name: "Fev", total: 22000000 },
  { name: "Mar", total: 18000000 },
  { name: "Apr", total: 28000000 },
  { name: "May", total: 35000000 },
  { name: "Iyun", total: 32000000 },
];

const attendanceData = [
  { name: "Bor", value: 85, color: "#22c55e" },
  { name: "Yo'q", value: 10, color: "#ef4444" },
  { name: "Kech", value: 5, color: "#f59e0b" },
];

interface DashboardStats {
  totalStudents: number;
  activeGroups: number;
  monthlyIncome: number;
  newLeads: number;
}

export default function Dashboard() {
  const { data: stats, isLoading } = useStats() as { data: DashboardStats | undefined; isLoading: boolean };

  if (isLoading) {
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

  const statsCards = [
    {
      title: "Jami o'quvchilar",
      value: stats?.totalStudents || 0,
      change: "+12%",
      changeType: "up",
      icon: Users,
      iconBg: "bg-blue-500/10",
      iconColor: "text-blue-500",
      description: "Faol o'quvchilar soni",
    },
    {
      title: "Faol guruhlar",
      value: stats?.activeGroups || 0,
      change: "+3",
      changeType: "up",
      icon: GraduationCap,
      iconBg: "bg-purple-500/10",
      iconColor: "text-purple-500",
      description: "Hozirda davom etmoqda",
    },
    {
      title: "Oylik tushum",
      value: `${((stats?.monthlyIncome || 0) / 1000000).toFixed(1)}M`,
      change: "+18%",
      changeType: "up",
      icon: Wallet,
      iconBg: "bg-emerald-500/10",
      iconColor: "text-emerald-500",
      description: "So'nggi 30 kun",
    },
    {
      title: "Yangi lidlar",
      value: stats?.newLeads || 0,
      change: "-5%",
      changeType: "down",
      icon: UserPlus,
      iconBg: "bg-amber-500/10",
      iconColor: "text-amber-500",
      description: "Bu oyda qabul",
    },
  ];

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Xayrli tong";
    if (hour < 18) return "Xayrli kun";
    return "Xayrli kech";
  };

  return (
    <div className="space-y-6 p-2">
      {/* Hero Header */}
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
          <div className="flex items-center gap-3 bg-white/20 backdrop-blur-sm px-4 py-2.5 rounded-xl">
            <CalendarDays className="h-5 w-5" />
            <span className="text-sm font-medium">
              {new Date().toLocaleDateString('uz-UZ', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
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

      {/* Charts Section */}
      <div className="grid gap-6 lg:grid-cols-7">
        {/* Revenue Chart */}
        <Card className="lg:col-span-4 card-modern animate-slide-up" style={{ animationDelay: '200ms' }}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold">Oylik tushum</CardTitle>
                <p className="text-sm text-muted-foreground">So'nggi 6 oy statistikasi</p>
              </div>
              <div className="flex items-center gap-2 text-emerald-500 text-sm font-medium">
                <TrendingUp className="h-4 w-4" />
                +18% o'sish
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} barSize={40}>
                  <XAxis
                    dataKey="name"
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${value / 1000000}M`}
                  />
                  <Tooltip 
                    cursor={{fill: 'rgba(0,0,0,0.05)', radius: 8}}
                    contentStyle={{ 
                      borderRadius: '12px', 
                      border: 'none', 
                      boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
                      padding: '12px 16px'
                    }}
                    formatter={(value: number) => [`${(value / 1000000).toFixed(1)}M so'm`, "Tushum"]}
                  />
                  <Bar
                    dataKey="total"
                    fill="url(#colorGradient)"
                    radius={[8, 8, 0, 0]}
                  />
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

        {/* Attendance Pie Chart */}
        <Card className="lg:col-span-3 card-modern animate-slide-up" style={{ animationDelay: '300ms' }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">Davomat statistikasi</CardTitle>
            <p className="text-sm text-muted-foreground">Bugungi holat</p>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={attendanceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {attendanceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '12px', 
                      border: 'none', 
                      boxShadow: '0 10px 40px rgba(0,0,0,0.12)' 
                    }}
                    formatter={(value: number) => [`${value}%`, ""]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 mt-4">
              {attendanceData.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-sm text-muted-foreground">{item.name}: {item.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Today's Classes */}
        <Card className="card-modern animate-slide-up" style={{ animationDelay: '400ms' }}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <BookOpen className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Bugungi darslar</CardTitle>
                <p className="text-sm text-muted-foreground">Jadval bo'yicha</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <p className="font-medium">Ingliz tili - Beginners</p>
                <p className="text-sm text-muted-foreground">09:00 - 10:30</p>
              </div>
              <span className="px-2 py-1 text-xs font-medium bg-emerald-500/10 text-emerald-500 rounded-full">Tugadi</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <p className="font-medium">Matematika - 8-sinf</p>
                <p className="text-sm text-muted-foreground">14:00 - 15:30</p>
              </div>
              <span className="px-2 py-1 text-xs font-medium bg-blue-500/10 text-blue-500 rounded-full">Hozir</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <p className="font-medium">Rus tili - Adults</p>
                <p className="text-sm text-muted-foreground">18:00 - 19:30</p>
              </div>
              <span className="px-2 py-1 text-xs font-medium bg-amber-500/10 text-amber-500 rounded-full">Kutilmoqda</span>
            </div>
          </CardContent>
        </Card>

        {/* Performance Metrics */}
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
                <span className="text-sm text-muted-foreground">85%</span>
              </div>
              <Progress value={85} className="h-2" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">To'lov yig'ilishi</span>
                <span className="text-sm text-muted-foreground">72%</span>
              </div>
              <Progress value={72} className="h-2" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Lid konversiyasi</span>
                <span className="text-sm text-muted-foreground">45%</span>
              </div>
              <Progress value={45} className="h-2" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">O'quvchi saqlanishi</span>
                <span className="text-sm text-muted-foreground">92%</span>
              </div>
              <Progress value={92} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* Quick Summary */}
        <Card className="card-modern animate-slide-up" style={{ animationDelay: '600ms' }}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <Wallet className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Moliyaviy xulosa</CardTitle>
                <p className="text-sm text-muted-foreground">Bu oy</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
              <span className="text-sm text-muted-foreground">Jami tushum</span>
              <span className="font-bold text-emerald-500">{((stats?.monthlyIncome || 0) / 1000000).toFixed(1)}M</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
              <span className="text-sm text-muted-foreground">Kutilayotgan to'lov</span>
              <span className="font-bold text-amber-500">12.5M</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 border border-red-500/10">
              <span className="text-sm text-muted-foreground">Qarzdorlik</span>
              <span className="font-bold text-red-500">8.2M</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
              <span className="text-sm text-muted-foreground">O'rtacha to'lov</span>
              <span className="font-bold text-blue-500">450K</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
