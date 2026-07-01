import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AppLayout } from "@/components/layout/AppLayout";
import { lazy, Suspense } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PWAInstallBanner } from "@/components/PWAInstallButton";

// Rollar uchun ruxsat berilgan yo'llar
const roleRouteAccess: Record<string, string[]> = {
  markaz_admin: ["/", "/leads", "/students", "/teachers", "/groups", "/subjects", "/schedule", "/payments", "/expenses", "/reports", "/settings"],
  teacher: ["/attendance", "/students", "/groups", "/schedule", "/statistics", "/teacher-salary"],
};

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Leads = lazy(() => import("@/pages/Leads"));
const Students = lazy(() => import("@/pages/Students"));
const Teachers = lazy(() => import("@/pages/Teachers"));
const Groups = lazy(() => import("@/pages/Groups"));
const Subjects = lazy(() => import("@/pages/Subjects"));
const Schedule = lazy(() => import("@/pages/Schedule"));
const Attendance = lazy(() => import("@/pages/Attendance"));
const Statistics = lazy(() => import("@/pages/Statistics"));
const Payments = lazy(() => import("@/pages/Payments"));
const Reports = lazy(() => import("@/pages/Reports"));
const Expenses = lazy(() => import("@/pages/Expenses"));
const Settings = lazy(() => import("@/pages/Settings"));
const TeacherSalary = lazy(() => import("@/pages/TeacherSalary"));
const Login = lazy(() => import("@/pages/Login"));
const TeacherLogin = lazy(() => import("@/pages/TeacherLogin"));
const TeacherDashboard = lazy(() => import("@/pages/TeacherDashboard"));
const SuperAdmin = lazy(() => import("@/pages/SuperAdmin"));
const SuperAdminLogin = lazy(() => import("@/pages/SuperAdminLogin"));
const RahbarLogin = lazy(() => import("@/pages/RahbarLogin"));
const RahbarDashboard = lazy(() => import("@/pages/RahbarDashboard"));
const NotFound = lazy(() => import("@/pages/not-found"));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Yuklanmoqda...</div>
    </div>
  );
}

function AdminRoutes() {
  const [location] = useLocation();
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

  // Rol tekshirish
  const userRole = user.role || "";
  const allowedPaths = roleRouteAccess[userRole];
  
  if (userRole === "manager") {
    return <Redirect to="/rahbar" />;
  }

  if (!allowedPaths || allowedPaths.length === 0) {
    fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    return <Redirect to="/login" />;
  }
  
  // Agar joriy sahifa ruxsatsiz bo'lsa, birinchi ruxsat berilgan sahifaga yo'naltirish
  if (!allowedPaths.includes(location)) {
    return <Redirect to={allowedPaths[0]} />;
  }

  return (
    <AppLayout 
      userRole={user.role} 
      userName={`${user.firstName} ${user.lastName}`}
      tenantName={user.tenantName}
      tenantLogo={user.tenantLogo}
    >
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/leads" component={Leads} />
            <Route path="/students" component={Students} />
            <Route path="/teachers" component={Teachers} />
            <Route path="/groups" component={Groups} />
            <Route path="/subjects" component={Subjects} />
            <Route path="/schedule" component={Schedule} />
            <Route path="/attendance" component={Attendance} />
            <Route path="/statistics" component={Statistics} />
            <Route path="/payments" component={Payments} />
            <Route path="/expenses" component={Expenses} />
            <Route path="/reports" component={Reports} />
            <Route path="/teacher-salary" component={TeacherSalary} />
            <Route path="/settings" component={Settings} />
            <Route component={NotFound} />
          </Switch>
        </Suspense>
      </ErrorBoundary>
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
        <Route path="/rahbar-login" component={RahbarLogin} />
        <Route path="/rahbar" component={RahbarDashboard} />
        <Route component={AdminRoutes} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <Router />
      </ErrorBoundary>
      <Toaster />
      <PWAInstallBanner />
    </QueryClientProvider>
  );
}

export default App;
