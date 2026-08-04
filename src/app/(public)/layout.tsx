import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { auth } from '@/lib/auth';
import { isRole } from '@/lib/auth/rbac';

/**
 * Chrome shared by every public page. The session is read on the server so the
 * header renders in its signed-in state on first paint, with no flash.
 */
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const role = session?.user?.role;

  return (
    <>
      <SiteHeader session={isRole(role) ? { user: { name: session?.user?.name, role } } : null} />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </>
  );
}
