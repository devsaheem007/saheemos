import { AuditLog } from '../models/index.js';

// Fire-and-forget: audit failures must never break the request.
export function audit(req, action, resource, resourceId, meta) {
  return AuditLog.create({
    user: req.user?._id, userName: req.user?.name, action, resource,
    resourceId: resourceId ? String(resourceId) : undefined, meta, ip: req.ip,
  }).catch((e) => console.error('audit failed', e.message));
}
