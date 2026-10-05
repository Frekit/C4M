import { AppNav } from "@/components/app-nav";
import { getCurrentUser } from "@/lib/auth/session";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <>
      <AppNav user={user} />
      <div
        id="contenido"
        tabIndex={-1}
        className="flex flex-1 flex-col outline-none"
      >
        {children}
      </div>
    </>
  );
}
