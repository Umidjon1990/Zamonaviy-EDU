import { useState, useEffect, useRef } from "react";
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
import { MessageSquare, AlertCircle, CheckCircle2, Image, Upload, Loader2 } from "lucide-react";

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  
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

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Xatolik", description: "Faqat rasm fayllari yuklash mumkin", variant: "destructive" });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Xatolik", description: "Rasm 5MB dan kichik bo'lishi kerak", variant: "destructive" });
      return;
    }

    setIsUploadingLogo(true);
    try {
      const urlRes = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type,
        }),
      });
      
      if (!urlRes.ok) throw new Error("Failed to get upload URL");
      const { uploadURL, objectPath } = await urlRes.json();

      await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      setBranding(prev => ({ ...prev, logo: objectPath }));
      await brandingMutation.mutateAsync({ logo: objectPath });
      toast({ title: "Muvaffaqiyat", description: "Logo muvaffaqiyatli yuklandi" });
    } catch (error) {
      toast({ title: "Xatolik", description: "Logo yuklashda xatolik yuz berdi", variant: "destructive" });
    } finally {
      setIsUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  const handleSaveBranding = async () => {
    brandingMutation.mutate({
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
                <div className="flex items-center gap-4">
                  <div className="w-24 h-24 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted overflow-hidden">
                    {branding.logo ? (
                      <img 
                        src={branding.logo} 
                        alt="Logo" 
                        className="w-full h-full object-contain"
                        data-testid="img-logo-preview"
                      />
                    ) : (
                      <Image className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <input
                      type="file"
                      accept="image/*"
                      ref={logoInputRef}
                      onChange={handleLogoUpload}
                      className="hidden"
                      data-testid="input-logo-file"
                    />
                    <Button
                      variant="outline"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={isUploadingLogo}
                      data-testid="button-upload-logo"
                    >
                      {isUploadingLogo ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Yuklanmoqda...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Logo yuklash
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-muted-foreground">PNG, JPG. Max 5MB</p>
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
    </div>
  );
}
