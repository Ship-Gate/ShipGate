import { PillNav } from '@/components/nav/pill-nav';
import { ProfileDropdown } from '@/components/nav/profile-dropdown';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-sg-bg0">
      <div className="flex items-center justify-between py-4 px-5">
        {/* Logo in left corner */}
        <div className="flex items-center gap-2">
          <img
            src="/logo.png"
            alt="ShipGate"
            className="w-7 h-7 rounded-[6px]"
          />
          <span className="text-sm font-bold text-sg-text0 tracking-tight">ShipGate</span>
        </div>
        
        {/* Pill navigation in center */}
        <div className="flex-1 flex justify-center">
          <PillNav />
        </div>
        
        {/* Profile dropdown in right corner */}
        <ProfileDropdown />
      </div>
      
      <div className="max-w-[1240px] mx-auto p-5">{children}</div>
    </div>
  );
}





































































































































































































































