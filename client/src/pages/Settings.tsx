import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { translations } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare, AlertCircle, CheckCircle2 } from "lucide-react";

export default function Settings() {
  const { toast } = useToast();
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
      </div>
    </div>
  );
}
