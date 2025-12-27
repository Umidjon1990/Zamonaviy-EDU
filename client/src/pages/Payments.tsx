import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { translations } from "@/lib/i18n";
import { usePayments, useCreatePayment, useStudents } from "@/lib/api";
import { Plus, Download } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

export default function Payments() {
  const { data: payments, isLoading } = usePayments();
  const { data: students } = useStudents();
  const createPayment = useCreatePayment();
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    studentId: 0,
    amount: 0,
    paymentType: "cash",
    status: "completed",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createPayment.mutateAsync(formData);
      toast({ title: "Muvaffaqiyat", description: "To'lov qabul qilindi" });
      setIsOpen(false);
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

  const completedPayments = payments?.filter((p: any) => p.status === 'completed') || [];
  const totalIncome = completedPayments.reduce((sum: number, p: any) => sum + p.amount, 0);

  // Find student name by ID
  const getStudentName = (studentId: number) => {
    const student = students?.find((s: any) => s.id === studentId);
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
                <div className="space-y-2">
                  <Label htmlFor="studentId">O'quvchi</Label>
                  <Select value={formData.studentId.toString()} onValueChange={(value) => setFormData({ ...formData, studentId: parseInt(value) })}>
                    <SelectTrigger data-testid="select-student">
                      <SelectValue placeholder="O'quvchini tanlang" />
                    </SelectTrigger>
                    <SelectContent>
                      {students?.map((s: any) => (
                        <SelectItem key={s.id} value={s.id.toString()}>
                          {s.firstName} {s.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
            <div className="text-2xl font-bold" data-testid="text-total-payments">{payments?.length || 0}</div>
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
              {payments && payments.length > 0 ? (
                payments.map((payment: any) => (
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
    </div>
  );
}
