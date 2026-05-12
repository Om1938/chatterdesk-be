export type UserRole = 'OWNER' | 'ADMIN' | 'AGENT' | 'VIEWER'

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  OWNER: 4,
  ADMIN: 3,
  AGENT: 2,
  VIEWER: 1,
}

export const CAN_SEND_MESSAGES: UserRole[] = ['OWNER', 'ADMIN', 'AGENT']
export const CAN_MANAGE_USERS: UserRole[] = ['OWNER', 'ADMIN']
export const CAN_MANAGE_ACCOUNTS: UserRole[] = ['OWNER']
export const ALL_ROLES: UserRole[] = ['OWNER', 'ADMIN', 'AGENT', 'VIEWER']
