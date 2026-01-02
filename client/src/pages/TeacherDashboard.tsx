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
  CheckCircle2, XCircle, AlertCircle, ChevronRight
} from "lucide-react";

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
          <TabsList className="glass-card p-1 h-auto">
            <TabsTrigger value="groups" className="flex items-center gap-2 data-[state=active]:gradient-primary data-[state=active]:text-white rounded-lg px-4 py-2.5 transition-all">
              <Users className="w-4 h-4" /> Guruhlarim
            </TabsTrigger>
            <TabsTrigger value="students" className="flex items-center gap-2 data-[state=active]:gradient-primary data-[state=active]:text-white rounded-lg px-4 py-2.5 transition-all">
              <UserPlus className="w-4 h-4" /> O'quvchilar
            </TabsTrigger>
            <TabsTrigger value="attendance" className="flex items-center gap-2 data-[state=active]:gradient-primary data-[state=active]:text-white rounded-lg px-4 py-2.5 transition-all">
              <Calendar className="w-4 h-4" /> Davomat
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
        </Tabs>
      </main>
    </div>
  );
}
