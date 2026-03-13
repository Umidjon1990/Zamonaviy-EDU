import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ShieldCheck, LogOut, HandCoins, Clock, ThumbsUp, ThumbsDown, Banknote, CheckCircle2, XCircle, Wallet
} from "lucide-react";

const months = [
  { value: "1", label: "Yanvar" }, { value: "2", label: "Fevral" },
  { value: "3", label: "Mart" }, { value: "4", label: "Aprel" },
  { value: "5", label: "May" }, { value: "6", label: "Iyun" },
  { value: "7", label: "Iyul" }, { value: "8", label: "Avgust" },
  { value: "9", label: "Sentyabr" }, { value: "10", label: "Oktyabr" },
  { value: "11", label: "Noyabr" }, { value: "12", label: "Dekabr" },
];

const currentMonth = (new Date().getMonth() + 1).toString();
const currentYear = new Date().getFullYear().toString();

export default function RahbarDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [statusFilter, setStatusFilter] = useState("all");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReceiptId, setRejectReceiptId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data: user } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (!res.ok) throw new Error("Not authenticated");
      return res.json();
    },
    retry: false,
  });

  const { data: cashReceipts, isLoading: cashLoading } = useQuery({
    queryKey: ["cash-receipts", selectedMonth, selectedYear, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ month: selectedMonth, year: selectedYear });
      if (statusFilter !== "all") params.append("status", statusFilter);
      const res = await fetch(`/api/cash-receipts?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Kassa ma'lumotlarini olishda xatolik");
      return res.json();
    },
  });

  const { data: cashStats } = useQuery({
    queryKey: ["cash-receipts-stats", selectedMonth, selectedYear],
    queryFn: async () => {
      const res = await fetch(`/api/cash-receipts/stats/summary?month=${selectedMonth}&year=${selectedYear}`, { credentials: "include" });
      if (!res.ok) throw new Error("Statistikani olishda xatolik");
      return res.json();
    },
  });

  const { data: dashboardData } = useQuery({
    queryKey: ["finance-dashboard", selectedMonth, selectedYear],
    queryFn: async () => {
      const res = await fetch(`/api/finance/dashboard?month=${selectedMonth}&year=${selectedYear}`, { credentials: "include" });
      if (!res.ok) throw new Error("Moliya ma'lumotlarini olishda xatolik");
      return res.json();
    },
  });

  const { data: expensesData } = useQuery({
    queryKey: ["expenses", selectedMonth, selectedYear],
    queryFn: async () => {
      const res = await fetch(`/api/expenses?month=${selectedMonth}&year=${selectedYear}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const monthlyIncome = dashboardData?.monthlyIncome || 0;

  const acceptMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/cash-receipts/${id}/accept`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Xatolik");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cash-receipts"] });
      queryClient.invalidateQueries({ queryKey: ["cash-receipts-stats"] });
      toast({ title: "Qabul qilindi", description: "Pul topshirish tasdiqlandi" });
    },
    onError: (err: Error) => {
      toast({ title: "Xatolik", description: err.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      const res = await fetch(`/api/cash-receipts/${id}/reject`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Xatolik");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cash-receipts"] });
      queryClient.invalidateQueries({ queryKey: ["cash-receipts-stats"] });
      setRejectDialogOpen(false);
      setRejectReceiptId(null);
      setRejectReason("");
      toast({ title: "Rad etildi", description: "Pul topshirish rad etildi" });
    },
    onError: (err: Error) => {
      toast({ title: "Xatolik", description: err.message, variant: "destructive" });
    },
  });

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      window.location.href = "/rahbar-login";
    } catch (error) {
      console.error("Logout xatosi:", error);
    }
  };

  const monthlyExpenses = dashboardData?.monthlyExpenses || 0;
  const toBeSubmitted = monthlyIncome - monthlyExpenses - (cashStats?.totalAccepted || 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50">
      <header className="sticky top-0 z-40 w-full border-b bg-white/95 backdrop-blur px-4 md:px-8 h-16 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-emerald-100 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="font-bold text-lg">Rahbar Kabineti</h1>
            {user && <p className="text-xs text-muted-foreground">{user.firstName} {user.lastName} - {user.tenantName}</p>}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleLogout} data-testid="button-rahbar-logout">
          <LogOut className="w-4 h-4 mr-2" /> Chiqish
        </Button>
      </header>

      <main className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
        <div className="flex flex-wrap gap-3 items-center">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[140px]" data-testid="select-rahbar-month">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map(m => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[100px]" data-testid="select-rahbar-year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["2024", "2025", "2026"].map(y => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-2">
                <Banknote className="w-5 h-5 text-blue-500" />
                <p className="text-sm text-muted-foreground">Umumiy tushum</p>
              </div>
              <p className="text-2xl font-bold text-blue-600" data-testid="text-rahbar-total-income">
                {monthlyIncome.toLocaleString()} UZS
              </p>
              <p className="text-xs text-muted-foreground mt-1">Oylik tushum</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-red-400">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-2">
                <XCircle className="w-5 h-5 text-red-400" />
                <p className="text-sm text-muted-foreground">Xarajatlar</p>
              </div>
              <p className="text-2xl font-bold text-red-500" data-testid="text-rahbar-expenses">
                {monthlyExpenses.toLocaleString()} UZS
              </p>
              <p className="text-xs text-muted-foreground mt-1">Oylik xarajat</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-red-600">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-2">
                <HandCoins className="w-5 h-5 text-red-600" />
                <p className="text-sm text-muted-foreground">Topshirilishi kerak</p>
              </div>
              <p className={`text-2xl font-bold ${toBeSubmitted < 0 ? 'text-red-600' : 'text-orange-600'}`} data-testid="text-rahbar-remaining">
                {toBeSubmitted.toLocaleString()} UZS
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {monthlyIncome.toLocaleString()} - {monthlyExpenses.toLocaleString()} - {(cashStats?.totalAccepted || 0).toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-orange-500">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-2">
                <Clock className="w-5 h-5 text-orange-500" />
                <p className="text-sm text-muted-foreground">Kutilayotgan</p>
              </div>
              <p className="text-2xl font-bold text-orange-600" data-testid="text-rahbar-pending">
                {(cashStats?.pendingAmount || 0).toLocaleString()} UZS
              </p>
              <p className="text-xs text-muted-foreground mt-1">{cashStats?.pendingCount || 0} ta topshiriq</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-emerald-500">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <p className="text-sm text-muted-foreground">Tasdiqlangan</p>
              </div>
              <p className="text-2xl font-bold text-emerald-600" data-testid="text-rahbar-accepted">
                {(cashStats?.totalAccepted || 0).toLocaleString()} UZS
              </p>
            </CardContent>
          </Card>
        </div>

        {monthlyExpenses > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Wallet className="w-4 h-4 text-red-500" />
                <h3 className="font-semibold text-sm">Oylik xarajatlar ro'yxati</h3>
                <Badge variant="secondary" className="ml-auto">{(expensesData || []).length} ta</Badge>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sana</TableHead>
                      <TableHead>Nomi</TableHead>
                      <TableHead>Kategoriya</TableHead>
                      <TableHead className="text-right">Summa</TableHead>
                      <TableHead>Izoh</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(expensesData || []).map((e: any) => (
                      <TableRow key={e.id}>
                        <TableCell className="whitespace-nowrap text-sm">{new Date(e.date).toLocaleDateString("uz-UZ")}</TableCell>
                        <TableCell className="font-medium text-sm">{e.title}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {e.category === "rent" ? "Ijara" : e.category === "salary" ? "O'qituvchi oyligi" : e.category === "staff_salary" ? "Xodim oyligi" : e.category === "supplies" ? "Jihozlar" : e.category === "utilities" ? "Kommunal" : e.category === "marketing" ? "Reklama" : "Boshqa"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium text-red-600 text-sm">{e.amount.toLocaleString()} UZS</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{e.notes || "-"}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell colSpan={3}>Jami xarajat</TableCell>
                      <TableCell className="text-right text-red-600">{monthlyExpenses.toLocaleString()} UZS</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-2 items-center">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]" data-testid="select-rahbar-status-filter">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barchasi</SelectItem>
              <SelectItem value="pending">Kutilayotgan</SelectItem>
              <SelectItem value="accepted">Tasdiqlangan</SelectItem>
              <SelectItem value="rejected">Rad etilgan</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Sana</TableHead>
                  <TableHead>Summa</TableHead>
                  <TableHead>Topshirgan</TableHead>
                  <TableHead>To'lov turi</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Izoh</TableHead>
                  <TableHead className="text-right">Amallar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cashLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <Skeleton className="h-6 w-48 mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : (cashReceipts || []).length > 0 ? (
                  (cashReceipts || []).map((r: any) => (
                    <TableRow key={r.id} data-testid={`row-rahbar-receipt-${r.id}`}>
                      <TableCell className="font-mono text-sm">#{r.id}</TableCell>
                      <TableCell>{new Date(r.submittedAt).toLocaleDateString("uz-UZ")}</TableCell>
                      <TableCell className="font-bold">{r.amount.toLocaleString()} UZS</TableCell>
                      <TableCell>
                        {r.submittedByUser ? `${r.submittedByUser.firstName} ${r.submittedByUser.lastName}` : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {r.paymentType === "cash" ? "Naqd" : r.paymentType === "card" ? "Karta" : "Bank"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={r.status === "accepted" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}
                          className={r.status === "accepted" ? "bg-emerald-100 text-emerald-800" : r.status === "pending" ? "bg-orange-100 text-orange-800" : ""}
                        >
                          {r.status === "pending" ? "Kutilmoqda" : r.status === "accepted" ? "Tasdiqlangan" : "Rad etilgan"}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate" title={r.note || r.rejectionReason || ""}>
                        {r.rejectionReason || r.note || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.status === "pending" && (
                          <div className="flex gap-1 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-emerald-600 hover:bg-emerald-50 hover:border-emerald-300"
                              onClick={() => acceptMutation.mutate(r.id)}
                              disabled={acceptMutation.isPending}
                              data-testid={`button-rahbar-accept-${r.id}`}
                            >
                              <ThumbsUp className="w-3 h-3 mr-1" /> Qabul
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 hover:bg-red-50 hover:border-red-300"
                              onClick={() => { setRejectReceiptId(r.id); setRejectDialogOpen(true); }}
                              data-testid={`button-rahbar-reject-${r.id}`}
                            >
                              <ThumbsDown className="w-3 h-3 mr-1" /> Rad
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      <HandCoins className="w-12 h-12 mx-auto mb-2 opacity-20" />
                      Pul topshirishlar topilmadi
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rad etish</DialogTitle>
              <DialogDescription>Rad etish sababini kiriting</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Sabab..."
                data-testid="input-rahbar-reject-reason"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Bekor qilish</Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (rejectReceiptId !== null) {
                    rejectMutation.mutate({ id: rejectReceiptId, reason: rejectReason });
                  }
                }}
                disabled={rejectMutation.isPending}
                data-testid="button-rahbar-confirm-reject"
              >
                {rejectMutation.isPending ? "Rad etilmoqda..." : "Rad etish"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
