// src/controllers/credential.controller.ts
// My documents, download link, public verify, aur signed file download.

import { Request, Response } from 'express';
import * as credentialService from '../services/credential.service';
import { readObject, isValidDownloadSignature } from '../utils/storage.util';
import { AppError } from '../utils/AppError';

export const listMine = async (req: Request, res: Response) => {
  const credentials = await credentialService.listMyCredentials(req.user!.id);
  res.status(200).json({ success: true, credentials });
};

// Seedha PDF nahi - 5 min ka signed link. Frontend isse open/download karta hai.
export const download = async (req: Request<{ credentialId: string }>, res: Response) => {
  const link = await credentialService.getDownloadLink(req.user!.id, req.params.credentialId);
  res.status(200).json({ success: true, ...link });
};

// PUBLIC - koi bhi (college, recruiter) bina login ke
export const verify = async (req: Request<{ credentialId: string }>, res: Response) => {
  const credential = await credentialService.verifyCredential(req.params.credentialId);
  res.status(200).json({ success: true, credential });
};

// Signed URL wala file download. Auth = signature (link 5 min mein expire).
export const file = async (req: Request<{ folder: string; file: string }>, res: Response) => {
  const key = `${req.params.folder}/${req.params.file}`;
  const expires = Number(req.query.expires);
  const sig = typeof req.query.sig === 'string' ? req.query.sig : '';
  if (!isValidDownloadSignature(key, expires, sig)) {
    throw AppError.forbidden('This download link is invalid or has expired', 'DOWNLOAD_LINK_EXPIRED');
  }
  let bytes: Buffer;
  try {
    bytes = await readObject(key);
  } catch {
    throw AppError.notFound('File not found');
  }
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="Beyownd-${req.params.file}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.status(200).send(bytes);
};
