import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  GraduationCap, Users, Calendar, LogOut, Plus, Check, X, Clock, 
  UserPlus, Edit, ArrowRightLeft, BookOpen, TrendingUp, Sparkles,
  CheckCircle2, XCircle, AlertCircle, ChevronRight, BarChart2, FileDown
} from "lucide-react";
import jsPDF from "jspdf";
import "jspdf-autotable";

export default function TeacherDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [teacherName, setTeacherName] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [isGroupOpen, setIsGroupOpen] = useState(false);
  const [isStudentOpen, setIsStudentOpen] = useState(false);
  const [isEditStudentOpen, setIsEditStudentOpen] = useState(false);
  const [isMoveStudentOpen, setIsMoveStudentOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [groupForm, setGroupForm] = useState({
    name: "",
    level: "Beginner",
    days: ["Dushanba", "Chorshanba", "Juma"],
    time: "14:00 - 15:30",
    room: "",
    maxStudents: 15,
  });

  const [studentForm, setStudentForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    parentPhone: "",
    groupId: "",
  });

  const [moveToGroupId, setMoveToGroupId] = useState("");

  // Statistika uchun
  const [statsMonth, setStatsMonth] = useState(new Date().getMonth() + 1);
  const [statsYear, setStatsYear] = useState(new Date().getFullYear());
  const [statsGroupId, setStatsGroupId] = useState<number | null>(null);

  // Ko'chirish (barcha o'quvchilar orasida)
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [transferStudent, setTransferStudent] = useState<any>(null);
  const [transferFromGroup, setTransferFromGroup] = useState("");
  const [transferToGroup, setTransferToGroup] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("teacherToken");
    const name = localStorage.getItem("teacherName");
    const id = localStorage.getItem("teacherId");
    
    if (!token) {
      setLocation("/teacher-login");
      return;
    }
    
    setTeacherName(name || "O'qituvchi");
    setTeacherId(id || "");
  }, [setLocation]);

  const { data: groupsData } = useQuery({
    queryKey: ["teacher-groups", teacherId],
    queryFn: async () => {
      const res = await fetch(`/api/teacher/${teacherId}/groups`);
      return res.json();
    },
    enabled: !!teacherId,
  });
  const groups = (groupsData || []) as any[];

  const { data: subjectsData } = useQuery({
    queryKey: ["subjects"],
    queryFn: async () => {
      const res = await fetch("/api/subjects");
      return res.json();
    },
  });
  const subjects = (subjectsData || []) as any[];

  const { data: studentsData } = useQuery({
    queryKey: ["group-students", selectedGroup],
    queryFn: async () => {
      const res = await fetch(`/api/groups/${selectedGroup}/students`);
      return res.json();
    },
    enabled: !!selectedGroup,
  });
  const groupStudents = (studentsData || []) as any[];

  const { data: allStudentsData } = useQuery({
    queryKey: ["teacher-all-students", teacherId],
    queryFn: async () => {
      const res = await fetch(`/api/teacher/${teacherId}/students`);
      return res.json();
    },
    enabled: !!teacherId,
  });
  const allStudents = (allStudentsData || []) as any[];

  const { data: attendanceData } = useQuery({
    queryKey: ["attendance", selectedGroup, attendanceDate],
    queryFn: async () => {
      const res = await fetch(`/api/attendance?groupId=${selectedGroup}&date=${attendanceDate}`);
      return res.json();
    },
    enabled: !!selectedGroup,
  });
  const attendance = (attendanceData || []) as any[];

  const { data: statsAttendanceRaw } = useQuery({
    queryKey: ["teacher-stats-attendance", statsGroupId, statsMonth, statsYear],
    queryFn: async () => {
      const res = await fetch(`/api/attendance?groupId=${statsGroupId}&month=${statsMonth}&year=${statsYear}`);
      return res.json();
    },
    enabled: !!statsGroupId,
  });
  const statsAttendance = (statsAttendanceRaw || []) as any[];

  const { data: statsStudentsRaw } = useQuery({
    queryKey: ["stats-group-students", statsGroupId],
    queryFn: async () => {
      const res = await fetch(`/api/groups/${statsGroupId}/students`);
      return res.json();
    },
    enabled: !!statsGroupId,
  });
  const statsStudents = (statsStudentsRaw || []) as any[];

  // Transfer student (barcha guruhdan)
  const { data: transferGroupStudentsRaw } = useQuery({
    queryKey: ["transfer-group-students", transferFromGroup],
    queryFn: async () => {
      const res = await fetch(`/api/groups/${transferFromGroup}/students`);
      return res.json();
    },
    enabled: !!transferFromGroup,
  });
  const transferGroupStudents = (transferGroupStudentsRaw || []) as any[];

  const createGroupMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, teacherId, subjectId: subjects[0]?.id || 1 }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-groups"] });
      setIsGroupOpen(false);
      setGroupForm({ name: "", level: "Beginner", days: [], time: "14:00 - 15:30", room: "", maxStudents: 15 });
      toast({ title: "Muvaffaqiyat", description: "Guruh yaratildi" });
    },
  });

  const createStudentMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/teacher/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-all-students"] });
      queryClient.invalidateQueries({ queryKey: ["group-students"] });
      setIsStudentOpen(false);
      setStudentForm({ firstName: "", lastName: "", phone: "", parentPhone: "", groupId: "" });
      toast({ title: "Muvaffaqiyat", description: "O'quvchi qo'shildi" });
    },
  });

  const updateStudentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await fetch(`/api/teacher/students/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-all-students"] });
      queryClient.invalidateQueries({ queryKey: ["group-students"] });
      setIsEditStudentOpen(false);
      setSelectedStudent(null);
      toast({ title: "Muvaffaqiyat", description: "O'quvchi tahrirlandi" });
    },
  });

  const moveStudentMutation = useMutation({
    mutationFn: async ({ studentId, fromGroupId, toGroupId }: { studentId: number; fromGroupId: number; toGroupId: number }) => {
      const res = await fetch("/api/teacher/move-student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, fromGroupId, toGroupId }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-students"] });
      queryClient.invalidateQueries({ queryKey: ["teacher-all-students"] });
      setIsMoveStudentOpen(false);
      setSelectedStudent(null);
      setMoveToGroupId("");
      toast({ title: "Muvaffaqiyat", description: "O'quvchi boshqa guruhga o'tkazildi" });
    },
  });

  const markAttendanceMutation = useMutation({
    mutationFn: async ({ studentId, status }: { studentId: number; status: string }) => {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          groupId: selectedGroup,
          date: attendanceDate,
          status,
        }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      toast({ title: "Muvaffaqiyat", description: "Davomat belgilandi" });
    },
  });

  const handleLogout = () => {
    localStorage.removeItem("teacherToken");
    localStorage.removeItem("teacherId");
    localStorage.removeItem("teacherName");
    setLocation("/teacher-login");
  };

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    createGroupMutation.mutate(groupForm);
  };

  const handleCreateStudent = (e: React.FormEvent) => {
    e.preventDefault();
    createStudentMutation.mutate(studentForm);
  };

  const handleUpdateStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStudent) {
      updateStudentMutation.mutate({
        id: selectedStudent.id,
        data: {
          firstName: studentForm.firstName,
          lastName: studentForm.lastName,
          phone: studentForm.phone,
          parentPhone: studentForm.parentPhone,
        },
      });
    }
  };

  const handleMoveStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStudent && selectedGroup && moveToGroupId) {
      moveStudentMutation.mutate({
        studentId: selectedStudent.id,
        fromGroupId: selectedGroup,
        toGroupId: parseInt(moveToGroupId),
      });
    }
  };

  const openEditStudent = (student: any) => {
    setSelectedStudent(student);
    setStudentForm({
      firstName: student.firstName,
      lastName: student.lastName,
      phone: student.phone || "",
      parentPhone: student.parentPhone || "",
      groupId: "",
    });
    setIsEditStudentOpen(true);
  };

  const openMoveStudent = (student: any) => {
    setSelectedStudent(student);
    setIsMoveStudentOpen(true);
  };

  const handleTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (transferStudent && transferFromGroup && transferToGroup) {
      moveStudentMutation.mutate({
        studentId: transferStudent.id,
        fromGroupId: parseInt(transferFromGroup),
        toGroupId: parseInt(transferToGroup),
      });
      setIsTransferOpen(false);
      setTransferStudent(null);
      setTransferFromGroup("");
      setTransferToGroup("");
    }
  };

  const getStudentStats = (studentId: number) => {
    const records = statsAttendance.filter((a: any) => a.studentId === studentId);
    const present = records.filter((a: any) => a.status === "present").length;
    const absent = records.filter((a: any) => a.status === "absent").length;
    const late = records.filter((a: any) => a.status === "late").length;
    const total = records.length;
    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
    return { present, absent, late, total, rate };
  };

  const monthNames = [
    "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
    "Iyul", "Avgust", "Sentabr", "Oktyabr", "Noyabr", "Dekabr"
  ];

  const generateAttendancePDF = () => {
    const doc = new jsPDF();
    const selectedGroupObj = groups.find((g: any) => g.id === statsGroupId);
    const monthLabel = monthNames[statsMonth - 1];

    doc.setFontSize(18);
    doc.text("DAVOMAT HISOBOTI", 14, 20);
    doc.setFontSize(12);
    doc.text(`Guruh: ${selectedGroupObj?.name || ""}`, 14, 32);
    doc.text(`O'qituvchi: ${teacherName}`, 14, 40);
    doc.text(`Oy: ${monthLabel} ${statsYear}`, 14, 48);

    const tableData = statsStudents.map((s: any, i: number) => {
      const st = getStudentStats(s.id);
      return [
        i + 1,
        `${s.firstName} ${s.lastName}`,
        st.present,
        st.absent,
        st.late,
        st.total,
        `${st.rate}%`,
      ];
    });

    (doc as any).autoTable({
      startY: 56,
      head: [["#", "O'quvchi", "Bor", "Yo'q", "Kech", "Jami", "%"]],
      body: tableData,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [102, 126, 234] },
      alternateRowStyles: { fillColor: [245, 247, 255] },
    });

    // Umumiy statistika qo'shish
    const totalPresent = statsStudents.reduce((acc: number, s: any) => acc + getStudentStats(s.id).present, 0);
    const totalAbsent = statsStudents.reduce((acc: number, s: any) => acc + getStudentStats(s.id).absent, 0);
    const totalLate = statsStudents.reduce((acc: number, s: any) => acc + getStudentStats(s.id).late, 0);
    const finalY = (doc as any).lastAutoTable?.finalY || 60;
    doc.setFontSize(11);
    doc.text(`Jami: Bor - ${totalPresent}, Yo'q - ${totalAbsent}, Kech - ${totalLate}`, 14, finalY + 10);

    doc.save(`davomat_${selectedGroupObj?.name}_${monthLabel}_${statsYear}.pdf`);
  };

  const getAttendanceStatus = (studentId: number) => {
    const record = attendance.find((a: any) => a.studentId === studentId);
    return record?.status || null;
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Xayrli tong";
    if (hour < 18) return "Xayrli kun";
    return "Xayrli kech";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20">
      {/* Modern Header */}
      <header className="sticky top-0 z-50 glass border-b border-white/20">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/25">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="font-bold text-lg">Zamonaviy-Edu</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> {teacherName}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="hover:bg-red-50 hover:text-red-600">
            <LogOut className="w-4 h-4 mr-2" /> Chiqish
          </Button>
        </div>
      </header>

      <main className="container py-6 px-4 space-y-6">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-2xl gradient-hero p-6 md:p-8 text-white">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full -ml-24 -mb-24 blur-2xl" />
          <div className="relative z-10">
            <p className="text-white/80 text-sm mb-1">{getGreeting()}</p>
            <h1 className="text-2xl md:text-3xl font-bold mb-2">{teacherName}</h1>
            <p className="text-white/70 text-sm">
              {new Date().toLocaleDateString('uz-UZ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          
          {/* Quick Stats */}
          <div className="relative z-10 grid grid-cols-3 gap-4 mt-6">
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 text-center">
              <p className="text-3xl font-bold">{groups.length}</p>
              <p className="text-xs text-white/70">Guruhlar</p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 text-center">
              <p className="text-3xl font-bold">{allStudents.length}</p>
              <p className="text-xs text-white/70">O'quvchilar</p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 text-center">
              <p className="text-3xl font-bold">85%</p>
              <p className="text-xs text-white/70">Davomat</p>
            </div>
          </div>
        </div>

        {/* Modern Tabs */}
        <Tabs defaultValue="attendance" className="space-y-6">
          <TabsList className="glass-card p-1 h-auto flex-wrap">
            <TabsTrigger value="groups" className="flex items-center gap-2 data-[state=active]:gradient-primary data-[state=active]:text-white rounded-lg px-4 py-2.5 transition-all">
              <Users className="w-4 h-4" /> Guruhlarim
            </TabsTrigger>
            <TabsTrigger value="students" className="flex items-center gap-2 data-[state=active]:gradient-primary data-[state=active]:text-white rounded-lg px-4 py-2.5 transition-all">
              <UserPlus className="w-4 h-4" /> O'quvchilar
            </TabsTrigger>
            <TabsTrigger value="attendance" className="flex items-center gap-2 data-[state=active]:gradient-primary data-[state=active]:text-white rounded-lg px-4 py-2.5 transition-all">
              <Calendar className="w-4 h-4" /> Davomat
            </TabsTrigger>
            <TabsTrigger value="statistics" className="flex items-center gap-2 data-[state=active]:gradient-primary data-[state=active]:text-white rounded-lg px-4 py-2.5 transition-all">
              <BarChart2 className="w-4 h-4" /> Statistika
            </TabsTrigger>
          </TabsList>

          {/* Groups Tab */}
          <TabsContent value="groups" className="space-y-4 animate-slide-up">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Mening guruhlarim</h2>
              <Dialog open={isGroupOpen} onOpenChange={setIsGroupOpen}>
                <DialogTrigger asChild>
                  <Button className="gradient-primary shadow-lg shadow-primary/25 hover-lift" data-testid="button-add-group">
                    <Plus className="w-4 h-4 mr-2" /> Guruh yaratish
                  </Button>
                </DialogTrigger>
                <DialogContent className="glass-card border-0">
                  <DialogHeader>
                    <DialogTitle>Yangi guruh yaratish</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateGroup} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Guruh nomi</Label>
                      <Input
                        value={groupForm.name}
                        onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                        placeholder="English Beginners"
                        className="bg-white/50"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Daraja</Label>
                        <Select value={groupForm.level} onValueChange={(v) => setGroupForm({ ...groupForm, level: v })}>
                          <SelectTrigger className="bg-white/50">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Beginner">Boshlang'ich</SelectItem>
                            <SelectItem value="Intermediate">O'rta</SelectItem>
                            <SelectItem value="Advanced">Yuqori</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Xona</Label>
                        <Input
                          value={groupForm.room}
                          onChange={(e) => setGroupForm({ ...groupForm, room: e.target.value })}
                          placeholder="Xona 1"
                          className="bg-white/50"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Dars vaqti</Label>
                      <Input
                        value={groupForm.time}
                        onChange={(e) => setGroupForm({ ...groupForm, time: e.target.value })}
                        placeholder="14:00 - 15:30"
                        className="bg-white/50"
                      />
                    </div>
                    <Button type="submit" className="w-full gradient-primary" disabled={createGroupMutation.isPending}>
                      {createGroupMutation.isPending ? "Yaratilmoqda..." : "Yaratish"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {groups.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {groups.map((group: any, index: number) => (
                  <Card 
                    key={group.id} 
                    className={`card-modern cursor-pointer hover-lift border-l-4 border-l-primary animate-slide-up`}
                    style={{ animationDelay: `${index * 100}ms` }}
                    onClick={() => setSelectedGroup(group.id)}
                    data-testid={`card-group-${group.id}`}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{group.name}</CardTitle>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                        <Clock className="w-4 h-4 text-primary" />
                        <span>{group.time}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <Badge className="bg-primary/10 text-primary hover:bg-primary/20">{group.level}</Badge>
                        <span className="text-xs text-muted-foreground">{group.room}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="card-modern">
                <CardContent className="p-12 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                    <BookOpen className="w-8 h-8 text-primary" />
                  </div>
                  <p className="text-muted-foreground mb-4">Hozircha guruhlaringiz yo'q</p>
                  <Button onClick={() => setIsGroupOpen(true)} className="gradient-primary">
                    <Plus className="w-4 h-4 mr-2" /> Birinchi guruhni yarating
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Students Tab */}
          <TabsContent value="students" className="space-y-4 animate-slide-up">
            <div className="flex flex-col sm:flex-row justify-between gap-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground text-sm">Guruhni tanlang</Label>
                <Select value={selectedGroup?.toString() || ""} onValueChange={(v) => setSelectedGroup(parseInt(v))}>
                  <SelectTrigger className="w-[220px] bg-white/80">
                    <SelectValue placeholder="Guruhni tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((g: any) => (
                      <SelectItem key={g.id} value={g.id.toString()}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="hover:bg-amber-50 hover:text-amber-600 hover:border-amber-300 shadow-sm"
                  onClick={() => setIsTransferOpen(true)}
                  data-testid="button-transfer-student"
                >
                  <ArrowRightLeft className="w-4 h-4 mr-2" /> Ko'chirish
                </Button>
                <Dialog open={isStudentOpen} onOpenChange={setIsStudentOpen}>
                <DialogTrigger asChild>
                  <Button className="gradient-primary shadow-lg shadow-primary/25 hover-lift" data-testid="button-add-student">
                    <UserPlus className="w-4 h-4 mr-2" /> O'quvchi qo'shish
                  </Button>
                </DialogTrigger>
                <DialogContent className="glass-card border-0">
                  <DialogHeader>
                    <DialogTitle>Yangi o'quvchi qo'shish</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateStudent} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Ism</Label>
                        <Input
                          value={studentForm.firstName}
                          onChange={(e) => setStudentForm({ ...studentForm, firstName: e.target.value })}
                          className="bg-white/50"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Familiya</Label>
                        <Input
                          value={studentForm.lastName}
                          onChange={(e) => setStudentForm({ ...studentForm, lastName: e.target.value })}
                          className="bg-white/50"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Telefon</Label>
                      <Input
                        value={studentForm.phone}
                        onChange={(e) => setStudentForm({ ...studentForm, phone: e.target.value })}
                        placeholder="+998 90 123 45 67"
                        className="bg-white/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Ota-ona telefoni</Label>
                      <Input
                        value={studentForm.parentPhone}
                        onChange={(e) => setStudentForm({ ...studentForm, parentPhone: e.target.value })}
                        placeholder="+998 90 123 45 67"
                        className="bg-white/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Guruh</Label>
                      <Select value={studentForm.groupId} onValueChange={(v) => setStudentForm({ ...studentForm, groupId: v })}>
                        <SelectTrigger className="bg-white/50">
                          <SelectValue placeholder="Guruhni tanlang" />
                        </SelectTrigger>
                        <SelectContent>
                          {groups.map((g: any) => (
                            <SelectItem key={g.id} value={g.id.toString()}>{g.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="submit" className="w-full gradient-primary" disabled={createStudentMutation.isPending}>
                      {createStudentMutation.isPending ? "Qo'shilmoqda..." : "Qo'shish"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
              </div>
            </div>

            {selectedGroup ? (
              <Card className="card-modern overflow-hidden">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="font-semibold">O'quvchi</TableHead>
                        <TableHead className="font-semibold">Telefon</TableHead>
                        <TableHead className="font-semibold">Ota-ona</TableHead>
                        <TableHead className="text-right font-semibold">Amallar</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupStudents.length > 0 ? (
                        groupStudents.map((student: any, index: number) => (
                          <TableRow key={student.id} className="hover:bg-primary/5 transition-colors">
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full gradient-purple flex items-center justify-center text-white text-sm font-medium">
                                  {student.firstName?.[0]}{student.lastName?.[0]}
                                </div>
                                <span className="font-medium">{student.firstName} {student.lastName}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{student.phone}</TableCell>
                            <TableCell className="text-muted-foreground">{student.parentPhone}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button size="sm" variant="outline" className="hover:bg-primary/10 hover:text-primary hover:border-primary" onClick={() => openEditStudent(student)}>
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="outline" className="hover:bg-amber-50 hover:text-amber-600 hover:border-amber-300" onClick={() => openMoveStudent(student)}>
                                  <ArrowRightLeft className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                            <Users className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                            Bu guruhda o'quvchilar yo'q
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : (
              <Card className="card-modern">
                <CardContent className="p-12 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500/10 flex items-center justify-center">
                    <Users className="w-8 h-8 text-amber-500" />
                  </div>
                  <p className="text-muted-foreground">O'quvchilarni ko'rish uchun guruhni tanlang</p>
                </CardContent>
              </Card>
            )}

            {/* Edit Student Dialog */}
            <Dialog open={isEditStudentOpen} onOpenChange={setIsEditStudentOpen}>
              <DialogContent className="glass-card border-0">
                <DialogHeader>
                  <DialogTitle>O'quvchini tahrirlash</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleUpdateStudent} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Ism</Label>
                      <Input
                        value={studentForm.firstName}
                        onChange={(e) => setStudentForm({ ...studentForm, firstName: e.target.value })}
                        className="bg-white/50"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Familiya</Label>
                      <Input
                        value={studentForm.lastName}
                        onChange={(e) => setStudentForm({ ...studentForm, lastName: e.target.value })}
                        className="bg-white/50"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Telefon</Label>
                    <Input
                      value={studentForm.phone}
                      onChange={(e) => setStudentForm({ ...studentForm, phone: e.target.value })}
                      className="bg-white/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Ota-ona telefoni</Label>
                    <Input
                      value={studentForm.parentPhone}
                      onChange={(e) => setStudentForm({ ...studentForm, parentPhone: e.target.value })}
                      className="bg-white/50"
                    />
                  </div>
                  <Button type="submit" className="w-full gradient-primary" disabled={updateStudentMutation.isPending}>
                    {updateStudentMutation.isPending ? "Saqlanmoqda..." : "Saqlash"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

            {/* Move Student Dialog */}
            <Dialog open={isMoveStudentOpen} onOpenChange={setIsMoveStudentOpen}>
              <DialogContent className="glass-card border-0">
                <DialogHeader>
                  <DialogTitle>O'quvchini boshqa guruhga o'tkazish</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleMoveStudent} className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{selectedStudent?.firstName} {selectedStudent?.lastName}</span> ni qaysi guruhga o'tkazmoqchisiz?
                  </p>
                  <div className="space-y-2">
                    <Label>Yangi guruh</Label>
                    <Select value={moveToGroupId} onValueChange={setMoveToGroupId}>
                      <SelectTrigger className="bg-white/50">
                        <SelectValue placeholder="Guruhni tanlang" />
                      </SelectTrigger>
                      <SelectContent>
                        {groups.filter((g: any) => g.id !== selectedGroup).map((g: any) => (
                          <SelectItem key={g.id} value={g.id.toString()}>{g.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full gradient-warning text-white" disabled={moveStudentMutation.isPending}>
                    {moveStudentMutation.isPending ? "O'tkazilmoqda..." : "O'tkazish"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* Attendance Tab */}
          <TabsContent value="attendance" className="space-y-4 animate-slide-up">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground text-sm">Guruh</Label>
                <Select value={selectedGroup?.toString() || ""} onValueChange={(v) => setSelectedGroup(parseInt(v))}>
                  <SelectTrigger className="w-[220px] bg-white/80">
                    <SelectValue placeholder="Guruhni tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((g: any) => (
                      <SelectItem key={g.id} value={g.id.toString()}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground text-sm">Sana</Label>
                <Input
                  type="date"
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                  className="w-[180px] bg-white/80"
                />
              </div>
            </div>

            {selectedGroup ? (
              <Card className="card-modern overflow-hidden">
                <CardHeader className="border-b bg-muted/30">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Davomat jadvali</CardTitle>
                    <Badge variant="outline" className="bg-white">
                      {new Date(attendanceDate).toLocaleDateString('uz-UZ', { day: 'numeric', month: 'long' })}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {groupStudents.length > 0 ? (
                      groupStudents.map((student: any) => {
                        const status = getAttendanceStatus(student.id);
                        return (
                          <div key={student.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full gradient-info flex items-center justify-center text-white text-sm font-medium">
                                {student.firstName?.[0]}{student.lastName?.[0]}
                              </div>
                              <div>
                                <p className="font-medium">{student.firstName} {student.lastName}</p>
                                <p className="text-xs text-muted-foreground">{student.phone}</p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant={status === "present" ? "default" : "outline"}
                                className={status === "present" ? "gradient-success border-0 text-white shadow-lg shadow-green-500/25" : "hover:bg-green-50 hover:text-green-600 hover:border-green-300"}
                                onClick={() => markAttendanceMutation.mutate({ studentId: student.id, status: "present" })}
                              >
                                <CheckCircle2 className="w-4 h-4 mr-1" /> Bor
                              </Button>
                              <Button
                                size="sm"
                                variant={status === "absent" ? "default" : "outline"}
                                className={status === "absent" ? "bg-red-500 border-0 text-white shadow-lg shadow-red-500/25" : "hover:bg-red-50 hover:text-red-600 hover:border-red-300"}
                                onClick={() => markAttendanceMutation.mutate({ studentId: student.id, status: "absent" })}
                              >
                                <XCircle className="w-4 h-4 mr-1" /> Yo'q
                              </Button>
                              <Button
                                size="sm"
                                variant={status === "late" ? "default" : "outline"}
                                className={status === "late" ? "gradient-warning border-0 text-white shadow-lg shadow-amber-500/25" : "hover:bg-amber-50 hover:text-amber-600 hover:border-amber-300"}
                                onClick={() => markAttendanceMutation.mutate({ studentId: student.id, status: "late" })}
                              >
                                <AlertCircle className="w-4 h-4 mr-1" /> Kech
                              </Button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-12 text-center text-muted-foreground">
                        <Calendar className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                        Bu guruhda o'quvchilar yo'q
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="card-modern">
                <CardContent className="p-12 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                    <Calendar className="w-8 h-8 text-primary" />
                  </div>
                  <p className="text-muted-foreground">Davomat belgilash uchun guruhni tanlang</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Statistika Tab */}
          <TabsContent value="statistics" className="space-y-4 animate-slide-up">
            <div className="flex flex-col sm:flex-row gap-4 items-end flex-wrap">
              <div className="space-y-2">
                <Label className="text-muted-foreground text-sm">Guruh</Label>
                <Select value={statsGroupId?.toString() || ""} onValueChange={(v) => setStatsGroupId(parseInt(v))}>
                  <SelectTrigger className="w-[200px] bg-white/80" data-testid="select-stats-group">
                    <SelectValue placeholder="Guruhni tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((g: any) => (
                      <SelectItem key={g.id} value={g.id.toString()}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground text-sm">Oy</Label>
                <Select value={statsMonth.toString()} onValueChange={(v) => setStatsMonth(parseInt(v))}>
                  <SelectTrigger className="w-[150px] bg-white/80" data-testid="select-stats-month">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {monthNames.map((m, i) => (
                      <SelectItem key={i + 1} value={(i + 1).toString()}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground text-sm">Yil</Label>
                <Select value={statsYear.toString()} onValueChange={(v) => setStatsYear(parseInt(v))}>
                  <SelectTrigger className="w-[110px] bg-white/80" data-testid="select-stats-year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2023, 2024, 2025, 2026, 2027].map((y) => (
                      <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {statsGroupId && statsStudents.length > 0 && (
                <Button onClick={generateAttendancePDF} className="gradient-primary shadow-lg shadow-primary/25 hover-lift" data-testid="button-download-pdf">
                  <FileDown className="w-4 h-4 mr-2" /> PDF yuklab olish
                </Button>
              )}
            </div>

            {statsGroupId ? (
              statsStudents.length > 0 ? (
                <div className="space-y-4">
                  {/* Umumiy kartalar */}
                  <div className="grid grid-cols-3 gap-4">
                    {(() => {
                      const totalPresent = statsStudents.reduce((acc: number, s: any) => acc + getStudentStats(s.id).present, 0);
                      const totalAbsent = statsStudents.reduce((acc: number, s: any) => acc + getStudentStats(s.id).absent, 0);
                      const totalLate = statsStudents.reduce((acc: number, s: any) => acc + getStudentStats(s.id).late, 0);
                      return (
                        <>
                          <Card className="card-modern border-l-4 border-l-green-500">
                            <CardContent className="p-4 text-center">
                              <p className="text-3xl font-bold text-green-600">{totalPresent}</p>
                              <p className="text-xs text-muted-foreground mt-1">Bor</p>
                            </CardContent>
                          </Card>
                          <Card className="card-modern border-l-4 border-l-red-500">
                            <CardContent className="p-4 text-center">
                              <p className="text-3xl font-bold text-red-600">{totalAbsent}</p>
                              <p className="text-xs text-muted-foreground mt-1">Yo'q</p>
                            </CardContent>
                          </Card>
                          <Card className="card-modern border-l-4 border-l-amber-500">
                            <CardContent className="p-4 text-center">
                              <p className="text-3xl font-bold text-amber-600">{totalLate}</p>
                              <p className="text-xs text-muted-foreground mt-1">Kech</p>
                            </CardContent>
                          </Card>
                        </>
                      );
                    })()}
                  </div>

                  {/* O'quvchilar jadvali */}
                  <Card className="card-modern overflow-hidden">
                    <CardHeader className="border-b bg-muted/30">
                      <CardTitle className="text-lg">
                        {groups.find((g: any) => g.id === statsGroupId)?.name} — {monthNames[statsMonth - 1]} {statsYear}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead className="font-semibold">#</TableHead>
                            <TableHead className="font-semibold">O'quvchi</TableHead>
                            <TableHead className="text-center font-semibold text-green-700">Bor</TableHead>
                            <TableHead className="text-center font-semibold text-red-700">Yo'q</TableHead>
                            <TableHead className="text-center font-semibold text-amber-700">Kech</TableHead>
                            <TableHead className="text-center font-semibold">Jami</TableHead>
                            <TableHead className="text-center font-semibold">%</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {statsStudents.map((student: any, index: number) => {
                            const st = getStudentStats(student.id);
                            return (
                              <TableRow key={student.id} className="hover:bg-primary/5 transition-colors" data-testid={`row-stats-${student.id}`}>
                                <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full gradient-purple flex items-center justify-center text-white text-xs font-medium">
                                      {student.firstName?.[0]}{student.lastName?.[0]}
                                    </div>
                                    <span className="font-medium">{student.firstName} {student.lastName}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100">{st.present}</Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge className="bg-red-100 text-red-700 hover:bg-red-100">{st.absent}</Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">{st.late}</Badge>
                                </TableCell>
                                <TableCell className="text-center text-muted-foreground">{st.total}</TableCell>
                                <TableCell className="text-center">
                                  <div className="flex items-center gap-2 justify-center">
                                    <Progress value={st.rate} className="w-12 h-2" />
                                    <span className={`text-sm font-semibold ${st.rate >= 80 ? "text-green-600" : st.rate >= 60 ? "text-amber-600" : "text-red-600"}`}>
                                      {st.rate}%
                                    </span>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <Card className="card-modern">
                  <CardContent className="p-12 text-center">
                    <BarChart2 className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                    <p className="text-muted-foreground">Bu guruhda o'quvchilar yoki davomat ma'lumotlari yo'q</p>
                  </CardContent>
                </Card>
              )
            ) : (
              <Card className="card-modern">
                <CardContent className="p-12 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                    <BarChart2 className="w-8 h-8 text-primary" />
                  </div>
                  <p className="text-muted-foreground">Statistikani ko'rish uchun guruh tanlang</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Ko'chirish (Transfer) dialogi — global */}
        <Dialog open={isTransferOpen} onOpenChange={(o) => { setIsTransferOpen(o); if (!o) { setTransferStudent(null); setTransferFromGroup(""); setTransferToGroup(""); } }}>
          <DialogContent className="glass-card border-0">
            <DialogHeader>
              <DialogTitle>O'quvchini guruhdan guruhga ko'chirish</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleTransfer} className="space-y-4">
              <div className="space-y-2">
                <Label>Qaysi guruhdan</Label>
                <Select value={transferFromGroup} onValueChange={(v) => { setTransferFromGroup(v); setTransferStudent(null); setTransferToGroup(""); }} data-testid="select-transfer-from">
                  <SelectTrigger className="bg-white/50">
                    <SelectValue placeholder="Guruhni tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((g: any) => (
                      <SelectItem key={g.id} value={g.id.toString()}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {transferFromGroup && (
                <div className="space-y-2">
                  <Label>O'quvchi</Label>
                  <Select value={transferStudent?.id?.toString() || ""} onValueChange={(v) => setTransferStudent(transferGroupStudents.find((s: any) => s.id === parseInt(v)))} data-testid="select-transfer-student">
                    <SelectTrigger className="bg-white/50">
                      <SelectValue placeholder="O'quvchini tanlang" />
                    </SelectTrigger>
                    <SelectContent>
                      {transferGroupStudents.map((s: any) => (
                        <SelectItem key={s.id} value={s.id.toString()}>{s.firstName} {s.lastName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {transferStudent && (
                <div className="space-y-2">
                  <Label>Yangi guruh</Label>
                  <Select value={transferToGroup} onValueChange={setTransferToGroup} data-testid="select-transfer-to">
                    <SelectTrigger className="bg-white/50">
                      <SelectValue placeholder="Yangi guruhni tanlang" />
                    </SelectTrigger>
                    <SelectContent>
                      {groups.filter((g: any) => g.id.toString() !== transferFromGroup).map((g: any) => (
                        <SelectItem key={g.id} value={g.id.toString()}>{g.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {transferStudent && transferToGroup && (
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-sm">
                  <span className="font-medium text-amber-800">{transferStudent.firstName} {transferStudent.lastName}</span>
                  <span className="text-amber-600"> — {groups.find((g: any) => g.id.toString() === transferFromGroup)?.name} → {groups.find((g: any) => g.id.toString() === transferToGroup)?.name}</span>
                </div>
              )}

              <Button
                type="submit"
                className="w-full gradient-warning text-white"
                disabled={!transferStudent || !transferToGroup || moveStudentMutation.isPending}
                data-testid="button-confirm-transfer"
              >
                {moveStudentMutation.isPending ? "Ko'chirilmoqda..." : "Ko'chirish"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
