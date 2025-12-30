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
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { GraduationCap, Users, Calendar, LogOut, Plus, Check, X, Clock, UserPlus, Edit, ArrowRightLeft } from "lucide-react";

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

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <p className="font-bold">Zamonaviy-Edu</p>
              <p className="text-xs text-muted-foreground">{teacherName}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" /> Chiqish
          </Button>
        </div>
      </header>

      <main className="container py-6 px-4 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">O'qituvchi paneli</h1>
        </div>

        <Tabs defaultValue="groups" className="space-y-6">
          <TabsList>
            <TabsTrigger value="groups" className="flex items-center gap-2">
              <Users className="w-4 h-4" /> Guruhlarim
            </TabsTrigger>
            <TabsTrigger value="students" className="flex items-center gap-2">
              <UserPlus className="w-4 h-4" /> O'quvchilar
            </TabsTrigger>
            <TabsTrigger value="attendance" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Davomat
            </TabsTrigger>
          </TabsList>

          <TabsContent value="groups" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={isGroupOpen} onOpenChange={setIsGroupOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-group">
                    <Plus className="w-4 h-4 mr-2" /> Guruh yaratish
                  </Button>
                </DialogTrigger>
                <DialogContent>
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
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Daraja</Label>
                        <Select value={groupForm.level} onValueChange={(v) => setGroupForm({ ...groupForm, level: v })}>
                          <SelectTrigger>
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
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Dars vaqti</Label>
                      <Input
                        value={groupForm.time}
                        onChange={(e) => setGroupForm({ ...groupForm, time: e.target.value })}
                        placeholder="14:00 - 15:30"
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={createGroupMutation.isPending}>
                      {createGroupMutation.isPending ? "Yaratilmoqda..." : "Yaratish"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {groups.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {groups.map((group: any) => (
                  <Card key={group.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedGroup(group.id)}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">{group.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        <span>{group.time}</span>
                      </div>
                      <Badge variant="secondary" className="mt-2">{group.level}</Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  Hozircha guruhlaringiz yo'q. Yangi guruh yarating.
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="students" className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between gap-4">
              <div className="space-y-2">
                <Label>Guruh</Label>
                <Select value={selectedGroup?.toString() || ""} onValueChange={(v) => setSelectedGroup(parseInt(v))}>
                  <SelectTrigger className="w-[200px]">
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
                  <Button data-testid="button-add-student">
                    <UserPlus className="w-4 h-4 mr-2" /> O'quvchi qo'shish
                  </Button>
                </DialogTrigger>
                <DialogContent>
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
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Familiya</Label>
                        <Input
                          value={studentForm.lastName}
                          onChange={(e) => setStudentForm({ ...studentForm, lastName: e.target.value })}
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
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Ota-ona telefoni</Label>
                      <Input
                        value={studentForm.parentPhone}
                        onChange={(e) => setStudentForm({ ...studentForm, parentPhone: e.target.value })}
                        placeholder="+998 90 123 45 67"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Guruh</Label>
                      <Select value={studentForm.groupId} onValueChange={(v) => setStudentForm({ ...studentForm, groupId: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Guruhni tanlang" />
                        </SelectTrigger>
                        <SelectContent>
                          {groups.map((g: any) => (
                            <SelectItem key={g.id} value={g.id.toString()}>{g.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="submit" className="w-full" disabled={createStudentMutation.isPending}>
                      {createStudentMutation.isPending ? "Qo'shilmoqda..." : "Qo'shish"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {selectedGroup ? (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>O'quvchi</TableHead>
                        <TableHead>Telefon</TableHead>
                        <TableHead>Ota-ona</TableHead>
                        <TableHead className="text-right">Amallar</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupStudents.length > 0 ? (
                        groupStudents.map((student: any) => (
                          <TableRow key={student.id}>
                            <TableCell className="font-medium">{student.firstName} {student.lastName}</TableCell>
                            <TableCell>{student.phone}</TableCell>
                            <TableCell>{student.parentPhone}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button size="sm" variant="outline" onClick={() => openEditStudent(student)}>
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => openMoveStudent(student)}>
                                  <ArrowRightLeft className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                            Bu guruhda o'quvchilar yo'q.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  O'quvchilarni ko'rish uchun guruhni tanlang.
                </CardContent>
              </Card>
            )}

            <Dialog open={isEditStudentOpen} onOpenChange={setIsEditStudentOpen}>
              <DialogContent>
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
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Familiya</Label>
                      <Input
                        value={studentForm.lastName}
                        onChange={(e) => setStudentForm({ ...studentForm, lastName: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Telefon</Label>
                    <Input
                      value={studentForm.phone}
                      onChange={(e) => setStudentForm({ ...studentForm, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Ota-ona telefoni</Label>
                    <Input
                      value={studentForm.parentPhone}
                      onChange={(e) => setStudentForm({ ...studentForm, parentPhone: e.target.value })}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={updateStudentMutation.isPending}>
                    {updateStudentMutation.isPending ? "Saqlanmoqda..." : "Saqlash"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={isMoveStudentOpen} onOpenChange={setIsMoveStudentOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>O'quvchini boshqa guruhga o'tkazish</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleMoveStudent} className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {selectedStudent?.firstName} {selectedStudent?.lastName} ni qaysi guruhga o'tkazmoqchisiz?
                  </p>
                  <div className="space-y-2">
                    <Label>Yangi guruh</Label>
                    <Select value={moveToGroupId} onValueChange={setMoveToGroupId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Guruhni tanlang" />
                      </SelectTrigger>
                      <SelectContent>
                        {groups.filter(g => g.id !== selectedGroup).map((g: any) => (
                          <SelectItem key={g.id} value={g.id.toString()}>{g.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full" disabled={moveStudentMutation.isPending || !moveToGroupId}>
                    {moveStudentMutation.isPending ? "O'tkazilmoqda..." : "O'tkazish"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="attendance" className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="space-y-2">
                <Label>Guruh</Label>
                <Select value={selectedGroup?.toString() || ""} onValueChange={(v) => setSelectedGroup(parseInt(v))}>
                  <SelectTrigger className="w-[200px]">
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
                <Label>Sana</Label>
                <Input
                  type="date"
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                  className="w-[200px]"
                />
              </div>
            </div>

            {selectedGroup ? (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>O'quvchi</TableHead>
                        <TableHead>Telefon</TableHead>
                        <TableHead className="text-center">Davomat</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupStudents.length > 0 ? (
                        groupStudents.map((student: any) => {
                          const status = getAttendanceStatus(student.id);
                          return (
                            <TableRow key={student.id}>
                              <TableCell className="font-medium">{student.firstName} {student.lastName}</TableCell>
                              <TableCell>{student.phone}</TableCell>
                              <TableCell>
                                <div className="flex justify-center gap-2">
                                  <Button
                                    size="sm"
                                    variant={status === "present" ? "default" : "outline"}
                                    className={status === "present" ? "bg-emerald-500 hover:bg-emerald-600" : ""}
                                    onClick={() => markAttendanceMutation.mutate({ studentId: student.id, status: "present" })}
                                  >
                                    <Check className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant={status === "absent" ? "default" : "outline"}
                                    className={status === "absent" ? "bg-red-500 hover:bg-red-600" : ""}
                                    onClick={() => markAttendanceMutation.mutate({ studentId: student.id, status: "absent" })}
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                            Bu guruhda o'quvchilar yo'q.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  Davomat olish uchun guruhni tanlang.
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
