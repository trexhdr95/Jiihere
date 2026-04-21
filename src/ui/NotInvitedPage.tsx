import { useAuth } from '@/data/authContext';
import { BrandMark } from './BrandMark';

/**
 * Shown when a signed-in user is not on the allowlist. They've successfully
 * authenticated with Google, but `ensure_profile` rejected them — so we've
 * already signed them out client-side. This page explains why and offers
 * a Try-again button in case the admin has just added them.
 */
export function NotInvitedPage() {
  const { signInWithGoogle } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm text-center">
        <BrandMark size={64} />
        <h1 className="mt-4 text-lg font-semibold text-brand-800">Invite required</h1>
        <p className="mt-2 text-sm text-slate-600">
          Jiihere is invite-only. Ask the admin to add your Google account's
          email to the allowlist, then try again.
        </p>
        <button
          onClick={() => void signInWithGoogle()}
          className="mt-4 w-full rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
