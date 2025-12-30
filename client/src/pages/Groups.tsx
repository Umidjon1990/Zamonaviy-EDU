import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { translations } from "@/lib/i18n";
import { useGroups, useCreateGroup, useDeleteGroup, useSubjects, useTeachers } from "@/lib/api";
import { Plus, Users, Clock, MapPin, Trash2, User } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

const WEEKDAYS = [
  { value: "Dushanba", label: "Du" },
  { value: "Seshanba", label: "Se" },
  { value: "Chorshanba", label: "Cho" },
  { value: "Payshanba", label: "Pa" },
  { value: "Juma", label: "Ju" },
  { value: "Shanba", label: "Sha" },
];

export default function Groups() {
  const { data: groupsData, isLoading } = useGroups();
  const groups = (groupsData || []) as any[];
  const { data: subjectsData } = useSubjects();
  const subjects = (subjectsData || []) as any[];
  const { data: teachersData } = useTeachers();
  const teachers = (teachersData || []) as any[];
  const createGroup = useCreateGroup();
  const deleteGroup = useDeleteGroup();
  const { toast } = useToast();
  
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    subjectId: 0,
    teacherId: "",
    level: "Beginner",
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
        subjectId: 0,
        teacherId: "",
        level: "Beginner",
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="subjectId">Fan</Label>
                  <Select value={formData.subjectId.toString()} onValueChange={(value) => setFormData({ ...formData, subjectId: parseInt(value) })}>
                    <SelectTrigger data-testid="select-subject">
                      <SelectValue placeholder="Tanlang" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map((s: any) => (
                        <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="level">Daraja</Label>
                  <Select value={formData.level} onValueChange={(value) => setFormData({ ...formData, level: value })}>
                    <SelectTrigger data-testid="select-level">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Beginner">Boshlang'ich</SelectItem>
                      <SelectItem value="Intermediate">O'rta</SelectItem>
                      <SelectItem value="Advanced">Yuqori</SelectItem>
                      <SelectItem value="A1">A1</SelectItem>
                      <SelectItem value="A2">A2</SelectItem>
                      <SelectItem value="B1">B1</SelectItem>
                      <SelectItem value="B2">B2</SelectItem>
                      <SelectItem value="C1">C1</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={createGroup.isPending} data-testid="button-submit">
                {createGroup.isPending ? "Saqlanmoqda..." : "Saqlash"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
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
                  <Badge variant="secondary">{group.level}</Badge>
                </div>
              </CardHeader>
              <CardContent className="pb-4 space-y-3">
                <div className="flex items-center text-sm text-muted-foreground">
                  <Clock className="mr-2 h-4 w-4 text-primary" />
                  <span>{group.days.join(", ")} • {group.time}</span>
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
