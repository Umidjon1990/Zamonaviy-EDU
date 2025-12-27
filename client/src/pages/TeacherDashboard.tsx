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
import { GraduationCap, Users, Calendar, LogOut, Plus, Check, X, Clock } from "lucide-react";

export default function TeacherDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [teacherName, setTeacherName] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [isGroupOpen, setIsGroupOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [groupForm, setGroupForm] = useState({
    name: "",
    level: "Beginner",
    days: ["Dushanba", "Chorshanba", "Juma"],
    time: "14:00 - 15:30",
    room: "",
    maxStudents: 15,
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
      toast({ title: "Muvaffaqiyat", description: "Guruh yaratildi" });
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
              <p className="font-bold">EduCRM</p>
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
