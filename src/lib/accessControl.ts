import * as trpc from '@trpc/server';

import { AccessControl } from 'accesscontrol';

export const resources = ['user', 'card', 'post', 'request', 'contribution'];
export const features = [
  'get:card',
  'create:card',
  'update:card',
  'delete:card',

  'get:post',
  'create:post',
  'update:post',
  'delete:post',

  'get:request',
  'create:request',
  'update:request',
  'delete:request',

  'get:contribution',
  'create:contribution',
  'update:contribution',
  'delete:contribution',
];

export const AdminGrantList = [
  {
    role: 'admin',
    resource: 'user',
    action: 'read:any',
    attributes: ['*', '!passwordHash'],
  },
  { role: 'admin', resource: 'user', action: 'create:any', attributes: '*' },
  { role: 'admin', resource: 'user', action: 'update:any', attributes: '*' },
  { role: 'admin', resource: 'user', action: 'delete:any', attributes: '*' },

  {
    role: 'admin',
    resource: 'card',
    action: 'create:any',
    attributes: '*',
  },
  { role: 'admin', resource: 'card', action: 'read:any', attributes: '*' },
  {
    role: 'admin',
    resource: 'card',
    action: 'update:any',
    attributes: '*',
  },
  { role: 'admin', resource: 'card', action: 'delete:any', attributes: '*' },

  { role: 'admin', resource: 'post', action: 'create:any', attributes: '*' },
  { role: 'admin', resource: 'post', action: 'read:any', attributes: '*' },
  { role: 'admin', resource: 'post', action: 'update:any', attributes: '*' },
  { role: 'admin', resource: 'post', action: 'delete:any', attributes: '*' },

  { role: 'admin', resource: 'request', action: 'create:any', attributes: '*' },
  { role: 'admin', resource: 'request', action: 'read:any', attributes: '*' },
  { role: 'admin', resource: 'request', action: 'update:any', attributes: '*' },
  { role: 'admin', resource: 'request', action: 'delete:any', attributes: '*' },

  {
    role: 'admin',
    resource: 'contribution',
    action: 'create:any',
    attributes: '*',
  },
  {
    role: 'admin',
    resource: 'contribution',
    action: 'read:any',
    attributes: '*',
  },
  {
    role: 'admin',
    resource: 'contribution',
    action: 'update:any',
    attributes: '*',
  },
  {
    role: 'admin',
    resource: 'contribution',
    action: 'delete:any',
    attributes: '*',
  },
];

export const UserGrantList = [
  {
    role: 'user',
    resource: 'user',
    action: 'update:own',
    attributes: [
      '*',
      '!id',
      '!role',
      '!email',
      '!updatedAt',
      '!createdAt',
      '!emailVerified',
    ],
  },
  {
    role: 'user',
    resource: 'user',
    action: 'read:own',
    attributes: ['*', '!role', '!updatedAt', '!passwordHash'],
  },

  {
    role: 'user',
    resource: 'card',
    action: 'create:own',
    attributes: ['*', '!id', '!userId', '!status', '!createAt', '!updatedAt'],
  },
  {
    role: 'user',
    resource: 'card',
    action: 'read:own',
    attributes: ['*', '!updatedAt'],
  },
  {
    role: 'user',
    resource: 'card',
    action: 'update:own',
    attributes: ['*', '!id', '!userId', '!status', 'createAt', '!updatedAt'],
  },

  {
    role: 'user',
    resource: 'post',
    action: 'create:own',
    attributes: ['*', '!id', '!createAt', '!updatedAt'],
  },
  {
    role: 'user',
    resource: 'post',
    action: 'read:own',
    attributes: ['*', '!updatedAt'],
  },
  {
    role: 'user',
    resource: 'post',
    action: 'update:own',
    attributes: ['*', '!id', '!createAt', '!updatedAt'],
  },

  {
    role: 'user',
    resource: 'request',
    action: 'create:own',
    attributes: [
      '*',
      '!id',
      '!userId',
      '!status',
      '!createAt',
      '!updatedAt',
      'approvedAt',
      '!approvedBy',
    ],
  },
  {
    role: 'user',
    resource: 'request',
    action: 'read:own',
    attributes: ['*', '!updatedAt'],
  },
  {
    role: 'user',
    resource: 'request',
    action: 'update:own',
    attributes: [
      '*',
      '!id',
      '!approvedAt',
      '!approvedBy',
      '!createAt',
      '!updatedAt',
    ],
  },

  {
    role: 'user',
    resource: 'contribution',
    action: 'read:own',
    attributes: '*',
  },
  {
    role: 'user',
    resource: 'contribution',
    action: 'update:own',
    attributes: [
      '*',
      '!id',
      '!agentId',
      '!createAt',
      '!updatedAt',
      '!receivedBy',
      '!approvedAt',
    ],
  },
];

export const AgentGrantList = [
  {
    role: 'agent',
    resource: 'user',
    action: 'read:any',
    attributes: ['*', '!role', '!updatedAt', '!passwordHash'],
  },
  {
    role: 'agent',
    resource: 'user',
    action: 'update:own',
    attributes: [
      '*',
      '!id',
      '!role',
      '!email',
      '!createAt',
      '!updatedAt',
      '!emailVerified',
    ],
  },

  {
    role: 'agent',
    resource: 'card',
    action: 'read:any',
    attributes: ['*', '!updatedAt'],
  },
  {
    role: 'agent',
    resource: 'card',
    action: 'create:any',
    attributes: ['*', '!id', '!createAt', '!updatedAt'],
  },
  {
    role: 'agent',
    resource: 'card',
    action: 'update:any',
    attributes: ['*', '!id', '!createAt', '!updatedAt'],
  },

  {
    role: 'agent',
    resource: 'post',
    action: 'read:any',
    attributes: ['*', '!updatedAt'],
  },
  {
    role: 'agent',
    resource: 'post',
    action: 'create:any',
    attributes: ['*', '!id', '!createAt', '!updatedAt'],
  },
  {
    role: 'agent',
    resource: 'post',
    action: 'update:any',
    attributes: ['*', '!id', '!createAt', '!updatedAt'],
  },

  {
    role: 'agent',
    resource: 'request',
    action: 'read:any',
    attributes: ['*', '!updatedAt'],
  },
  { role: 'agent', resource: 'request', action: 'create:any', attributes: '*' },
  {
    role: 'agent',
    resource: 'request',
    action: 'update:any',
    attributes: [
      '*',
      '!id',
      '!userId',
      '!updatedAt',
      '!createdAt',
      '!approvedBy',
    ],
  },

  {
    role: 'agent',
    resource: 'contribution',
    action: 'create:any',
    attributes: '*',
  },
  {
    role: 'agent',
    resource: 'contribution',
    action: 'read:any',
    attributes: ['*', '!updatedAt'],
  },
  {
    role: 'agent',
    resource: 'contribution',
    action: 'update:any',
    attributes: [
      '*',
      '!id',
      '!agentId',
      '!createAt',
      '!updatedAt',
      '!receivedBy',
      '!approvedAt',
    ],
  },
];

export const GuestGrantList = [
  {
    role: 'guest',
    resource: 'user',
    action: 'read:own',
    attributes: ['*', '!role', '!updatedAt', '!passwordHash'],
  },

  {
    role: 'guest',
    resource: 'card',
    action: 'read:own',
    attributes: ['*', '!updatedAt'],
  },

  {
    role: 'guest',
    resource: 'post',
    action: 'read:own',
    attributes: ['*', '!updatedAt'],
  },

  {
    role: 'guest',
    resource: 'request',
    action: 'read:own',
    attributes: ['*', '!updatedAt'],
  },

  {
    role: 'guest',
    resource: 'contribution',
    action: 'read:own',
    attributes: ['*', '!updatedAt'],
  },
];

const grantList = [
  ...AdminGrantList,
  ...AgentGrantList,
  ...UserGrantList,
  ...GuestGrantList,
];

export const acl = new AccessControl(grantList);

export enum Action {
  read = 'read',
  create = 'create',
  update = 'update',
  delete = 'delete',
}

type accessType = {
  isOwnerFunc: () => boolean;
  resource: string;
  user: { id: string; role: string };
  action: Action;
  input: any;
  query: Awaited<Promise<(input: any) => any>>;
};

export const handleAccess = async (params: accessType) => {
  const { query, isOwnerFunc, action, input, user, resource } = params;
  const permission = acl
    .can(user.role)
    [`${action}${isOwnerFunc() ? 'Own' : 'Any'}`](resource);
  const { granted } = permission;
  const q = granted ? await query(input) : {};
  if (!granted) throw new trpc.TRPCError({ code: 'FORBIDDEN' });
  return { granted, data: permission.filter(q) };
};

export const handleManyAccess = async (
  params: Omit<accessType, 'isOwnerFunc'>,
) => {
  const { query, input, action, user, resource } = params;
  const { id, role } = user;
  const access = acl.permission({ role, resource, action, possession: 'any' });
  const { granted } = access;
  const q = await query({ where: { ...(granted ? input : { ...input, id }) } });
  return { granted, data: access.filter(q) };
};
