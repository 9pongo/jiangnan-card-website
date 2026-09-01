import cors from 'cors';
import express from 'express';
import pg from 'pg';
import { z } from 'zod';

const app = express();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const roles = { admin: ['banner:view', 'banner:create', 'banner:submit', 'banner:approve', 'banner:disable'], content_editor: ['banner:view', 'banner:create', 'banner:submit'], ad_operator: ['banner:view', 'banner:create', 'banner:submit'], product_editor: [], consignment_staff: [] };
const internalPath = z.string().regex(/^\/[a-zA-Z0-9/_?=&-]*$/);
const targetUrl = z.union([z.string().url(), internalPath]).nullable();
const bannerInput = z.object({ name: z.string().trim().min(1).max(120), kind: z.enum(['store', 'external']), placement: z.enum(['hero', 'home_leaderboard', 'product_sidebar', 'mobile_banner']), priority: z.number().int().min(0).max(1000), startsAt: z.string().datetime(), endsAt: z.string().datetime(), targetUrl, imageKey: z.string().trim().min(1).max(512), imageUrl: z.string().url().nullable().optional() }).refine(value => new Date(value.endsAt) > new Date(value.startsAt), { message: '結束時間必須晚於開始時間', path: ['endsAt'] });
const eventInput = z.object({ eventKey: z.string().uuid() });

app.use(cors({ origin: process.env.PUBLIC_ORIGIN?.split(',') ?? false }));
app.use(express.json({ limit: '128kb' }));
app.get('/health', async (_req, res) => { await pool.query('SELECT 1'); res.json({ status: 'ok' }); });
app.get('/api/v1/public/banners/:placement', async (req, res, next) => {
  try { const placement = z.enum(['hero', 'home_leaderboard', 'product_sidebar', 'mobile_banner']).parse(req.params.placement); const { rows } = await pool.query('SELECT id,name,kind,target_url AS "targetUrl",image_url AS "imageUrl" FROM active_banner_for_placement($1,now())', [placement]); res.json({ data: rows }); } catch (error) { next(error); }
});
app.post('/api/v1/public/banners/:id/events/:type', async (req, res, next) => {
  try { const { eventKey } = eventInput.parse(req.body); const eventType = z.enum(['impression', 'click']).parse(req.params.type); await pool.query('INSERT INTO banner_events (banner_id,event_type,event_key) VALUES ($1,$2,$3) ON CONFLICT (event_type,event_key) DO NOTHING', [req.params.id, eventType, eventKey]); res.status(202).json({ accepted: true }); } catch (error) { next(error); }
});
app.get('/api/v1/admin/banners', requirePermission('banner:view'), async (_req, res, next) => {
  try { const { rows } = await pool.query(`SELECT b.id,b.name,b.kind,b.placement,b.priority,b.starts_at AS "startsAt",b.ends_at AS "endsAt",b.target_url AS "targetUrl",b.image_url AS "imageUrl",b.status,u.display_name AS "createdBy",COALESCE(metrics.impressions,0)::int AS impressions,COALESCE(metrics.clicks,0)::int AS clicks FROM banners b JOIN users u ON u.id=b.created_by LEFT JOIN LATERAL (SELECT count(*) FILTER (WHERE event_type='impression') AS impressions,count(*) FILTER (WHERE event_type='click') AS clicks FROM banner_events WHERE banner_id=b.id) metrics ON true ORDER BY b.updated_at DESC`); res.json({ data: rows }); } catch (error) { next(error); }
});
app.post('/api/v1/admin/banners', requirePermission('banner:create'), async (req, res, next) => {
  try { const input = bannerInput.parse(req.body); const { rows } = await pool.query(`INSERT INTO banners (name,kind,placement,priority,starts_at,ends_at,target_url,image_key,image_url,status,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'draft',$10) RETURNING id,status`, [input.name,input.kind,input.placement,input.priority,input.startsAt,input.endsAt,input.targetUrl,input.imageKey,input.imageUrl ?? null,req.user.id]); await audit(req.user.id,'banner.created','banner',rows[0].id,input); res.status(201).json({ data: rows[0] }); } catch (error) { next(error); }
});
app.post('/api/v1/admin/banners/:id/submit', requirePermission('banner:submit'), async (req, res, next) => { try { res.json({ data: await changeState(req.params.id,'draft','pending_review',req.user.id,'banner.submitted') }); } catch (error) { next(error); } });
app.post('/api/v1/admin/banners/:id/approve', requirePermission('banner:approve'), async (req, res, next) => {
  try { const { rows } = await pool.query(`UPDATE banners SET status=CASE WHEN starts_at > now() THEN 'scheduled'::banner_status ELSE 'published'::banner_status END,approved_by=$2 WHERE id=$1 AND status='pending_review' RETURNING id,status`, [req.params.id,req.user.id]); if (!rows[0]) return res.status(409).json({ error: '只有待審核 Banner 可以發布。' }); await audit(req.user.id,'banner.approved','banner',rows[0].id,null); res.json({ data: rows[0] }); } catch (error) { next(error); }
});
app.post('/api/v1/admin/banners/:id/disable', requirePermission('banner:disable'), async (req, res, next) => {
  try { const { rows } = await pool.query(`UPDATE banners SET status='disabled' WHERE id=$1 AND status IN ('draft','pending_review','published','scheduled') RETURNING id,status`, [req.params.id]); if (!rows[0]) return res.status(409).json({ error: 'Banner 無法停用。' }); await audit(req.user.id,'banner.disabled','banner',rows[0].id,null); res.json({ data: rows[0] }); } catch (error) { next(error); }
});
function requirePermission(permission) { return (req,res,next) => { /* Replace this demo adapter with corporate OIDC JWT validation before deployment. */ const role = req.header('x-demo-role') ?? 'admin'; const id = role === 'ad_operator' ? '00000000-0000-0000-0000-000000000002' : role === 'content_editor' ? '00000000-0000-0000-0000-000000000003' : '00000000-0000-0000-0000-000000000001'; req.user = { id, role, permissions: roles[role] ?? [] }; if (!req.user.permissions.includes(permission)) return res.status(403).json({ error: '權限不足。' }); next(); }; }
async function changeState(id, from, to, actorId, action) { const { rows } = await pool.query('UPDATE banners SET status=$3 WHERE id=$1 AND status=$2 RETURNING id,status', [id,from,to]); if (!rows[0]) { const error = new Error('Invalid state transition'); error.status = 409; throw error; } await audit(actorId,action,'banner',rows[0].id,null); return rows[0]; }
async function audit(actorId,action,entityType,entityId,payload) { await pool.query('INSERT INTO audit_log (actor_id,action,entity_type,entity_id,payload) VALUES ($1,$2,$3,$4,$5)', [actorId,action,entityType,entityId,payload]); }
app.use((error,_req,res,_next) => { if (error instanceof z.ZodError) return res.status(400).json({ error: '請檢查欄位內容。', details: error.flatten() }); console.error(error); res.status(error.status ?? 500).json({ error: error.message === 'Invalid state transition' ? 'Banner 狀態已變更，請重新整理。' : '伺服器發生錯誤。' }); });
app.listen(process.env.PORT ?? 3000, () => console.log('jiangnan-card-api listening'));
