import { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap, Marker, Circle } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { getPosition, wf } from '@/lib/workforce';
import { distanceMeters } from '@shared/workforce';

export default function WorkforceMap({ latitude, longitude, onChange }: { latitude: number | null; longitude: number | null; onChange: (lat: number, lng: number) => void }) {
  const element = useRef<HTMLDivElement>(null), map = useRef<LeafletMap | undefined>(undefined), marker = useRef<Marker | undefined>(undefined), circle = useRef<Circle | undefined>(undefined);
  const callback = useRef(onChange); callback.current = onChange;
  const [query, setQuery] = useState(''), [results, setResults] = useState<any[]>([]), [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [ready, setReady] = useState(false), [tileError,setTileError]=useState(false), [draftLat,setDraftLat]=useState(latitude===null?'':latitude.toFixed(6)), [draftLon,setDraftLon]=useState(longitude===null?'':longitude.toFixed(6));
  useEffect(() => {
    let disposed = false;
    import('leaflet').then(L => {
      if (disposed || !element.current) return;
      const m = L.map(element.current).setView(latitude !== null && longitude !== null ? [latitude, longitude] : [40.9983, 71.6726], latitude !== null ? 18 : 12); map.current = m;
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 19 }).on('tileerror',()=>{if(!disposed)setTileError(true);}).addTo(m);
      const pin = L.divIcon({ className: '', html: '<div style="width:24px;height:24px;border:4px solid white;border-radius:50%;background:#2563eb;box-shadow:0 2px 8px #334155"></div>', iconSize: [24, 24], iconAnchor: [12, 12] });
      marker.current = L.marker([latitude ?? 40.9983, longitude ?? 71.6726], { icon: pin, draggable: true, opacity: latitude === null ? 0 : 1 }).addTo(m);
      circle.current = L.circle([latitude ?? 40.9983, longitude ?? 71.6726], { radius: 50, color: '#2563eb', fillOpacity: latitude === null ? 0 : .12, opacity: latitude === null ? 0 : 1 }).addTo(m);
      m.on('click', e => callback.current(e.latlng.lat, e.latlng.lng));
      marker.current.on('dragend', () => { const p = marker.current!.getLatLng(); callback.current(p.lat, p.lng); }); setReady(true);
    });
    return () => { disposed = true; map.current?.remove(); map.current = undefined; };
  }, []);
  useEffect(() => {
    if (!ready || latitude === null || longitude === null) return;
    setDraftLat(latitude.toFixed(6));setDraftLon(longitude.toFixed(6));
    marker.current?.setLatLng([latitude, longitude]).setOpacity(1); circle.current?.setLatLng([latitude, longitude]).setStyle({ opacity: 1, fillOpacity: .12 }); map.current?.setView([latitude, longitude], 18);
  }, [latitude, longitude, ready]);
  const applyCoordinates=()=>{const lat=Number(draftLat),lon=Number(draftLon);if(!draftLat||!draftLon||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180){setMessage('Kenglik va uzunlikni to‘g‘ri kiriting.');return;}onChange(lat,lon);};
  const locate = async (test: boolean) => { setBusy(true); setMessage('GPS aniqlanmoqda…'); try { const p = await getPosition(); if (test && latitude !== null && longitude !== null) setMessage(`Markazdan ${Math.round(distanceMeters(latitude, longitude, p.coords.latitude, p.coords.longitude))} m. GPS aniqligi ±${Math.round(p.coords.accuracy)} m.`); else { onChange(p.coords.latitude, p.coords.longitude); setMessage('Nuqta tanlandi. Markaz kirishiga mosligini xaritada tekshiring va saqlang.'); } } catch (e) { setMessage((e as Error).message); } finally { setBusy(false); } };
  const search = async () => { setBusy(true); setMessage(''); try { const r = await wf<any[]>('geocode?q=' + encodeURIComponent(query)); setResults(r); if (!r.length) setMessage('Manzil topilmadi. Xaritadan belgilang.'); } catch (e) { setMessage((e as Error).message); } finally { setBusy(false); } };
  return <div className="space-y-3">
    <div className="flex gap-2"><Input aria-label="Markaz manzilini qidirish" placeholder="Masalan: Namangan, Boburshoh ko‘chasi" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void search(); } }} /><Button type="button" disabled={busy || query.trim().length < 3} onClick={search}>Qidirish</Button></div>
    {results.length > 0 && <div className="rounded-lg border divide-y">{results.map((r, i) => <button type="button" key={i} className="block p-3 text-left text-sm w-full hover:bg-muted" onClick={() => { onChange(r.latitude, r.longitude); setResults([]); }}>{r.name}</button>)}</div>}
    <div ref={element} role="application" aria-label="Markaz joylashuvi xaritasi, bosib nuqta tanlang" className="h-80 rounded-xl border relative z-0" />
    {tileError&&<p role="status" className="text-xs text-amber-800">Xarita tasviri yuklanmadi. Internetni tekshiring; manzil qidiruvi, hozirgi joylashuv yoki koordinatalardan foydalanishingiz mumkin.</p>}
    <p className="text-sm text-muted-foreground">Xaritani bosing yoki ko‘k belgini suring. Doira — 50 metr.</p>
    <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => locate(false)}>Hozirgi joylashuvim</Button><Button type="button" variant="outline" disabled={busy || latitude === null} onClick={() => locate(true)}>Masofani tekshirish</Button></div>
    <div className="grid grid-cols-2 gap-3"><label className="text-sm">Kenglik<Input aria-label="Markaz kengligi" type="number" step="0.000001" value={draftLat} onChange={e=>setDraftLat(e.target.value)} /></label><label className="text-sm">Uzunlik<Input aria-label="Markaz uzunligi" type="number" step="0.000001" value={draftLon} onChange={e=>setDraftLon(e.target.value)} /></label></div>
    <Button type="button" variant="outline" onClick={applyCoordinates}>Koordinatalarni qo‘llash</Button>
    {message && <p role="status" className="text-sm p-3 rounded-lg bg-muted">{message}</p>}
  </div>;
}
