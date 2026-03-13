import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { translations } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, AlertCircle, CheckCircle2, Image, ShieldCheck, Plus, Trash2, Eye, EyeOff, Copy, Users, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { convertGoogleDriveUrl } from "@/lib/utils";

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  
  const [centerInfo, setCenterInfo] = useState({
    name: "Zamonaviy-Edu Learning Center",
    phone: "+998 90 123 45 67",
    address: "Toshkent sh., Yunusobod t., 12-uy",
  });

  const [notifications, setNotifications] = useState({
    smsEnabled: true,
    marketingEnabled: false,
    darkMode: false,
  });

  const [branding, setBranding] = useState({
    logo: "",
    receiptTitle: "",
    telegramChannel: "",
  });

  const [rahbarDialogOpen, setRahbarDialogOpen] = useState(false);
  const [rahbarForm, setRahbarForm] = useState({ firstName: "", lastName: "", phone: "", password: "" });
  const [createdRahbarPassword, setCreatedRahbarPassword] = useState<string | null>(null);

  const [staffDialogOpen, setStaffDialogOpen] = useState(false);
  const [editStaffId, setEditStaffId] = useState<string | null>(null);
  const [staffForm, setStaffForm] = useState({ firstName: "", lastName: "", phone: "", salaryAmount: 0 });

  const { data: brandingData, isLoading: isBrandingLoading } = useQuery({
    queryKey: ["branding"],
    queryFn: async () => {
      const res = await fetch("/api/branding");
      if (!res.ok) return null;
      return res.json();
    },
  });

  useEffect(() => {
    if (brandingData) {
      setBranding({
        logo: brandingData.logo || "",
        receiptTitle: brandingData.receiptTitle || "",
        telegramChannel: brandingData.telegramChannel || "",
      });
    }
  }, [brandingData]);

  const brandingMutation = useMutation({
    mutationFn: async (data: { logo?: string; receiptTitle?: string; telegramChannel?: string }) => {
      const res = await fetch("/api/branding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update branding");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branding"] });
      toast({ title: "Muvaffaqiyat", description: "Brending sozlamalari saqlandi" });
    },
    onError: () => {
      toast({ title: "Xatolik", description: "Saqlashda xatolik yuz berdi", variant: "destructive" });
    },
  });

  const handleSaveBranding = async () => {
    brandingMutation.mutate({
      logo: branding.logo || undefined,
      receiptTitle: branding.receiptTitle,
      telegramChannel: branding.telegramChannel,
    });
  };

  const { data: smsBalance } = useQuery({
    queryKey: ["sms-balance"],
    queryFn: async () => {
      const res = await fetch("/api/sms/balance");
      return res.json();
    },
  });

  const { data: tenantSms } = useQuery({
    queryKey: ["tenant-sms"],
    queryFn: async () => {
      const res = await fetch("/api/tenant-sms");
      if (!res.ok) return null;
      return res.json();
    },
  });

  const { data: managers, isLoading: managersLoading } = useQuery({
    queryKey: ["managers"],
    queryFn: async () => {
      const res = await fetch("/api/managers", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const createManagerMutation = useMutation({
    mutationFn: async (data: { firstName: string; lastName: string; phone: string; password: string }) => {
      const res = await fetch("/api/managers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Xatolik");
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["managers"] });
      setCreatedRahbarPassword(variables.password);
      setRahbarForm({ firstName: "", lastName: "", phone: "", password: "" });
      toast({ title: "Muvaffaqiyat", description: "Rahbar yaratildi" });
    },
    onError: (err: Error) => {
      toast({ title: "Xatolik", description: err.message, variant: "destructive" });
    },
  });

  const deleteManagerMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/managers/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Xatolik");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["managers"] });
      toast({ title: "O'chirildi", description: "Rahbar o'chirildi" });
    },
    onError: (err: Error) => {
      toast({ title: "Xatolik", description: err.message, variant: "destructive" });
    },
  });

  const { data: staffList, isLoading: staffLoading } = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const res = await fetch("/api/staff", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const createStaffMutation = useMutation({
    mutationFn: async (data: { firstName: string; lastName: string; phone: string; salaryAmount: number }) => {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Xatolik");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      setStaffDialogOpen(false);
      setStaffForm({ firstName: "", lastName: "", phone: "", salaryAmount: 0 });
      toast({ title: "Muvaffaqiyat", description: "Xodim qo'shildi" });
    },
    onError: (err: Error) => {
      toast({ title: "Xatolik", description: err.message, variant: "destructive" });
    },
  });

  const updateStaffMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; firstName: string; lastName: string; phone: string; salaryAmount: number }) => {
      const res = await fetch(`/api/staff/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Xatolik");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      setStaffDialogOpen(false);
      setEditStaffId(null);
      setStaffForm({ firstName: "", lastName: "", phone: "", salaryAmount: 0 });
      toast({ title: "Muvaffaqiyat", description: "Xodim yangilandi" });
    },
    onError: (err: Error) => {
      toast({ title: "Xatolik", description: err.message, variant: "destructive" });
    },
  });

  const deleteStaffMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/staff/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Xatolik");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      toast({ title: "O'chirildi", description: "Xodim o'chirildi" });
    },
    onError: (err: Error) => {
      toast({ title: "Xatolik", description: err.message, variant: "destructive" });
    },
  });

  const handleSaveCenter = async () => {
    setIsSaving(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      localStorage.setItem("centerInfo", JSON.stringify(centerInfo));
      toast({ title: "Muvaffaqiyat", description: "Markaz ma'lumotlari saqlandi" });
    } catch (error) {
      toast({ title: "Xatolik", description: "Saqlashda xatolik yuz berdi", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveNotifications = async () => {
    setIsSaving(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      localStorage.setItem("notifications", JSON.stringify(notifications));
      toast({ title: "Muvaffaqiyat", description: "Sozlamalar saqlandi" });
    } catch (error) {
      toast({ title: "Xatolik", description: "Saqlashda xatolik yuz berdi", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">{translations.nav.settings}</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Markaz ma'lumotlari</CardTitle>
            <CardDescription>O'quv markazingiz haqida umumiy ma'lumotlar</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="center-name">Markaz nomi</Label>
              <Input 
                id="center-name" 
                value={centerInfo.name}
                onChange={(e) => setCenterInfo({ ...centerInfo, name: e.target.value })}
                data-testid="input-center-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefon raqam</Label>
              <Input 
                id="phone" 
                value={centerInfo.phone}
                onChange={(e) => setCenterInfo({ ...centerInfo, phone: e.target.value })}
                data-testid="input-phone"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Manzil</Label>
              <Input 
                id="address" 
                value={centerInfo.address}
                onChange={(e) => setCenterInfo({ ...centerInfo, address: e.target.value })}
                data-testid="input-address"
              />
            </div>
            <Button onClick={handleSaveCenter} disabled={isSaving} data-testid="button-save-center">
              {isSaving ? "Saqlanmoqda..." : "Saqlash"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tizim sozlamalari</CardTitle>
            <CardDescription>Bildirishnomalar va xavfsizlik</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between space-x-2">
              <Label htmlFor="notifications" className="flex flex-col space-y-1">
                <span>SMS xabarnomalar</span>
                <span className="font-normal text-xs text-muted-foreground">Ota-onalarga davomat haqida SMS yuborish</span>
              </Label>
              <Switch 
                id="notifications" 
                checked={notifications.smsEnabled}
                onCheckedChange={(checked) => setNotifications({ ...notifications, smsEnabled: checked })}
                data-testid="switch-sms"
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between space-x-2">
              <Label htmlFor="marketing" className="flex flex-col space-y-1">
                <span>Marketing xabarlari</span>
                <span className="font-normal text-xs text-muted-foreground">Yangi kurslar haqida e'lonlar</span>
              </Label>
              <Switch 
                id="marketing"
                checked={notifications.marketingEnabled}
                onCheckedChange={(checked) => setNotifications({ ...notifications, marketingEnabled: checked })}
                data-testid="switch-marketing"
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between space-x-2">
              <Label htmlFor="theme" className="flex flex-col space-y-1">
                <span>Tungi rejim</span>
                <span className="font-normal text-xs text-muted-foreground">Interfeys rangini o'zgartirish</span>
              </Label>
              <Switch 
                id="theme"
                checked={notifications.darkMode}
                onCheckedChange={(checked) => setNotifications({ ...notifications, darkMode: checked })}
                data-testid="switch-dark-mode"
              />
            </div>
            <Button onClick={handleSaveNotifications} disabled={isSaving} data-testid="button-save-notifications">
              {isSaving ? "Saqlanmoqda..." : "Saqlash"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              SMS xizmati
            </CardTitle>
            <CardDescription>Markaz SMS krediti va holati</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {tenantSms ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Xizmat holati:</span>
                  {tenantSms.smsEnabled ? (
                    <Badge className="bg-green-500 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Yoqilgan
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      O'chirilgan
                    </Badge>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Qolgan kredit:</span>
                  <div className="text-2xl font-bold" data-testid="text-sms-credits">
                    {tenantSms.smsCredits.toLocaleString()} SMS
                  </div>
                </div>
                {!tenantSms.smsEnabled && (
                  <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                    SMS xizmati admin tomonidan yoqilmagan. Yoqish uchun administrator bilan bog'laning.
                  </p>
                )}
                {tenantSms.smsEnabled && tenantSms.smsCredits <= 10 && (
                  <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-md">
                    SMS kredit kam qoldi! Yangi kredit sotib olish uchun administrator bilan bog'laning.
                  </p>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">Yuklanmoqda...</p>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="h-5 w-5" />
              Brending sozlamalari
            </CardTitle>
            <CardDescription>Chek va hujjatlarda ko'rinadigan markaz logosi va ma'lumotlari</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <Label>Markaz logosi</Label>
                <div className="flex items-start gap-4">
                  <div className="w-24 h-24 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted overflow-hidden shrink-0">
                    {branding.logo ? (
                      <img 
                        src={convertGoogleDriveUrl(branding.logo) || branding.logo} 
                        alt="Logo" 
                        className="w-full h-full object-contain"
                        data-testid="img-logo-preview"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <Image className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="space-y-2 flex-1">
                    <Input
                      value={branding.logo}
                      onChange={(e) => setBranding({ ...branding, logo: e.target.value })}
                      placeholder="https://drive.google.com/file/d/..."
                      data-testid="input-logo-url"
                    />
                    <p className="text-xs text-muted-foreground">Google Drive havolasi yoki to'g'ridan-to'g'ri rasm URL kiriting</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="receipt-title">Chekdagi markaz nomi</Label>
                  <Input
                    id="receipt-title"
                    value={branding.receiptTitle}
                    onChange={(e) => setBranding({ ...branding, receiptTitle: e.target.value })}
                    placeholder="Masalan: Zamonaviy O'quv Markazi"
                    data-testid="input-receipt-title"
                  />
                  <p className="text-xs text-muted-foreground">To'lov chekida ko'rinadigan markaz nomi</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="telegram-channel">Telegram kanal</Label>
                  <Input
                    id="telegram-channel"
                    value={branding.telegramChannel}
                    onChange={(e) => setBranding({ ...branding, telegramChannel: e.target.value })}
                    placeholder="@markaznomi yoki https://t.me/markaznomi"
                    data-testid="input-telegram-channel"
                  />
                  <p className="text-xs text-muted-foreground">Chekda QR kod bilan ko'rsatiladi</p>
                </div>
              </div>
            </div>

            <Button 
              onClick={handleSaveBranding} 
              disabled={brandingMutation.isPending}
              data-testid="button-save-branding"
            >
              {brandingMutation.isPending ? "Saqlanmoqda..." : "Saqlash"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-6 h-6 text-emerald-600" />
              <div>
                <CardTitle>Rahbar boshqaruvi</CardTitle>
                <CardDescription>Kassa tasdiqlash uchun rahbar yarating. Rahbar <code className="text-xs bg-muted px-1 py-0.5 rounded">/rahbar-login</code> sahifasidan kiradi.</CardDescription>
              </div>
            </div>
            <Dialog open={rahbarDialogOpen} onOpenChange={(open) => { setRahbarDialogOpen(open); if (!open) setCreatedRahbarPassword(null); }}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-add-rahbar">
                  <Plus className="w-4 h-4 mr-2" /> Rahbar qo'shish
                </Button>
              </DialogTrigger>
              <DialogContent>
                {createdRahbarPassword ? (
                  <>
                    <DialogHeader>
                      <DialogTitle>Rahbar yaratildi</DialogTitle>
                      <DialogDescription>Parolni nusxalab oling. Dialog yopilgandan keyin parolni qayta ko'rib bo'lmaydi!</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                        <p className="text-xs text-amber-600 mb-2">Parol (faqat bir marta ko'rsatiladi)</p>
                        <p className="text-2xl font-mono font-bold text-amber-800" data-testid="text-created-password">{createdRahbarPassword}</p>
                      </div>
                      <Button
                        className="w-full"
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(createdRahbarPassword);
                          toast({ title: "Nusxalandi", description: "Parol nusxalandi" });
                        }}
                        data-testid="button-copy-rahbar-password"
                      >
                        <Copy className="w-4 h-4 mr-2" /> Parolni nusxalash
                      </Button>
                    </div>
                    <DialogFooter>
                      <Button onClick={() => { setRahbarDialogOpen(false); setCreatedRahbarPassword(null); }}>Yopish</Button>
                    </DialogFooter>
                  </>
                ) : (
                  <>
                    <DialogHeader>
                      <DialogTitle>Yangi rahbar yaratish</DialogTitle>
                      <DialogDescription>Rahbar kassa topshiruvlarini tasdiqlash/rad etish uchun javobgar</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Ism</Label>
                          <Input
                            value={rahbarForm.firstName}
                            onChange={(e) => setRahbarForm({ ...rahbarForm, firstName: e.target.value })}
                            placeholder="Ism"
                            data-testid="input-rahbar-firstname"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Familiya</Label>
                          <Input
                            value={rahbarForm.lastName}
                            onChange={(e) => setRahbarForm({ ...rahbarForm, lastName: e.target.value })}
                            placeholder="Familiya"
                            data-testid="input-rahbar-lastname"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Telefon raqam</Label>
                        <Input
                          value={rahbarForm.phone}
                          onChange={(e) => setRahbarForm({ ...rahbarForm, phone: e.target.value })}
                          placeholder="+998901234567"
                          data-testid="input-rahbar-phone-create"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Parol</Label>
                        <Input
                          value={rahbarForm.password}
                          onChange={(e) => setRahbarForm({ ...rahbarForm, password: e.target.value })}
                          placeholder="Parol kiriting"
                          data-testid="input-rahbar-password-create"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setRahbarDialogOpen(false)}>Bekor qilish</Button>
                      <Button
                        onClick={() => {
                          if (!rahbarForm.firstName || !rahbarForm.lastName || !rahbarForm.phone || !rahbarForm.password) {
                            toast({ title: "Xatolik", description: "Barcha maydonlarni to'ldiring", variant: "destructive" });
                            return;
                          }
                          createManagerMutation.mutate(rahbarForm);
                        }}
                        disabled={createManagerMutation.isPending}
                        data-testid="button-create-rahbar-submit"
                      >
                        {createManagerMutation.isPending ? "Yaratilmoqda..." : "Yaratish"}
                      </Button>
                    </DialogFooter>
                  </>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {managersLoading ? (
            <p className="text-muted-foreground text-sm">Yuklanmoqda...</p>
          ) : (managers || []).length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ism</TableHead>
                  <TableHead>Telefon</TableHead>
                  <TableHead>Yaratilgan</TableHead>
                  <TableHead className="text-right">Amallar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(managers || []).map((m: any) => (
                  <TableRow key={m.id} data-testid={`row-manager-${m.id}`}>
                    <TableCell className="font-medium">{m.firstName} {m.lastName}</TableCell>
                    <TableCell>{m.phone}</TableCell>
                    <TableCell>{new Date(m.createdAt).toLocaleDateString("uz-UZ")}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => {
                          if (confirm("Rahbarni o'chirishni xohlaysizmi?")) {
                            deleteManagerMutation.mutate(m.id);
                          }
                        }}
                        data-testid={`button-delete-manager-${m.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <ShieldCheck className="w-12 h-12 mx-auto mb-2 opacity-20" />
              <p>Hali rahbar qo'shilmagan</p>
              <p className="text-xs mt-1">Rahbar qo'shish tugmasini bosing</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="w-6 h-6 text-blue-600" />
              <div>
                <CardTitle>Xodimlar</CardTitle>
                <CardDescription>Admin, buxgalter va boshqa xodimlarni qo'shing. Oylik maosh belgilang.</CardDescription>
              </div>
            </div>
            <Dialog open={staffDialogOpen} onOpenChange={(open) => { setStaffDialogOpen(open); if (!open) { setEditStaffId(null); setStaffForm({ firstName: "", lastName: "", phone: "", salaryAmount: 0 }); } }}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-add-staff">
                  <Plus className="w-4 h-4 mr-2" /> Xodim qo'shish
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editStaffId ? "Xodimni tahrirlash" : "Yangi xodim qo'shish"}</DialogTitle>
                  <DialogDescription>Xodim ma'lumotlarini kiriting</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Ism</Label>
                      <Input
                        value={staffForm.firstName}
                        onChange={(e) => setStaffForm({ ...staffForm, firstName: e.target.value })}
                        placeholder="Ism"
                        data-testid="input-staff-firstname"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Familiya</Label>
                      <Input
                        value={staffForm.lastName}
                        onChange={(e) => setStaffForm({ ...staffForm, lastName: e.target.value })}
                        placeholder="Familiya"
                        data-testid="input-staff-lastname"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Telefon raqam</Label>
                    <Input
                      value={staffForm.phone}
                      onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })}
                      placeholder="+998901234567"
                      data-testid="input-staff-phone"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Oylik miqdori (so'm)</Label>
                    <Input
                      type="number"
                      value={staffForm.salaryAmount || ""}
                      onChange={(e) => setStaffForm({ ...staffForm, salaryAmount: parseInt(e.target.value) || 0 })}
                      placeholder="0"
                      data-testid="input-staff-salary"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setStaffDialogOpen(false); setEditStaffId(null); }}>Bekor qilish</Button>
                  <Button
                    onClick={() => {
                      if (!staffForm.firstName || !staffForm.lastName || !staffForm.phone) {
                        toast({ title: "Xatolik", description: "Ism, familiya va telefon kiriting", variant: "destructive" });
                        return;
                      }
                      if (editStaffId) {
                        updateStaffMutation.mutate({ id: editStaffId, ...staffForm });
                      } else {
                        createStaffMutation.mutate(staffForm);
                      }
                    }}
                    disabled={createStaffMutation.isPending || updateStaffMutation.isPending}
                    data-testid="button-submit-staff"
                  >
                    {editStaffId ? "Yangilash" : "Qo'shish"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {staffLoading ? (
            <p className="text-muted-foreground text-sm">Yuklanmoqda...</p>
          ) : (staffList || []).length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ism</TableHead>
                  <TableHead>Telefon</TableHead>
                  <TableHead>Oylik</TableHead>
                  <TableHead className="text-right">Amallar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(staffList || []).map((s: any) => (
                  <TableRow key={s.id} data-testid={`row-staff-${s.id}`}>
                    <TableCell className="font-medium">{s.firstName} {s.lastName}</TableCell>
                    <TableCell>{s.phone}</TableCell>
                    <TableCell>{(s.salaryAmount || 0).toLocaleString()} so'm</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditStaffId(s.id);
                            setStaffForm({ firstName: s.firstName, lastName: s.lastName, phone: s.phone || "", salaryAmount: s.salaryAmount || 0 });
                            setStaffDialogOpen(true);
                          }}
                          data-testid={`button-edit-staff-${s.id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => {
                            if (confirm("Xodimni o'chirishni xohlaysizmi?")) {
                              deleteStaffMutation.mutate(s.id);
                            }
                          }}
                          data-testid={`button-delete-staff-${s.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-20" />
              <p>Hali xodim qo'shilmagan</p>
              <p className="text-xs mt-1">Xodim qo'shish tugmasini bosing</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
