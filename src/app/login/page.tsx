import { Suspense } from 'react';
import { SearchParamsLoginForm } from '@/components/auth/SearchParamsLoginForm';
import { Skeleton } from '@/components/ui';

export const metadata = {
  title: 'Sign in · TUSOME Analytics',
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-blue-600 text-lg font-bold text-white">
            T
          </div>
          <h1 className="mt-4 text-2xl font-bold text-gray-900">TUSOME Analytics</h1>
          <p className="mt-1 text-sm text-gray-600">Sign in to view your school&apos;s results.</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <Suspense
            fallback={
              <div className="space-y-4" aria-busy="true">
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
              </div>
            }
          >
            <SearchParamsLoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
