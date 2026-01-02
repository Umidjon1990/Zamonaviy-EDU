import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Printer, Download, Send, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import logoImg from "@/assets/logo.png";

interface PaymentReceiptProps {
  payment: {
    id: number;
    amount: number;
    paymentType: string;
    status: string;
    notes?: string;
    createdAt: string;
  };
  student: {
    id: number;
    firstName: string;
    lastName: string;
    phone: string;
  };
  groupName?: string;
  subjectName?: string;
  teacherName?: string;
  tenantName?: string;
  onClose: () => void;
}

function formatAmount(amount: number): string {
  return amount.toLocaleString("uz-UZ");
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("uz-UZ", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString("uz-UZ", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getPaymentTypeLabel(type: string): string {
  switch (type) {
    case "cash": return "Naqd pul";
    case "card": return "Plastik karta";
    case "bank_transfer": return "Bank o'tkazmasi";
    default: return type;
  }
}

const TELEGRAM_CHANNEL = "https://t.me/Zamonaviytalimuzkanali";

export default function PaymentReceipt({ payment, student, groupName, subjectName, teacherName, tenantName, onClose }: PaymentReceiptProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(TELEGRAM_CHANNEL)}`;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>To'lov cheki #${payment.id}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 10px; max-width: 300px; margin: 0 auto; }
            .receipt { border: 2px dashed #1a365d; padding: 15px; border-radius: 8px; }
            .header { text-align: center; margin-bottom: 15px; }
            .logo { width: 70px; height: 70px; margin: 0 auto 10px; }
            .logo img { width: 100%; height: 100%; object-fit: contain; image-rendering: -webkit-optimize-contrast; image-rendering: crisp-edges; }
            .title { margin: 0; font-size: 16px; color: #1a365d; font-weight: bold; }
            .subtitle { margin: 5px 0; color: #666; font-size: 11px; }
            .divider { border-top: 1px dashed #1a365d; margin: 12px 0; }
            .row { display: flex; justify-content: space-between; margin: 6px 0; font-size: 12px; }
            .row .label { color: #666; }
            .row .value { font-weight: 500; text-align: right; max-width: 60%; }
            .total { font-size: 16px; font-weight: bold; margin-top: 10px; color: #1a365d; }
            .qr-section { text-align: center; margin-top: 15px; padding-top: 10px; border-top: 1px dashed #1a365d; }
            .qr-section p { font-size: 10px; color: #666; margin: 5px 0; }
            .qr-section a { color: #1a365d; font-size: 11px; }
            .qr-section img { image-rendering: -webkit-optimize-contrast; image-rendering: crisp-edges; image-rendering: pixelated; }
            .footer { text-align: center; margin-top: 10px; font-size: 10px; color: #999; }
            .loading { text-align: center; padding: 20px; }
            @media print { body { padding: 0; } .loading { display: none; } }
          </style>
        </head>
        <body>
          <div class="loading" id="loading">Rasmlar yuklanmoqda...</div>
          <div class="receipt" id="receipt" style="display:none;">
            <div class="header">
              <div class="logo"><img id="logo-img" src="${logoImg}" alt="Logo" /></div>
              <h1 class="title">ZAMONAVIY TA'LIM</h1>
              <p class="subtitle">To'lov cheki #${payment.id}</p>
            </div>
            <div class="divider"></div>
            <div class="row"><span class="label">O'quvchi:</span><span class="value">${student.firstName} ${student.lastName}</span></div>
            ${teacherName ? `<div class="row"><span class="label">O'qituvchi:</span><span class="value">${teacherName}</span></div>` : ''}
            ${subjectName ? `<div class="row"><span class="label">Fan:</span><span class="value">${subjectName}</span></div>` : ''}
            ${groupName ? `<div class="row"><span class="label">Guruh:</span><span class="value">${groupName}</span></div>` : ''}
            <div class="row"><span class="label">Summa:</span><span class="value">${formatAmount(payment.amount)} so'm</span></div>
            <div class="row"><span class="label">Sana:</span><span class="value">${formatDate(payment.createdAt)}</span></div>
            <div class="row"><span class="label">Vaqt:</span><span class="value">${formatTime(payment.createdAt)}</span></div>
            <div class="row"><span class="label">To'lov turi:</span><span class="value">${getPaymentTypeLabel(payment.paymentType)}</span></div>
            <div class="divider"></div>
            <div class="row total"><span>Jami:</span><span>${formatAmount(payment.amount)} so'm</span></div>
            <div class="qr-section">
              <p>Telegram kanalimiz:</p>
              <img id="qr-img" src="${qrCodeUrl}" alt="QR Code" style="width:80px;height:80px;"/>
              <p><a href="${TELEGRAM_CHANNEL}">@Zamonaviytalimuzkanali</a></p>
            </div>
            <div class="footer">
              <p>Xaridingiz uchun rahmat!</p>
            </div>
          </div>
          <script>
            var imagesLoaded = 0;
            var totalImages = 2;
            
            function checkAllLoaded() {
              imagesLoaded++;
              if (imagesLoaded >= totalImages) {
                document.getElementById('loading').style.display = 'none';
                document.getElementById('receipt').style.display = 'block';
                setTimeout(function() { window.print(); }, 100);
              }
            }
            
            var logoImg = document.getElementById('logo-img');
            var qrImg = document.getElementById('qr-img');
            
            if (logoImg.complete) { checkAllLoaded(); } 
            else { logoImg.onload = checkAllLoaded; logoImg.onerror = checkAllLoaded; }
            
            if (qrImg.complete) { checkAllLoaded(); } 
            else { qrImg.onload = checkAllLoaded; qrImg.onerror = checkAllLoaded; }
            
            setTimeout(function() {
              if (imagesLoaded < totalImages) {
                document.getElementById('loading').style.display = 'none';
                document.getElementById('receipt').style.display = 'block';
                window.print();
              }
            }, 3000);
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [80, 180],
    });

    const centerX = 40;
    let y = 15;

    doc.setFontSize(14);
    doc.setTextColor(26, 54, 93);
    doc.text("ZAMONAVIY TA'LIM", centerX, y, { align: "center" });
    y += 6;
    
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`To'lov cheki #${payment.id}`, centerX, y, { align: "center" });
    y += 8;

    doc.setDrawColor(26, 54, 93);
    doc.setLineWidth(0.1);
    doc.setLineDashPattern([1, 1], 0);
    doc.line(5, y, 75, y);
    y += 6;

    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    
    const addRow = (label: string, value: string) => {
      doc.setTextColor(100, 100, 100);
      doc.text(label, 5, y);
      doc.setTextColor(0, 0, 0);
      const maxWidth = 45;
      const lines = doc.splitTextToSize(value, maxWidth);
      doc.text(lines, 75, y, { align: "right" });
      y += lines.length > 1 ? 8 : 5;
    };

    addRow("O'quvchi:", `${student.firstName} ${student.lastName}`);
    if (teacherName) addRow("O'qituvchi:", teacherName);
    if (groupName) addRow("Guruh:", groupName);
    addRow("Summa:", `${formatAmount(payment.amount)} so'm`);
    addRow("Sana:", formatDate(payment.createdAt));
    addRow("Vaqt:", formatTime(payment.createdAt));
    addRow("To'lov turi:", getPaymentTypeLabel(payment.paymentType));
    
    y += 2;
    doc.line(5, y, 75, y);
    y += 6;

    doc.setFontSize(12);
    doc.setTextColor(26, 54, 93);
    doc.text("Jami:", 5, y);
    doc.text(`${formatAmount(payment.amount)} so'm`, 75, y, { align: "right" });
    y += 10;

    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("Telegram kanalimiz:", centerX, y, { align: "center" });
    y += 4;
    doc.setTextColor(26, 54, 93);
    doc.text("@Zamonaviytalimuzkanali", centerX, y, { align: "center" });
    y += 8;

    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("Xaridingiz uchun rahmat!", centerX, y, { align: "center" });

    doc.save(`chek_${payment.id}.pdf`);
    toast({ title: "Muvaffaqiyat", description: "PDF yuklab olindi" });
  };

  const handleSendTelegram = async () => {
    try {
      const response = await fetch("/api/telegram/send-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: student.id,
          paymentId: payment.id,
          amount: payment.amount,
          groupName: groupName,
          teacherName: teacherName,
        }),
      });

      const result = await response.json();
      if (result.success) {
        toast({ title: "Muvaffaqiyat", description: "Chek Telegram orqali yuborildi" });
      } else {
        toast({ 
          title: "Xatolik", 
          description: result.error || "Telegram orqali yuborishda xatolik", 
          variant: "destructive" 
        });
      }
    } catch (error) {
      toast({ title: "Xatolik", description: "Telegram bilan bog'lanishda xatolik", variant: "destructive" });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-sm bg-white relative">
        <Button 
          variant="ghost" 
          size="icon" 
          className="absolute right-2 top-2 z-10"
          onClick={onClose}
          data-testid="button-close-receipt"
        >
          <X className="h-4 w-4" />
        </Button>
        
        <div ref={receiptRef}>
          <CardContent className="pt-6 space-y-4">
            {/* Logo and Header */}
            <div className="text-center">
              <img src={logoImg} alt="Logo" className="w-20 h-20 mx-auto mb-2 object-contain" />
              <h2 className="text-lg font-bold text-[#1a365d]">ZAMONAVIY TA'LIM</h2>
              <p className="text-sm text-muted-foreground">To'lov cheki #{payment.id}</p>
            </div>
            
            <Separator className="border-dashed border-[#1a365d]" />
            
            {/* Receipt Details */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">O'quvchi:</span>
                <span className="font-medium">{student.firstName} {student.lastName}</span>
              </div>
              {teacherName && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">O'qituvchi:</span>
                  <span className="font-medium">{teacherName}</span>
                </div>
              )}
              {subjectName && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fan:</span>
                  <span className="font-medium">{subjectName}</span>
                </div>
              )}
              {groupName && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Guruh:</span>
                  <span className="font-medium">{groupName}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Summa:</span>
                <span className="font-medium">{formatAmount(payment.amount)} so'm</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sana:</span>
                <span className="font-medium">{formatDate(payment.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vaqt:</span>
                <span className="font-medium">{formatTime(payment.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">To'lov turi:</span>
                <span className="font-medium">{getPaymentTypeLabel(payment.paymentType)}</span>
              </div>
            </div>
            
            <Separator className="border-dashed border-[#1a365d]" />
            
            {/* Total */}
            <div className="flex justify-between items-center text-lg font-bold text-[#1a365d]">
              <span>Jami:</span>
              <span>{formatAmount(payment.amount)} so'm</span>
            </div>
            
            {/* QR Code Section */}
            <div className="text-center pt-2 border-t border-dashed border-[#1a365d]">
              <p className="text-xs text-muted-foreground mb-2">Telegram kanalimiz:</p>
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(TELEGRAM_CHANNEL)}`} 
                alt="QR Code"
                className="w-20 h-20 mx-auto"
                style={{ imageRendering: 'crisp-edges' }}
              />
              <a 
                href={TELEGRAM_CHANNEL} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs text-[#1a365d] hover:underline mt-2 block"
              >
                @Zamonaviytalimuzkanali
              </a>
            </div>
            
            <p className="text-center text-xs text-muted-foreground">
              Xaridingiz uchun rahmat!
            </p>
          </CardContent>
        </div>
        
        <div className="p-4 pt-0 grid grid-cols-3 gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handlePrint}
            data-testid="button-print-receipt"
          >
            <Printer className="h-4 w-4 mr-1" />
            Chop
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleDownloadPDF}
            data-testid="button-download-receipt"
          >
            <Download className="h-4 w-4 mr-1" />
            PDF
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleSendTelegram}
            data-testid="button-send-receipt"
          >
            <Send className="h-4 w-4 mr-1" />
            Bot
          </Button>
        </div>
      </Card>
    </div>
  );
}
