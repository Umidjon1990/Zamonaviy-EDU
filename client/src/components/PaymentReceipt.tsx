import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Printer, Download, Send, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";

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

export default function PaymentReceipt({ payment, student, groupName, tenantName, onClose }: PaymentReceiptProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const handlePrint = () => {
    const printContent = receiptRef.current;
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>To'lov cheki #${payment.id}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; max-width: 400px; margin: 0 auto; }
            .receipt { border: 2px dashed #ccc; padding: 20px; border-radius: 8px; }
            .header { text-align: center; margin-bottom: 20px; }
            .header h1 { margin: 0; font-size: 18px; }
            .header p { margin: 5px 0; color: #666; font-size: 12px; }
            .divider { border-top: 1px dashed #ccc; margin: 15px 0; }
            .row { display: flex; justify-content: space-between; margin: 8px 0; font-size: 14px; }
            .row .label { color: #666; }
            .row .value { font-weight: 500; }
            .total { font-size: 18px; font-weight: bold; margin-top: 15px; }
            .footer { text-align: center; margin-top: 20px; font-size: 11px; color: #999; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="header">
              <h1>${tenantName || "O'quv Markaz"}</h1>
              <p>To'lov cheki</p>
              <p>#${payment.id}</p>
            </div>
            <div class="divider"></div>
            <div class="row"><span class="label">Sana:</span><span class="value">${formatDate(payment.createdAt)}</span></div>
            <div class="row"><span class="label">O'quvchi:</span><span class="value">${student.firstName} ${student.lastName}</span></div>
            ${groupName ? `<div class="row"><span class="label">Kurs:</span><span class="value">${groupName}</span></div>` : ''}
            <div class="row"><span class="label">To'lov turi:</span><span class="value">${getPaymentTypeLabel(payment.paymentType)}</span></div>
            ${payment.notes ? `<div class="row"><span class="label">Izoh:</span><span class="value">${payment.notes}</span></div>` : ''}
            <div class="divider"></div>
            <div class="row total"><span>Jami:</span><span>${formatAmount(payment.amount)} so'm</span></div>
            <div class="footer">
              <p>Xaridingiz uchun rahmat!</p>
              <p>${new Date().getFullYear()}</p>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [80, 150],
    });

    const centerX = 40;
    let y = 10;

    doc.setFontSize(12);
    doc.text(tenantName || "O'quv Markaz", centerX, y, { align: "center" });
    y += 6;
    
    doc.setFontSize(10);
    doc.text("To'lov cheki", centerX, y, { align: "center" });
    y += 5;
    doc.text(`#${payment.id}`, centerX, y, { align: "center" });
    y += 8;

    doc.setLineWidth(0.1);
    doc.setLineDashPattern([1, 1], 0);
    doc.line(5, y, 75, y);
    y += 6;

    doc.setFontSize(9);
    
    const addRow = (label: string, value: string) => {
      doc.text(label, 5, y);
      doc.text(value, 75, y, { align: "right" });
      y += 5;
    };

    addRow("Sana:", formatDate(payment.createdAt).substring(0, 20));
    addRow("O'quvchi:", `${student.firstName} ${student.lastName}`);
    if (groupName) addRow("Kurs:", groupName);
    addRow("To'lov turi:", getPaymentTypeLabel(payment.paymentType));
    if (payment.notes) addRow("Izoh:", payment.notes.substring(0, 20));
    
    y += 2;
    doc.line(5, y, 75, y);
    y += 6;

    doc.setFontSize(11);
    doc.text("Jami:", 5, y);
    doc.text(`${formatAmount(payment.amount)} so'm`, 75, y, { align: "right" });
    y += 10;

    doc.setFontSize(8);
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
          className="absolute right-2 top-2"
          onClick={onClose}
          data-testid="button-close-receipt"
        >
          <X className="h-4 w-4" />
        </Button>
        
        <div ref={receiptRef}>
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-lg">{tenantName || "O'quv Markaz"}</CardTitle>
            <p className="text-sm text-muted-foreground">To'lov cheki #{payment.id}</p>
          </CardHeader>
          
          <CardContent className="space-y-3">
            <Separator className="border-dashed" />
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sana:</span>
                <span className="font-medium">{formatDate(payment.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">O'quvchi:</span>
                <span className="font-medium">{student.firstName} {student.lastName}</span>
              </div>
              {groupName && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Kurs:</span>
                  <span className="font-medium">{groupName}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">To'lov turi:</span>
                <span className="font-medium">{getPaymentTypeLabel(payment.paymentType)}</span>
              </div>
              {payment.notes && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Izoh:</span>
                  <span className="font-medium">{payment.notes}</span>
                </div>
              )}
            </div>
            
            <Separator className="border-dashed" />
            
            <div className="flex justify-between items-center text-lg font-bold">
              <span>Jami:</span>
              <span className="text-primary">{formatAmount(payment.amount)} so'm</span>
            </div>
            
            <p className="text-center text-xs text-muted-foreground pt-2">
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
