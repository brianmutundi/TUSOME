'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useParent } from '@/components/parent/ParentContext';
import { ScreenSkeleton } from '@/components/parent/parts';

/** Old deep link /parent/<studentId>: select that child, then show their fees. */
export default function LegacyChildRedirect() {
  const { studentId } = useParams<{ studentId: string }>();
  const { kids, selectChild } = useParent();
  const router = useRouter();

  useEffect(() => {
    if (!kids) return;
    if (kids.some((k) => k.studentId === studentId)) {
      selectChild(studentId);
      router.replace('/parent/fees');
    } else {
      router.replace('/parent');
    }
  }, [kids, studentId, selectChild, router]);

  return <ScreenSkeleton />;
}
