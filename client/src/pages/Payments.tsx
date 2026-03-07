import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { translations } from "@/lib/i18n";
import { usePayments, useCreatePayment, useUpdatePayment, useDeletePayment, useStudents, useGroups, useTeachers, useSubjects } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, User, Phone, Wallet, Pencil, Trash2, MessageSquare, Calendar, Clock, GraduationCap, UserPlus, Users, X, Filter } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import PaymentReceipt from "@/components/PaymentReceipt";

export default function Payments() {
  const { data: payments, isLoading } = usePayments();
  const { data: students } = useStudents();
  const { data: groups } = useGroups();
  const { data: teachers } = useTeachers();
  const { data: subjects } = useSubjects();
  const { data: brandingData } = useQuery({
    queryKey: ["branding"],
    queryFn: async () => {
      const res = await fetch("/api/branding");
      if (!res.ok) return null;
      return res.json();
    },
  });
  const createPayment = useCreatePayment();
  const updatePayment = useUpdatePayment();
  const deletePayment = useDeletePayment();
  
  const studentsList = Array.isArray(students) ? students : [];
  const groupsList = Array.isArray(groups) ? groups : [];
  const paymentsList = Array.isArray(payments) ? payments : [];
  const teachersList = Array.isArray(teachers) ? teachers : [];
  const subjectsList = Array.isArray(subjects) ? subjects : [];
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [sendSms, setSendSms] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterFromDate, setFilterFromDate] = useState("");
  const [filterToDate, setFilterToDate] = useState("");
  const [filterTeacherId, setFilterTeacherId] = useState("");
  const [filterGroupId, setFilterGroupId] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [studentMode, setStudentMode] = useState<"existing" | "new">("existing");
  const [receiptData, setReceiptData] = useState<{
    payment: any;
    student: any;
    groupName?: string;
    subjectName?: string;
    teacherName?: string;
  } | null>(null);
  
  const [formData, setFormData] = useState({
    studentId: 0,
    amount: 0,
    paymentType: "cash",
    status: "completed",
    notes: "",
    teacherId: "",
  });
  
  const [newStudentData, setNewStudentData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    parentPhone: "",
  });
  
  const [editPayment, setEditPayment] = useState<any>(null);
  const [editFormData, setEditFormData] = useState({
    amount: 0,
    paymentType: "cash",
    status: "completed",
    notes: "",
  });

  const now = new Date();
  const currentDate = now.toLocaleDateString('uz-UZ', { year: 'numeric', month: 'long', day: 'numeric' });
  const currentTime = now.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return studentsList;
    const query = searchQuery.toLowerCase().trim();
    return studentsList.filter((s: any) => {
      const fullName = `${s.firstName} ${s.lastName}`.toLowerCase();
      const phone = (s.phone || '').toLowerCase();
      const parentPhone = (s.parentPhone || '').toLowerCase();
      return fullName.includes(query) || phone.includes(query) || parentPhone.includes(query);
    });
  }, [studentsList, searchQuery]);

  const selectedStudent = useMemo(() => {
    if (!formData.studentId) return null;
    return studentsList.find((s: any) => s.id === formData.studentId);
  }, [studentsList, formData.studentId]);

  const selectedTeacher = useMemo(() => {
    if (!formData.teacherId) return null;
    return teachersList.find((t: any) => t.id === formData.teacherId);
  }, [teachersList, formData.teacherId]);

  const teacherEarningPreview = useMemo(() => {
    if (!selectedTeacher || !formData.amount) return 0;
    return Math.round(formData.amount * (selectedTeacher.salaryPercent || 0) / 100);
  }, [selectedTeacher, formData.amount]);

  const groupStudentIds = useMemo(() => {
    if (!filterGroupId) return null;
    const group = groupsList.find((g: any) => g.id?.toString() === filterGroupId);
    if (!group) return null;
    return studentsList
      .filter((s: any) => s.groups?.includes(filterGroupId) || s.groupIds?.includes(parseInt(filterGroupId)))
      .map((s: any) => s.id);
  }, [filterGroupId, groupsList, studentsList]);

  const teacherGroupIds = useMemo(() => {
    if (!filterTeacherId) return [];
    return groupsList.filter((g: any) => g.teacherId === filterTeacherId).map((g: any) => g.id);
  }, [filterTeacherId, groupsList]);

  const relevantGroupIds = useMemo(() => {
    if (filterGroupId) return [parseInt(filterGroupId)];
    if (filterTeacherId) return teacherGroupIds;
    return [];
  }, [filterGroupId, filterTeacherId, teacherGroupIds]);

  const { data: groupStudentsData } = useQuery({
    queryKey: ["group-students-for-filter", relevantGroupIds],
    queryFn: async () => {
      if (relevantGroupIds.length === 0) return [];
      const allStudents: any[] = [];
      const seenIds = new Set<number>();
      for (const gId of relevantGroupIds) {
        const res = await fetch(`/api/groups/${gId}/students`);
        if (res.ok) {
          const data = await res.json();
          const group = groupsList.find((g: any) => g.id === gId);
          data.forEach((s: any) => {
            if (!seenIds.has(s.id)) {
              seenIds.add(s.id);
              allStudents.push({ ...s, groupId: gId, groupName: group?.name });
            }
          });
        }
      }
      return allStudents;
    },
    enabled: relevantGroupIds.length > 0,
  });

  const [quickPayStudentId, setQuickPayStudentId] = useState<number | null>(null);

  const monthNames = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"];

  const monthFilteredPayments = useMemo(() => {
    const startOfMonth = new Date(selectedYear, selectedMonth, 1);
    const endOfMonth = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999);
    return paymentsList.filter((p: any) => {
      const date = new Date(p.createdAt);
      return date >= startOfMonth && date <= endOfMonth;
    });
  }, [paymentsList, selectedMonth, selectedYear]);

  const paidUnpaidData = useMemo(() => {
    const gsData = Array.isArray(groupStudentsData) ? groupStudentsData : [];
    if (gsData.length === 0) return null;

    const relevantTeacherId = filterTeacherId || (filterGroupId ? groupsList.find((g: any) => g.id?.toString() === filterGroupId)?.teacherId : null);

    const relevantPayments = monthFilteredPayments.filter((p: any) => {
      if (!p.status || p.status !== 'completed') return false;
      if (relevantTeacherId && p.teacherId !== relevantTeacherId) return false;
      return true;
    });

    const paidStudentIds = new Set(relevantPayments.map((p: any) => p.studentId));

    const paid = gsData.filter((s: any) => paidStudentIds.has(s.id));
    const unpaid = gsData.filter((s: any) => !paidStudentIds.has(s.id));

    return { paid, unpaid, total: gsData.length, relevantTeacherId };
  }, [groupStudentsData, monthFilteredPayments, filterTeacherId, filterGroupId, groupsList]);

  const filteredPayments = useMemo(() => {
    let result = monthFilteredPayments;

    if (filterSearch.trim()) {
      const query = filterSearch.toLowerCase().trim();
      result = result.filter((p: any) => {
        const student = studentsList.find((s: any) => s.id === p.studentId);
        const studentName = student ? `${student.firstName} ${student.lastName}`.toLowerCase() : (p.studentName || '').toLowerCase();
        const teacher = teachersList.find((t: any) => t.id === p.teacherId);
        const teacherName = teacher ? `${teacher.firstName} ${teacher.lastName}`.toLowerCase() : '';
        return studentName.includes(query) || teacherName.includes(query);
      });
    }

    if (filterFromDate) {
      const from = new Date(filterFromDate);
      from.setHours(0, 0, 0, 0);
      result = result.filter((p: any) => new Date(p.createdAt) >= from);
    }

    if (filterToDate) {
      const to = new Date(filterToDate);
      to.setHours(23, 59, 59, 999);
      result = result.filter((p: any) => new Date(p.createdAt) <= to);
    }

    if (filterTeacherId) {
      result = result.filter((p: any) => p.teacherId === filterTeacherId);
    }

    if (filterGroupId) {
      const group = groupsList.find((g: any) => g.id?.toString() === filterGroupId);
      if (group && group.teacherId) {
        result = result.filter((p: any) => p.teacherId === group.teacherId);
      }
    }

    return result;
  }, [monthFilteredPayments, filterSearch, filterFromDate, filterToDate, filterTeacherId, filterGroupId, studentsList, teachersList, groupsList]);

  const resetForm = () => {
    setFormData({ studentId: 0, amount: 0, paymentType: "cash", status: "completed", notes: "", teacherId: "" });
    setNewStudentData({ firstName: "", lastName: "", phone: "", parentPhone: "" });
    setSearchQuery("");
    setStudentMode("existing");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (studentMode === "existing" && !formData.studentId) {
      toast({ title: "Xatolik", description: "O'quvchini tanlang", variant: "destructive" });
      return;
    }
    if (studentMode === "new" && (!newStudentData.firstName || !newStudentData.lastName)) {
      toast({ title: "Xatolik", description: "Ism va familiya kiritilishi kerak", variant: "destructive" });
      return;
    }
    if (!formData.amount || formData.amount <= 0) {
      toast({ title: "Xatolik", description: "Summa kiritilishi kerak", variant: "destructive" });
      return;
    }
    if (!formData.teacherId) {
      toast({ title: "Xatolik", description: "O'qituvchini tanlang", variant: "destructive" });
      return;
    }

    try {
      const payload: any = {
        amount: formData.amount,
        paymentType: formData.paymentType,
        status: formData.status,
        notes: formData.notes,
        teacherId: formData.teacherId,
      };

      if (studentMode === "existing") {
        payload.studentId = formData.studentId;
      } else {
        payload.newStudent = newStudentData;
      }

      const result = await createPayment.mutateAsync(payload);
      toast({ title: "Muvaffaqiyat", description: "To'lov qabul qilindi" });
      
      const studentId = result.createdStudent ? result.createdStudent.id : formData.studentId;
      
      if (sendSms && studentId) {
        try {
          const smsResponse = await fetch("/api/sms/payment-received", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ studentId, amount: formData.amount }),
          });
          const smsResult = await smsResponse.json();
          if (smsResult.success) {
            toast({ title: "SMS yuborildi", description: "O'quvchiga SMS xabarnoma yuborildi" });
          } else {
            toast({ title: "SMS xatosi", description: smsResult.error || "SMS yuborishda xatolik", variant: "destructive" });
          }
        } catch (smsError) {
          console.error("SMS error:", smsError);
        }
      }
      
      const student = result.createdStudent || studentsList.find((s: any) => s.id === formData.studentId);
      const teacher = teachersList.find((t: any) => t.id === formData.teacherId);
      
      let studentGroup: any = null;
      let subject: any = null;
      if (studentId && !result.createdStudent) {
        try {
          const groupsResponse = await fetch(`/api/students/${studentId}/groups`);
          if (groupsResponse.ok) {
            const studentGroupsData = await groupsResponse.json();
            if (studentGroupsData.length > 0) {
              const firstGroupId = studentGroupsData[0].groupId;
              studentGroup = groupsList.find((g: any) => g.id === firstGroupId);
              subject = studentGroup?.subjectId ? subjectsList.find((s: any) => s.id === studentGroup.subjectId) : null;
            }
          }
        } catch (err) {
          console.error("Failed to fetch student groups:", err);
        }
      }
      
      setReceiptData({
        payment: result,
        student: student,
        groupName: studentGroup?.name,
        subjectName: subject?.name,
        teacherName: teacher ? `${teacher.firstName} ${teacher.lastName}` : undefined,
      });
      
      setIsOpen(false);
      resetForm();
    } catch (error: any) {
      toast({ title: "Xatolik", description: error?.message || "To'lovni qabul qilishda xatolik", variant: "destructive" });
    }
  };

  const handleEditClick = (payment: any) => {
    setEditPayment(payment);
    setEditFormData({
      amount: payment.amount,
      paymentType: payment.paymentType,
      status: payment.status,
      notes: payment.notes || "",
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPayment) return;
    
    try {
      await updatePayment.mutateAsync({
        id: editPayment.id,
        ...editFormData,
      });
      toast({ title: "Muvaffaqiyat", description: "To'lov yangilandi" });
      setEditPayment(null);
    } catch (error) {
      toast({ title: "Xatolik", description: "To'lovni yangilashda xatolik", variant: "destructive" });
    }
  };

  const handleDelete = async (payment: any) => {
    if (!confirm(`Bu to'lovni o'chirishni xohlaysizmi?\n\nO'quvchi: ${getStudentName(payment.studentId, payment)}\nSumma: ${payment.amount.toLocaleString()} UZS\n\nDiqqat: O'quvchi balansi qaytariladi!`)) {
      return;
    }
    
    try {
      await deletePayment.mutateAsync(payment.id);
      toast({ title: "Muvaffaqiyat", description: "To'lov o'chirildi" });
    } catch (error) {
      toast({ title: "Xatolik", description: "To'lovni o'chirishda xatolik", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const completedPayments = monthFilteredPayments.filter((p: any) => p.status === 'completed');
  const totalIncome = completedPayments.reduce((sum: number, p: any) => sum + p.amount, 0);

  const getStudentName = (studentId: number, payment?: any) => {
    const student = studentsList.find((s: any) => s.id === studentId);
    if (student) return `${student.firstName} ${student.lastName}`;
    if (payment?.studentName) return payment.studentName;
    return `#${studentId}`;
  };

  const getTeacherName = (teacherId: string | null) => {
    if (!teacherId) return "-";
    const teacher = teachersList.find((t: any) => t.id === teacherId);
    return teacher ? `${teacher.firstName} ${teacher.lastName}` : "-";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold tracking-tight">{translations.nav.payments}</h1>
          <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-1.5">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
              <SelectTrigger className="w-[120px] h-8 text-sm border-0 bg-transparent shadow-none" data-testid="select-filter-month">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthNames.map((name, i) => (
                  <SelectItem key={i} value={i.toString()}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
              <SelectTrigger className="w-[80px] h-8 text-sm border-0 bg-transparent shadow-none" data-testid="select-filter-year">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2024, 2025, 2026, 2027].map((y) => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="flex-1 sm:flex-none" data-testid="button-add-payment">
                <Plus className="mr-2 h-4 w-4" /> To'lov qabul qilish
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>To'lov qabul qilish</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{currentDate}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{currentTime}</span>
                  </div>
                </div>

                <Tabs value={studentMode} onValueChange={(v) => setStudentMode(v as "existing" | "new")}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="existing" className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Mavjud o'quvchi
                    </TabsTrigger>
                    <TabsTrigger value="new" className="flex items-center gap-2">
                      <UserPlus className="w-4 h-4" />
                      Yangi o'quvchi
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="existing" className="space-y-3 mt-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Ism, familiya yoki telefon..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                        data-testid="input-search-student"
                      />
                    </div>
                    <div className="max-h-40 overflow-y-auto border rounded-lg divide-y">
                      {filteredStudents.length > 0 ? (
                        filteredStudents.slice(0, 20).map((s: any) => {
                          const isSelected = formData.studentId === s.id;
                          return (
                            <div
                              key={s.id}
                              onClick={() => setFormData({ ...formData, studentId: s.id })}
                              className={`p-3 cursor-pointer transition-colors ${
                                isSelected 
                                  ? 'bg-primary/10 border-l-4 border-l-primary' 
                                  : 'hover:bg-muted/50'
                              }`}
                              data-testid={`student-option-${s.id}`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="font-medium text-sm">{s.firstName} {s.lastName}</div>
                                <Badge variant={s.balance > 0 ? "default" : s.balance < 0 ? "destructive" : "secondary"} className="text-xs">
                                  {s.balance?.toLocaleString() || 0} UZS
                                </Badge>
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3 h-3" />
                                  {s.phone || '-'}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="p-4 text-center text-muted-foreground text-sm">
                          O'quvchi topilmadi
                        </div>
                      )}
                    </div>
                    {selectedStudent && (
                      <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                        <div className="flex items-center gap-2 font-semibold text-primary text-sm">
                          <User className="w-4 h-4" />
                          {selectedStudent.firstName} {selectedStudent.lastName}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {selectedStudent.phone || '-'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Wallet className="w-3 h-3" />
                            <span className={selectedStudent.balance < 0 ? 'text-red-500' : selectedStudent.balance > 0 ? 'text-emerald-500' : ''}>
                              {(selectedStudent.balance || 0).toLocaleString()} UZS
                            </span>
                          </span>
                        </div>
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="new" className="space-y-3 mt-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="newFirstName" className="text-xs">Ismi *</Label>
                        <Input
                          id="newFirstName"
                          value={newStudentData.firstName}
                          onChange={(e) => setNewStudentData({ ...newStudentData, firstName: e.target.value })}
                          placeholder="Ali"
                          data-testid="input-new-firstName"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="newLastName" className="text-xs">Familiyasi *</Label>
                        <Input
                          id="newLastName"
                          value={newStudentData.lastName}
                          onChange={(e) => setNewStudentData({ ...newStudentData, lastName: e.target.value })}
                          placeholder="Valiyev"
                          data-testid="input-new-lastName"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="newPhone" className="text-xs">Telefoni</Label>
                        <Input
                          id="newPhone"
                          value={newStudentData.phone}
                          onChange={(e) => setNewStudentData({ ...newStudentData, phone: e.target.value })}
                          placeholder="+998901234567"
                          data-testid="input-new-phone"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="newParentPhone" className="text-xs">Ota-ona tel.</Label>
                        <Input
                          id="newParentPhone"
                          value={newStudentData.parentPhone}
                          onChange={(e) => setNewStudentData({ ...newStudentData, parentPhone: e.target.value })}
                          placeholder="+998901234567"
                          data-testid="input-new-parentPhone"
                        />
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">O'qituvchi *</Label>
                  <Select value={formData.teacherId} onValueChange={(value) => setFormData({ ...formData, teacherId: value })}>
                    <SelectTrigger data-testid="select-teacher">
                      <SelectValue placeholder="O'qituvchini tanlang..." />
                    </SelectTrigger>
                    <SelectContent>
                      {teachersList.map((t: any) => (
                        <SelectItem key={t.id} value={t.id}>
                          <div className="flex items-center gap-2">
                            <GraduationCap className="w-4 h-4" />
                            {t.firstName} {t.lastName}
                            {t.salaryPercent > 0 && (
                              <span className="text-xs text-muted-foreground">({t.salaryPercent}%)</span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="amount" className="text-xs font-medium">Summa (UZS) *</Label>
                  <Input
                    id="amount"
                    type="number"
                    value={formData.amount || ""}
                    onChange={(e) => setFormData({ ...formData, amount: parseInt(e.target.value) || 0 })}
                    placeholder="500000"
                    required
                    data-testid="input-amount"
                  />
                </div>

                {selectedTeacher && formData.amount > 0 && selectedTeacher.salaryPercent > 0 && (
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-amber-700">O'qituvchi ulushi ({selectedTeacher.salaryPercent}%):</span>
                      <span className="font-bold text-amber-800">{teacherEarningPreview.toLocaleString()} UZS</span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-amber-700">Markaz ulushi:</span>
                      <span className="font-bold text-amber-800">{(formData.amount - teacherEarningPreview).toLocaleString()} UZS</span>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">To'lov turi</Label>
                  <Select value={formData.paymentType} onValueChange={(value) => setFormData({ ...formData, paymentType: value })}>
                    <SelectTrigger data-testid="select-paymentType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Naqd pul</SelectItem>
                      <SelectItem value="card">Plastik karta</SelectItem>
                      <SelectItem value="bank_transfer">Bank o'tkazmasi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="notes" className="text-xs font-medium">Izoh</Label>
                  <Input
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Oylik to'lov"
                    data-testid="input-notes"
                  />
                </div>

                <div className="flex items-center space-x-2 py-1">
                  <Checkbox 
                    id="sendSms" 
                    checked={sendSms} 
                    onCheckedChange={(checked) => setSendSms(checked as boolean)}
                    data-testid="checkbox-send-sms"
                  />
                  <label htmlFor="sendSms" className="text-sm font-medium leading-none flex items-center gap-2 cursor-pointer">
                    <MessageSquare className="w-4 h-4" />
                    SMS xabarnoma yuborish
                  </label>
                </div>

                <Button type="submit" className="w-full" disabled={createPayment.isPending} data-testid="button-submit">
                  {createPayment.isPending ? "Saqlanmoqda..." : "Qabul qilish"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{monthNames[selectedMonth]} tushum</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600" data-testid="text-total-income">{totalIncome.toLocaleString()} UZS</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Jami to'lovlar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-payments">{monthFilteredPayments.length}</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">To'langan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{completedPayments.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 w-full sm:w-auto">
              <Label className="text-xs font-medium mb-1.5 block">
                <Search className="w-3 h-3 inline mr-1" />
                Ism/familiya bo'yicha qidirish
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="O'quvchi yoki o'qituvchi ismi..."
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                  className="pl-9"
                  data-testid="input-filter-search"
                />
              </div>
            </div>
            <div className="w-full sm:w-auto">
              <Label className="text-xs font-medium mb-1.5 block">Dan</Label>
              <Input
                type="date"
                value={filterFromDate}
                onChange={(e) => setFilterFromDate(e.target.value)}
                data-testid="input-filter-from-date"
              />
            </div>
            <div className="w-full sm:w-auto">
              <Label className="text-xs font-medium mb-1.5 block">Gacha</Label>
              <Input
                type="date"
                value={filterToDate}
                onChange={(e) => setFilterToDate(e.target.value)}
                data-testid="input-filter-to-date"
              />
            </div>
            {(filterSearch || filterFromDate || filterToDate || filterTeacherId || filterGroupId) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setFilterSearch(""); setFilterFromDate(""); setFilterToDate(""); setFilterTeacherId(""); setFilterGroupId(""); }}
                className="whitespace-nowrap"
                data-testid="button-clear-filters"
              >
                <X className="w-4 h-4 mr-1" />
                Tozalash
              </Button>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-3 items-end mt-3">
            <div className="w-full sm:w-auto sm:min-w-[200px]">
              <Label className="text-xs font-medium mb-1.5 block">
                <GraduationCap className="w-3 h-3 inline mr-1" />
                O'qituvchi bo'yicha
              </Label>
              <Select value={filterTeacherId} onValueChange={(val) => { setFilterTeacherId(val === "all" ? "" : val); }}>
                <SelectTrigger data-testid="select-filter-teacher">
                  <SelectValue placeholder="Barchasi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Barchasi</SelectItem>
                  {teachersList.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.firstName} {t.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-auto sm:min-w-[200px]">
              <Label className="text-xs font-medium mb-1.5 block">
                <Users className="w-3 h-3 inline mr-1" />
                Guruh bo'yicha
              </Label>
              <Select value={filterGroupId} onValueChange={(val) => { setFilterGroupId(val === "all" ? "" : val); }}>
                <SelectTrigger data-testid="select-filter-group">
                  <SelectValue placeholder="Barchasi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Barchasi</SelectItem>
                  {groupsList.map((g: any) => (
                    <SelectItem key={g.id} value={g.id.toString()}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {(filterSearch || filterFromDate || filterToDate || filterTeacherId || filterGroupId) && (
            <div className="mt-3 text-sm text-muted-foreground flex items-center gap-1">
              <Filter className="w-4 h-4" />
              {filteredPayments.length} ta to'lov topildi (jami {paymentsList.length} tadan)
            </div>
          )}
        </CardContent>
      </Card>

      {paidUnpaidData && (filterTeacherId || filterGroupId) && (
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">
                O'quvchilar holati — {monthNames[selectedMonth]} {selectedYear}
              </CardTitle>
              <Badge variant="outline" className="text-sm">
                Jami: {paidUnpaidData.total} ta o'quvchi
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <h3 className="text-sm font-semibold text-emerald-700">To'lov qilganlar ({paidUnpaidData.paid.length})</h3>
                </div>
                <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                  {paidUnpaidData.paid.length > 0 ? paidUnpaidData.paid.map((s: any) => {
                    const studentPayments = monthFilteredPayments.filter((p: any) => p.studentId === s.id && p.status === 'completed');
                    const totalPaid = studentPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
                    return (
                      <div key={s.id} className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-50 border border-emerald-100" data-testid={`paid-student-${s.id}`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-emerald-200 flex items-center justify-center text-emerald-700 text-[10px] font-bold flex-shrink-0">
                            {s.firstName?.[0]}{s.lastName?.[0]}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{s.firstName} {s.lastName}</p>
                            {s.phone && <p className="text-[10px] text-muted-foreground">{s.phone}</p>}
                          </div>
                        </div>
                        <span className="text-xs font-bold text-emerald-700 flex-shrink-0">{totalPaid.toLocaleString()} UZS</span>
                      </div>
                    );
                  }) : (
                    <p className="text-xs text-muted-foreground text-center py-4">Hali to'lov qilgan o'quvchi yo'q</p>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <h3 className="text-sm font-semibold text-red-700">To'lov qilmaganlar ({paidUnpaidData.unpaid.length})</h3>
                </div>
                <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                  {paidUnpaidData.unpaid.length > 0 ? paidUnpaidData.unpaid.map((s: any) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-red-50 border border-red-100 cursor-pointer hover:bg-red-100 transition-colors"
                      onClick={() => {
                        setFormData({
                          studentId: s.id,
                          amount: 0,
                          paymentType: "cash",
                          status: "completed",
                          notes: "",
                          teacherId: paidUnpaidData.relevantTeacherId || "",
                        });
                        setStudentMode("existing");
                        setSearchQuery(`${s.firstName} ${s.lastName}`);
                        setIsOpen(true);
                      }}
                      data-testid={`unpaid-student-${s.id}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-red-200 flex items-center justify-center text-red-700 text-[10px] font-bold flex-shrink-0">
                          {s.firstName?.[0]}{s.lastName?.[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{s.firstName} {s.lastName}</p>
                          {s.phone && <p className="text-[10px] text-muted-foreground">{s.phone}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-xs text-red-600 font-medium">{(s.balance || 0).toLocaleString()}</span>
                        <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] border-red-200 text-red-700 hover:bg-red-100">
                          <Wallet className="w-3 h-3 mr-1" />
                          To'lov
                        </Button>
                      </div>
                    </div>
                  )) : (
                    <p className="text-xs text-muted-foreground text-center py-4">Barcha o'quvchilar to'lov qilgan</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>O'quvchi</TableHead>
                <TableHead>O'qituvchi</TableHead>
                <TableHead>Summa</TableHead>
                <TableHead>Sana</TableHead>
                <TableHead>To'lov turi</TableHead>
                <TableHead>Holat</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayments.length > 0 ? (
                filteredPayments.map((payment: any) => (
                  <TableRow key={payment.id} data-testid={`row-payment-${payment.id}`}>
                    <TableCell className="font-medium" data-testid={`text-student-${payment.id}`}>
                      {getStudentName(payment.studentId, payment)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {getTeacherName(payment.teacherId)}
                    </TableCell>
                    <TableCell data-testid={`text-amount-${payment.id}`}>
                      <div>{payment.amount.toLocaleString()} UZS</div>
                      {payment.teacherEarning > 0 && (
                        <div className="text-xs text-amber-600">Ustoz: {payment.teacherEarning.toLocaleString()}</div>
                      )}
                    </TableCell>
                    <TableCell>{new Date(payment.createdAt).toLocaleDateString('uz-UZ')}</TableCell>
                    <TableCell>{payment.paymentType === 'cash' ? 'Naqd' : payment.paymentType === 'card' ? 'Karta' : 'Bank'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        payment.status === "completed" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                        payment.status === "pending" ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                        "bg-red-50 text-red-700 border-red-200"
                      } data-testid={`badge-status-${payment.id}`}>
                        {payment.status === "completed" ? "To'langan" : 
                         payment.status === "pending" ? "Kutilmoqda" : "Bekor qilingan"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleEditClick(payment)}
                          data-testid={`button-edit-payment-${payment.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDelete(payment)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          data-testid={`button-delete-payment-${payment.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Hozircha to'lovlar yo'q.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {receiptData && receiptData.payment && receiptData.student && (
        <PaymentReceipt
          payment={receiptData.payment}
          student={receiptData.student}
          groupName={receiptData.groupName}
          subjectName={receiptData.subjectName}
          teacherName={receiptData.teacherName}
          branding={brandingData ? {
            logo: brandingData.logo,
            receiptTitle: brandingData.receiptTitle,
            telegramChannel: brandingData.telegramChannel,
          } : undefined}
          onClose={() => setReceiptData(null)}
        />
      )}

      <Dialog open={!!editPayment} onOpenChange={(open) => !open && setEditPayment(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>To'lovni tahrirlash</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium">O'quvchi: {editPayment && getStudentName(editPayment.studentId, editPayment)}</p>
              <p className="text-xs text-muted-foreground">
                Sana: {editPayment && new Date(editPayment.createdAt).toLocaleDateString('uz-UZ')}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-amount">Summa (UZS)</Label>
              <Input
                id="edit-amount"
                type="number"
                value={editFormData.amount}
                onChange={(e) => setEditFormData({ ...editFormData, amount: parseInt(e.target.value) || 0 })}
                data-testid="input-edit-amount"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-paymentType">To'lov turi</Label>
              <Select value={editFormData.paymentType} onValueChange={(value) => setEditFormData({ ...editFormData, paymentType: value })}>
                <SelectTrigger data-testid="select-edit-paymentType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Naqd pul</SelectItem>
                  <SelectItem value="card">Plastik karta</SelectItem>
                  <SelectItem value="bank_transfer">Bank o'tkazmasi</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-status">Holat</Label>
              <Select value={editFormData.status} onValueChange={(value) => setEditFormData({ ...editFormData, status: value })}>
                <SelectTrigger data-testid="select-edit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="completed">To'langan</SelectItem>
                  <SelectItem value="pending">Kutilmoqda</SelectItem>
                  <SelectItem value="cancelled">Bekor qilingan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-notes">Izoh</Label>
              <Input
                id="edit-notes"
                value={editFormData.notes}
                onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                placeholder="Izoh"
                data-testid="input-edit-notes"
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setEditPayment(null)}>
                Bekor qilish
              </Button>
              <Button type="submit" className="flex-1" disabled={updatePayment.isPending} data-testid="button-save-edit">
                {updatePayment.isPending ? "Saqlanmoqda..." : "Saqlash"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
