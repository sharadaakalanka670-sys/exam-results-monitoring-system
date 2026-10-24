import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';

// Ensure storage directory exists
if (!fs.existsSync(ENV.STORAGE_DIR)) {
  fs.mkdirSync(ENV.STORAGE_DIR, { recursive: true });
}

export interface SignedDownloadPayload {
  documentId: number;
  userId: number;
  examScheduleId: number;
  documentType: string;
}

/**
 * Validates that file buffer starts with PDF magic number %PDF-
 */
export function isValidPdfBuffer(buffer: Buffer): boolean {
  if (buffer.length < 5) return false;
  const header = buffer.subarray(0, 5).toString('ascii');
  return header === '%PDF-';
}

/**
 * Computes SHA-256 checksum of buffer
 */
export function computeSha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Saves a file buffer securely to private storage with a unique random key
 */
export function savePrivateFile(buffer: Buffer, originalFilename: string): { storageKey: string; fullPath: string } {
  const ext = path.extname(originalFilename).toLowerCase() || '.pdf';
  const randomKey = `${Date.now()}-${crypto.randomBytes(16).toString('hex')}${ext}`;
  const fullPath = path.join(ENV.STORAGE_DIR, randomKey);
  
  fs.writeFileSync(fullPath, buffer);
  return { storageKey: randomKey, fullPath };
}

/**
 * Resolves full path to private storage key
 */
export function getPrivateFilePath(storageKey: string): string {
  // Sanitize path against directory traversal
  const safeName = path.basename(storageKey);
  return path.join(ENV.STORAGE_DIR, safeName);
}

/**
 * Generates a short-lived signed download token (valid 5 minutes)
 */
export function generateSignedDownloadToken(payload: SignedDownloadPayload): string {
  return jwt.sign(payload, ENV.JWT_SECRET, { expiresIn: '5m' });
}

/**
 * Verifies signed download token
 */
export function verifySignedDownloadToken(token: string): SignedDownloadPayload | null {
  try {
    return jwt.verify(token, ENV.JWT_SECRET) as SignedDownloadPayload;
  } catch {
    return null;
  }
}
