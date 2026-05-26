import { Metadata } from '@grpc/grpc-js';
import { AuthenticatedRequestUser } from '../auth/jwt-auth.guard';

export function buildForwardMetadata(token?: string, user?: AuthenticatedRequestUser): Metadata {
  const md = new Metadata();
  if (token) md.set('authorization', `Bearer ${token}`);
  if (user?.sub) md.set('x-user-id', user.sub);
  if (user?.email) md.set('x-user-email', user.email);
  return md;
}
