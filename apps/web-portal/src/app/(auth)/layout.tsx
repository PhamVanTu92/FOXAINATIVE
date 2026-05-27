export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0d1f3c] via-[#0f2a4a] to-[#0a1628] flex items-center justify-center p-4">
      {children}
    </div>
  );
}
