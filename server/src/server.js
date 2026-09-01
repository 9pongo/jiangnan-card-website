import cors from 'cors';
import express from 'express';
import pg from 'pg';
import { z } from 'zod';

const app = express();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const bannerInput = z.object({ name: z.string().min(1).max(120), kind: z.enum(['store', 'external']), placement: z.enum(['hero', 'home_leaderboard', 'product_sidebar', 'mobile_banner']), priority: z.number().int().min(0).max(1000), startsAt: z.string().datetime(), endsAt: z.string().datetime(), targetUrl: z.string().max(2048).nullable(), imageKey: z.string().min(1).max(512) });

app.use(cors({ origin: process.env.PUBLIC_ORIGIN?.split(',') ?? false }));
app.use(express.json({ limit: '128kb' }));
app.get('/health', async (_req, res) => { await pool.query('SELECT 1'); res.json({ status: 'ok' }); });
app.get('/api/v1/public/banners/:placement', async (req, res) => {
  const { rows } = await pool.query(`SELECT id, name, kind, target_url AS "targetUrl", image_url AS "imageUrl" FROM active_banner_for_placement($1, now())`, [req.params.placement]);
  res.json({ data: rows });
});
app.post('/api/v1/admin/banners', requirePermission('banner:create'), async (req, res, next) => {
  try { const input = bannerInput.parse(req.body); const { rows } = await pool.query(`INSERT INTO banners (name, kind, placement, priority, starts_at, ends_at, target_url, image_key, status, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'draft',$9) RETURNING id, status`, [input.name, input.kind, input.placement, input.priority, input.startsAt, input.endsAt, input.targetUrl, input.imageKey, req.user.id]); await audit(req.user.id, 'banner.created', 'banner', rows[0].id, input); res.status(201).json({ data: rows[0] }); } catch (error) { next(error); }
});
app.post('/api/v1/admin/banners/:id/publish', requirePermission('banner:publish'), async (req, res) => { const { rows } = await pool.query(`UPDATE banners SET status='pending_review', updated_at=now() WHERE id=$1 AND status='draft' RETURNING id,status`, [req.params.id]); if (!rows[0]) return res.status(409).json({ error: 'Banner is not a publishable draft.' }); await audit(req.user.id, 'banner.submitted', 'banner', rows[0].id, null); res.json({ data: rows[0] }); });
function requirePermission(permission) { return (req, res, next) => { /* Replace with corporate SSO JWT validation in deployment. */ req.user = { id: req.header('x-demo-user-id') ?? '00000000-0000-0000-0000-000000000001', permissions: ['banner:create', 'banner:publish'] }; if (!req.user.permissions.includes(permission)) return res.sendStatus(403); next(); }; }
async function audit(actorId, action, entityType, entityId, payload) { await pool.query('INSERT INTO audit_log (actor_id, action, entity_type, entity_id, payload) VALUES ($1,$2,$3,$4,$5)', [actorId, action, entityType, entityId, payload]); }
app.use((error, _req, res, _next) => { if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid request', details: error.flatten() }); console.error(error); res.status(500).json({ error: 'Internal server error' }); });
app.listen(process.env.PORT ?? 3000, () => console.log('jiangnan-card-api listening'));
