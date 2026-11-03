'use client';

import { useSearchParams } from 'next/navigation';
import { LoginForm } from './LoginForm';

export function SearchParamsLoginForm() {
  const searchParams = useSearchParams();
  return <LoginForm next={searchParams.get('next')} />;
}
