import { describe, it, expect } from 'vitest';
import { totalBilled, totalPaid, outstandingBalance } from './statementMaths';

describe('statement maths', () => {
  const rows = [
    { row_kind: 'opening', amount: 1000, running_balance: 1000 },
    { row_kind: 'fee', amount: 5000, running_balance: 6000 },
    { row_kind: 'payment', amount: -2000, running_balance: 4000 },
    { row_kind: 'reversal', amount: 500, running_balance: 4500 },
  ];
  it('totals billed', () => expect(totalBilled(rows)).toBe(6000));
  it('totals paid', () => expect(totalPaid(rows)).toBe(1500));
  it('outstanding', () => expect(outstandingBalance(rows)).toBe(4500));
});
