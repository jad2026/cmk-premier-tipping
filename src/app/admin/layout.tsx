export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Cover the rugby field background with plain grey for admin only */}
      <div className="fixed inset-0 bg-[#f3f4f6] -z-10" aria-hidden="true" />
      {children}
    </>
  );
}
