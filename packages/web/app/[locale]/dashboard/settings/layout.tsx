/**
 * Settings frame — the design's page header plus the tab bar, above whichever tab
 * is open.
 *
 * The header is new: the screen used to open straight onto a bare tab bar, with no
 * title and nothing saying what any of it governs.
 */

import { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import SettingsNav from './SettingsNav';

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations('Settings');

  return (
    <div>
      <div style={{ paddingBottom: 18 }}>
        <h1 className="r-page-title">{t('title')}</h1>
        <p className="r-page-sub">{t('description')}</p>
      </div>
      <SettingsNav />
      <div style={{ paddingTop: 22 }}>{children}</div>
    </div>
  );
}
