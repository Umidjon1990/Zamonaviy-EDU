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
  CheckCircle2, XCircle, AlertCircle, ChevronRight, BarChart2, FileDown,
  Banknote, SendHorizonal, CreditCard, AlertTriangle, BadgeCheck, Trash2
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
  const [deleteGroupId, setDeleteGroupId] = useState<number | null>(null);
  const [isDeleteGroupOpen, setIsDeleteGroupOpen] = useState(false);

  // To'lov yig'ish
  const [paymentForm, setPaymentForm] = useState({
    studentId: "",
    groupId: "",
    amount: "",
    paymentType: "cash",
    notes: "",
  });

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

  // Tanlangan guruh o'quvchilarining to'lov holati
  const { data: paymentStatusData } = useQuery({
    queryKey: ["group-payment-status", selectedGroup],
    queryFn: async () => {
      if (!selectedGroup) return [];
      const res = await fetch(`/api/teacher/group/${selectedGroup}/payment-status`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedGroup,
    refetchInterval: 60000,
  });
  const paymentStatus = (paymentStatusData || []) as any[];

  // Bugungi davomat holati (o'tkazib yuborilgan darslar)
  const { data: todayAttendanceStatusData } = useQuery({
    queryKey: ["today-attendance-status", teacherId],
    queryFn: async () => {
      const res = await fetch(`/api/teacher/today-attendance-status`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!teacherId,
    refetchInterval: 120000,
  });
  const todayAttendanceStatus = (todayAttendanceStatusData || []) as any[];

  // Uzbek hafta kunlari
  const uzbekDays = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
  const todayUzbekDay = uzbekDays[new Date().getDay()];

  // Bugun dars bor, lekin davomat olinmagan guruhlar
  const missedAttendanceGroups = todayAttendanceStatus.filter((g: any) => {
    const hasClassToday = (g.days || []).some((d: string) =>
      d.toLowerCase().includes(todayUzbekDay.toLowerCase().slice(0, 3))
    );
    return hasClassToday && !g.hasAttendanceToday;
  });

  // O'quvchi to'lov holatini olish helper
  const getStudentPaymentStatus = (studentId: number) =>
    paymentStatus.find((p: any) => p.studentId === studentId);

  // O'qituvchi yig'gan to'lovlar tarixi
  const { data: collectedPaymentsData, refetch: refetchCollectedPayments } = useQuery({
    queryKey: ["teacher-collected-payments", teacherId],
    queryFn: async () => {
      const res = await fetch("/api/teacher/collected-payments");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!teacherId,
  });
  const collectedPayments = (collectedPaymentsData || []) as any[];

  const submitPaymentMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/teacher/collected-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Xatolik");
      }
      return res.json();
    },
    onSuccess: () => {
      refetchCollectedPayments();
      setPaymentForm({ studentId: "", groupId: "", amount: "", paymentType: "cash", notes: "" });
      toast({ title: "Muvaffaqiyat", description: "To'lov adminga yuborildi. Tasdiq kutilmoqda." });
    },
    onError: (err: any) => {
      toast({ title: "Xatolik", description: err.message, variant: "destructive" });
    },
  });

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

  const deleteGroupMutation = useMutation({
    mutationFn: async (groupId: number) => {
      const res = await fetch(`/api/groups/${groupId}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "O'chirishda xatolik");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-groups"] });
      if (selectedGroup === deleteGroupId) setSelectedGroup(null);
      setIsDeleteGroupOpen(false);
      setDeleteGroupId(null);
      toast({ title: "O'chirildi", description: "Guruh muvaffaqiyatli o'chirildi" });
    },
    onError: (err: any) => {
      toast({ title: "Xatolik", description: err.message, variant: "destructive" });
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
    const doc = new jsPDF({ orientation: "landscape" });
    const selectedGroupObj = groups.find((g: any) => g.id === statsGroupId);
    const monthLabel = monthNames[statsMonth - 1];

    // --- Sarlavha ---
    doc.setFontSize(16);
    doc.text("DAVOMAT HISOBOTI", 14, 16);
    doc.setFontSize(10);
    doc.text(`Guruh: ${selectedGroupObj?.name || ""}`, 14, 24);
    doc.text(`O'qituvchi: ${teacherName}`, 14, 30);
    doc.text(`Oy: ${monthLabel} ${statsYear}`, 14, 36);

    // --- 1-jadval: Umumiy hisobot ---
    const summaryData = statsStudents.map((s: any, i: number) => {
      const st = getStudentStats(s.id);
      return [i + 1, `${s.firstName} ${s.lastName}`, st.present, st.absent, st.late, st.total, `${st.rate}%`];
    });

    (doc as any).autoTable({
      startY: 42,
      head: [["#", "O'quvchi", "Bor", "Yo'q", "Kech", "Jami", "%"]],
      body: summaryData,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [102, 126, 234], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 247, 255] },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 60 },
        2: { cellWidth: 18, halign: "center" },
        3: { cellWidth: 18, halign: "center" },
        4: { cellWidth: 18, halign: "center" },
        5: { cellWidth: 18, halign: "center" },
        6: { cellWidth: 18, halign: "center" },
      },
    });

    const totalPresent = statsStudents.reduce((acc: number, s: any) => acc + getStudentStats(s.id).present, 0);
    const totalAbsent = statsStudents.reduce((acc: number, s: any) => acc + getStudentStats(s.id).absent, 0);
    const totalLate = statsStudents.reduce((acc: number, s: any) => acc + getStudentStats(s.id).late, 0);
    const afterSummary = (doc as any).lastAutoTable?.finalY || 60;
    doc.setFontSize(9);
    doc.text(`Jami: Bor — ${totalPresent}, Yo'q — ${totalAbsent}, Kech — ${totalLate}`, 14, afterSummary + 7);

    // --- 2-jadval: Kunlik davomat grid ---
    const uniqueDates = [...new Set(
      statsAttendance.map((a: any) => a.date?.toString().slice(0, 10))
    )].filter(Boolean).sort() as string[];

    if (uniqueDates.length > 0) {
      const weekLetters = ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"];
      const dateHeaders = uniqueDates.map((d) => {
        const dt = new Date(d + "T00:00:00");
        return `${weekLetters[dt.getDay()]}\n${dt.getDate()}`;
      });

      const gridHead = [["#", "O'quvchi", ...dateHeaders, "%"]];
      const gridBody = statsStudents.map((s: any, i: number) => {
        const st = getStudentStats(s.id);
        const cells = uniqueDates.map((d) => {
          const rec = statsAttendance.find(
            (a: any) => a.studentId === s.id && a.date?.toString().slice(0, 10) === d
          );
          if (!rec) return "—";
          if (rec.status === "present") return "B";
          if (rec.status === "absent") return "Y";
          if (rec.status === "late") return "K";
          return "—";
        });
        return [i + 1, `${s.firstName} ${s.lastName}`, ...cells, `${st.rate}%`];
      });

      const startGridY = afterSummary + 14;
      // Har bir kun ustunining kengligi (agar ko'p bo'lsa kichraytirish)
      const dateCellWidth = Math.max(7, Math.min(12, Math.floor(210 / (uniqueDates.length + 3))));

      (doc as any).autoTable({
        startY: startGridY,
        head: gridHead,
        body: gridBody,
        styles: { fontSize: 8, halign: "center" as const, cellPadding: 2 },
        headStyles: { fillColor: [80, 100, 200], textColor: 255, fontSize: 7, halign: "center" as const },
        alternateRowStyles: { fillColor: [245, 247, 255] },
        columnStyles: {
          0: { cellWidth: 8 },
          1: { cellWidth: 45, halign: "left" as const },
          ...Object.fromEntries(
            uniqueDates.map((_, i) => [i + 2, { cellWidth: dateCellWidth, halign: "center" as const }])
          ),
          [uniqueDates.length + 2]: { cellWidth: 14, halign: "center" as const },
        },
        didParseCell: (data: any) => {
          if (data.section === "body" && data.column.index >= 2 && data.column.index < uniqueDates.length + 2) {
            const val = data.cell.text?.[0];
            if (val === "B") data.cell.styles.textColor = [22, 163, 74];
            else if (val === "Y") data.cell.styles.textColor = [220, 38, 38];
            else if (val === "K") data.cell.styles.textColor = [217, 119, 6];
            else data.cell.styles.textColor = [180, 180, 180];
          }
        },
      });

      // Izoh
      const afterGrid = (doc as any).lastAutoTable?.finalY || startGridY + 10;
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text("B = Bor   Y = Yo'q   K = Kech qoldi   — = Qayd etilmagan", 14, afterGrid + 6);
      doc.setTextColor(0);
    }

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
            <TabsTrigger value="payment" className="flex items-center gap-2 data-[state=active]:gradient-primary data-[state=active]:text-white rounded-lg px-4 py-2.5 transition-all" data-testid="tab-payment">
              <Banknote className="w-4 h-4" /> To'lov
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

            {/* Guruhni o'chirish tasdiqlash dialogi */}
            <Dialog open={isDeleteGroupOpen} onOpenChange={(v) => { setIsDeleteGroupOpen(v); if (!v) setDeleteGroupId(null); }}>
              <DialogContent className="glass-card border-0 max-w-sm">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-red-600">
                    <Trash2 className="w-5 h-5" /> Guruhni o'chirish
                  </DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    {groups.find((g: any) => g.id === deleteGroupId)?.name}
                  </span>{" "}
                  guruhini o'chirmoqchimisiz? Bu amalni qaytarib bo'lmaydi.
                </p>
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => { setIsDeleteGroupOpen(false); setDeleteGroupId(null); }}
                  >
                    Bekor qilish
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    disabled={deleteGroupMutation.isPending}
                    onClick={() => deleteGroupId && deleteGroupMutation.mutate(deleteGroupId)}
                  >
                    {deleteGroupMutation.isPending ? "O'chirilmoqda..." : "Ha, o'chirish"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {groups.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {groups.map((group: any, index: number) => (
                  <Card 
                    key={group.id} 
                    className={`card-modern hover-lift border-l-4 border-l-primary animate-slide-up`}
                    style={{ animationDelay: `${index * 100}ms` }}
                    data-testid={`card-group-${group.id}`}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle
                          className="text-lg cursor-pointer hover:text-primary transition-colors"
                          onClick={() => setSelectedGroup(group.id)}
                        >
                          {group.name}
                        </CardTitle>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteGroupId(group.id);
                              setIsDeleteGroupOpen(true);
                            }}
                            data-testid={`button-delete-group-${group.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                          <ChevronRight
                            className="w-5 h-5 text-muted-foreground cursor-pointer"
                            onClick={() => setSelectedGroup(group.id)}
                          />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="cursor-pointer" onClick={() => setSelectedGroup(group.id)}>
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
                        <TableHead className="font-semibold">To'lov holati</TableHead>
                        <TableHead className="font-semibold hidden sm:table-cell">Telefon</TableHead>
                        <TableHead className="text-right font-semibold">Amallar</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupStudents.length > 0 ? (
                        groupStudents.map((student: any) => {
                          const ps = getStudentPaymentStatus(student.id);
                          const isOverdue = !ps || ps.isOverdue;
                          const daysSince = ps?.daysSinceLastPayment;
                          const lastDate = ps?.lastPaymentDate
                            ? new Date(ps.lastPaymentDate).toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit" })
                            : null;
                          return (
                          <TableRow key={student.id} className="hover:bg-primary/5 transition-colors">
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full gradient-purple flex items-center justify-center text-white text-sm font-medium">
                                  {student.firstName?.[0]}{student.lastName?.[0]}
                                </div>
                                <span className="font-medium">{student.firstName} {student.lastName}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {!ps ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-gray-300 shrink-0" />
                                  <span className="text-xs text-muted-foreground">Yuklanmoqda...</span>
                                </div>
                              ) : isOverdue ? (
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                                    <span className="text-xs font-semibold text-red-600">
                                      {daysSince === null ? "Hech to'lamagan" : `${daysSince} kun o'tdi`}
                                    </span>
                                  </div>
                                  {lastDate && <p className="text-xs text-muted-foreground pl-3.5">Oxirgi: {lastDate}</p>}
                                </div>
                              ) : (
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1.5">
                                    <BadgeCheck className="w-3.5 h-3.5 text-green-600 shrink-0" />
                                    <span className="text-xs font-semibold text-green-700">
                                      {daysSince === 0 ? "Bugun" : daysSince === 1 ? "Kecha" : `${daysSince} kun oldin`}
                                    </span>
                                  </div>
                                  {lastDate && <p className="text-xs text-muted-foreground pl-5">{lastDate} · {(ps.lastPaymentAmount || 0).toLocaleString("uz-UZ")} so'm</p>}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm hidden sm:table-cell">{student.phone}</TableCell>
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
                          );
                        })
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

            {/* O'tkazilgan darslar ogohlantiruvi */}
            {missedAttendanceGroups.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-800 text-sm">Bugun davomat olinmagan guruhlar!</p>
                  <div className="mt-1 space-y-0.5">
                    {missedAttendanceGroups.map((g: any) => (
                      <p key={g.groupId} className="text-xs text-amber-700">
                        • <span className="font-medium">{g.groupName}</span>
                        {g.time && <span className="text-amber-600"> — {g.time}</span>}
                        <span className="text-amber-500"> ({g.studentCount} o'quvchi)</span>
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            )}

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
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-lg">Davomat jadvali</CardTitle>
                    <div className="flex items-center gap-2">
                      {/* Progress ko'rsatgich */}
                      {groupStudents.length > 0 && (() => {
                        const marked = groupStudents.filter((s: any) => getAttendanceStatus(s.id) !== null).length;
                        const total = groupStudents.length;
                        return (
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${marked === total ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                              {marked}/{total} belgilandi
                            </span>
                          </div>
                        );
                      })()}
                      <Badge variant="outline" className="bg-white">
                        {new Date(attendanceDate).toLocaleDateString('uz-UZ', { day: 'numeric', month: 'long' })}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {groupStudents.length > 0 ? (
                      groupStudents.map((student: any, idx: number) => {
                        const status = getAttendanceStatus(student.id);
                        const isMarked = status !== null;
                        return (
                          <div
                            key={student.id}
                            className={`flex items-center justify-between p-4 transition-colors ${isMarked ? "bg-muted/10" : "hover:bg-muted/30"}`}
                          >
                            <div className="flex items-center gap-3">
                              {/* Status rangli krujok */}
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium relative
                                ${status === "present" ? "bg-green-500" : status === "absent" ? "bg-red-500" : status === "late" ? "bg-amber-500" : "gradient-info"}`}>
                                {student.firstName?.[0]}{student.lastName?.[0]}
                                {isMarked && (
                                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-white flex items-center justify-center shadow">
                                    {status === "present" && <CheckCircle2 className="w-3 h-3 text-green-600" />}
                                    {status === "absent" && <XCircle className="w-3 h-3 text-red-500" />}
                                    {status === "late" && <AlertCircle className="w-3 h-3 text-amber-500" />}
                                  </span>
                                )}
                              </div>
                              <div>
                                <p className="font-medium">{student.firstName} {student.lastName}</p>
                                <p className="text-xs text-muted-foreground">
                                  {status === "present" ? "✓ Bor deb belgilandi" :
                                   status === "absent" ? "✗ Yo'q deb belgilandi" :
                                   status === "late" ? "⚡ Kech qoldi deb belgilandi" :
                                   "Hali belgilanmagan"}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-1.5">
                              <Button
                                size="sm"
                                variant={status === "present" ? "default" : "outline"}
                                className={`transition-all ${status === "present"
                                  ? "gradient-success border-0 text-white shadow-lg shadow-green-500/25 ring-2 ring-green-400 ring-offset-1"
                                  : "hover:bg-green-50 hover:text-green-600 hover:border-green-300 opacity-70"}`}
                                onClick={() => {
                                  if (status !== "present") markAttendanceMutation.mutate({ studentId: student.id, status: "present" });
                                }}
                                disabled={markAttendanceMutation.isPending}
                              >
                                <CheckCircle2 className="w-4 h-4 sm:mr-1" />
                                <span className="hidden sm:inline">Bor</span>
                              </Button>
                              <Button
                                size="sm"
                                variant={status === "absent" ? "default" : "outline"}
                                className={`transition-all ${status === "absent"
                                  ? "bg-red-500 border-0 text-white shadow-lg shadow-red-500/25 ring-2 ring-red-400 ring-offset-1"
                                  : "hover:bg-red-50 hover:text-red-600 hover:border-red-300 opacity-70"}`}
                                onClick={() => {
                                  if (status !== "absent") markAttendanceMutation.mutate({ studentId: student.id, status: "absent" });
                                }}
                                disabled={markAttendanceMutation.isPending}
                              >
                                <XCircle className="w-4 h-4 sm:mr-1" />
                                <span className="hidden sm:inline">Yo'q</span>
                              </Button>
                              <Button
                                size="sm"
                                variant={status === "late" ? "default" : "outline"}
                                className={`transition-all ${status === "late"
                                  ? "gradient-warning border-0 text-white shadow-lg shadow-amber-500/25 ring-2 ring-amber-400 ring-offset-1"
                                  : "hover:bg-amber-50 hover:text-amber-600 hover:border-amber-300 opacity-70"}`}
                                onClick={() => {
                                  if (status !== "late") markAttendanceMutation.mutate({ studentId: student.id, status: "late" });
                                }}
                                disabled={markAttendanceMutation.isPending}
                              >
                                <AlertCircle className="w-4 h-4 sm:mr-1" />
                                <span className="hidden sm:inline">Kech</span>
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
                  {/* Kunlik davomat grid */}
                  {(() => {
                    // Oyda bo'lgan barcha noyob kunlar
                    const uniqueDates = [...new Set(
                      statsAttendance.map((a: any) => a.date?.toString().slice(0, 10))
                    )].filter(Boolean).sort() as string[];

                    if (uniqueDates.length === 0) return null;

                    const shortDay = (dateStr: string) => {
                      const d = new Date(dateStr + "T00:00:00");
                      return d.getDate().toString();
                    };
                    const weekLetter = (dateStr: string) => {
                      const d = new Date(dateStr + "T00:00:00");
                      return ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"][d.getDay()];
                    };
                    const cellStatus = (studentId: number, dateStr: string) => {
                      const rec = statsAttendance.find(
                        (a: any) => a.studentId === studentId && a.date?.toString().slice(0, 10) === dateStr
                      );
                      return rec?.status || null;
                    };

                    return (
                      <Card className="card-modern overflow-hidden">
                        <CardHeader className="border-b bg-muted/30">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-primary" />
                            Kunlik davomat jadvali — {monthNames[statsMonth - 1]} {statsYear}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground">
                            Jami {uniqueDates.length} ta dars kuni qayd etilgan
                          </p>
                        </CardHeader>
                        <CardContent className="p-0 overflow-x-auto">
                          <table className="w-full text-sm border-collapse min-w-max">
                            <thead>
                              <tr className="bg-muted/40">
                                <th className="text-left px-4 py-2 font-semibold sticky left-0 bg-muted/40 z-10 min-w-[160px] border-r border-border/40">
                                  O'quvchi
                                </th>
                                {uniqueDates.map((d) => (
                                  <th key={d} className="px-2 py-2 text-center font-medium text-muted-foreground min-w-[44px]">
                                    <div className="text-xs text-muted-foreground/70">{weekLetter(d)}</div>
                                    <div className="text-sm font-semibold">{shortDay(d)}</div>
                                  </th>
                                ))}
                                <th className="px-3 py-2 text-center font-semibold border-l border-border/40 min-w-[60px]">%</th>
                              </tr>
                            </thead>
                            <tbody>
                              {statsStudents.map((student: any, idx: number) => {
                                const st = getStudentStats(student.id);
                                return (
                                  <tr key={student.id} className={idx % 2 === 0 ? "bg-white" : "bg-muted/10"}>
                                    <td className={`px-4 py-2.5 sticky left-0 z-10 border-r border-border/40 ${idx % 2 === 0 ? "bg-white" : "bg-muted/10"}`}>
                                      <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-full gradient-purple flex items-center justify-center text-white text-xs font-medium shrink-0">
                                          {student.firstName?.[0]}{student.lastName?.[0]}
                                        </div>
                                        <span className="font-medium truncate max-w-[110px]">{student.firstName} {student.lastName}</span>
                                      </div>
                                    </td>
                                    {uniqueDates.map((d) => {
                                      const status = cellStatus(student.id, d);
                                      return (
                                        <td key={d} className="px-2 py-2 text-center">
                                          {status === "present" ? (
                                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-green-100 text-green-700 text-xs font-bold" title="Bor">✓</span>
                                          ) : status === "absent" ? (
                                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-100 text-red-600 text-xs font-bold" title="Yo'q">✗</span>
                                          ) : status === "late" ? (
                                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-100 text-amber-600 text-xs font-bold" title="Kech">⏰</span>
                                          ) : (
                                            <span className="inline-flex items-center justify-center w-7 h-7 text-muted-foreground/30 text-xs">—</span>
                                          )}
                                        </td>
                                      );
                                    })}
                                    <td className="px-3 py-2 text-center border-l border-border/40">
                                      <span className={`text-xs font-bold ${st.rate >= 80 ? "text-green-600" : st.rate >= 60 ? "text-amber-600" : "text-red-600"}`}>
                                        {st.rate}%
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                          {/* Izoh */}
                          <div className="flex items-center gap-4 px-4 py-3 border-t bg-muted/20 text-xs text-muted-foreground flex-wrap">
                            <div className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold text-xs">✓</span> Bor</div>
                            <div className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold text-xs">✗</span> Yo'q</div>
                            <div className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-bold text-xs">⏰</span> Kech qoldi</div>
                            <div className="flex items-center gap-1.5"><span className="text-muted-foreground/40">—</span> Qayd etilmagan</div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })()}
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

          {/* To'lov Tab */}
          <TabsContent value="payment" className="space-y-4 animate-slide-up">
            <div className="grid gap-6 md:grid-cols-2">
              {/* To'lov yig'ish formasi */}
              <Card className="card-modern">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Banknote className="w-5 h-5 text-primary" /> To'lov qabul qilish
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!paymentForm.studentId || !paymentForm.amount) return;
                      submitPaymentMutation.mutate({
                        studentId: parseInt(paymentForm.studentId),
                        groupId: paymentForm.groupId ? parseInt(paymentForm.groupId) : undefined,
                        amount: parseInt(paymentForm.amount),
                        paymentType: paymentForm.paymentType,
                        notes: paymentForm.notes || undefined,
                      });
                    }}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <Label>Guruh (ixtiyoriy)</Label>
                      <Select
                        value={paymentForm.groupId}
                        onValueChange={(v) => setPaymentForm({ ...paymentForm, groupId: v, studentId: "" })}
                      >
                        <SelectTrigger className="bg-white/50" data-testid="select-payment-group">
                          <SelectValue placeholder="Guruhni tanlang" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">— Barcha o'quvchilar —</SelectItem>
                          {groups.map((g: any) => (
                            <SelectItem key={g.id} value={g.id.toString()}>{g.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>O'quvchi *</Label>
                      <Select
                        value={paymentForm.studentId}
                        onValueChange={(v) => setPaymentForm({ ...paymentForm, studentId: v })}
                      >
                        <SelectTrigger className="bg-white/50" data-testid="select-payment-student">
                          <SelectValue placeholder="O'quvchini tanlang" />
                        </SelectTrigger>
                        <SelectContent>
                          {(paymentForm.groupId
                            ? allStudents.filter((s: any) => s.groupIds?.includes(parseInt(paymentForm.groupId)))
                            : allStudents
                          ).map((s: any) => (
                            <SelectItem key={s.id} value={s.id.toString()}>
                              {s.firstName} {s.lastName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Summa (so'm) *</Label>
                      <Input
                        type="number"
                        placeholder="500000"
                        value={paymentForm.amount}
                        onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                        className="bg-white/50"
                        min={1}
                        required
                        data-testid="input-payment-amount"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>To'lov turi</Label>
                      <Select
                        value={paymentForm.paymentType}
                        onValueChange={(v) => setPaymentForm({ ...paymentForm, paymentType: v })}
                      >
                        <SelectTrigger className="bg-white/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Naqd pul</SelectItem>
                          <SelectItem value="card">Plastik karta</SelectItem>
                          <SelectItem value="bank_transfer">Bank o'tkazma</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Izoh (ixtiyoriy)</Label>
                      <Input
                        placeholder="Oylik to'lov..."
                        value={paymentForm.notes}
                        onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                        className="bg-white/50"
                        data-testid="input-payment-notes"
                      />
                    </div>
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                      To'lov admin tomonidan tasdiqlanganidan so'ng rasman qabul qilinadi.
                    </div>
                    <Button
                      type="submit"
                      className="w-full gradient-primary"
                      disabled={!paymentForm.studentId || !paymentForm.amount || submitPaymentMutation.isPending}
                      data-testid="button-submit-payment"
                    >
                      <SendHorizonal className="w-4 h-4 mr-2" />
                      {submitPaymentMutation.isPending ? "Yuborilmoqda..." : "Adminga yuborish"}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Yuborilgan to'lovlar tarixi */}
              <Card className="card-modern">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-primary" /> Yuborilgan to'lovlar
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {collectedPayments.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground text-sm">
                      Hali yuborilgan to'lovlar yo'q
                    </div>
                  ) : (
                    <div className="divide-y">
                      {collectedPayments.slice(0, 20).map((p: any) => {
                        const date = new Date(p.createdAt);
                        const statusMap: Record<string, { label: string; color: string }> = {
                          pending: { label: "Kutilmoqda", color: "text-amber-600 bg-amber-50 border-amber-200" },
                          confirmed: { label: "Tasdiqlandi", color: "text-green-700 bg-green-50 border-green-200" },
                          rejected: { label: "Rad etildi", color: "text-red-600 bg-red-50 border-red-200" },
                        };
                        const st = statusMap[p.status] || statusMap.pending;
                        return (
                          <div key={p.id} className="p-4 flex items-start justify-between gap-2" data-testid={`row-collected-payment-${p.id}`}>
                            <div>
                              <p className="font-medium text-sm">{p.studentName}</p>
                              <p className="text-xs text-muted-foreground">
                                {(p.amount).toLocaleString("uz-UZ")} so'm · {p.paymentType === "cash" ? "Naqd" : p.paymentType === "card" ? "Karta" : "Bank"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {date.toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit", year: "2-digit" })} {date.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })}
                              </p>
                              {p.rejectionReason && (
                                <p className="text-xs text-red-500 mt-1">Sabab: {p.rejectionReason}</p>
                              )}
                            </div>
                            <Badge variant="outline" className={`text-xs shrink-0 ${st.color}`}>
                              {st.label}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
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
