import { supabase } from './supabaseClient';

export interface Profile {
  userId: string;
  email: string;
  isAdmin: boolean;
  createdAt: string;
}

export interface Invite {
  id: string;
  email: string;
  invitedBy: string | null;
  invitedAt: string;
  accepted: boolean;
  acceptedAt: string | null;
}

interface ProfileRow {
  user_id: string;
  email: string;
  is_admin: boolean;
  created_at: string;
}

interface InviteRow {
  id: string;
  email: string;
  invited_by: string | null;
  invited_at: string;
  accepted: boolean;
  accepted_at: string | null;
}

function dbToProfile(r: ProfileRow): Profile {
  return { userId: r.user_id, email: r.email, isAdmin: r.is_admin, createdAt: r.created_at };
}

function dbToInvite(r: InviteRow): Invite {
  return {
    id: r.id,
    email: r.email,
    invitedBy: r.invited_by,
    invitedAt: r.invited_at,
    accepted: r.accepted,
    acceptedAt: r.accepted_at,
  };
}

/**
 * Invite gate. Called once right after sign-in. The DB function:
 *   - Returns an existing profile if the user already has one.
 *   - Bootstraps the very first user as admin.
 *   - Otherwise: requires a matching pending invite; raises 'not_invited'.
 * Surface that specific error code so the UI can render the right screen.
 */
export class NotInvitedError extends Error {
  constructor() {
    super('not_invited');
    this.name = 'NotInvitedError';
  }
}

export async function ensureProfile(): Promise<Profile> {
  const { data, error } = await supabase.rpc('ensure_profile');
  if (error) {
    if (/not_invited/i.test(error.message)) throw new NotInvitedError();
    throw error;
  }
  return dbToProfile(data as ProfileRow);
}

// ---------------------------------------------------------------------------
// Admin-only functions. RLS lets only is_admin() users read/write these —
// if a non-admin calls them they'll get an empty result, not an error.
// ---------------------------------------------------------------------------

export async function listProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase.from('profiles').select('*').order('created_at');
  if (error) throw error;
  return (data ?? []).map((r) => dbToProfile(r as ProfileRow));
}

export async function listInvites(): Promise<Invite[]> {
  const { data, error } = await supabase
    .from('invites')
    .select('*')
    .order('invited_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => dbToInvite(r as InviteRow));
}

export async function createInvite(email: string, invitedByUserId: string): Promise<Invite> {
  const normalised = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalised)) {
    throw new Error('Invalid email address');
  }
  const { data, error } = await supabase
    .from('invites')
    .insert({ email: normalised, invited_by: invitedByUserId })
    .select('*')
    .single();
  if (error) throw error;
  return dbToInvite(data as InviteRow);
}

export async function revokeInvite(id: string): Promise<void> {
  const { error } = await supabase.from('invites').delete().eq('id', id);
  if (error) throw error;
}
