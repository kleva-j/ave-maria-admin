import { UserTypeModel, Role } from './user/types';

export interface IdentityDraft {
  readonly _type: 'draft';
  readonly accountId: string;
  readonly id: string;
  readonly email: string;
  readonly role: Role;
}

export interface InvocationContext {
  readonly isGuest: boolean;
  readonly identity: Identity | null;
}

export type Identity = IdentityDraft | CompleteIdentity;

export interface CompleteIdentity {
  readonly _type: 'complete';
  readonly accountId: string;
  readonly id: string;
  readonly role: Role;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly fullName: string;
  readonly accountType?: UserTypeModel;
}

export function ensureIdentity() {
  return;
}
