'use client';

import { useEffect, useState } from 'react';
import { getSchoolProfile } from '@/lib/analytics/api';
import type { SchoolProfile } from '@/lib/analytics/types';

export function SchoolHeader({ title }: { title?: string }) {
  const [profile, setProfile] = useState<SchoolProfile | null>(null);

  useEffect(() => {
    getSchoolProfile().then(setProfile).catch(() => setProfile(null));
  }, []);

  const addressParts = [profile?.county, profile?.region, profile?.country].filter(Boolean);

  return (
    <header className="mb-6 border-b border-gray-200 pb-4 text-center">
      {profile?.logo_url && (
        <img
          src={profile.logo_url}
          alt={profile.name ? `${profile.name} logo` : 'School logo'}
          className="mx-auto mb-3 h-16 w-auto object-contain"
        />
      )}
      {profile?.name && <h1 className="text-xl font-bold text-gray-900">{profile.name}</h1>}
      {profile?.motto && <p className="mt-1 text-sm italic text-gray-600">{profile.motto}</p>}
      {addressParts.length > 0 && (
        <p className="mt-1 text-xs text-gray-500">{addressParts.join(', ')}</p>
      )}
      <div className="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-gray-500">
        {profile?.contact_phone && <span>Tel: {profile.contact_phone}</span>}
        {profile?.contact_email && <span>Email: {profile.contact_email}</span>}
      </div>
      {title && <p className="mt-3 text-sm font-semibold uppercase tracking-wide text-gray-700">{title}</p>}
    </header>
  );
}