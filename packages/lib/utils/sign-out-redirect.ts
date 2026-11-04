import { formatPath } from '../constants/app';
import { env } from './env';

/**
 * Where the browser goes after signing out. An explicit path wins; otherwise
 * the deployment's NEXT_PUBLIC_POST_SIGNOUT_URL (an identity provider's logout
 * page, so signing out here ends that session too), else the sign-in page.
 */
export const resolveSignOutRedirect = (redirectPath?: string): string => {
  if (redirectPath) {
    return redirectPath;
  }

  const configured = env('NEXT_PUBLIC_POST_SIGNOUT_URL');

  return configured && /^https?:\/\//i.test(configured) ? configured : formatPath('/signin');
};
