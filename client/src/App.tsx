import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AppLayout } from "@/components/layout/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Leads from "@/pages/Leads";
import Students from "@/pages/Students";
import Teachers from "@/pages/Teachers";
import Groups from "@/pages/Groups";
import Schedule from "@/pages/Schedule";
import Payments from "@/pages/Payments";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";
import Login from "@/pages/Login";
import TeacherLogin from "@/pages/TeacherLogin";
import TeacherDashboard from "@/pages/TeacherDashboard";
import SuperAdmin from "@/pages/SuperAdmin";
import SuperAdminLogin from "@/pages/SuperAdminLogin";
import NotFound from "@/pages/not-found";

function AdminRoutes() {
  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (!res.ok) throw new Error("Not authenticated");
      return res.json();
    },
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Yuklanmoqda...</p>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/leads" component={Leads} />
        <Route path="/students" component={Students} />
        <Route path="/teachers" component={Teachers} />
        <Route path="/groups" component={Groups} />
        <Route path="/schedule" component={Schedule} />
        <Route path="/payments" component={Payments} />
        <Route path="/reports" component={Reports} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/super-admin" component={SuperAdmin} />
      <Route path="/super-admin-login" component={SuperAdminLogin} />
      <Route path="/login" component={Login} />
      <Route path="/teacher-login" component={TeacherLogin} />
      <Route path="/teacher-dashboard" component={TeacherDashboard} />
      <Route component={AdminRoutes} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
