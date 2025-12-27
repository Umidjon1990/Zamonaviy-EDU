import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { translations } from "@/lib/i18n";
import { Plus, Download } from "lucide-react";

// Mock payments data
const mockPayments = [
  { id: 1, student: "Aziz Rahimov", amount: 500000, date: "2024-12-27", type: "Naqd", status: "completed" },
  { id: 2, student: "Malika Karimova", amount: 450000, date: "2024-12-26", type: "Karta (Click)", status: "completed" },
  { id: 3, student: "Jasur Tursunov", amount: 500000, date: "2024-12-25", type: "Payme", status: "pending" },
  { id: 4, student: "Dilnoza Aliyeva", amount: 1200000, date: "2024-12-24", type: "Bank o'tkazmasi", status: "completed" },
  { id: 5, student: "Otabek Usmonov", amount: 300000, date: "2024-12-23", type: "Naqd", status: "failed" },
];

export default function Payments() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">{translations.nav.payments}</h1>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" className="flex-1 sm:flex-none">
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
          <Button className="flex-1 sm:flex-none">
            <Plus className="mr-2 h-4 w-4" /> To‘lov qabul qilish
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Jami tushum (Dekabr)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">35,450,000 UZS</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Kutilayotgan qarzdorlik</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">12,200,000 UZS</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Xarajatlar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">8,500,000 UZS</div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>O‘quvchi</TableHead>
                <TableHead>Summa</TableHead>
                <TableHead>Sana</TableHead>
                <TableHead>To‘lov turi</TableHead>
                <TableHead>Holat</TableHead>
                <TableHead className="text-right">Chek</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockPayments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell className="font-medium">{payment.student}</TableCell>
                  <TableCell>{payment.amount.toLocaleString()} UZS</TableCell>
                  <TableCell>{payment.date}</TableCell>
                  <TableCell>{payment.type}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={
                      payment.status === "completed" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                      payment.status === "pending" ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                      "bg-red-50 text-red-700 border-red-200"
                    }>
                      {payment.status === "completed" ? "To‘langan" : 
                       payment.status === "pending" ? "Tekshirilmoqda" : "Bekor qilingan"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="h-8">Yuklash</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
