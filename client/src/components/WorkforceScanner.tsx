import { useEffect, useRef, useState } from 'react';
import { Button } from './ui/button';
export default function WorkforceScanner({ onRead, onClose }: { onRead: (text: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null), callback = useRef(onRead); callback.current = onRead;
  const [error, setError] = useState('');
  useEffect(() => {
    let disposed = false, controls: { stop: () => void } | undefined, accepted = false;
    import('@zxing/browser').then(async ({ BrowserQRCodeReader }) => {
      if (disposed || !video.current) return;
      const reader = new BrowserQRCodeReader();
      controls = await reader.decodeFromConstraints({ video: { facingMode: { ideal: 'environment' } }, audio: false }, video.current, (result, _error, controller) => {
        if (result && !accepted && !disposed) { accepted = true; controller.stop(); callback.current(result.getText()); }
      });
      if (disposed) controls.stop();
    }).catch(() => { if (!disposed) setError('Kamera ochilmadi. Brauzerda kameraga ruxsat bering. QR skanerlash uchun sayt HTTPS orqali ochilgan bo‘lishi kerak.'); });
    return () => { disposed = true; controls?.stop(); const stream = video.current?.srcObject as MediaStream | null; stream?.getTracks().forEach(t => t.stop()); };
  }, []);
  return <div className="space-y-3"><video ref={video} muted playsInline className="w-full max-h-96 rounded-xl bg-black" aria-label="QR skaner kamerasi" /><p className="text-sm text-muted-foreground">Markazdagi QR rasmni kameraga ko‘rsating.</p>{error && <p role="alert" className="text-destructive">{error}</p>}<Button variant="outline" onClick={onClose}>Yopish</Button></div>;
}
