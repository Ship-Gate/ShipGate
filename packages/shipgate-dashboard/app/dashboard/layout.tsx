import { PillNav } from '@/components/nav/pill-nav';
import { ProfileDropdown } from '@/components/nav/profile-dropdown';
import { CommandPalette } from '@/components/command-palette';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-sg-bg0">
      <CommandPalette />
      <div className="flex items-center justify-between py-4 px-5">
        <div className="flex items-center gap-2">
          <img
            src="/logo.png"
            alt="ShipGate"
            className="w-7 h-7 rounded-[6px]"
          />
          <span className="text-sm font-bold text-sg-text0 tracking-tight">ShipGate</span>
        </div>
        
        <div className="flex-1 flex justify-center">
          <PillNav />
        </div>
        
        <ProfileDropdown />
      </div>
      
      <div className="max-w-[1240px] mx-auto p-5">{children}</div>
    </div>
  );
}





































































































































































































































