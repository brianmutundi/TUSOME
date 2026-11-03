import { AuthGate } from '@/components/auth/AuthGate';

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return <AuthGate>{children}</AuthGate>;
}
