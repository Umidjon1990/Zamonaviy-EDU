import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Users, 
  GraduationCap, 
  Calendar, 
  CreditCard, 
  Settings, 
  LogOut,
  Menu,
  X,
  UserCheck,
  FileText,
  BookOpen
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { translations } from "@/lib/i18n";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const preloadPages = () => {
  import("@/pages/Dashboard");
  import("@/pages/Students");
  import("@/pages/Payments");
  import("@/pages/Groups");
  import("@/pages/Leads");
  import("@/pages/Reports");
};

const allNavItems = [
  { icon: LayoutDashboard, label: translations.nav.dashboard, href: "/", roles: ["markaz_admin", "manager"] },
  { icon: Calendar, label: "Davomat", href: "/attendance", roles: ["teacher"] },
  { icon: Users, label: translations.nav.leads, href: "/leads", roles: ["markaz_admin", "manager"] },
  { icon: GraduationCap, label: translations.nav.students, href: "/students", roles: ["markaz_admin", "manager", "teacher"] },
  { icon: UserCheck, label: "O'qituvchilar", href: "/teachers", roles: ["markaz_admin"] },
  { icon: Users, label: translations.nav.groups, href: "/groups", roles: ["markaz_admin", "manager"] },
  { icon: BookOpen, label: "Fanlar", href: "/subjects", roles: ["markaz_admin"] },
  { icon: Calendar, label: translations.nav.schedule, href: "/schedule", roles: ["markaz_admin", "manager", "teacher"] },
  { icon: CreditCard, label: translations.nav.payments, href: "/payments", roles: ["markaz_admin", "manager"] },
  { icon: FileText, label: "Moliya", href: "/reports", roles: ["markaz_admin", "manager"] },
  { icon: FileText, label: "Oylik", href: "/teacher-salary", roles: ["teacher"] },
  { icon: Settings, label: translations.nav.settings, href: "/settings", roles: ["markaz_admin"] },
];

interface AppLayoutProps {
  children: React.ReactNode;
  userRole?: string;
  userName?: string;
}

export function AppLayout({ children, userRole, userName = "Foydalanuvchi" }: AppLayoutProps) {
  // Xavfsiz default - agar rol noma'lum bo'lsa, hech narsa ko'rsatilmaydi
  const safeRole = userRole || "";
  const navItems = allNavItems.filter(item => item.roles.includes(safeRole));
  const [location] = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      window.location.href = "/login";
    } catch (error) {
      console.error("Logout xatosi:", error);
    }
  };

  useEffect(() => {
    const timer = setTimeout(preloadPages, 100);
    return () => clearTimeout(timer);
  }, []);

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <GraduationCap className="text-primary-foreground w-5 h-5" />
        </div>
        <span className="font-display font-bold text-xl tracking-tight">Zamonaviy-Edu</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-colors cursor-pointer touch-manipulation",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground active:bg-sidebar-accent/70"
                )}
                onClick={() => setIsMobileOpen(false)}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                <span className="truncate">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border space-y-3">
        <div className="flex items-center gap-3 p-2 rounded-lg bg-sidebar-accent/50">
          <Avatar className="h-9 w-9 border border-sidebar-border">
            <AvatarFallback>{userName.split(' ').map(n => n[0]).join('').toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{userName}</p>
            <p className="text-xs text-sidebar-foreground/60 truncate">
              {userRole === 'markaz_admin' ? 'Administrator' : userRole === 'teacher' ? "O'qituvchi" : userRole === 'manager' ? 'Menejer' : userRole}
            </p>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-sidebar-foreground/70 hover:text-sidebar-foreground"
            onClick={handleLogout}
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:block w-64 shrink-0 fixed inset-y-0 z-50">
        <SidebarContent />
      </aside>

      {/* Mobile Header & Content Wrapper */}
      <div className="flex-1 flex flex-col md:ml-64 min-h-screen transition-all duration-300 ease-in-out">
        <header className="md:hidden sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <GraduationCap className="text-primary-foreground w-5 h-5" />
            </div>
            <span className="font-display font-bold text-lg">Zamonaviy-Edu</span>
          </div>
          
          <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="-mr-2">
                <Menu className="w-6 h-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-[280px] sm:w-[300px] border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
              <SidebarContent />
            </SheetContent>
          </Sheet>
        </header>

        <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full animate-in fade-in-50 duration-500">
          {children}
        </main>
      </div>
    </div>
  );
}
