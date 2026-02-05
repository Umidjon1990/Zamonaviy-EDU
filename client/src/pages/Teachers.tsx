import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useTeachers, useCreateTeacher, useUpdateTeacher, useDeleteTeacher, useSubjects } from "@/lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Trash2, Percent, Pencil, BookOpen, Download, Upload } from "lucide-react";
import * as XLSX from "xlsx";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

export default function Teachers() {
  const { data: teachersData, isLoading } = useTeachers();
  const teachers = (teachersData || []) as any[];
  const { data: subjectsData } = useSubjects();
  const subjects = (subjectsData || []) as any[];
  const createTeacher = useCreateTeacher();
  const updateTeacher = useUpdateTeacher();
  const deleteTeacher = useDeleteTeacher();
  const { toast } = useToast();
  
  const [isOpen, setIsOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<any>(null);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    phone: "",
    subjectId: "",
    salaryPercent: 30,
  });
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importData, setImportData] = useState<any[]>([]);
  const [importLoading, setImportLoading] = useState(false);

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch("/api/teachers/excel/template", { credentials: "include" });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "oqituvchilar_shablon.xlsx";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast({ title: "Xatolik", description: "Shablonni yuklab olishda xatolik", variant: "destructive" });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result;
      const workbook = XLSX.read(data, { type: "binary" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      setImportData(jsonData);
      setIsImportOpen(true);
    };
    reader.readAsBinaryString(file);
  };

  const handleImportSubmit = async () => {
    if (importData.length === 0) return;
    setImportLoading(true);
    try {
      const response = await fetch("/api/teachers/excel/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ data: importData }),
      });
      const result = await response.json();
      
      if (result.success > 0) {
        toast({ title: "Muvaffaqiyat", description: `${result.success} ta o'qituvchi qo'shildi. Standart parol: 123456` });
      }
      if (result.errors && result.errors.length > 0) {
        toast({ title: "Ogohlantirish", description: result.errors.slice(0, 3).join(", "), variant: "destructive" });
      }
      
      setIsImportOpen(false);
      setImportData([]);
      window.location.reload();
    } catch (error) {
      toast({ title: "Xatolik", description: "Import qilishda xatolik", variant: "destructive" });
    } finally {
      setImportLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const submitData = {
        ...formData,
        subjectId: formData.subjectId ? parseInt(formData.subjectId) : null,
      };
      await createTeacher.mutateAsync(submitData);
      toast({ title: "Muvaffaqiyat", description: "Yangi o'qituvchi qo'shildi" });
      setIsOpen(false);
      setFormData({ firstName: "", lastName: "", email: "", password: "", phone: "", subjectId: "", salaryPercent: 30 });
    } catch (error) {
      toast({ title: "Xatolik", description: "O'qituvchi qo'shishda xatolik yuz berdi", variant: "destructive" });
    }
  };

  const handleEdit = (teacher: any) => {
    setEditingTeacher(teacher);
    setFormData({
      firstName: teacher.firstName || "",
      lastName: teacher.lastName || "",
      email: teacher.email || "",
      password: "",
      phone: teacher.phone || "",
      subjectId: teacher.subjectId?.toString() || "",
      salaryPercent: teacher.salaryPercent || 30,
    });
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const submitData = {
        ...formData,
        subjectId: formData.subjectId ? parseInt(formData.subjectId) : null,
      };
      await updateTeacher.mutateAsync({ id: editingTeacher.id, ...submitData });
      toast({ title: "Muvaffaqiyat", description: "O'qituvchi ma'lumotlari yangilandi" });
      setIsEditOpen(false);
      setEditingTeacher(null);
      setFormData({ firstName: "", lastName: "", email: "", password: "", phone: "", subjectId: "", salaryPercent: 30 });
    } catch (error) {
      toast({ title: "Xatolik", description: "Yangilashda xatolik yuz berdi", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Haqiqatan ham o'chirmoqchimisiz?")) {
      try {
        await deleteTeacher.mutateAsync(id);
        toast({ title: "Muvaffaqiyat", description: "O'qituvchi o'chirildi" });
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
        <h1 className="text-3xl font-bold tracking-tight">O'qituvchilar</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleDownloadTemplate} data-testid="button-download-template">
            <Download className="mr-2 h-4 w-4" /> Shablon
          </Button>
          <label>
            <Button variant="outline" asChild data-testid="button-upload-excel">
              <span><Upload className="mr-2 h-4 w-4" /> Excel yuklash</span>
            </Button>
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileUpload} />
          </label>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-teacher">
                <Plus className="mr-2 h-4 w-4" /> O'qituvchi qo'shish
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Yangi o'qituvchi qo'shish</DialogTitle>
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
                <Label htmlFor="email">Email (ixtiyoriy)</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="teacher@educrm.uz"
                  data-testid="input-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Parol</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Kamida 6 belgi"
                  required
                  data-testid="input-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefon</Label>
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
                <Label htmlFor="subjectId">Fan (ixtiyoriy)</Label>
                <Select value={formData.subjectId} onValueChange={(value) => setFormData({ ...formData, subjectId: value })}>
                  <SelectTrigger data-testid="select-subject">
                    <SelectValue placeholder="Fanni tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map((s: any) => (
                      <SelectItem key={s.id} value={s.id.toString()}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="salaryPercent">Oylik foiz (%)</Label>
                <div className="relative">
                  <Input
                    id="salaryPercent"
                    type="number"
                    min="0"
                    max="100"
                    value={formData.salaryPercent}
                    onChange={(e) => setFormData({ ...formData, salaryPercent: parseInt(e.target.value) || 0 })}
                    className="pr-10"
                    data-testid="input-salaryPercent"
                  />
                  <Percent className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground">O'quvchi to'lov qilganda o'qituvchiga tushadigan foiz</p>
              </div>
              <Button type="submit" className="w-full" disabled={createTeacher.isPending} data-testid="button-submit">
                {createTeacher.isPending ? "Saqlanmoqda..." : "Saqlash"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Excel dan import qilish</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {importData.length} ta o'qituvchi topildi. Import qilishni xohlaysizmi?
            </p>
            <p className="text-xs text-amber-600">
              Diqqat: Barcha o'qituvchilar uchun standart parol: 123456
            </p>
            {importData.length > 0 && (
              <div className="max-h-48 overflow-auto border rounded p-2 text-sm">
                {importData.slice(0, 5).map((row: any, i: number) => (
                  <div key={i} className="py-1 border-b last:border-0">
                    {row["Ism"] || row["ism"]} {row["Familiya"] || row["familiya"]}
                  </div>
                ))}
                {importData.length > 5 && (
                  <div className="text-muted-foreground pt-1">va yana {importData.length - 5} ta...</div>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsImportOpen(false)} className="flex-1">
                Bekor qilish
              </Button>
              <Button onClick={handleImportSubmit} disabled={importLoading} className="flex-1">
                {importLoading ? "Yuklanmoqda..." : "Import qilish"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>O'qituvchini tahrirlash</DialogTitle>
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
              <Label htmlFor="edit-email">Email (ixtiyoriy)</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="teacher@educrm.uz"
                data-testid="input-edit-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-password">Yangi parol (bo'sh qoldirsa o'zgarmaydi)</Label>
              <Input
                id="edit-password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Yangi parol kiriting..."
                data-testid="input-edit-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Telefon</Label>
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
              <Label htmlFor="edit-subjectId">Fan (ixtiyoriy)</Label>
              <Select value={formData.subjectId} onValueChange={(value) => setFormData({ ...formData, subjectId: value })}>
                <SelectTrigger data-testid="select-edit-subject">
                  <SelectValue placeholder="Fanni tanlang" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((s: any) => (
                    <SelectItem key={s.id} value={s.id.toString()}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-salaryPercent">Oylik foiz (%)</Label>
              <div className="relative">
                <Input
                  id="edit-salaryPercent"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.salaryPercent}
                  onChange={(e) => setFormData({ ...formData, salaryPercent: parseInt(e.target.value) || 0 })}
                  className="pr-10"
                  data-testid="input-edit-salaryPercent"
                />
                <Percent className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={updateTeacher.isPending} data-testid="button-edit-submit">
              {updateTeacher.isPending ? "Saqlanmoqda..." : "Saqlash"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <div className="flex items-center gap-2 max-w-sm">
        <div className="relative w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="O'qituvchi qidirish..."
            className="pl-9 bg-background"
            data-testid="input-search-teachers"
          />
        </div>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>F.I.SH</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead>Oylik foiz</TableHead>
                <TableHead className="text-right">Amallar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teachers.length > 0 ? (
                teachers.map((teacher: any) => (
                  <TableRow key={teacher.id} data-testid={`row-teacher-${teacher.id}`}>
                    <TableCell className="font-medium" data-testid={`text-name-${teacher.id}`}>
                      {teacher.firstName} {teacher.lastName}
                    </TableCell>
                    <TableCell data-testid={`text-email-${teacher.id}`}>{teacher.email}</TableCell>
                    <TableCell>{teacher.phone}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center px-2 py-1 rounded-md bg-primary/10 text-primary font-medium text-sm">
                        {teacher.salaryPercent || 0}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(teacher)} data-testid={`button-edit-${teacher.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(teacher.id)} data-testid={`button-delete-${teacher.id}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Hozircha o'qituvchilar yo'q. Yangi o'qituvchi qo'shing.
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
