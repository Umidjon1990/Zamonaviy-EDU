import { useState, useEffect } from "react";
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
import { Building2, Users, CreditCard, TrendingUp, Plus, Settings, Pencil, Trash2, LogOut } from "lucide-react";
import { useLocation } from "wouter";
import type { Tenant, SubscriptionPlan } from "@shared/schema";

function getAuthHeaders() {
  const token = localStorage.getItem("superAdminToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function SuperAdmin() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("superAdminToken");
    if (!token) {
      setLocation("/super-admin-login");
      return;
    }
    
    fetch("/api/super-admin/verify", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data.valid) {
          localStorage.removeItem("superAdminToken");
          setLocation("/super-admin-login");
        } else {
          setIsAuthenticated(true);
        }
      })
      .catch(() => {
        setLocation("/super-admin-login");
      });
  }, [setLocation]);

  const handleLogout = () => {
    localStorage.removeItem("superAdminToken");
    setLocation("/super-admin-login");
  };

  const [isAddTenantOpen, setIsAddTenantOpen] = useState(false);
  const [isAddPlanOpen, setIsAddPlanOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [newTenant, setNewTenant] = useState({
    name: "",
    slug: "",
    phone: "",
    email: "",
    address: "",
    status: "trial",
    planId: 1,
    trialDays: 14,
    subscriptionEndsAt: "",
    adminFirstName: "",
    adminLastName: "",
    adminPhone: "",
    adminPassword: "",
  });
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [newPlan, setNewPlan] = useState({
    name: "",
    price: 0,
    maxStudents: 50,
    maxTeachers: 5,
    maxGroups: 10,
    features: [] as string[],
    isActive: true,
  });
  const [featureInput, setFeatureInput] = useState("");

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
      setNewTenant({ name: "", slug: "", phone: "", email: "", address: "", status: "trial", planId: 1, trialDays: 14, subscriptionEndsAt: "", adminFirstName: "", adminLastName: "", adminPhone: "", adminPassword: "" });
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
      setEditingTenant(null);
    },
  });

  const createPlanMutation = useMutation({
    mutationFn: async (data: typeof newPlan) => {
      const res = await fetch("/api/admin/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create plan");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/plans"] });
      setIsAddPlanOpen(false);
      setNewPlan({ name: "", price: 0, maxStudents: 50, maxTeachers: 5, maxGroups: 10, features: [], isActive: true });
      setFeatureInput("");
    },
  });

  const updatePlanMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<SubscriptionPlan> }) => {
      const res = await fetch(`/api/admin/plans/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update plan");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/plans"] });
      setEditingPlan(null);
    },
  });

  const deletePlanMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/plans/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete plan");
      return res.ok;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/plans"] });
    },
  });

  const addFeature = () => {
    if (featureInput.trim() && !newPlan.features.includes(featureInput.trim())) {
      setNewPlan({ ...newPlan, features: [...newPlan.features, featureInput.trim()] });
      setFeatureInput("");
    }
  };

  const removeFeature = (feature: string) => {
    setNewPlan({ ...newPlan, features: newPlan.features.filter(f => f !== feature) });
  };

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Yuklanmoqda...</p>
      </div>
    );
  }

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
        <Button variant="outline" onClick={handleLogout} data-testid="button-logout">
          <LogOut className="mr-2 h-4 w-4" />
          Chiqish
        </Button>
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
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="trialDays">Sinov muddati (kun)</Label>
                      <Input
                        id="trialDays"
                        type="number"
                        data-testid="input-trial-days"
                        value={newTenant.trialDays}
                        onChange={(e) => setNewTenant({ ...newTenant, trialDays: parseInt(e.target.value) || 0 })}
                        placeholder="14"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="subscriptionEndsAt">Obuna tugash sanasi</Label>
                      <Input
                        id="subscriptionEndsAt"
                        type="date"
                        data-testid="input-subscription-ends"
                        value={newTenant.subscriptionEndsAt}
                        onChange={(e) => setNewTenant({ ...newTenant, subscriptionEndsAt: e.target.value })}
                      />
                    </div>
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
                  <TableHead>Sinov tugash</TableHead>
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
                    <TableCell>{formatDate(tenant.trialEndsAt)}</TableCell>
                    <TableCell>{formatDate(tenant.subscriptionEndsAt)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingTenant(tenant)}
                          data-testid={`button-edit-tenant-${tenant.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
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
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      Hali markazlar yo'q
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>

          {/* Edit Tenant Dialog */}
          <Dialog open={!!editingTenant} onOpenChange={(open) => !open && setEditingTenant(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Markaz sozlamalari</DialogTitle>
                <DialogDescription>{editingTenant?.name} markazi sozlamalari</DialogDescription>
              </DialogHeader>
              {editingTenant && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Tarif</Label>
                    <Select
                      value={editingTenant.planId?.toString() || ""}
                      onValueChange={(value) => setEditingTenant({ ...editingTenant, planId: parseInt(value) })}
                    >
                      <SelectTrigger>
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
                  <div className="space-y-2">
                    <Label>Holat</Label>
                    <Select
                      value={editingTenant.status}
                      onValueChange={(value) => setEditingTenant({ ...editingTenant, status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Faol</SelectItem>
                        <SelectItem value="trial">Sinov</SelectItem>
                        <SelectItem value="suspended">To'xtatilgan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Sinov tugash sanasi</Label>
                    <Input
                      type="date"
                      value={editingTenant.trialEndsAt ? new Date(editingTenant.trialEndsAt).toISOString().split('T')[0] : ""}
                      onChange={(e) => setEditingTenant({ ...editingTenant, trialEndsAt: e.target.value ? new Date(e.target.value) : null })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Obuna tugash sanasi</Label>
                    <Input
                      type="date"
                      value={editingTenant.subscriptionEndsAt ? new Date(editingTenant.subscriptionEndsAt).toISOString().split('T')[0] : ""}
                      onChange={(e) => setEditingTenant({ ...editingTenant, subscriptionEndsAt: e.target.value ? new Date(e.target.value) : null })}
                    />
                    <div className="flex gap-2 mt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const baseDate = editingTenant.subscriptionEndsAt ? new Date(editingTenant.subscriptionEndsAt) : new Date();
                          const newDate = new Date(baseDate);
                          newDate.setMonth(newDate.getMonth() + 1);
                          setEditingTenant({ ...editingTenant, subscriptionEndsAt: newDate, status: "active" });
                        }}
                        data-testid="button-extend-1-month"
                      >
                        +1 oy
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const baseDate = editingTenant.subscriptionEndsAt ? new Date(editingTenant.subscriptionEndsAt) : new Date();
                          const newDate = new Date(baseDate);
                          newDate.setMonth(newDate.getMonth() + 3);
                          setEditingTenant({ ...editingTenant, subscriptionEndsAt: newDate, status: "active" });
                        }}
                        data-testid="button-extend-3-months"
                      >
                        +3 oy
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const baseDate = editingTenant.subscriptionEndsAt ? new Date(editingTenant.subscriptionEndsAt) : new Date();
                          const newDate = new Date(baseDate);
                          newDate.setFullYear(newDate.getFullYear() + 1);
                          setEditingTenant({ ...editingTenant, subscriptionEndsAt: newDate, status: "active" });
                        }}
                        data-testid="button-extend-1-year"
                      >
                        +1 yil
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Uzaytirish tugmasi statusni ham "Faol" ga o'zgartiradi</p>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingTenant(null)}>Bekor qilish</Button>
                <Button 
                  onClick={() => editingTenant && updateTenantMutation.mutate({ 
                    id: editingTenant.id, 
                    data: {
                      planId: editingTenant.planId,
                      status: editingTenant.status,
                      trialEndsAt: editingTenant.trialEndsAt,
                      subscriptionEndsAt: editingTenant.subscriptionEndsAt,
                    }
                  })}
                >
                  Saqlash
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="plans" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Tarif rejalari</h2>
            <Dialog open={isAddPlanOpen} onOpenChange={setIsAddPlanOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-plan">
                  <Plus className="h-4 w-4 mr-2" />
                  Yangi tarif
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Yangi tarif qo'shish</DialogTitle>
                  <DialogDescription>Tarif ma'lumotlarini kiriting</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="planName">Tarif nomi</Label>
                    <Input
                      id="planName"
                      data-testid="input-plan-name"
                      value={newPlan.name}
                      onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
                      placeholder="Masalan: Professional"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="planPrice">Narxi (so'm/oy)</Label>
                    <Input
                      id="planPrice"
                      type="number"
                      data-testid="input-plan-price"
                      value={newPlan.price}
                      onChange={(e) => setNewPlan({ ...newPlan, price: parseInt(e.target.value) || 0 })}
                      placeholder="500000"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="maxStudents">O'quvchilar</Label>
                      <Input
                        id="maxStudents"
                        type="number"
                        data-testid="input-max-students"
                        value={newPlan.maxStudents}
                        onChange={(e) => setNewPlan({ ...newPlan, maxStudents: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="maxTeachers">O'qituvchilar</Label>
                      <Input
                        id="maxTeachers"
                        type="number"
                        data-testid="input-max-teachers"
                        value={newPlan.maxTeachers}
                        onChange={(e) => setNewPlan({ ...newPlan, maxTeachers: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="maxGroups">Guruhlar</Label>
                      <Input
                        id="maxGroups"
                        type="number"
                        data-testid="input-max-groups"
                        value={newPlan.maxGroups}
                        onChange={(e) => setNewPlan({ ...newPlan, maxGroups: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Xususiyatlar</Label>
                    <div className="flex gap-2">
                      <Input
                        value={featureInput}
                        onChange={(e) => setFeatureInput(e.target.value)}
                        placeholder="sms, telegram..."
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addFeature())}
                      />
                      <Button type="button" variant="outline" onClick={addFeature}>+</Button>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {newPlan.features.map((f, idx) => (
                        <Badge key={idx} variant="secondary" className="cursor-pointer" onClick={() => removeFeature(f)}>
                          {f} ×
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddPlanOpen(false)}>Bekor qilish</Button>
                  <Button 
                    onClick={() => createPlanMutation.mutate(newPlan)}
                    disabled={!newPlan.name || newPlan.price <= 0}
                    data-testid="button-save-plan"
                  >
                    Saqlash
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {plans.map((plan) => (
              <Card key={plan.id} data-testid={`card-plan-${plan.id}`}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{plan.name}</CardTitle>
                      <CardDescription>
                        <span className="text-2xl font-bold text-primary">{formatPrice(plan.price)}</span>
                        <span className="text-muted-foreground">/oy</span>
                      </CardDescription>
                    </div>
                    <div className="flex gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => setEditingPlan(plan)}
                        data-testid={`button-edit-plan-${plan.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => {
                          if (confirm("Bu tarifni o'chirmoqchimisiz?")) {
                            deletePlanMutation.mutate(plan.id);
                          }
                        }}
                        data-testid={`button-delete-plan-${plan.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
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

          {/* Edit Plan Dialog */}
          <Dialog open={!!editingPlan} onOpenChange={(open) => !open && setEditingPlan(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Tarifni tahrirlash</DialogTitle>
                <DialogDescription>{editingPlan?.name} tarifini o'zgartiring</DialogDescription>
              </DialogHeader>
              {editingPlan && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Tarif nomi</Label>
                    <Input
                      value={editingPlan.name}
                      onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Narxi (so'm/oy)</Label>
                    <Input
                      type="number"
                      value={editingPlan.price}
                      onChange={(e) => setEditingPlan({ ...editingPlan, price: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label>O'quvchilar</Label>
                      <Input
                        type="number"
                        value={editingPlan.maxStudents}
                        onChange={(e) => setEditingPlan({ ...editingPlan, maxStudents: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>O'qituvchilar</Label>
                      <Input
                        type="number"
                        value={editingPlan.maxTeachers}
                        onChange={(e) => setEditingPlan({ ...editingPlan, maxTeachers: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Guruhlar</Label>
                      <Input
                        type="number"
                        value={editingPlan.maxGroups}
                        onChange={(e) => setEditingPlan({ ...editingPlan, maxGroups: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingPlan(null)}>Bekor qilish</Button>
                <Button 
                  onClick={() => editingPlan && updatePlanMutation.mutate({ 
                    id: editingPlan.id, 
                    data: {
                      name: editingPlan.name,
                      price: editingPlan.price,
                      maxStudents: editingPlan.maxStudents,
                      maxTeachers: editingPlan.maxTeachers,
                      maxGroups: editingPlan.maxGroups,
                    }
                  })}
                >
                  Saqlash
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
}
