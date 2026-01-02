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
import { translations } from "@/lib/i18n";
import { usePayments, useCreatePayment, useStudents, useGroups, useTeachers } from "@/lib/api";
import { Plus, Download, MessageSquare, Search, User, Phone, GraduationCap, Wallet } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import PaymentReceipt from "@/components/PaymentReceipt";

export default function Payments() {
  const { data: payments, isLoading } = usePayments();
  const { data: students } = useStudents();
  const { data: groups } = useGroups();
  const { data: teachers } = useTeachers();
  const createPayment = useCreatePayment();
  
  const studentsList = Array.isArray(students) ? students : [];
  const groupsList = Array.isArray(groups) ? groups : [];
  const paymentsList = Array.isArray(payments) ? payments : [];
  const teachersList = Array.isArray(teachers) ? teachers : [];
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [sendSms, setSendSms] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [receiptData, setReceiptData] = useState<{
    payment: any;
    student: any;
    groupName?: string;
    teacherName?: string;
  } | null>(null);
  const [formData, setFormData] = useState({
    studentId: 0,
    amount: 0,
    paymentType: "cash",
    status: "completed",
    notes: "",
  });

  // Filter students based on search query
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

  // Get selected student details
  const selectedStudent = useMemo(() => {
    if (!formData.studentId) return null;
    return studentsList.find((s: any) => s.id === formData.studentId);
  }, [studentsList, formData.studentId]);

  // Get student's group and teacher
  const getStudentInfo = (student: any) => {
    if (!student) return { group: null, teacher: null };
    const group = groupsList.find((g: any) => g.id === student.groupId);
    const teacher = group ? teachersList.find((t: any) => t.id === group.teacherId) : null;
    return { group, teacher };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newPayment = await createPayment.mutateAsync(formData);
      toast({ title: "Muvaffaqiyat", description: "To'lov qabul qilindi" });
      
      if (sendSms && formData.studentId) {
        try {
          const smsResponse = await fetch("/api/sms/payment-received", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ studentId: formData.studentId, amount: formData.amount }),
          });
          const smsResult = await smsResponse.json();
          if (smsResult.success) {
            toast({ title: "SMS yuborildi", description: "O'quvchiga SMS xabarnoma yuborildi" });
          } else {
            toast({ title: "SMS xatosi", description: smsResult.error || "SMS yuborishda xatolik", variant: "destructive" });
          }
        } catch (smsError) {
          console.error("SMS error:", smsError);
          toast({ title: "SMS xatosi", description: "SMS yuborishda xatolik", variant: "destructive" });
        }
      }
      
      const student = studentsList.find((s: any) => s.id === formData.studentId);
      const studentGroup = groupsList.find((g: any) => g.id === student?.groupId);
      const teacher = studentGroup?.teacherId ? teachersList.find((t: any) => t.id === studentGroup.teacherId) : null;
      
      setReceiptData({
        payment: newPayment,
        student: student,
        groupName: studentGroup?.name,
        teacherName: teacher ? `${teacher.firstName} ${teacher.lastName}` : undefined,
      });
      
      setIsOpen(false);
      setSearchQuery("");
      setFormData({ studentId: 0, amount: 0, paymentType: "cash", status: "completed", notes: "" });
    } catch (error) {
      toast({ title: "Xatolik", description: "To'lovni qabul qilishda xatolik", variant: "destructive" });
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

  const completedPayments = paymentsList.filter((p: any) => p.status === 'completed');
  const totalIncome = completedPayments.reduce((sum: number, p: any) => sum + p.amount, 0);

  // Find student name by ID
  const getStudentName = (studentId: number) => {
    const student = studentsList.find((s: any) => s.id === studentId);
    return student ? `${student.firstName} ${student.lastName}` : `#${studentId}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">{translations.nav.payments}</h1>
        <div className="flex gap-2 w-full sm:w-auto">
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button className="flex-1 sm:flex-none" data-testid="button-add-payment">
                <Plus className="mr-2 h-4 w-4" /> To'lov qabul qilish
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>To'lov qabul qilish</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Search Input */}
                <div className="space-y-2">
                  <Label htmlFor="search">O'quvchini qidirish</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="search"
                      placeholder="Ism, familiya yoki telefon..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                      data-testid="input-search-student"
                    />
                  </div>
                </div>

                {/* Student List */}
                <div className="space-y-2">
                  <Label>O'quvchini tanlang ({filteredStudents.length} ta)</Label>
                  <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
                    {filteredStudents.length > 0 ? (
                      filteredStudents.slice(0, 20).map((s: any) => {
                        const { group, teacher } = getStudentInfo(s);
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
                              <div className="font-medium">{s.firstName} {s.lastName}</div>
                              <Badge variant={s.balance > 0 ? "default" : s.balance < 0 ? "destructive" : "secondary"} className="text-xs">
                                {s.balance?.toLocaleString() || 0} UZS
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {s.phone || '-'}
                              </span>
                              {group && (
                                <span className="flex items-center gap-1">
                                  <GraduationCap className="w-3 h-3" />
                                  {group.name}
                                </span>
                              )}
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
                </div>

                {/* Selected Student Info */}
                {selectedStudent && (
                  <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
                    <div className="flex items-center gap-2 font-semibold text-primary">
                      <User className="w-4 h-4" />
                      {selectedStudent.firstName} {selectedStudent.lastName}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Phone className="w-3 h-3 text-muted-foreground" />
                        <span>{selectedStudent.phone || '-'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Wallet className="w-3 h-3 text-muted-foreground" />
                        <span className={selectedStudent.balance < 0 ? 'text-red-500' : selectedStudent.balance > 0 ? 'text-emerald-500' : ''}>
                          {(selectedStudent.balance || 0).toLocaleString()} UZS
                        </span>
                      </div>
                      {(() => {
                        const { group, teacher } = getStudentInfo(selectedStudent);
                        return (
                          <>
                            {group && (
                              <div className="flex items-center gap-2">
                                <GraduationCap className="w-3 h-3 text-muted-foreground" />
                                <span>{group.name}</span>
                              </div>
                            )}
                            {teacher && (
                              <div className="flex items-center gap-2">
                                <User className="w-3 h-3 text-muted-foreground" />
                                <span>{teacher.firstName} {teacher.lastName}</span>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="amount">Summa (UZS)</Label>
                  <Input
                    id="amount"
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: parseInt(e.target.value) || 0 })}
                    placeholder="500000"
                    required
                    data-testid="input-amount"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paymentType">To'lov turi</Label>
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
                <div className="space-y-2">
                  <Label htmlFor="notes">Izoh</Label>
                  <Input
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Oylik to'lov"
                    data-testid="input-notes"
                  />
                </div>
                <div className="flex items-center space-x-2 py-2">
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Jami tushum</CardTitle>
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
            <div className="text-2xl font-bold" data-testid="text-total-payments">{paymentsList.length}</div>
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
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>O'quvchi</TableHead>
                <TableHead>Summa</TableHead>
                <TableHead>Sana</TableHead>
                <TableHead>To'lov turi</TableHead>
                <TableHead>Holat</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paymentsList.length > 0 ? (
                paymentsList.map((payment: any) => (
                  <TableRow key={payment.id} data-testid={`row-payment-${payment.id}`}>
                    <TableCell className="font-medium" data-testid={`text-student-${payment.id}`}>
                      {getStudentName(payment.studentId)}
                    </TableCell>
                    <TableCell data-testid={`text-amount-${payment.id}`}>{payment.amount.toLocaleString()} UZS</TableCell>
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
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
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
          teacherName={receiptData.teacherName}
          onClose={() => setReceiptData(null)}
        />
      )}
    </div>
  );
}
