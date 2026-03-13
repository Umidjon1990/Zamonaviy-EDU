import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useExpenses, useCreateExpense, useUpdateExpense, useDeleteExpense, useTeachers, useStaff } from "@/lib/api";
import { Plus, Pencil, Trash2, Wallet, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

const categories = [
  { value: "rent", label: "Ijara" },
  { value: "salary", label: "O'qituvchi oyligi" },
  { value: "staff_salary", label: "Xodim oyligi" },
  { value: "supplies", label: "Jihozlar" },
  { value: "utilities", label: "Kommunal" },
  { value: "marketing", label: "Reklama" },
  { value: "other", label: "Boshqa" },
];

const categoryColors: Record<string, string> = {
  rent: "bg-blue-100 text-blue-800",
  salary: "bg-green-100 text-green-800",
  staff_salary: "bg-teal-100 text-teal-800",
  supplies: "bg-orange-100 text-orange-800",
  utilities: "bg-purple-100 text-purple-800",
  marketing: "bg-pink-100 text-pink-800",
  other: "bg-gray-100 text-gray-800",
};

const months = [
  { value: "1", label: "Yanvar" },
  { value: "2", label: "Fevral" },
  { value: "3", label: "Mart" },
  { value: "4", label: "Aprel" },
  { value: "5", label: "May" },
  { value: "6", label: "Iyun" },
  { value: "7", label: "Iyul" },
  { value: "8", label: "Avgust" },
  { value: "9", label: "Sentyabr" },
  { value: "10", label: "Oktyabr" },
  { value: "11", label: "Noyabr" },
  { value: "12", label: "Dekabr" },
];

const currentMonth = new Date().getMonth() + 1;
const currentYear = new Date().getFullYear();

export default function Expenses() {
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const { data: expenses, isLoading } = useExpenses(selectedMonth, selectedYear);
  const { data: teachers } = useTeachers();
  const { data: staffData } = useStaff();
  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();
  const deleteExpense = useDeleteExpense();
  const { toast } = useToast();

  const teachersList = Array.isArray(teachers) ? teachers : [];
  const staffList = Array.isArray(staffData) ? staffData : [];
  const getTeacherName = (teacherId: string) => {
    const teacher = teachersList.find((t: any) => t.id === teacherId);
    return teacher ? `${teacher.firstName} ${teacher.lastName}` : "";
  };
  const getStaffName = (staffId: string) => {
    const staff = staffList.find((s: any) => s.id === staffId);
    return staff ? `${staff.firstName} ${staff.lastName}` : "";
  };
  const getPersonName = (expense: any) => {
    if (expense.category === "salary" && expense.teacherId) return getTeacherName(expense.teacherId);
    if (expense.category === "staff_salary" && expense.staffId) return getStaffName(expense.staffId);
    return "-";
  };

  const [isOpen, setIsOpen] = useState(false);
  const [editExpense, setEditExpense] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState({
    title: "",
    amount: 0,
    category: "other",
    teacherId: "" as string,
    staffId: "" as string,
    notes: "",
    date: new Date().toISOString().split("T")[0],
  });

  const expensesList = Array.isArray(expenses) ? expenses : [];
  const filteredExpenses = expensesList.filter((e: any) =>
    e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (e.notes || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalExpenses = expensesList.reduce((sum: number, e: any) => sum + e.amount, 0);
  const categoryTotals = expensesList.reduce((acc: Record<string, number>, e: any) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {});

  const resetForm = () => {
    setFormData({ title: "", amount: 0, category: "other", teacherId: "", staffId: "", notes: "", date: new Date().toISOString().split("T")[0] });
    setEditExpense(null);
  };

  const handleSubmit = async () => {
    if (!formData.title || formData.amount <= 0) {
      toast({ title: "Xatolik", description: "Nomi va summani kiriting", variant: "destructive" });
      return;
    }
    if (formData.category === "salary" && !formData.teacherId) {
      toast({ title: "Xatolik", description: "O'qituvchi oyligiga o'qituvchini tanlang", variant: "destructive" });
      return;
    }
    if (formData.category === "staff_salary" && !formData.staffId) {
      toast({ title: "Xatolik", description: "Xodim oyligiga xodimni tanlang", variant: "destructive" });
      return;
    }
    const submitData = {
      ...formData,
      teacherId: formData.category === "salary" ? formData.teacherId : null,
      staffId: formData.category === "staff_salary" ? formData.staffId : null,
    };
    try {
      if (editExpense) {
        await updateExpense.mutateAsync({ id: editExpense.id, ...submitData });
        toast({ title: "Muvaffaqiyat", description: "Xarajat yangilandi" });
      } else {
        await createExpense.mutateAsync(submitData);
        toast({ title: "Muvaffaqiyat", description: "Xarajat qo'shildi" });
      }
      setIsOpen(false);
      resetForm();
    } catch (error: any) {
      toast({ title: "Xatolik", description: error.message, variant: "destructive" });
    }
  };

  const handleEdit = (expense: any) => {
    setEditExpense(expense);
    setFormData({
      title: expense.title,
      amount: expense.amount,
      category: expense.category,
      teacherId: expense.teacherId || "",
      staffId: expense.staffId || "",
      notes: expense.notes || "",
      date: new Date(expense.date).toISOString().split("T")[0],
    });
    setIsOpen(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteExpense.mutateAsync(id);
      toast({ title: "Muvaffaqiyat", description: "Xarajat o'chirildi" });
    } catch (error: any) {
      toast({ title: "Xatolik", description: error.message, variant: "destructive" });
    }
  };

  const getCategoryLabel = (value: string) => categories.find(c => c.value === value)?.label || value;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold" data-testid="text-expenses-title">Xarajatlar</h1>
        <div className="flex items-center gap-2">
          <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
            <SelectTrigger className="w-[130px]" data-testid="select-expense-month">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
            <SelectTrigger className="w-[90px]" data-testid="select-expense-year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-expense"><Plus className="mr-2 h-4 w-4" />Xarajat qo'shish</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>{editExpense ? "Xarajatni tahrirlash" : "Yangi xarajat"}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="title">Nomi</Label>
                  <Input id="title" data-testid="input-expense-title" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="Masalan: Ofis ijarasi" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="amount">Summa (so'm)</Label>
                  <Input id="amount" data-testid="input-expense-amount" type="number" value={formData.amount || ""} onChange={(e) => setFormData({ ...formData, amount: parseInt(e.target.value) || 0 })} placeholder="0" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="category">Kategoriya</Label>
                  <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                    <SelectTrigger data-testid="select-expense-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {formData.category === "salary" && (
                  <div className="grid gap-2">
                    <Label htmlFor="teacherId">O'qituvchi</Label>
                    <Select value={formData.teacherId} onValueChange={(v) => setFormData({ ...formData, teacherId: v })}>
                      <SelectTrigger data-testid="select-expense-teacher">
                        <SelectValue placeholder="O'qituvchini tanlang" />
                      </SelectTrigger>
                      <SelectContent>
                        {teachersList.map((t: any) => (
                          <SelectItem key={t.id} value={t.id}>{t.firstName} {t.lastName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {formData.category === "staff_salary" && (
                  <div className="grid gap-2">
                    <Label htmlFor="staffId">Xodim</Label>
                    <Select value={formData.staffId} onValueChange={(v) => {
                      const selectedStaff = staffList.find((s: any) => s.id === v);
                      setFormData({ ...formData, staffId: v, amount: selectedStaff?.salaryAmount || formData.amount });
                    }}>
                      <SelectTrigger data-testid="select-expense-staff">
                        <SelectValue placeholder="Xodimni tanlang" />
                      </SelectTrigger>
                      <SelectContent>
                        {staffList.map((s: any) => (
                          <SelectItem key={s.id} value={s.id}>{s.firstName} {s.lastName} — {(s.salaryAmount || 0).toLocaleString()} so'm</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="grid gap-2">
                  <Label htmlFor="date">Sana</Label>
                  <Input id="date" data-testid="input-expense-date" type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="notes">Izoh</Label>
                  <Input id="notes" data-testid="input-expense-notes" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Qo'shimcha ma'lumot" />
                </div>
              </div>
              <Button onClick={handleSubmit} disabled={createExpense.isPending || updateExpense.isPending} data-testid="button-submit-expense">
                {editExpense ? "Yangilash" : "Qo'shish"}
              </Button>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Jami xarajat</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="text-total-expenses">{totalExpenses.toLocaleString()} so'm</div>
            <p className="text-xs text-muted-foreground">{months.find(m => m.value === selectedMonth.toString())?.label} {selectedYear}</p>
          </CardContent>
        </Card>
        {Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([cat, amount]) => (
          <Card key={cat}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{getCategoryLabel(cat)}</CardTitle>
              <Badge className={categoryColors[cat] || categoryColors.other} variant="secondary">{cat}</Badge>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid={`text-category-total-${cat}`}>{(amount as number).toLocaleString()} so'm</div>
              <p className="text-xs text-muted-foreground">{totalExpenses > 0 ? Math.round(((amount as number) / totalExpenses) * 100) : 0}% umumiy xarajatdan</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <CardTitle>Xarajatlar ro'yxati ({filteredExpenses.length})</CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Qidirish..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-8" data-testid="input-search-expenses" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredExpenses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-no-expenses">
              Xarajatlar topilmadi
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sana</TableHead>
                    <TableHead>Nomi</TableHead>
                    <TableHead>Kategoriya</TableHead>
                    <TableHead>Xodim/O'qituvchi</TableHead>
                    <TableHead className="text-right">Summa</TableHead>
                    <TableHead>Izoh</TableHead>
                    <TableHead className="text-right">Amallar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExpenses.map((expense: any) => (
                    <TableRow key={expense.id} data-testid={`row-expense-${expense.id}`}>
                      <TableCell className="whitespace-nowrap">{new Date(expense.date).toLocaleDateString("uz-UZ")}</TableCell>
                      <TableCell className="font-medium">{expense.title}</TableCell>
                      <TableCell>
                        <Badge className={categoryColors[expense.category] || categoryColors.other} variant="secondary">
                          {getCategoryLabel(expense.category)}
                        </Badge>
                      </TableCell>
                      <TableCell data-testid={`text-expense-person-${expense.id}`}>
                        {getPersonName(expense)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-red-600">{expense.amount.toLocaleString()} so'm</TableCell>
                      <TableCell className="max-w-[200px] truncate">{expense.notes || "-"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(expense)} data-testid={`button-edit-expense-${expense.id}`}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(expense.id)} data-testid={`button-delete-expense-${expense.id}`}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
