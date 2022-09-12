export enum UserTypeModel {
  admin = 'admin',
  agent = 'agent',
  guest = 'guest',
  user = 'user',
}

export enum Role {
  admin = 'admin',
  user = 'user',
  agent = 'agent',
}

export interface CreateUserModel {
  firstName: string;
  lastName: string;
  email: string;
  type: UserTypeModel;
  status: UserStatusModel;
  accountId: string;
  passwordHash: string;
  role: Role;
}

export interface UserModel {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  type: UserTypeModel;
  status: UserStatusModel;
  createdAt: Date;
  updatedAt: Date;
  accountId: string;
  lastSignInAt?: Date;
  lastTokenRefreshAt?: Date;
}

export interface UserSearchFilterModel {
  term?: string;
}

export enum UserStatusModel {
  active = 'active',
  pending = 'pending',
  invited = 'invited',
  revoked = 'revoked',
  deleted = 'deleted',
  deactivated = 'deactivated',
}

export interface UserInputModel {
  limit: number;
  offset: number;
  filter?: UserSearchFilterModel;
  sort?: string;
}

export interface UpdateUserModel {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  type?: UserTypeModel;
  status?: UserStatusModel;
  lastSignInAt?: Date;
  lastTokenRefreshAt?: Date;
}
