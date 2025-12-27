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
import { useLeads, useCreateLead, useUpdateLead, useDeleteLead } from "@/lib/api";
import { Plus, Search, Phone, MessageCircle, Calendar, Trash2, Edit } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

export default function Leads() {
  const { data: leads, isLoading } = useLeads();
  const createLead = useCreateLead();
  const updateLead = useUpdateLead();
  const deleteLead = useDeleteLead();
  const { toast } = useToast();
  
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    source: "Instagram",
    interest: "",
    status: "new",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createLead.mutateAsync(formData);
      toast({ title: "Muvaffaqiyat", description: "Yangi lid qo'shildi" });
      setIsOpen(false);
      setFormData({ firstName: "", lastName: "", phone: "", source: "Instagram", interest: "", status: "new" });
    } catch (error) {
      toast({ title: "Xatolik", description: "Lid qo'shishda xatolik yuz berdi", variant: "destructive" });
    }
  };

  const handleStatusChange = async (id: number, status: string) => {
    try {
      await updateLead.mutateAsync({ id, status });
      toast({ title: "Muvaffaqiyat", description: "Status yangilandi" });
    } catch (error) {
      toast({ title: "Xatolik", description: "Statusni yangilashda xatolik", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Haqiqatan ham o'chirmoqchimisiz?")) {
      try {
        await deleteLead.mutateAsync(id);
        toast({ title: "Muvaffaqiyat", description: "Lid o'chirildi" });
      } catch (error) {
        toast({ title: "Xatolik", description: "O'chirishda xatolik", variant: "destructive" });
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "new": return "bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200";
      case "contacted": return "bg-yellow-100 text-yellow-700 hover:bg-yellow-200 border-yellow-200";
      case "trial": return "bg-purple-100 text-purple-700 hover:bg-purple-200 border-purple-200";
      case "converted": return "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200";
      case "lost": return "bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-200";
      default: return "bg-gray-100 text-gray-700";
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
        <h1 className="text-3xl font-bold tracking-tight">{translations.leads.title}</h1>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto" data-testid="button-add-lead">
              <Plus className="mr-2 h-4 w-4" /> {translations.leads.addLead}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Yangi lid qo'shish</DialogTitle>
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
                <Label htmlFor="interest">Qiziqish (Kurs)</Label>
                <Input
                  id="interest"
                  value={formData.interest}
                  onChange={(e) => setFormData({ ...formData, interest: e.target.value })}
                  placeholder="English, Math, IELTS..."
                  required
                  data-testid="input-interest"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="source">Manba</Label>
                <Select value={formData.source} onValueChange={(value) => setFormData({ ...formData, source: value })}>
                  <SelectTrigger data-testid="select-source">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Instagram">Instagram</SelectItem>
                    <SelectItem value="Telegram">Telegram</SelectItem>
                    <SelectItem value="Walk-in">Shaxsan keldi</SelectItem>
                    <SelectItem value="Referral">Tanish orqali</SelectItem>
                    <SelectItem value="Website">Veb-sayt</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={createLead.isPending} data-testid="button-submit">
                {createLead.isPending ? "Saqlanmoqda..." : "Saqlash"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2 max-w-sm">
        <div className="relative w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder={translations.common.search}
            className="pl-9 bg-background"
            data-testid="input-search-leads"
          />
        </div>
      </div>

      {/* Desktop View */}
      <Card className="hidden md:block shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{translations.leads.columns.name}</TableHead>
                <TableHead>{translations.leads.columns.phone}</TableHead>
                <TableHead>{translations.leads.columns.source}</TableHead>
                <TableHead>{translations.leads.columns.interest}</TableHead>
                <TableHead>{translations.common.status}</TableHead>
                <TableHead>{translations.leads.columns.date}</TableHead>
                <TableHead className="text-right">{translations.common.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads && leads.length > 0 ? (
                leads.map((lead: any) => (
                  <TableRow key={lead.id} data-testid={`row-lead-${lead.id}`}>
                    <TableCell className="font-medium" data-testid={`text-name-${lead.id}`}>
                      {lead.firstName} {lead.lastName}
                    </TableCell>
                    <TableCell data-testid={`text-phone-${lead.id}`}>{lead.phone}</TableCell>
                    <TableCell>{lead.source}</TableCell>
                    <TableCell>{lead.interest}</TableCell>
                    <TableCell>
                      <Select value={lead.status} onValueChange={(value) => handleStatusChange(lead.id, value)}>
                        <SelectTrigger className={`w-32 h-8 text-xs ${getStatusColor(lead.status)}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">Yangi</SelectItem>
                          <SelectItem value="contacted">Qo'ng'iroq</SelectItem>
                          <SelectItem value="trial">Sinov</SelectItem>
                          <SelectItem value="converted">O'qishga o'tdi</SelectItem>
                          <SelectItem value="lost">Yopilgan</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>{new Date(lead.createdAt).toLocaleDateString('uz-UZ')}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" data-testid={`button-call-${lead.id}`}>
                          <Phone className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(lead.id)} data-testid={`button-delete-${lead.id}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Hozircha lidlar yo'q. Yangi lid qo'shing.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Mobile View */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {leads && leads.length > 0 ? (
          leads.map((lead: any) => (
            <Card key={lead.id} className="shadow-sm" data-testid={`card-lead-${lead.id}`}>
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium text-lg">{lead.firstName} {lead.lastName}</h3>
                    <div className="flex items-center text-sm text-muted-foreground mt-1">
                      <Phone className="h-3 w-3 mr-1" />
                      {lead.phone}
                    </div>
                  </div>
                  <Select value={lead.status} onValueChange={(value) => handleStatusChange(lead.id, value)}>
                    <SelectTrigger className={`w-28 h-7 text-xs ${getStatusColor(lead.status)}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">Yangi</SelectItem>
                      <SelectItem value="contacted">Qo'ng'iroq</SelectItem>
                      <SelectItem value="trial">Sinov</SelectItem>
                      <SelectItem value="converted">O'qishga o'tdi</SelectItem>
                      <SelectItem value="lost">Yopilgan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Qiziqish</p>
                    <p className="font-medium">{lead.interest}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Manba</p>
                    <p className="font-medium">{lead.source}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t mt-2">
                  <div className="flex items-center text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3 mr-1" />
                    {new Date(lead.createdAt).toLocaleDateString('uz-UZ')}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="h-8 w-8 p-0 text-green-600 border-green-200 bg-green-50">
                      <Phone className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 w-8 p-0 text-destructive border-red-200 bg-red-50" onClick={() => handleDelete(lead.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="shadow-sm">
            <CardContent className="p-8 text-center text-muted-foreground">
              Hozircha lidlar yo'q. Yangi lid qo'shing.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
