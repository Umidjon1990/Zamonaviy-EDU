import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { Textarea } from "@/components/ui/textarea";
import { translations } from "@/lib/i18n";
import { useGroups, useCreateGroup, useDeleteGroup, useTeachers, useImportGroupTemplate } from "@/lib/api";
import { Plus, Users, Clock, MapPin, Trash2, User, FileText, Copy } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

const WEEKDAYS = [
  { value: "Dushanba", label: "Du" },
  { value: "Seshanba", label: "Se" },
  { value: "Chorshanba", label: "Cho" },
  { value: "Payshanba", label: "Pa" },
  { value: "Juma", label: "Ju" },
  { value: "Shanba", label: "Sha" },
  { value: "Yakshanba", label: "Ya" },
];

const TEMPLATE_EXAMPLE = `Guruh nomi: Ingliz tili A1
Kunlari: seshanba/shanba
Vaqti: 10:00
Xona: 3-xona
O'qituvchi: Abdushukur
O'quvchilar:
1. Aliyev Jasur
   +998 90 123 45 67
2. Karimova Nilufar
   +998 91 234 56 78
3. Rahimov Sardor
   +998 93 345 67 89`;

export default function Groups() {
  const { data: groupsData, isLoading } = useGroups();
  const groups = (groupsData || []) as any[];
  const { data: teachersData } = useTeachers();
  const teachers = (teachersData || []) as any[];
  const createGroup = useCreateGroup();
  const deleteGroup = useDeleteGroup();
  const importTemplate = useImportGroupTemplate();
  const { toast } = useToast();
  
  const [isOpen, setIsOpen] = useState(false);
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);
  const [templateText, setTemplateText] = useState("");
  const [importResult, setImportResult] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    teacherId: "",
    days: [] as string[],
    time: "",
    room: "",
    maxStudents: 15,
  });

  const toggleDay = (day: string) => {
    setFormData(prev => ({
      ...prev,
      days: prev.days.includes(day) 
        ? prev.days.filter(d => d !== day)
        : [...prev.days, day]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.days.length === 0) {
      toast({ title: "Xatolik", description: "Kamida bitta kun tanlang", variant: "destructive" });
      return;
    }
    if (!formData.teacherId) {
      toast({ title: "Xatolik", description: "O'qituvchini tanlang", variant: "destructive" });
      return;
    }
    try {
      await createGroup.mutateAsync(formData);
      toast({ title: "Muvaffaqiyat", description: "Yangi guruh yaratildi" });
      setIsOpen(false);
      setFormData({
        name: "",
        teacherId: "",
        days: [],
        time: "",
        room: "",
        maxStudents: 15,
      });
    } catch (error) {
      toast({ title: "Xatolik", description: "Guruh yaratishda xatolik yuz berdi", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Haqiqatan ham o'chirmoqchimisiz?")) {
      try {
        await deleteGroup.mutateAsync(id);
        toast({ title: "Muvaffaqiyat", description: "Guruh o'chirildi" });
      } catch (error) {
        toast({ title: "Xatolik", description: "O'chirishda xatolik", variant: "destructive" });
      }
    }
  };

  const handleTemplateImport = async () => {
    if (!templateText.trim()) {
      toast({ title: "Xatolik", description: "Shablon matnini kiriting", variant: "destructive" });
      return;
    }
    
    try {
      const result = await importTemplate.mutateAsync(templateText);
      setImportResult(result);
      toast({ 
        title: "Muvaffaqiyat", 
        description: `Guruh yaratildi! ${(result as any).totalStudents} ta o'quvchi qo'shildi.`
      });
    } catch (error: any) {
      let errorMessage = "Import xatosi";
      try {
        if (error?.message) {
          const cleanMessage = error.message.replace("API Error: ", "");
          const errorData = JSON.parse(cleanMessage);
          errorMessage = errorData?.error || errorMessage;
        }
      } catch {
        errorMessage = error?.message || "Import xatosi";
      }
      toast({ 
        title: "Xatolik", 
        description: errorMessage, 
        variant: "destructive" 
      });
    }
  };

  const copyTemplateExample = () => {
    navigator.clipboard.writeText(TEMPLATE_EXAMPLE);
    toast({ title: "Nusxalandi", description: "Shablon namunasi nusxalandi" });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">{translations.groups.title}</h1>
        <div className="flex gap-2">
          <Dialog open={isTemplateOpen} onOpenChange={(open) => {
            setIsTemplateOpen(open);
            if (!open) {
              setTemplateText("");
              setImportResult(null);
            }
          }}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full sm:w-auto" data-testid="button-import-template">
                <FileText className="mr-2 h-4 w-4" /> Shablon bilan
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Shablon bilan guruh yaratish</DialogTitle>
                <DialogDescription>
                  Quyidagi formatda ma'lumotlarni kiriting yoki nusxalab qo'ying
                </DialogDescription>
              </DialogHeader>
              
              {!importResult ? (
                <div className="space-y-4">
                  <div className="bg-muted p-3 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <Label className="text-sm font-medium">Shablon namunasi:</Label>
                      <Button variant="ghost" size="sm" onClick={copyTemplateExample}>
                        <Copy className="h-4 w-4 mr-1" /> Nusxalash
                      </Button>
                    </div>
                    <pre className="text-xs whitespace-pre-wrap text-muted-foreground font-mono bg-background p-2 rounded">
{TEMPLATE_EXAMPLE}
                    </pre>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Shablon matni</Label>
                    <Textarea
                      value={templateText}
                      onChange={(e) => setTemplateText(e.target.value)}
                      placeholder="Shablon matnini shu yerga qo'ying..."
                      className="min-h-[200px] font-mono text-sm"
                      data-testid="textarea-template"
                    />
                  </div>
                  
                  <div className="text-xs text-muted-foreground">
                    <p className="font-medium mb-1">Eslatma:</p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>O'qituvchi ismi tizimda mavjud bo'lishi kerak</li>
                      <li>Kunlar: du/se/chor/pay/juma/sha/yak yoki to'liq nomi</li>
                      <li>O'quvchi telefon raqami bo'sh joy bilan bo'lishi mumkin</li>
                      <li>Mavjud o'quvchilar avtomatik guruhga qo'shiladi</li>
                    </ul>
                  </div>
                  
                  <Button 
                    onClick={handleTemplateImport} 
                    className="w-full" 
                    disabled={importTemplate.isPending}
                    data-testid="button-import-submit"
                  >
                    {importTemplate.isPending ? "Yuklanmoqda..." : "Import qilish"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                    <h3 className="font-semibold text-green-700 dark:text-green-400 mb-2">Muvaffaqiyatli yaratildi!</h3>
                    <div className="space-y-2 text-sm">
                      <p><strong>Guruh:</strong> {importResult.group?.name}</p>
                      <p><strong>O'qituvchi:</strong> {importResult.teacher?.name}</p>
                      <p><strong>Yangi o'quvchilar:</strong> {importResult.createdStudents} ta</p>
                      <p><strong>Mavjud o'quvchilar:</strong> {importResult.existingStudents} ta</p>
                      <p><strong>Jami:</strong> {importResult.totalStudents} ta o'quvchi guruhga qo'shildi</p>
                    </div>
                  </div>
                  
                  {importResult.errors && importResult.errors.length > 0 && (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800">
                      <p className="font-medium text-yellow-700 dark:text-yellow-400 text-sm mb-1">Ogohlantirishlar:</p>
                      <ul className="text-xs text-yellow-600 dark:text-yellow-500 list-disc pl-4">
                        {importResult.errors.map((err: string, i: number) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  <Button onClick={() => setIsTemplateOpen(false)} className="w-full">
                    Yopish
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
          
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto" data-testid="button-add-group">
                <Plus className="mr-2 h-4 w-4" /> {translations.groups.addGroup}
              </Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Yangi guruh yaratish</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Guruh nomi</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="English Beginners A1"
                  required
                  data-testid="input-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">Dars vaqti</Label>
                <Input
                  id="time"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  placeholder="14:00 - 15:30"
                  required
                  data-testid="input-time"
                />
              </div>
              <div className="space-y-2">
                <Label>Kunlari</Label>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAYS.map((day) => (
                    <Toggle
                      key={day.value}
                      pressed={formData.days.includes(day.value)}
                      onPressedChange={() => toggleDay(day.value)}
                      variant="outline"
                      size="sm"
                      className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                      data-testid={`toggle-day-${day.value}`}
                    >
                      {day.label}
                    </Toggle>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="room">Xona</Label>
                <Input
                  id="room"
                  value={formData.room}
                  onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                  placeholder="Xona 1"
                  data-testid="input-room"
                />
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
                <Label htmlFor="maxStudents">Maksimal o'quvchilar soni</Label>
                <Input
                  id="maxStudents"
                  type="number"
                  min="1"
                  value={formData.maxStudents}
                  onChange={(e) => setFormData({ ...formData, maxStudents: parseInt(e.target.value) || 15 })}
                  data-testid="input-maxStudents"
                />
              </div>
              <Button type="submit" className="w-full" disabled={createGroup.isPending} data-testid="button-submit">
                {createGroup.isPending ? "Saqlanmoqda..." : "Saqlash"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {groups && groups.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((group: any) => (
            <Card key={group.id} className="overflow-hidden hover:shadow-md transition-all group border-l-4 border-l-primary" data-testid={`card-group-${group.id}`}>
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Guruh</p>
                    <CardTitle className="text-xl" data-testid={`text-name-${group.id}`}>{group.name}</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pb-4 space-y-3">
                <div className="flex items-center text-sm text-muted-foreground">
                  <Clock className="mr-2 h-4 w-4 text-primary" />
                  <span>{group.days?.join(", ") || ""} • {group.time}</span>
                </div>
                {group.room && (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <MapPin className="mr-2 h-4 w-4 text-primary" />
                    <span>{group.room}</span>
                  </div>
                )}
                
                <div className="pt-2">
                  <div className="flex justify-between text-xs mb-1">
                    <span>Sig'im</span>
                    <span>0 / {group.maxStudents}</span>
                  </div>
                  <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary rounded-full" 
                      style={{ width: `0%` }}
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="bg-muted/30 p-3 flex justify-end gap-2">
                <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={() => handleDelete(group.id)}>
                  <Trash2 className="h-4 w-4 mr-1" /> O'chirish
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="shadow-sm">
          <CardContent className="p-8 text-center text-muted-foreground">
            Hozircha guruhlar yo'q. Yangi guruh qo'shing.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
