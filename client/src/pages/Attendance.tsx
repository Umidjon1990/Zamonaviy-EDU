import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Users, Calendar, Check, X, Clock, Star, Send, 
  BookOpen, GraduationCap, Sparkles, ChevronRight,
  CheckCircle2, XCircle, AlertCircle, MessageCircle
} from "lucide-react";

export default function Attendance() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [gradeTopic, setGradeTopic] = useState("");
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [pendingGrades, setPendingGrades] = useState<Record<number, number | null>>({});
  const [pendingAttendance, setPendingAttendance] = useState<Record<number, string | null>>({});

  const { data: groupsData } = useQuery({
    queryKey: ["groups"],
    queryFn: async () => {
      const res = await fetch("/api/groups", { credentials: "include" });
      return res.json();
    },
  });
  const groups = (groupsData || []) as any[];

  const { data: studentsData } = useQuery({
    queryKey: ["group-students", selectedGroup],
    queryFn: async () => {
      const res = await fetch(`/api/groups/${selectedGroup}/students`, { credentials: "include" });
      return res.json();
    },
    enabled: !!selectedGroup,
  });
  const groupStudents = (studentsData || []) as any[];

  const { data: attendanceData, refetch: refetchAttendance } = useQuery({
    queryKey: ["attendance", selectedGroup, selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/attendance?groupId=${selectedGroup}&date=${selectedDate}`, { credentials: "include" });
      return res.json();
    },
    enabled: !!selectedGroup,
  });
  const attendance = (attendanceData || []) as any[];

  const { data: gradesData, refetch: refetchGrades } = useQuery({
    queryKey: ["grades", selectedGroup, selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/grades?groupId=${selectedGroup}&date=${selectedDate}`, { credentials: "include" });
      return res.json();
    },
    enabled: !!selectedGroup,
  });
  const grades = (gradesData || []) as any[];

  const markAttendanceMutation = useMutation({
    mutationFn: async ({ studentId, status }: { studentId: number; status: string }) => {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          studentId,
          groupId: selectedGroup,
          date: selectedDate,
          status,
        }),
      });
      return res.json();
    },
    onSuccess: () => {
      refetchAttendance();
      toast({ title: "Muvaffaqiyat", description: "Davomat belgilandi" });
    },
  });

  const setGradeMutation = useMutation({
    mutationFn: async ({ studentId, grade }: { studentId: number; grade: number }) => {
      const res = await fetch("/api/grades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          studentId,
          groupId: selectedGroup,
          date: selectedDate,
          grade,
          topic: gradeTopic || null,
        }),
      });
      return res.json();
    },
    onSuccess: () => {
      refetchGrades();
      toast({ title: "Muvaffaqiyat", description: "Baho qo'yildi" });
    },
  });

  const getStudentAttendance = (studentId: number) => {
    return attendance.find((a: any) => a.studentId === studentId);
  };

  const getStudentGrade = (studentId: number) => {
    return grades.find((g: any) => g.studentId === studentId);
  };

  const selectedGroupData = groups.find(g => g.id === selectedGroup);
  
  const attendanceStats = {
    present: attendance.filter((a: any) => a.status === 'present').length,
    absent: attendance.filter((a: any) => a.status === 'absent').length,
    late: attendance.filter((a: any) => a.status === 'late').length,
    total: groupStudents.length,
  };

  const gradeStats = {
    excellent: grades.filter((g: any) => g.grade === 5).length,
    good: grades.filter((g: any) => g.grade === 4).length,
    average: grades.filter((g: any) => g.grade === 3).length,
    poor: grades.filter((g: any) => g.grade <= 2).length,
    avg: grades.length > 0 ? (grades.reduce((sum: number, g: any) => sum + g.grade, 0) / grades.length).toFixed(1) : '0',
  };

  const shareToTelegram = () => {
    if (!selectedGroupData) return;
    
    const dateStr = new Date(selectedDate).toLocaleDateString('uz-UZ', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long',
      year: 'numeric'
    });

    let message = `📊 *DAVOMAT VA BAHOLAR*\n`;
    message += `📅 ${dateStr}\n`;
    message += `📚 Guruh: ${selectedGroupData.name}\n\n`;
    
    message += `✅ *Davomat:*\n`;
    message += `• Kelganlar: ${attendanceStats.present} ta\n`;
    message += `• Kelmaganlar: ${attendanceStats.absent} ta\n`;
    message += `• Kechikkanlar: ${attendanceStats.late} ta\n\n`;
    
    if (grades.length > 0) {
      message += `📝 *Baholar:*\n`;
      message += `• O'rtacha ball: ${gradeStats.avg}\n`;
      message += `• A'lo (5): ${gradeStats.excellent} ta\n`;
      message += `• Yaxshi (4): ${gradeStats.good} ta\n`;
      message += `• O'rta (3): ${gradeStats.average} ta\n\n`;
    }
    
    message += `👥 *O'quvchilar:*\n`;
    groupStudents.forEach((student: any) => {
      const att = getStudentAttendance(student.id);
      const gr = getStudentGrade(student.id);
      const statusEmoji = att?.status === 'present' ? '✅' : att?.status === 'absent' ? '❌' : att?.status === 'late' ? '⏰' : '⬜';
      const gradeText = gr ? ` | Baho: ${gr.grade}` : '';
      message += `${statusEmoji} ${student.firstName} ${student.lastName}${gradeText}\n`;
    });
    
    message += `\n_Zamonaviy-Edu_`;
    
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://t.me/share/url?text=${encodedMessage}`, "_blank");
    setIsShareDialogOpen(false);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Xayrli tong";
    if (hour < 18) return "Xayrli kun";
    return "Xayrli kech";
  };

  return (
    <div className="space-y-6 p-2 pb-24 md:pb-6">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-6 md:p-8 text-white animate-slide-up">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full -ml-24 -mb-24 blur-2xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-yellow-300" />
            <span className="text-white/80 text-sm">{getGreeting()}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold">
            Davomat va Baholash
          </h1>
          <p className="text-white/70 mt-1">
            O'quvchilarni baholang va davomatini belgilang
          </p>
        </div>
      </div>

      {/* Controls - Mobile Optimized */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="glass-card border-0 shadow-lg hover-lift">
          <CardContent className="p-4">
            <Label className="text-sm font-medium text-muted-foreground mb-2 block">Guruhni tanlang</Label>
            <Select value={selectedGroup?.toString() || ""} onValueChange={(v) => setSelectedGroup(parseInt(v))}>
              <SelectTrigger className="h-12 text-base" data-testid="select-group">
                <SelectValue placeholder="Guruh tanlang..." />
              </SelectTrigger>
              <SelectContent>
                {groups.map((group: any) => (
                  <SelectItem key={group.id} value={group.id.toString()}>
                    <div className="flex items-center gap-2">
                      <GraduationCap className="w-4 h-4" />
                      {group.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card className="glass-card border-0 shadow-lg hover-lift">
          <CardContent className="p-4">
            <Label className="text-sm font-medium text-muted-foreground mb-2 block">Sanani tanlang</Label>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-12 text-base"
              data-testid="input-date"
            />
          </CardContent>
        </Card>
      </div>

      {selectedGroup && (
        <>
          {/* Stats Cards - Mobile Scrollable */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <Card className="glass-card border-0 shadow-md">
              <CardContent className="p-4 flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center mb-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                </div>
                <span className="text-2xl font-bold text-emerald-600">{attendanceStats.present}</span>
                <span className="text-xs text-muted-foreground">Kelgan</span>
              </CardContent>
            </Card>
            
            <Card className="glass-card border-0 shadow-md">
              <CardContent className="p-4 flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center mb-2">
                  <XCircle className="w-5 h-5 text-red-500" />
                </div>
                <span className="text-2xl font-bold text-red-600">{attendanceStats.absent}</span>
                <span className="text-xs text-muted-foreground">Kelmagan</span>
              </CardContent>
            </Card>
            
            <Card className="glass-card border-0 shadow-md">
              <CardContent className="p-4 flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center mb-2">
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                </div>
                <span className="text-2xl font-bold text-amber-600">{attendanceStats.late}</span>
                <span className="text-xs text-muted-foreground">Kechikkan</span>
              </CardContent>
            </Card>
            
            <Card className="glass-card border-0 shadow-md">
              <CardContent className="p-4 flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center mb-2">
                  <Star className="w-5 h-5 text-blue-500" />
                </div>
                <span className="text-2xl font-bold text-blue-600">{gradeStats.avg}</span>
                <span className="text-xs text-muted-foreground">O'rtacha ball</span>
              </CardContent>
            </Card>
          </div>

          {/* Topic Input for Grades */}
          <Card className="glass-card border-0 shadow-lg animate-slide-up" style={{ animationDelay: '0.15s' }}>
            <CardContent className="p-4">
              <Label className="text-sm font-medium text-muted-foreground mb-2 block">
                <BookOpen className="w-4 h-4 inline mr-1" />
                Dars mavzusi (ixtiyoriy)
              </Label>
              <Input
                placeholder="Masalan: Present Simple, Algebraik ifodalar..."
                value={gradeTopic}
                onChange={(e) => setGradeTopic(e.target.value)}
                className="h-11"
                data-testid="input-topic"
              />
            </CardContent>
          </Card>

          {/* Students List - Mobile Optimized Cards */}
          <div className="space-y-3 animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                O'quvchilar ({groupStudents.length} ta)
              </h2>
              <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2" data-testid="button-share-telegram">
                    <Send className="w-4 h-4" />
                    <span className="hidden sm:inline">Telegram</span>
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <MessageCircle className="w-5 h-5 text-blue-500" />
                      Telegramga yuborish
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <p className="text-sm text-muted-foreground">
                      Bugungi davomat va baholar haqidagi ma'lumot Telegram orqali yuboriladi.
                    </p>
                    <div className="bg-muted/50 rounded-lg p-4 text-sm">
                      <p className="font-medium mb-2">Yuboriladi:</p>
                      <ul className="space-y-1 text-muted-foreground">
                        <li>• Guruh: {selectedGroupData?.name}</li>
                        <li>• Sana: {new Date(selectedDate).toLocaleDateString('uz-UZ')}</li>
                        <li>• Davomat statistikasi</li>
                        <li>• Baholar va o'rtacha ball</li>
                        <li>• O'quvchilar ro'yxati</li>
                      </ul>
                    </div>
                    <Button onClick={shareToTelegram} className="w-full gap-2" data-testid="button-confirm-share">
                      <Send className="w-4 h-4" />
                      Telegramda ulashish
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {groupStudents.length === 0 ? (
              <Card className="glass-card border-0 shadow-lg">
                <CardContent className="p-8 text-center text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Bu guruhda hali o'quvchi yo'q</p>
                </CardContent>
              </Card>
            ) : (
              groupStudents.map((student: any, index: number) => {
                const att = getStudentAttendance(student.id);
                const gr = getStudentGrade(student.id);
                
                return (
                  <Card 
                    key={student.id} 
                    className="glass-card border-0 shadow-md hover-lift animate-slide-up"
                    style={{ animationDelay: `${0.25 + index * 0.05}s` }}
                    data-testid={`card-student-${student.id}`}
                  >
                    <CardContent className="p-4">
                      {/* Student Name */}
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-semibold text-sm">
                          {student.firstName[0]}{student.lastName[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium truncate">{student.firstName} {student.lastName}</h3>
                          <p className="text-xs text-muted-foreground">{student.phone}</p>
                        </div>
                        {att && (
                          <Badge 
                            variant="outline" 
                            className={`
                              ${att.status === 'present' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-200' : ''}
                              ${att.status === 'absent' ? 'bg-red-500/10 text-red-600 border-red-200' : ''}
                              ${att.status === 'excused' || att.status === 'late' ? 'bg-amber-500/10 text-amber-600 border-amber-200' : ''}
                            `}
                          >
                            {att.status === 'present' ? 'Bor' : att.status === 'absent' ? "Yo'q" : 'Sababli'}
                          </Badge>
                        )}
                      </div>

                      {/* Attendance Buttons */}
                      <div className="mb-4">
                        <Label className="text-xs font-medium text-muted-foreground mb-2 block">
                          Davomat
                          {att && <span className="ml-2 text-primary font-semibold">• Saqlangan: {att.status === 'present' ? 'Bor' : att.status === 'absent' ? "Yo'q" : 'Sababli'}</span>}
                          {pendingAttendance[student.id] && (
                            <span className="ml-2 text-amber-600 font-semibold animate-pulse">• Tanlangan: {pendingAttendance[student.id] === 'present' ? 'Bor' : pendingAttendance[student.id] === 'absent' ? "Yo'q" : 'Sababli'}</span>
                          )}
                        </Label>
                        <div className="grid grid-cols-3 gap-2">
                          {(['present', 'absent', 'excused'] as const).map((status) => {
                            const pending = pendingAttendance[student.id];
                            const isPending = pending === status;
                            const isSaved = att?.status === status && !pending;
                            const isSelected = isPending || isSaved;
                            const statusConfig = {
                              present: {
                                icon: <CheckCircle2 className="w-4 h-4" />,
                                label: 'Bor',
                                selectedClass: isPending 
                                  ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-lg shadow-emerald-500/30 border-0 ring-2 ring-emerald-300 ring-offset-2'
                                  : 'bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-lg shadow-emerald-500/30 border-0',
                                hoverClass: 'hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-300',
                              },
                              absent: {
                                icon: <XCircle className="w-4 h-4" />,
                                label: "Yo'q",
                                selectedClass: isPending
                                  ? 'bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-lg shadow-red-500/30 border-0 ring-2 ring-red-300 ring-offset-2'
                                  : 'bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-lg shadow-red-500/30 border-0',
                                hoverClass: 'hover:bg-red-50 hover:text-red-600 hover:border-red-300',
                              },
                              excused: {
                                icon: <AlertCircle className="w-4 h-4" />,
                                label: 'Sababli',
                                selectedClass: isPending
                                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30 border-0 ring-2 ring-amber-300 ring-offset-2'
                                  : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30 border-0',
                                hoverClass: 'hover:bg-amber-50 hover:text-amber-600 hover:border-amber-300',
                              },
                            };
                            const config = statusConfig[status];
                            return (
                              <Button
                                key={status}
                                variant={isSelected ? 'default' : 'outline'}
                                size="sm"
                                className={`h-11 gap-1.5 font-medium transition-all ${isSelected ? config.selectedClass : config.hoverClass}`}
                                onClick={() => {
                                  setPendingAttendance(prev => ({
                                    ...prev,
                                    [student.id]: prev[student.id] === status ? null : status
                                  }));
                                }}
                                data-testid={`button-${status}-${student.id}`}
                              >
                                {config.icon}
                                <span className="text-xs">{config.label}</span>
                              </Button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Grade Buttons */}
                      <div>
                        <Label className="text-xs font-medium text-muted-foreground mb-2 block">
                          Baho (1-5)
                          {gr && <span className="ml-2 text-primary font-semibold">• Saqlangan: {gr.grade}</span>}
                          {pendingGrades[student.id] !== undefined && pendingGrades[student.id] !== null && (
                            <span className="ml-2 text-amber-600 font-semibold animate-pulse">• Tanlangan: {pendingGrades[student.id]}</span>
                          )}
                        </Label>
                        <div className="flex gap-2 items-center">
                          <div className="grid grid-cols-5 gap-2 flex-1">
                            {[1, 2, 3, 4, 5].map((grade) => {
                              const pendingGrade = pendingGrades[student.id];
                              const isPending = pendingGrade === grade;
                              const isSaved = gr?.grade === grade && pendingGrade === undefined;
                              const isSelected = isPending || isSaved;
                              const gradeColors = {
                                1: isSelected 
                                  ? isPending 
                                    ? 'bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg shadow-red-500/30 border-0 ring-2 ring-red-300 ring-offset-2' 
                                    : 'bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg shadow-red-500/30 border-0'
                                  : 'hover:bg-red-50 hover:text-red-600 hover:border-red-300 text-red-500',
                                2: isSelected 
                                  ? isPending
                                    ? 'bg-gradient-to-r from-orange-600 to-orange-500 text-white shadow-lg shadow-orange-500/30 border-0 ring-2 ring-orange-300 ring-offset-2'
                                    : 'bg-gradient-to-r from-orange-600 to-orange-500 text-white shadow-lg shadow-orange-500/30 border-0'
                                  : 'hover:bg-orange-50 hover:text-orange-600 hover:border-orange-300 text-orange-500',
                                3: isSelected 
                                  ? isPending
                                    ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-lg shadow-amber-500/30 border-0 ring-2 ring-amber-300 ring-offset-2'
                                    : 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-lg shadow-amber-500/30 border-0'
                                  : 'hover:bg-amber-50 hover:text-amber-600 hover:border-amber-300 text-amber-500',
                                4: isSelected 
                                  ? isPending
                                    ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/30 border-0 ring-2 ring-blue-300 ring-offset-2'
                                    : 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/30 border-0'
                                  : 'hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 text-blue-500',
                                5: isSelected 
                                  ? isPending
                                    ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-lg shadow-emerald-500/30 border-0 ring-2 ring-emerald-300 ring-offset-2'
                                    : 'bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-lg shadow-emerald-500/30 border-0'
                                  : 'hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-300 text-emerald-500',
                              };
                              return (
                                <Button
                                  key={grade}
                                  variant={isSelected ? 'default' : 'outline'}
                                  size="sm"
                                  className={`h-11 text-lg font-bold transition-all ${gradeColors[grade as keyof typeof gradeColors]}`}
                                  onClick={() => {
                                    setPendingGrades(prev => ({
                                      ...prev,
                                      [student.id]: prev[student.id] === grade ? null : grade
                                    }));
                                  }}
                                  data-testid={`button-grade-${grade}-${student.id}`}
                                >
                                  {grade}
                                </Button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>

          {/* Save All Button */}
          {(Object.keys(pendingGrades).some(k => pendingGrades[parseInt(k)] !== null) || 
            Object.keys(pendingAttendance).some(k => pendingAttendance[parseInt(k)] !== null)) && (
            <Card className="glass-card border-0 shadow-lg sticky bottom-4 animate-slide-up">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {Object.values(pendingAttendance).filter(v => v !== null).length} ta davomat, {Object.values(pendingGrades).filter(v => v !== null).length} ta baho
                    </span>
                    {" "}saqlanmagan
                  </div>
                  <Button
                    size="lg"
                    className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white shadow-lg px-8"
                    onClick={async () => {
                      let savedCount = 0;
                      
                      // Save all pending attendance
                      for (const [studentIdStr, status] of Object.entries(pendingAttendance)) {
                        if (status) {
                          await markAttendanceMutation.mutateAsync({ studentId: parseInt(studentIdStr), status });
                          savedCount++;
                        }
                      }
                      
                      // Save all pending grades
                      for (const [studentIdStr, grade] of Object.entries(pendingGrades)) {
                        if (grade) {
                          await setGradeMutation.mutateAsync({ studentId: parseInt(studentIdStr), grade });
                          savedCount++;
                        }
                      }
                      
                      // Clear pending states
                      setPendingAttendance({});
                      setPendingGrades({});
                      
                      toast({ 
                        title: "Muvaffaqiyat", 
                        description: `${savedCount} ta ma'lumot saqlandi` 
                      });
                    }}
                    data-testid="button-save-all"
                  >
                    <Check className="w-5 h-5 mr-2" />
                    Hammasini saqlash
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!selectedGroup && (
        <Card className="glass-card border-0 shadow-lg animate-slide-up">
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <GraduationCap className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Guruhni tanlang</h3>
            <p className="text-muted-foreground">
              Davomat va baholash uchun yuqoridan guruhni tanlang
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
