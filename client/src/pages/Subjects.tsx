import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSubjects, useCreateSubject, useUpdateSubject, useDeleteSubject } from "@/lib/api";
import { Plus, BookOpen, Pencil, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

export default function Subjects() {
  const { data: subjectsData, isLoading } = useSubjects();
  const subjects = (subjectsData || []) as any[];
  const createSubject = useCreateSubject();
  const updateSubject = useUpdateSubject();
  const deleteSubject = useDeleteSubject();
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<any>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });

  const [editFormData, setEditFormData] = useState({
    name: "",
    description: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({ title: "Xatolik", description: "Fan nomini kiriting", variant: "destructive" });
      return;
    }
    try {
      await createSubject.mutateAsync(formData);
      toast({ title: "Muvaffaqiyat", description: "Yangi fan yaratildi" });
      setIsOpen(false);
      setFormData({ name: "", description: "" });
    } catch (error) {
      toast({ title: "Xatolik", description: "Fan yaratishda xatolik", variant: "destructive" });
    }
  };

  const openEditDialog = (subject: any) => {
    setEditingSubject(subject);
    setEditFormData({
      name: subject.name || "",
      description: subject.description || "",
    });
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubject) return;
    if (!editFormData.name.trim()) {
      toast({ title: "Xatolik", description: "Fan nomini kiriting", variant: "destructive" });
      return;
    }
    try {
      await updateSubject.mutateAsync({ id: editingSubject.id, ...editFormData });
      toast({ title: "Muvaffaqiyat", description: "Fan yangilandi" });
      setIsEditOpen(false);
      setEditingSubject(null);
    } catch (error) {
      toast({ title: "Xatolik", description: "Fan yangilashda xatolik", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Haqiqatan ham o'chirmoqchimisiz?")) {
      try {
        await deleteSubject.mutateAsync(id);
        toast({ title: "Muvaffaqiyat", description: "Fan o'chirildi" });
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
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Fanlar</h1>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto" data-testid="button-add-subject">
              <Plus className="mr-2 h-4 w-4" /> Yangi fan
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Yangi fan yaratish</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Fan nomi</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ingliz tili"
                  required
                  data-testid="input-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Tavsif (ixtiyoriy)</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Fan haqida qisqacha ma'lumot..."
                  data-testid="input-description"
                />
              </div>
              <Button type="submit" className="w-full" disabled={createSubject.isPending} data-testid="button-submit">
                {createSubject.isPending ? "Saqlanmoqda..." : "Saqlash"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Fanni tahrirlash</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Fan nomi</Label>
              <Input
                id="edit-name"
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                placeholder="Ingliz tili"
                required
                data-testid="input-edit-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Tavsif (ixtiyoriy)</Label>
              <Textarea
                id="edit-description"
                value={editFormData.description}
                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                placeholder="Fan haqida qisqacha ma'lumot..."
                data-testid="input-edit-description"
              />
            </div>
            <Button type="submit" className="w-full" disabled={updateSubject.isPending} data-testid="button-edit-submit">
              {updateSubject.isPending ? "Saqlanmoqda..." : "Saqlash"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {subjects && subjects.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {subjects.map((subject: any) => (
            <Card key={subject.id} className="overflow-hidden hover:shadow-md transition-all border-l-4 border-l-primary" data-testid={`card-subject-${subject.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-primary" />
                  </div>
                  <CardTitle className="text-lg" data-testid={`text-name-${subject.id}`}>{subject.name}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pb-4">
                {subject.description ? (
                  <p className="text-sm text-muted-foreground">{subject.description}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Tavsif kiritilmagan</p>
                )}
              </CardContent>
              <CardFooter className="bg-muted/30 p-3 flex justify-end gap-2">
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => openEditDialog(subject)} data-testid={`button-edit-${subject.id}`}>
                  <Pencil className="h-4 w-4 mr-1" /> Tahrirlash
                </Button>
                <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={() => handleDelete(subject.id)}>
                  <Trash2 className="h-4 w-4 mr-1" /> O'chirish
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="shadow-sm">
          <CardContent className="p-8 text-center text-muted-foreground">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <BookOpen className="w-8 h-8 text-primary" />
            </div>
            <p className="mb-4">Hozircha fanlar yo'q</p>
            <Button onClick={() => setIsOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Birinchi fanni yarating
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
