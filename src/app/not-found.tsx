import { AppNav } from "@/components/app-nav";
import { NotFoundMessage } from "@/components/not-found-message";
import { PublicBrandHeader } from "@/components/public-brand-header";
import { getCurrentUser } from "@/lib/auth/session";

export default async function NotFound() {
  const user = await getCurrentUser();

  return (
    <>
      {user ? <AppNav user={user} /> : <PublicBrandHeader />}
      <div
        id="contenido"
        tabIndex={-1}
        className="flex flex-1 flex-col outline-none"
      >
        <NotFoundMessage />
      </div>
    </>
  );
}
