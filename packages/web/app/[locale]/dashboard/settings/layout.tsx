import { ReactNode } from 'react';
import SettingsNav from './SettingsNav';

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-0">
      <div className="pb-0">
        <div className="px-0 pt-2 pb-0">
          <SettingsNav />
        </div>
      </div>
      <div className="pt-4">{children}</div>
    </div>
  );
}
