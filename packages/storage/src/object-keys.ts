import { createHash } from 'node:crypto';
import { uuidV7 } from '@family-historian/database';

function scopeSegment(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex').slice(0, 24);
}

export function originalObjectKey(organizationId: string, familyArchiveId: string): string {
  return `tenants/${scopeSegment(organizationId)}/archives/${scopeSegment(familyArchiveId)}/originals/${uuidV7()}`;
}

export function derivativeObjectKey(originalObjectId: string, recipeVersion: string): string {
  return `derivatives/${scopeSegment(originalObjectId)}/${scopeSegment(recipeVersion)}/${uuidV7()}`;
}

export function exportObjectKey(organizationId: string, familyArchiveId: string): string {
  return `tenants/${scopeSegment(organizationId)}/archives/${scopeSegment(familyArchiveId)}/exports/${uuidV7()}`;
}
