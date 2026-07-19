import type { UserRepo } from '../ports/auth-ports.js';
import { PublicUseCaseError } from '@narraza/shared';

/**
 * Authorize that a user exists and is active.
 *
 * Returns the full user record on success.
 *
 * Error mapping:
 * - Missing user         -> NOT_FOUND (public: "Not found") — indistinguishable from IDOR
 * - Suspended user       -> FORBIDDEN
 * - Deleted user         -> FORBIDDEN
 */
export async function authorizeActiveUser(
  userRepo: UserRepo,
  userId: string,
) {
  const user = await userRepo.findById(userId);
  if (!user) {
    throw new PublicUseCaseError('NOT_FOUND', 'User not found');
  }

  if (user.status === 'suspended') {
    throw new PublicUseCaseError('FORBIDDEN', 'Account is suspended');
  }

  if (user.status === 'deleted') {
    throw new PublicUseCaseError('FORBIDDEN', 'Account has been deleted');
  }

  // Active
  return user;
}
