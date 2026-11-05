// Local-only fixture server for UI QA. Never imported by the production application.
import express from 'express';
import { createServer } from 'node:http';
import { createServer as createVite } from 'vite';
import { workforceFixture } from './workforce-fixture';
import { registerWorkforceRoutes } from '../server/workforce-routes';
const { db, pool } = await workforceFixture();
const app = express(); app.use(express.json());
const auth: any = (req: any, _res: any, next: any) => {
  const teacher = String(req.headers.cookie || '').includes('preview_role=teacher');
  req.session = { tenantId: 1, userId: teacher ? 't1' : 'admin', role: teacher ? 'teacher' : 'markaz_admin' }; next();
};
app.use(auth);
app.get('/api/auth/me', (req: any, res) => res.json({ id: req.session.userId, role: req.session.role, firstName: req.session.role === 'teacher' ? 'Anvar' : 'Umidjon', lastName: 'Ustoz', tenantName: 'Zamonaviy Ta’lim' }));
app.get('/api/teachers', async (_req, res) => res.json((await db.query<any>("SELECT id,first_name AS \"firstName\",last_name AS \"lastName\" FROM users WHERE tenant_id=1 AND role='teacher'")).rows));
app.get('/api/groups', async (_req, res) => res.json((await db.query('SELECT * FROM groups WHERE tenant_id=1')).rows));
app.get('/api/stats', (_req, res) => res.json({ totalStudents: 32, activeGroups: 3, monthlyIncome: 4000000, newLeads: 4 }));
registerWorkforceRoutes(app, pool, auth);
app.get('/api/teacher/salary', async (req: any, res) => res.json(await (await import('../server/workforce-service')).createWorkforceService(pool).payroll({ tenantId: 1, userId: 't1', role: 'teacher' }, 't1', `${req.query.year}-${String(req.query.month).padStart(2, '0')}`)));
app.get('/api/*', (_req, res) => res.json([]));
const vite = await createVite({ server: { middlewareMode: true }, appType: 'spa' }); app.use(vite.middlewares);
export const server = createServer(app); server.listen(5055, '127.0.0.1', () => console.log('Workforce fixture ready: http://127.0.0.1:5055'));
process.once('SIGTERM', () => { void vite.close(); server.close(); void db.close(); });
