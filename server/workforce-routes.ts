import type { Express, RequestHandler } from 'express';
import { z, ZodError } from 'zod';
import QRCode from 'qrcode';
import { FinanceError } from './payment-service';
import { createWorkforceService, type WorkforceActor } from './workforce-service';
import { monthInput, uzWorkDate } from '../shared/workforce';

export function registerWorkforceRoutes(app: Express, pool: any, auth: RequestHandler) {
  const service = createWorkforceService(pool);
  const actor = (req: any): WorkforceActor => ({ tenantId: req.session.tenantId, userId: req.session.userId, role: req.session.role });
  const cookieName = (req: any) => `wf_device_${req.session.tenantId}_${req.session.userId}`;
  const deviceToken = (req: any) => { const name = cookieName(req) + '='; const v = (req.headers.cookie || '').split(';').map((s: string) => s.trim()).find((s: string) => s.startsWith(name))?.slice(name.length); return /^[a-f0-9]{64}$/.test(v || '') ? v : undefined; };
  const run = (fn: (req: any, res: any) => Promise<any>): RequestHandler => async (req, res) => {
    try { const value = await fn(req, res); if (!res.headersSent) res.json(value); }
    catch (e) { if (e instanceof ZodError) return void res.status(400).json({ error: e.issues.map(i => i.message).join('; ') }); if (e instanceof FinanceError) return void res.status(e.status).json({ error: e.message }); console.error('Workforce operation failed', { code: (e as any)?.code || 'internal' }); res.status(503).json({ error: 'Amal bajarilmadi. Qayta urinib ko‘ring.' }); }
  };
  app.use('/api/workforce', auth, (req: any, res, next) => {
    if (!['teacher', 'markaz_admin'].includes(req.session.role)) return void res.status(403).json({ error: 'Ruxsat yo‘q' });
    if (!['GET', 'HEAD'].includes(req.method)) {
      const origin = req.get('origin');
      if (req.get('sec-fetch-site') === 'cross-site' || (origin && new URL(origin).host !== req.get('host'))) return void res.status(403).json({ error: 'So‘rov manbasi noto‘g‘ri' });
      if (!req.is('application/json')) return void res.status(415).json({ error: 'JSON ma’lumot yuboring' });
    }
    next();
  });
  app.get('/api/workforce/settings', run(req => service.settings(actor(req))));
  app.put('/api/workforce/settings', run(req => service.updateSettings(actor(req), req.body)));
  app.get('/api/workforce/qr.png', run(async (req, res) => {
    const text = await service.qr(actor(req)); const png = await QRCode.toBuffer(text, { width: 1000, margin: 4, errorCorrectionLevel: 'H' });
    res.setHeader('Content-Type', 'image/png'); if (req.query.download === '1') res.setHeader('Content-Disposition', 'attachment; filename="zamonaviy-crm-qr.png"'); res.send(png);
  }));
  app.get('/api/workforce/devices', run(req => service.devices(actor(req), deviceToken(req))));
  app.post('/api/workforce/devices', run(async (req, res) => {
    const d = z.object({ label: z.string().trim().min(2).max(100) }).strict().parse(req.body);
    const result = await service.registerDevice(actor(req), deviceToken(req), d.label);
    res.cookie(cookieName(req), result.token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 365 * 86400000, path: '/api/workforce' }); return result.device;
  }));
  app.post('/api/workforce/devices/:id/decision', run(req => service.decideDevice(actor(req), req.params.id, z.enum(['approve', 'revoke']).parse(req.body.action))));
  app.get('/api/workforce/schedule', run(req => service.schedule(actor(req), String(req.query.from || uzWorkDate()), String(req.query.to || req.query.from || uzWorkDate()))));
  app.post('/api/workforce/schedule', run(req => service.saveSchedule(actor(req), req.body)));
  app.post('/api/workforce/lesson-exception', run(req => service.updateLesson(actor(req), req.body)));
  app.get('/api/workforce/dashboard', run(req => service.dashboard(actor(req), String(req.query.date || uzWorkDate()))));
  app.post('/api/workforce/scan', run(req => service.scan(actor(req), deviceToken(req), req.body)));
  app.post('/api/workforce/day-correction', run(req => service.updateDay(actor(req), req.body)));
  app.get('/api/workforce/fine-types', run(req => service.fineTypes(actor(req))));
  app.post('/api/workforce/fine-types', run(req => service.saveFineType(actor(req), null, req.body)));
  app.patch('/api/workforce/fine-types/:id', run(req => service.saveFineType(actor(req), z.coerce.number().int().positive().parse(req.params.id), req.body)));
  app.get('/api/workforce/fines', run(req => service.fines(actor(req), String(req.query.month || uzWorkDate().slice(0, 7)))));
  app.post('/api/workforce/fines', run(req => service.createFine(actor(req), req.body)));
  app.post('/api/workforce/fines/:id/explanation', run(req => service.explainFine(actor(req), z.coerce.number().int().positive().parse(req.params.id), req.body)));
  app.post('/api/workforce/fines/:id/decision', run(req => service.decideFine(actor(req), z.coerce.number().int().positive().parse(req.params.id), req.body)));
  app.get('/api/workforce/history', run(req => service.history(actor(req), req.query.kind && String(req.query.kind), req.query.id && String(req.query.id))));
  app.get('/api/workforce/payroll', run(req => service.payroll(actor(req), req.session.role === 'teacher' ? req.session.userId : z.string().min(1).parse(req.query.teacherId), monthInput.parse(req.query.month || uzWorkDate().slice(0, 7)))));
  app.post('/api/workforce/payroll/close', run(req => service.closePayroll(actor(req), z.string().min(1).parse(req.body.teacherId), monthInput.parse(req.body.month), z.number().int().min(0).parse(req.body.otherDeductions || 0))));
  let lastSearch = 0;
  app.get('/api/workforce/geocode', run(async req => {
    if (req.session.role !== 'markaz_admin') throw new FinanceError('Faqat administrator uchun', 403);
    const q = z.string().trim().min(3).max(200).parse(req.query.q); if (Date.now() - lastSearch < 1200) throw new FinanceError('Qidiruvni bir ozdan keyin takrorlang', 429); lastSearch = Date.now();
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=uz&q=${encodeURIComponent(q)}`, { headers: { 'User-Agent': 'ZamonaviyCRM/1.0 (https://www.zamonaviy-crm.uz)', 'Accept-Language': 'uz,ru,en' }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new FinanceError('Manzil qidiruvi vaqtincha ishlamayapti. Xaritadan nuqtani belgilang.', 503);
    return (await response.json() as any[]).map(r => ({ name: r.display_name, latitude: Number(r.lat), longitude: Number(r.lon) }));
  }));
  return service;
}
