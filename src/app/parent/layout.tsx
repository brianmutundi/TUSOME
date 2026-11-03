import { ParentGate } from '@/components/parent/ParentGate';

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  return <ParentGate>{children}</ParentGate>;
}
