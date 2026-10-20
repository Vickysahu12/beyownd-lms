// src/utils/audit.util.ts
// Ek line mein audit entry - har admin/mentor action jo paise ya trust ko
// chhoota hai (refund, revoke, price change, role change, content publish).
// Session diya ho to usi transaction ka hissa banta hai.

import { ClientSession, Types } from 'mongoose';
import AuditLog from '../models/auditLog.model';

export const writeAudit = async (
  actorId: string | Types.ObjectId,
  action: string,
  targetType: string,
  targetId: string | Types.ObjectId,
  details: Record<string, unknown> = {},
  session?: ClientSession
) => {
  await AuditLog.create(
    [{ actorId: new Types.ObjectId(String(actorId)), action, targetType, targetId: new Types.ObjectId(String(targetId)), details }],
    session ? { session } : {}
  );
};
