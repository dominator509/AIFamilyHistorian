import type { RightsStatus, Role, Visibility } from '@family-historian/contracts';
import { DomainError } from './errors.js';

export interface AccessContext {
  readonly role: Role;
  readonly visibility: Visibility;
  readonly rightsStatus: RightsStatus;
  readonly isSelectedContributor: boolean;
  readonly hasValidShareLink: boolean;
  readonly embargoReleased: boolean;
  readonly subjectConsentActive: boolean;
}

export function assertItemReadable(context: AccessContext): void {
  if (context.rightsStatus === 'disputed')
    throw new DomainError('RIGHTS_DISPUTED', 'item rights are disputed');
  if (context.rightsStatus !== 'verified')
    throw new DomainError('RIGHTS_UNVERIFIED', 'item rights are not verified');
  if (!context.subjectConsentActive)
    throw new DomainError('CONSENT_REQUIRED', 'subject consent is required');
  if (!context.embargoReleased) throw new DomainError('PERMISSION_DENIED', 'item is embargoed');
  if (context.role === 'platform_admin')
    throw new DomainError(
      'PERMISSION_DENIED',
      'platform administrators have no standing content access',
    );
  if (context.role === 'organization_owner' || context.role === 'archive_owner') return;

  const permitted =
    context.visibility === 'family_members' ||
    context.visibility === 'public_approved' ||
    (context.visibility === 'selected_contributors' && context.isSelectedContributor) ||
    (context.visibility === 'link_recipients' && context.hasValidShareLink);
  if (!permitted) throw new DomainError('PERMISSION_DENIED', 'item visibility denies access');
}

export function assertCanApproveEdition(role: Role): void {
  if (role !== 'archive_owner')
    throw new DomainError('PERMISSION_DENIED', 'only archive owners can approve editions');
}
