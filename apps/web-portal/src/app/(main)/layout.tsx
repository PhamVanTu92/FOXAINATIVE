import Sidebar from '@/components/layout/Sidebar';
import PermissionGuard from '@/components/layout/PermissionGuard';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-page transition-colors duration-200">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-page">
        <PermissionGuard>{children}</PermissionGuard>
      </main>
    </div>
  );
}
