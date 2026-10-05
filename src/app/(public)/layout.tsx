import { PublicBrandHeader } from "@/components/public-brand-header";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <PublicBrandHeader />
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
