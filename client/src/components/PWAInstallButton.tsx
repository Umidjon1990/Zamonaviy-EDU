import { useState, useEffect } from "react";
import { Download, X, Share, Plus, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isIOS() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

function isInStandaloneMode() {
  return (
    ("standalone" in navigator && (navigator as any).standalone === true) ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}

function isAndroid() {
  return /Android/.test(navigator.userAgent);
}

export function PWAInstallButton({ variant = "icon" }: { variant?: "icon" | "full" }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showAndroidBtn, setShowAndroidBtn] = useState(false);
  const [showIOSDialog, setShowIOSDialog] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isInStandaloneMode()) return;

    const dismissed = localStorage.getItem("pwa-install-dismissed");
    if (dismissed) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowAndroidBtn(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => {
      setShowAndroidBtn(false);
      setDeferredPrompt(null);
    });
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleAndroidInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setShowAndroidBtn(false);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    localStorage.setItem("pwa-install-dismissed", "1");
    setDismissed(true);
    setShowAndroidBtn(false);
  };

  if (isInStandaloneMode() || dismissed) return null;

  // iOS Safari: "O'rnatish" tugmasi dialog ochadi
  if (isIOS()) {
    return (
      <>
        <Button
          onClick={() => setShowIOSDialog(true)}
          variant="outline"
          size={variant === "icon" ? "sm" : "default"}
          className="flex items-center gap-2 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
          data-testid="button-pwa-install-ios"
        >
          <Download className="h-4 w-4" />
          {variant === "full" && <span>Ilovani o'rnatish</span>}
          {variant === "icon" && <span className="hidden sm:inline">O'rnatish</span>}
        </Button>

        <Dialog open={showIOSDialog} onOpenChange={setShowIOSDialog}>
          <DialogContent className="max-w-sm mx-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-blue-600" />
                iPhone'ga o'rnatish
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">
                Zamonaviy-Edu ilovasini ekraningizga qo'shish uchun Safari'da quyidagi amallarni bajaring:
              </p>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold shrink-0">1</div>
                  <div>
                    <p className="text-sm font-medium">Ulashish tugmasini bosing</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      Quyi panelda <Share className="w-3 h-3 inline mx-0.5" /> belgisini toping
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold shrink-0">2</div>
                  <div>
                    <p className="text-sm font-medium">"Bosh ekranga qo'shish" ni tanlang</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Plus className="w-3 h-3 inline mx-0.5" /> "Add to Home Screen"
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold shrink-0">3</div>
                  <div>
                    <p className="text-sm font-medium">"Qo'shish" tugmasini bosing</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Ilova bosh ekranda paydo bo'ladi</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button className="flex-1 gradient-primary" onClick={() => setShowIOSDialog(false)}>
                  Tushundim
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setShowIOSDialog(false); handleDismiss(); }}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Android / Desktop: native install prompt
  if (!showAndroidBtn) return null;

  return (
    <div className="flex items-center gap-1">
      <Button
        onClick={handleAndroidInstall}
        variant="outline"
        size={variant === "icon" ? "sm" : "default"}
        className="flex items-center gap-2 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
        data-testid="button-pwa-install"
      >
        <Download className="h-4 w-4" />
        {variant === "full" && <span>Ilovani o'rnatish</span>}
        {variant === "icon" && <span className="hidden sm:inline">O'rnatish</span>}
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={handleDismiss}>
        <X className="w-3 h-3" />
      </Button>
    </div>
  );
}

// Global banner — sahifaning pastida turadi
export function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [showIOSDialog, setShowIOSDialog] = useState(false);

  useEffect(() => {
    if (isInStandaloneMode()) return;
    if (localStorage.getItem("pwa-banner-dismissed")) return;

    if (isIOS()) {
      // iOS Safari: banner 2 soniyadan so'ng ko'rsatiladi
      const t = setTimeout(() => setShow(true), 2000);
      return () => clearTimeout(t);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShow(true), 1500);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setShow(false));
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismiss = () => {
    localStorage.setItem("pwa-banner-dismissed", "1");
    setShow(false);
  };

  const install = async () => {
    if (isIOS()) { setShowIOSDialog(true); return; }
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setShow(false);
    setDeferredPrompt(null);
  };

  if (!show) return null;

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-in slide-in-from-bottom-4 duration-300">
        <div className="max-w-lg mx-auto bg-white rounded-2xl shadow-2xl border border-border p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center shrink-0">
            <Smartphone className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">Zamonaviy-Edu ilovasini o'rnating</p>
            <p className="text-xs text-muted-foreground">Tezkor kirish va offline ishlash imkoni</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" className="gradient-primary text-white text-xs px-3" onClick={install}>
              O'rnatish
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={dismiss}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* iOS yo'riqnoma dialogi */}
      <Dialog open={showIOSDialog} onOpenChange={setShowIOSDialog}>
        <DialogContent className="max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-blue-600" />
              iPhone'ga o'rnatish
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Safari orqali ilovani bosh ekraningizga qo'shing:
            </p>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold shrink-0">1</div>
                <p className="text-sm pt-0.5">Quyi panelda <strong>Ulashish</strong> (<Share className="w-3.5 h-3.5 inline" />) tugmasini bosing</p>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold shrink-0">2</div>
                <p className="text-sm pt-0.5"><strong>"Bosh ekranga qo'shish"</strong> ni tanlang (<Plus className="w-3.5 h-3.5 inline" /> Add to Home Screen)</p>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold shrink-0">3</div>
                <p className="text-sm pt-0.5">O'ng yuqori burchakdagi <strong>"Qo'shish"</strong> ni bosing</p>
              </div>
            </div>
            <Button className="w-full gradient-primary" onClick={() => { setShowIOSDialog(false); dismiss(); }}>
              Tushundim
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
