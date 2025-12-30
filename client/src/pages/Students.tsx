import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { translations } from "@/lib/i18n";
import { useStudents, useCreateStudent, useUpdateStudent, useDeleteStudent, useGroups, useTeachers, useAddStudentToGroup } from "@/lib/api";
import { Plus, Search, Trash2, Pencil } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

export default function Students() {
  const { data: studentsData, isLoading } = useStudents();
  const students = (studentsData || []) as any[];
  const { data: groupsData } = useGroups();
  const groups = (groupsData || []) as any[];
  const { data: teachersData } = useTeachers();
  const teachers = (teachersData || []) as any[];
  const createStudent = useCreateStudent();
  const updateStudent = useUpdateStudent();
  const deleteStudent = useDeleteStudent();
  const addStudentToGroup = useAddStudentToGroup();
  const { toast } = useToast();
  
  const [isOpen, setIsOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    parentPhone: "",
    status: "active",
    balance: 0,
    groupId: 0,
    teacherId: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { groupId, teacherId, balance, ...studentData } = formData;
      const newStudent = await createStudent.mutateAsync({
        ...studentData,
        balance: balance > 0 ? -balance : balance,
      }) as any;
      
      if (groupId && groupId > 0 && newStudent?.id) {
        try {
          await addStudentToGroup.mutateAsync({ studentId: newStudent.id, groupId });
        } catch (groupError) {
          toast({ title: "Ogohlantirish", description: "O'quvchi qo'shildi, lekin guruhga qo'shishda xatolik", variant: "destructive" });
        }
      }
      
      toast({ title: "Muvaffaqiyat", description: "Yangi o'quvchi qo'shildi" });
      setIsOpen(false);
      setFormData({ firstName: "", lastName: "", phone: "", parentPhone: "", status: "active", balance: 0, groupId: 0, teacherId: "" });
    } catch (error) {
      toast({ title: "Xatolik", description: "O'quvchi qo'shishda xatolik yuz berdi", variant: "destructive" });
    }
  };

  const handleEdit = (student: any) => {
    setEditingStudent(student);
    setFormData({
      firstName: student.firstName || "",
      lastName: student.lastName || "",
      phone: student.phone || "",
      parentPhone: student.parentPhone || "",
      status: student.status || "active",
      balance: student.balance || 0,
      groupId: 0,
      teacherId: "",
    });
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { groupId, teacherId, ...studentData } = formData;
      await updateStudent.mutateAsync({ id: editingStudent.id, ...studentData });
      toast({ title: "Muvaffaqiyat", description: "O'quvchi ma'lumotlari yangilandi" });
      setIsEditOpen(false);
      setEditingStudent(null);
      setFormData({ firstName: "", lastName: "", phone: "", parentPhone: "", status: "active", balance: 0, groupId: 0, teacherId: "" });
    } catch (error) {
      toast({ title: "Xatolik", description: "Yangilashda xatolik yuz berdi", variant: "destructive" });
    }
  };

  const handleStatusChange = async (id: number, status: string) => {
    try {
      await updateStudent.mutateAsync({ id, status });
      toast({ title: "Muvaffaqiyat", description: "Status yangilandi" });
    } catch (error) {
      toast({ title: "Xatolik", description: "Statusni yangilashda xatolik", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Haqiqatan ham o'chirmoqchimisiz?")) {
      try {
        await deleteStudent.mutateAsync(id);
        toast({ title: "Muvaffaqiyat", description: "O'quvchi o'chirildi" });
      } catch (error) {
        toast({ title: "Xatolik", description: "O'chirishda xatolik", variant: "destructive" });
      }
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">{translations.students.title}</h1>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto" data-testid="button-add-student">
              <Plus className="mr-2 h-4 w-4" /> {translations.students.addStudent}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Yangi o'quvchi qo'shish</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Ism</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    required
                    data-testid="input-firstName"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Familiya</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    required
                    data-testid="input-lastName"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">O'quvchi telefoni</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+998 90 123 45 67"
                  required
                  data-testid="input-phone"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="parentPhone">Ota-ona telefoni</Label>
                <Input
                  id="parentPhone"
                  value={formData.parentPhone}
                  onChange={(e) => setFormData({ ...formData, parentPhone: e.target.value })}
                  placeholder="+998 90 123 45 67"
                  required
                  data-testid="input-parentPhone"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="balance">Oylik to'lov (qarzdorlik)</Label>
                <Input
                  id="balance"
                  type="number"
                  value={formData.balance}
                  onChange={(e) => setFormData({ ...formData, balance: parseInt(e.target.value) || 0 })}
                  placeholder="500000"
                  data-testid="input-balance"
                />
                <p className="text-xs text-muted-foreground">Bu summa avtomatik qarzdorlik sifatida qo'shiladi</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="groupId">Guruh</Label>
                <Select value={formData.groupId.toString()} onValueChange={(value) => setFormData({ ...formData, groupId: parseInt(value) })}>
                  <SelectTrigger data-testid="select-group">
                    <SelectValue placeholder="Guruhni tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((g: any) => (
                      <SelectItem key={g.id} value={g.id.toString()}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="teacherId">O'qituvchi</Label>
                <Select value={formData.teacherId} onValueChange={(value) => setFormData({ ...formData, teacherId: value })}>
                  <SelectTrigger data-testid="select-teacher">
                    <SelectValue placeholder="O'qituvchini tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers.map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.firstName} {t.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Holat</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                  <SelectTrigger data-testid="select-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Faol</SelectItem>
                    <SelectItem value="paused">Muzlatilgan</SelectItem>
                    <SelectItem value="left">Ketgan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={createStudent.isPending} data-testid="button-submit">
                {createStudent.isPending ? "Saqlanmoqda..." : "Saqlash"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>O'quvchini tahrirlash</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-firstName">Ism</Label>
                <Input
                  id="edit-firstName"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  required
                  data-testid="input-edit-firstName"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-lastName">Familiya</Label>
                <Input
                  id="edit-lastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  required
                  data-testid="input-edit-lastName"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">O'quvchi telefoni</Label>
              <Input
                id="edit-phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+998 90 123 45 67"
                required
                data-testid="input-edit-phone"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-parentPhone">Ota-ona telefoni</Label>
              <Input
                id="edit-parentPhone"
                value={formData.parentPhone}
                onChange={(e) => setFormData({ ...formData, parentPhone: e.target.value })}
                placeholder="+998 90 123 45 67"
                required
                data-testid="input-edit-parentPhone"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-balance">Balans (UZS)</Label>
              <Input
                id="edit-balance"
                type="number"
                value={formData.balance}
                onChange={(e) => setFormData({ ...formData, balance: parseInt(e.target.value) || 0 })}
                data-testid="input-edit-balance"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-status">Holat</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger data-testid="select-edit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Faol</SelectItem>
                  <SelectItem value="paused">Muzlatilgan</SelectItem>
                  <SelectItem value="left">Ketgan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" disabled={updateStudent.isPending} data-testid="button-edit-submit">
              {updateStudent.isPending ? "Saqlanmoqda..." : "Saqlash"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <div className="flex items-center gap-2 max-w-sm">
        <div className="relative w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder={translations.common.search}
            className="pl-9 bg-background"
            data-testid="input-search-students"
          />
        </div>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>F.I.SH</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead>Ota-ona</TableHead>
                <TableHead>Balans</TableHead>
                <TableHead>Holat</TableHead>
                <TableHead className="text-right">Amallar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.length > 0 ? (
                students.map((student: any) => (
                  <TableRow key={student.id} data-testid={`row-student-${student.id}`}>
                    <TableCell className="font-medium" data-testid={`text-name-${student.id}`}>
                      {student.firstName} {student.lastName}
                    </TableCell>
                    <TableCell data-testid={`text-phone-${student.id}`}>{student.phone}</TableCell>
                    <TableCell>{student.parentPhone}</TableCell>
                    <TableCell>
                      <span className={student.balance < 0 ? "text-destructive font-medium" : "text-emerald-600 font-medium"} data-testid={`text-balance-${student.id}`}>
                        {student.balance.toLocaleString()} UZS
                      </span>
                    </TableCell>
                    <TableCell>
                      <Select value={student.status} onValueChange={(value) => handleStatusChange(student.id, value)}>
                        <SelectTrigger className={`w-28 h-8 text-xs ${
                          student.status === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                          student.status === "paused" ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                          "bg-gray-50 text-gray-700 border-gray-200"
                        }`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Faol</SelectItem>
                          <SelectItem value="paused">Muzlatilgan</SelectItem>
                          <SelectItem value="left">Ketgan</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(student)} data-testid={`button-edit-${student.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(student.id)} data-testid={`button-delete-${student.id}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Hozircha o'quvchilar yo'q. Yangi o'quvchi qo'shing.
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
