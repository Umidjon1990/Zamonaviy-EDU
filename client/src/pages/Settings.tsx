import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { translations } from "@/lib/i18n";

export default function Settings() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">{translations.nav.settings}</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Markaz ma'lumotlari</CardTitle>
            <CardDescription>O‘quv markazingiz haqida umumiy ma'lumotlar</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="center-name">Markaz nomi</Label>
              <Input id="center-name" defaultValue="EduCRM Learning Center" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefon raqam</Label>
              <Input id="phone" defaultValue="+998 90 123 45 67" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Manzil</Label>
              <Input id="address" defaultValue="Toshkent sh., Yunusobod t., 12-uy" />
            </div>
            <Button>Saqlash</Button>
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
              <Switch id="notifications" defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between space-x-2">
              <Label htmlFor="marketing" className="flex flex-col space-y-1">
                <span>Marketing xabarlari</span>
                <span className="font-normal text-xs text-muted-foreground">Yangi kurslar haqida e'lonlar</span>
              </Label>
              <Switch id="marketing" />
            </div>
            <Separator />
            <div className="flex items-center justify-between space-x-2">
              <Label htmlFor="theme" className="flex flex-col space-y-1">
                <span>Tungi rejim</span>
                <span className="font-normal text-xs text-muted-foreground">Interfeys rangini o'zgartirish</span>
              </Label>
              <Switch id="theme" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
