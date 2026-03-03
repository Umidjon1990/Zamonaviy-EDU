import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { translations } from "@/lib/i18n";
import { useStudents, useCreateStudent, useUpdateStudent, useDeleteStudent, useBulkDeleteStudents, useGroups, useTeachers, useAddStudentToGroup, useUnassignedStudents } from "@/lib/api";
import { Plus, Search, Trash2, Pencil, Download, Upload, FileSpreadsheet, Eye, FileText } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import * as XLSX from "xlsx";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

export default function Students() {
  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
  });
  const isTeacher = currentUser?.role === "teacher";
  const hasPermission = (perm: string) => isTeacher ? (currentUser?.permissions || []).includes(perm) : true;
  const { data: studentsData, isLoading } = useStudents();
  const students = (studentsData || []) as any[];
  const { data: groupsData } = useGroups();
  const groups = (groupsData || []) as any[];
  const { data: teachersData } = useTeachers();
  const teachers = (teachersData || []) as any[];
  const createStudent = useCreateStudent();
  const updateStudent = useUpdateStudent();
  const deleteStudent = useDeleteStudent();
  const bulkDeleteStudents = useBulkDeleteStudents();
  const addStudentToGroup = useAddStudentToGroup();
  const { data: unassignedData } = useUnassignedStudents();
  const unassignedStudents = (unassignedData || []) as any[];
  const { toast } = useToast();
  
  const [isOpen, setIsOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState<"all" | "unassigned">("all");
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
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importData, setImportData] = useState<any[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);
  const [templateInfo, setTemplateInfo] = useState<{ columns: string[], data: any[] } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isBulkAddOpen, setIsBulkAddOpen] = useState(false);
  const [bulkAddText, setBulkAddText] = useState("");
  const [bulkAddGroupId, setBulkAddGroupId] = useState("");
  const [bulkAddLoading, setBulkAddLoading] = useState(false);

  const handleShowTemplate = async () => {
    try {
      const response = await fetch("/api/students/excel/template-info", { credentials: "include" });
      const data = await response.json();
      setTemplateInfo(data);
      setIsTemplateOpen(true);
    } catch (error) {
      toast({ title: "Xatolik", description: "Shablon ma'lumotlarini olishda xatolik", variant: "destructive" });
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch("/api/students/excel/template", { credentials: "include" });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "oquvchilar_shablon.xlsx";
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
      const response = await fetch("/api/students/excel/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ data: importData }),
      });
      const result = await response.json();
      
      if (result.success > 0) {
        toast({ title: "Muvaffaqiyat", description: `${result.success} ta o'quvchi qo'shildi` });
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

  const handleBulkAddStudents = async () => {
    if (!bulkAddText.trim()) {
      toast({ title: "Xatolik", description: "O'quvchilar ro'yxatini kiriting", variant: "destructive" });
      return;
    }
    if (!bulkAddGroupId) {
      toast({ title: "Xatolik", description: "Guruhni tanlang", variant: "destructive" });
      return;
    }
    setBulkAddLoading(true);
    try {
      const res = await fetch("/api/students/bulk-add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          text: bulkAddText,
          groupId: parseInt(bulkAddGroupId),
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast({ title: "Xatolik", description: result.error || "Import xatosi", variant: "destructive" });
        return;
      }
      toast({
        title: "Muvaffaqiyat",
        description: `${result.created} ta yangi, ${result.existing} ta mavjud o'quvchi guruhga qo'shildi`,
      });
      setIsBulkAddOpen(false);
      setBulkAddText("");
      setBulkAddGroupId("");
      window.location.reload();
    } catch (error) {
      toast({ title: "Xatolik", description: "Import qilishda xatolik", variant: "destructive" });
    } finally {
      setBulkAddLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { groupId, teacherId, balance, ...studentData } = formData;

      if (isTeacher && (!groupId || groupId <= 0)) {
        toast({ title: "Xatolik", description: "Guruhni tanlang", variant: "destructive" });
        return;
      }

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

  const toggleSelectStudent = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredStudents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredStudents.map((s: any) => s.id)));
    }
  };

  const handleBulkDelete = async () => {
    try {
      await bulkDeleteStudents.mutateAsync(Array.from(selectedIds));
      toast({ title: "Muvaffaqiyat", description: `${selectedIds.size} ta o'quvchi o'chirildi` });
      setSelectedIds(new Set());
      setIsBulkDeleteOpen(false);
    } catch (error) {
      toast({ title: "Xatolik", description: "O'chirishda xatolik yuz berdi", variant: "destructive" });
    }
  };

  const unassignedIds = useMemo(() => new Set(unassignedStudents.map((s: any) => s.id)), [unassignedStudents]);

  const filteredStudents = useMemo(() => {
    let result = groupFilter === "unassigned" 
      ? students.filter((s: any) => unassignedIds.has(s.id))
      : students;
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter((s: any) => {
        const fullName = `${s.firstName} ${s.lastName}`.toLowerCase();
        const phone = (s.phone || '').toLowerCase();
        const parentPhone = (s.parentPhone || '').toLowerCase();
        const groupNames = (s.groupNames || []).join(' ').toLowerCase();
        const teacherNames = (s.teacherNames || []).join(' ').toLowerCase();
        return fullName.includes(query) || phone.includes(query) || parentPhone.includes(query) || groupNames.includes(query) || teacherNames.includes(query);
      });
    }
    return result;
  }, [students, searchQuery, groupFilter, unassignedIds]);

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
        <div className="flex flex-wrap gap-2">
          {!isTeacher && (
          <>
          <Button variant="outline" onClick={handleShowTemplate} data-testid="button-show-template">
            <Eye className="mr-2 h-4 w-4" /> Shablon
          </Button>
          <Button variant="outline" onClick={handleDownloadTemplate} data-testid="button-download-template">
            <Download className="mr-2 h-4 w-4" /> Yuklab olish
          </Button>
          <label>
            <Button variant="outline" asChild data-testid="button-upload-excel">
              <span><Upload className="mr-2 h-4 w-4" /> Excel yuklash</span>
            </Button>
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileUpload} />
          </label>
          </>
          )}
          {isTeacher && hasPermission('add_student') && (
          <Dialog open={isBulkAddOpen} onOpenChange={(open) => {
            setIsBulkAddOpen(open);
            if (!open) { setBulkAddText(""); setBulkAddGroupId(""); }
          }}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-bulk-add-students">
                <FileText className="mr-2 h-4 w-4" /> Shablon bilan
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Shablon bilan o'quvchilar qo'shish</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Guruhni tanlang</Label>
                  <Select value={bulkAddGroupId} onValueChange={setBulkAddGroupId}>
                    <SelectTrigger data-testid="select-bulk-group">
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
                  <Label>O'quvchilar ro'yxati</Label>
                  <Textarea
                    value={bulkAddText}
                    onChange={(e) => setBulkAddText(e.target.value)}
                    placeholder={"Familiyasi Ismi\n+998901234567\nFamiliyasi Ismi\n+998911234567"}
                    className="min-h-[200px] font-mono text-sm"
                    data-testid="textarea-bulk-students"
                  />
                </div>
                <div className="text-xs text-muted-foreground">
                  <p className="font-medium mb-1">Format:</p>
                  <p>Har bir o'quvchi uchun ism-familiya va keyingi qatorda telefon raqami</p>
                </div>
                <Button onClick={handleBulkAddStudents} className="w-full" disabled={bulkAddLoading} data-testid="button-bulk-add-submit">
                  {bulkAddLoading ? "Yuklanmoqda..." : "Qo'shish"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          )}
          {hasPermission('add_student') && (
          <Dialog open={isOpen} onOpenChange={(open) => {
            setIsOpen(open);
            if (open && isTeacher) {
              setFormData(prev => ({ ...prev, teacherId: currentUser?.userId || "", status: "active" }));
            }
          }}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-student">
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
                <Label htmlFor="parentPhone">Ota-ona telefoni (ixtiyoriy)</Label>
                <Input
                  id="parentPhone"
                  value={formData.parentPhone}
                  onChange={(e) => setFormData({ ...formData, parentPhone: e.target.value })}
                  placeholder="+998 90 123 45 67"
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
              {!isTeacher && (
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
              )}
              {!isTeacher && (
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
              )}
              <Button type="submit" className="w-full" disabled={createStudent.isPending} data-testid="button-submit">
                {createStudent.isPending ? "Saqlanmoqda..." : "Saqlash"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
          )}
        </div>
      </div>

      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Excel dan import qilish</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {importData.length} ta o'quvchi topildi. Import qilishni xohlaysizmi?
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

      <Dialog open={isTemplateOpen} onOpenChange={setIsTemplateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Excel shablon namunasi</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Quyidagi ustunlar bilan Excel fayl tayyorlang:
            </p>
            {templateInfo && (
              <div className="overflow-auto border rounded">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {templateInfo.columns.map((col: string) => (
                        <TableHead key={col} className="font-bold whitespace-nowrap">{col}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templateInfo.data.map((row: any, i: number) => (
                      <TableRow key={i}>
                        {templateInfo.columns.map((col: string) => (
                          <TableCell key={col} className="whitespace-nowrap">{row[col]}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsTemplateOpen(false)} className="flex-1">
                Yopish
              </Button>
              <Button onClick={handleDownloadTemplate} className="flex-1">
                <Download className="mr-2 h-4 w-4" /> Yuklab olish
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
              <Label htmlFor="edit-parentPhone">Ota-ona telefoni (ixtiyoriy)</Label>
              <Input
                id="edit-parentPhone"
                value={formData.parentPhone}
                onChange={(e) => setFormData({ ...formData, parentPhone: e.target.value })}
                placeholder="+998 90 123 45 67"
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

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Ism, familiya yoki telefon..."
            className="pl-9 bg-background"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search-students"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={groupFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setGroupFilter("all")}
            data-testid="button-filter-all"
          >
            Barchasi ({students.length})
          </Button>
          <Button
            variant={groupFilter === "unassigned" ? "default" : "outline"}
            size="sm"
            onClick={() => setGroupFilter("unassigned")}
            className={groupFilter === "unassigned" ? "" : "border-amber-300 text-amber-700 hover:bg-amber-50"}
            data-testid="button-filter-unassigned"
          >
            Guruhsiz ({unassignedStudents.length})
          </Button>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
          <span className="text-sm font-medium" data-testid="text-selected-count">{selectedIds.size} ta o'quvchi tanlandi</span>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setIsBulkDeleteOpen(true)}
            data-testid="button-bulk-delete"
          >
            <Trash2 className="mr-2 h-4 w-4" /> O'chirish
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedIds(new Set())}
            data-testid="button-clear-selection"
          >
            Bekor qilish
          </Button>
        </div>
      )}

      <AlertDialog open={isBulkDeleteOpen} onOpenChange={setIsBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>O'quvchilarni o'chirish</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedIds.size} ta o'quvchini o'chirmoqchimisiz? Bu amalni ortga qaytarib bo'lmaydi. To'lov tarixi saqlanib qoladi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-bulk-delete-cancel">Bekor qilish</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={bulkDeleteStudents.isPending}
              data-testid="button-bulk-delete-confirm"
            >
              {bulkDeleteStudents.isPending ? "O'chirilmoqda..." : `${selectedIds.size} ta o'chirish`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={filteredStudents.length > 0 && selectedIds.size === filteredStudents.length}
                    onCheckedChange={toggleSelectAll}
                    data-testid="checkbox-select-all"
                  />
                </TableHead>
                <TableHead>F.I.SH</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead>Ota-ona</TableHead>
                <TableHead>Yo'nalish</TableHead>
                <TableHead>O'qituvchi</TableHead>
                <TableHead>Balans</TableHead>
                <TableHead>Holat</TableHead>
                <TableHead className="text-right">Amallar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.length > 0 ? (
                filteredStudents.map((student: any) => (
                  <TableRow key={student.id} data-testid={`row-student-${student.id}`}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(student.id)}
                        onCheckedChange={() => toggleSelectStudent(student.id)}
                        data-testid={`checkbox-student-${student.id}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium" data-testid={`text-name-${student.id}`}>
                      {student.firstName} {student.lastName}
                    </TableCell>
                    <TableCell data-testid={`text-phone-${student.id}`}>{student.phone}</TableCell>
                    <TableCell>{student.parentPhone}</TableCell>
                    <TableCell>
                      {student.groupNames?.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {student.groupNames.map((g: string, i: number) => (
                            <div key={i} className="flex flex-wrap gap-1">
                              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                {g}
                              </Badge>
                              {student.subjectNames?.[i] && (
                                <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                                  {student.subjectNames[i]}
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">Guruhsiz</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {student.teacherNames?.length > 0 ? (
                        <span className="text-sm">{student.teacherNames.join(", ")}</span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
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
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
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
