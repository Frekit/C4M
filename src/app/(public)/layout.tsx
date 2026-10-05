export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="border-b bg-background">
        <div className="mx-auto flex h-[52px] w-full items-center px-4 min-[1024px]:px-6 min-[1181px]:px-8">
          <p className="font-heading text-sm font-medium tracking-tight">
            Creators For Media
          </p>
        </div>
      </header>
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
