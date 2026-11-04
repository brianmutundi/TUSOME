export interface StmtRow { row_kind: string; amount: number; running_balance: number; }

export function totalBilled(rows: StmtRow[]): number {
  let n = 0;
  for (const r of rows) {
    if ((r.row_kind === 'fee' || r.row_kind === 'opening') && r.amount > 0) n += r.amount;
  }
  return n;
}

export function totalPaid(rows: StmtRow[]): number {
  let n = 0;
  for (const r of rows) {
    if (r.row_kind === 'payment') n += -r.amount;
    if (r.row_kind === 'reversal') n -= r.amount;
  }
  return n;
}

export function outstandingBalance(rows: StmtRow[]): number {
  if (!rows.length) return 0;
  return rows[rows.length - 1].running_balance;
}
