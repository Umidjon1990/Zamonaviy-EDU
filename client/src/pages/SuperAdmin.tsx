import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Users, CreditCard, TrendingUp, Plus, Settings } from "lucide-react";
import type { Tenant, SubscriptionPlan } from "@shared/schema";

export default function SuperAdmin() {
  const queryClient = useQueryClient();
  const [isAddTenantOpen, setIsAddTenantOpen] = useState(false);
  const [newTenant, setNewTenant] = useState({
    name: "",
    slug: "",
    phone: "",
    email: "",
    address: "",
    status: "trial",
    planId: 1,
    adminFirstName: "",
    adminLastName: "",
    adminPhone: "",
    adminPassword: "",
  });

  const { data: stats } = useQuery({
    queryKey: ["/api/admin/stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/stats");
      return res.json();
    },
  });

  const { data: tenants = [] } = useQuery<Tenant[]>({
    queryKey: ["/api/admin/tenants"],
    queryFn: async () => {
      const res = await fetch("/api/admin/tenants");
      return res.json();
    },
  });

  const { data: plans = [] } = useQuery<SubscriptionPlan[]>({
    queryKey: ["/api/admin/plans"],
    queryFn: async () => {
      const res = await fetch("/api/admin/plans");
      return res.json();
    },
  });

  const createTenantMutation = useMutation({
    mutationFn: async (data: typeof newTenant) => {
      const res = await fetch("/api/admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create tenant");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setIsAddTenantOpen(false);
      setNewTenant({ name: "", slug: "", phone: "", email: "", address: "", status: "trial", planId: 1, adminFirstName: "", adminLastName: "", adminPhone: "", adminPassword: "" });
    },
  });

  const updateTenantMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Tenant> }) => {
      const res = await fetch(`/api/admin/tenants/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update tenant");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants"] });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500">Faol</Badge>;
      case "trial":
        return <Badge className="bg-blue-500">Sinov</Badge>;
      case "suspended":
        return <Badge className="bg-red-500">To'xtatilgan</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getPlanName = (planId: number | null) => {
    if (!planId) return "—";
    const plan = plans.find(p => p.id === planId);
    return plan?.name || "—";
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("uz-UZ");
  };

  const formatPrice = (price: number) => {
    return price.toLocaleString() + " so'm";
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Super Admin Panel</h1>
          <p className="text-muted-foreground">Barcha markazlarni boshqarish</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Jami Markazlar</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-tenants">{stats?.totalTenants || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Faol</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-active-tenants">{stats?.activeTenants || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sinov</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600" data-testid="text-trial-tenants">{stats?.trialTenants || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">To'xtatilgan</CardTitle>
            <CreditCard className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="text-suspended-tenants">{stats?.suspendedTenants || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="tenants" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tenants" data-testid="tab-tenants">Markazlar</TabsTrigger>
          <TabsTrigger value="plans" data-testid="tab-plans">Tariflar</TabsTrigger>
        </TabsList>

        <TabsContent value="tenants" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Markazlar ro'yxati</h2>
            <Dialog open={isAddTenantOpen} onOpenChange={setIsAddTenantOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-tenant">
                  <Plus className="h-4 w-4 mr-2" />
                  Yangi markaz
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Yangi markaz qo'shish</DialogTitle>
                  <DialogDescription>Yangi o'quv markazi ma'lumotlarini kiriting</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Markaz nomi</Label>
                    <Input
                      id="name"
                      data-testid="input-tenant-name"
                      value={newTenant.name}
                      onChange={(e) => {
                        setNewTenant({ 
                          ...newTenant, 
                          name: e.target.value,
                          slug: generateSlug(e.target.value)
                        });
                      }}
                      placeholder="Masalan: Bilim Akademiyasi"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slug">URL (slug)</Label>
                    <Input
                      id="slug"
                      data-testid="input-tenant-slug"
                      value={newTenant.slug}
                      onChange={(e) => setNewTenant({ ...newTenant, slug: e.target.value })}
                      placeholder="bilim-akademiyasi"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefon</Label>
                    <Input
                      id="phone"
                      data-testid="input-tenant-phone"
                      value={newTenant.phone}
                      onChange={(e) => setNewTenant({ ...newTenant, phone: e.target.value })}
                      placeholder="+998 90 123 45 67"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      data-testid="input-tenant-email"
                      value={newTenant.email}
                      onChange={(e) => setNewTenant({ ...newTenant, email: e.target.value })}
                      placeholder="info@markaz.uz"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Manzil</Label>
                    <Input
                      id="address"
                      data-testid="input-tenant-address"
                      value={newTenant.address}
                      onChange={(e) => setNewTenant({ ...newTenant, address: e.target.value })}
                      placeholder="Toshkent sh., Chilonzor tumani"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="plan">Tarif</Label>
                    <Select
                      value={newTenant.planId.toString()}
                      onValueChange={(value) => setNewTenant({ ...newTenant, planId: parseInt(value) })}
                    >
                      <SelectTrigger data-testid="select-tenant-plan">
                        <SelectValue placeholder="Tarifni tanlang" />
                      </SelectTrigger>
                      <SelectContent>
                        {plans.map((plan) => (
                          <SelectItem key={plan.id} value={plan.id.toString()}>
                            {plan.name} - {formatPrice(plan.price)}/oy
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="border-t pt-4 mt-4">
                    <h4 className="font-medium mb-3">Markaz admini</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="adminFirstName">Ism</Label>
                        <Input
                          id="adminFirstName"
                          data-testid="input-admin-firstname"
                          value={newTenant.adminFirstName}
                          onChange={(e) => setNewTenant({ ...newTenant, adminFirstName: e.target.value })}
                          placeholder="Admin ismi"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="adminLastName">Familiya</Label>
                        <Input
                          id="adminLastName"
                          data-testid="input-admin-lastname"
                          value={newTenant.adminLastName}
                          onChange={(e) => setNewTenant({ ...newTenant, adminLastName: e.target.value })}
                          placeholder="Admin familiyasi"
                        />
                      </div>
                    </div>
                    <div className="space-y-2 mt-3">
                      <Label htmlFor="adminPhone">Login (Telefon raqami)</Label>
                      <Input
                        id="adminPhone"
                        data-testid="input-admin-phone"
                        value={newTenant.adminPhone}
                        onChange={(e) => setNewTenant({ ...newTenant, adminPhone: e.target.value })}
                        placeholder="998901234567"
                      />
                    </div>
                    <div className="space-y-2 mt-3">
                      <Label htmlFor="adminPassword">Parol</Label>
                      <Input
                        id="adminPassword"
                        type="password"
                        data-testid="input-admin-password"
                        value={newTenant.adminPassword}
                        onChange={(e) => setNewTenant({ ...newTenant, adminPassword: e.target.value })}
                        placeholder="Parolni kiriting"
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddTenantOpen(false)}>
                    Bekor qilish
                  </Button>
                  <Button 
                    onClick={() => createTenantMutation.mutate(newTenant)}
                    disabled={!newTenant.name || !newTenant.slug || !newTenant.phone || !newTenant.adminPhone || !newTenant.adminPassword}
                    data-testid="button-save-tenant"
                  >
                    Saqlash
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Markaz</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Telefon</TableHead>
                  <TableHead>Tarif</TableHead>
                  <TableHead>Holat</TableHead>
                  <TableHead>Obuna tugash</TableHead>
                  <TableHead>Amallar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map((tenant) => (
                  <TableRow key={tenant.id} data-testid={`row-tenant-${tenant.id}`}>
                    <TableCell className="font-medium">{tenant.name}</TableCell>
                    <TableCell className="text-muted-foreground">{tenant.slug}</TableCell>
                    <TableCell>{tenant.phone}</TableCell>
                    <TableCell>{getPlanName(tenant.planId)}</TableCell>
                    <TableCell>{getStatusBadge(tenant.status)}</TableCell>
                    <TableCell>{formatDate(tenant.subscriptionEndsAt)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Select
                          value={tenant.status}
                          onValueChange={(value) => updateTenantMutation.mutate({ 
                            id: tenant.id, 
                            data: { status: value } 
                          })}
                        >
                          <SelectTrigger className="w-[130px]" data-testid={`select-status-${tenant.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Faol</SelectItem>
                            <SelectItem value="trial">Sinov</SelectItem>
                            <SelectItem value="suspended">To'xtatish</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {tenants.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Hali markazlar yo'q
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="plans" className="space-y-4">
          <h2 className="text-xl font-semibold">Tarif rejalari</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {plans.map((plan) => (
              <Card key={plan.id} data-testid={`card-plan-${plan.id}`}>
                <CardHeader>
                  <CardTitle>{plan.name}</CardTitle>
                  <CardDescription>
                    <span className="text-2xl font-bold text-primary">{formatPrice(plan.price)}</span>
                    <span className="text-muted-foreground">/oy</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">O'quvchilar:</span>
                    <span className="font-medium">{plan.maxStudents} ta</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">O'qituvchilar:</span>
                    <span className="font-medium">{plan.maxTeachers} ta</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Guruhlar:</span>
                    <span className="font-medium">{plan.maxGroups} ta</span>
                  </div>
                  <div className="pt-2">
                    <span className="text-muted-foreground text-sm">Xususiyatlar:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {plan.features?.map((feature, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {feature}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
