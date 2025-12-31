import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AppLayout } from "@/components/layout/AppLayout";
import { lazy, Suspense } from "react";

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Leads = lazy(() => import("@/pages/Leads"));
const Students = lazy(() => import("@/pages/Students"));
const Teachers = lazy(() => import("@/pages/Teachers"));
const Groups = lazy(() => import("@/pages/Groups"));
const Schedule = lazy(() => import("@/pages/Schedule"));
const Payments = lazy(() => import("@/pages/Payments"));
const Reports = lazy(() => import("@/pages/Reports"));
const Attendance = lazy(() => import("@/pages/Attendance"));
const Settings = lazy(() => import("@/pages/Settings"));
const Login = lazy(() => import("@/pages/Login"));
const TeacherLogin = lazy(() => import("@/pages/TeacherLogin"));
const TeacherDashboard = lazy(() => import("@/pages/TeacherDashboard"));
const SuperAdmin = lazy(() => import("@/pages/SuperAdmin"));
const SuperAdminLogin = lazy(() => import("@/pages/SuperAdminLogin"));
const NotFound = lazy(() => import("@/pages/not-found"));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Yuklanmoqda...</div>
    </div>
  );
}

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
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/leads" component={Leads} />
          <Route path="/students" component={Students} />
          <Route path="/teachers" component={Teachers} />
          <Route path="/groups" component={Groups} />
          <Route path="/schedule" component={Schedule} />
          <Route path="/payments" component={Payments} />
          <Route path="/attendance" component={Attendance} />
          <Route path="/reports" component={Reports} />
          <Route path="/settings" component={Settings} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </AppLayout>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/super-admin" component={SuperAdmin} />
        <Route path="/super-admin-login" component={SuperAdminLogin} />
        <Route path="/login" component={Login} />
        <Route path="/teacher-login" component={TeacherLogin} />
        <Route path="/teacher-dashboard" component={TeacherDashboard} />
        <Route component={AdminRoutes} />
      </Switch>
    </Suspense>
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
