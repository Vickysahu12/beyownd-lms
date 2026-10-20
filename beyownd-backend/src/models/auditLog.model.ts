// src/models/auditLog.model.ts
//
// ── HOW THIS FILE CONNECTS TO THE REST OF THE APP ──────────────────────────
// - Har admin/mentor action jo trust ya paise ko chhoota hai, yahan likha
//   jaata hai: project review decision, credential revoke, refund marking,
//   price change (Phase 5). "Kisne, kab, kya badla, kyun" - baad mein koi
//   student ya college sawaal kare to jawab yahan hai.
// - APPEND-ONLY: koi update/delete route nahi. Model bhi update block karta hai.
// - Design: docs/design/schemas.md §6.2
// ─────────────────────────────────────────────────────────────────────────

import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface IAuditLog extends Document {
  actorId: Types.ObjectId;
  action: string;
  targetType: string;
  targetId: Types.ObjectId;
  details: Record<string, unknown>;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // e.g. 'submission.review', 'credential.revoke', 'cohort.update_price'
    action: { type: String, required: true },
    targetType: { type: String, required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    details: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Append-only: likha hua audit kabhi badla nahi ja sakta
auditLogSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne'], function () {
  throw new Error('Audit logs are append-only');
});

// "Is cheez ke saath kya-kya hua" aur "is admin ne kya-kya kiya"
auditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
auditLogSchema.index({ actorId: 1, createdAt: -1 });

const AuditLog: Model<IAuditLog> = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);

export default AuditLog;
