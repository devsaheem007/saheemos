import express from 'express';
import { requirePerm } from '../middleware/security.js';
import { asyncHandler, AppError } from './errors.js';
import { escapeRegex } from './sanitize.js';
import { audit } from './audit.js';
import { toCsv } from './csv.js';
import { sendXlsx, sendPdfTable } from './exporters.js';
import { getSettings } from '../models/index.js';

const isStr = (v) => typeof v === 'string' && v !== '';

/**
 * Generic, permission-enforced CRUD router.
 * Options: search[], filters[], populate, sort, scope(req), readonlyFields[], readOnly,
 *          noDelete, beforeCreate(req, body), afterCreate(req, doc), beforeUpdate(req, doc, body), afterUpdate(req, doc)
 * The scope() filter is applied to list, read, update and delete, so portal users can never touch other people's records.
 */
export function crud(key, Model, o = {}) {
  const router = express.Router();
  const protectedFields = ['_id', '__v', 'createdAt', 'updatedAt', ...(o.readonlyFields || [])];
  const clean = (b) => { const x = { ...b }; protectedFields.forEach((f) => delete x[f]); return x; };
  const scopeOf = async (req) => (o.scope ? o.scope(req) : {});
  const and = (...parts) => { const p = parts.filter((x) => x && Object.keys(x).length); return p.length ? { $and: p } : {}; };
  const query = (q) => { let cur = Model.find(q); if (o.populate) cur = cur.populate(o.populate); return cur; };

  router.get('/', requirePerm(key, 'r'), asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const parts = [await scopeOf(req)];
    if (isStr(req.query.q) && o.search?.length) {
      const rx = new RegExp(escapeRegex(req.query.q.slice(0, 80)), 'i');
      parts.push({ $or: o.search.map((f) => ({ [f]: rx })) });
    }
    const f = {};
    for (const name of o.filters || []) if (isStr(req.query[name])) f[name] = req.query[name];
    parts.push(f);
    const q = and(...parts);
    const sort = o.sort || '-createdAt';

    if (['csv', 'xlsx', 'pdf'].includes(req.query.format)) {
      const rows = await query(q).sort(sort).limit(5000).lean();
      if (req.query.format === 'xlsx') return sendXlsx(res, key, key, rows);
      if (req.query.format === 'pdf') return sendPdfTable(res, { filename: key, title: key.replace(/([A-Z])/g, ' $1'), schoolName: (await getSettings()).schoolName, rows });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${key}.csv"`);
      return res.send(toCsv(rows));
    }
    const [items, total] = await Promise.all([
      query(q).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
      Model.countDocuments(q),
    ]);
    res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  }));

  router.get('/:id', requirePerm(key, 'r'), asyncHandler(async (req, res) => {
    const doc = await query(and({ _id: req.params.id }, await scopeOf(req))).findOne().lean();
    if (!doc) throw new AppError(404, 'Not found');
    res.json(doc);
  }));

  if (o.readOnly) return router;

  router.post('/', requirePerm(key, 'c'), asyncHandler(async (req, res) => {
    let body = clean(req.body);
    if (o.beforeCreate) body = (await o.beforeCreate(req, body)) || body;
    const doc = await Model.create(body);
    audit(req, 'create', key, doc._id);
    if (o.afterCreate) await o.afterCreate(req, doc);
    res.status(201).json(doc);
  }));

  router.patch('/:id', requirePerm(key, 'u'), asyncHandler(async (req, res) => {
    const doc = await Model.findOne(and({ _id: req.params.id }, await scopeOf(req)));
    if (!doc) throw new AppError(404, 'Not found');
    const body = clean(req.body);
    if (o.beforeUpdate) await o.beforeUpdate(req, doc, body);
    doc.set(body);
    await doc.save();
    audit(req, 'update', key, doc._id);
    if (o.afterUpdate) await o.afterUpdate(req, doc);
    res.json(doc);
  }));

  if (!o.noDelete) {
    router.delete('/:id', requirePerm(key, 'd'), asyncHandler(async (req, res) => {
      const doc = await Model.findOne(and({ _id: req.params.id }, await scopeOf(req)));
      if (!doc) throw new AppError(404, 'Not found');
      if (o.beforeDelete) await o.beforeDelete(req, doc);
      await doc.deleteOne();
      audit(req, 'delete', key, doc._id);
      res.json({ ok: true });
    }));
  }
  return router;
}
