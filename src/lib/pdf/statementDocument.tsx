import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { FeeStatementRow } from '@/lib/analytics/api';

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica' },
  header: { textAlign: 'center', marginBottom: 16, borderBottom: '1 solid #e5e7eb', paddingBottom: 12 },
  title: { fontSize: 16, fontWeight: 'bold', marginBottom: 2 },
  sub: { fontSize: 9, color: '#6b7280', marginBottom: 2 },
  table: { marginTop: 12 },
  th: { flexDirection: 'row', borderBottom: '1 solid #9ca3af', paddingBottom: 4, marginBottom: 4, fontSize: 9, fontWeight: 'bold' },
  tr: { flexDirection: 'row', borderBottom: '1 solid #e5e7eb', paddingVertical: 3 },
  td: { fontSize: 9 },
  footer: { marginTop: 16, borderTop: '1 solid #e5e7eb', paddingTop: 8, fontSize: 9, color: '#6b7280' },
});

export interface StatementPdfData {
  school: { name: string; motto?: string | null; county?: string | null; region?: string | null; country?: string | null; contact_phone?: string | null; contact_email?: string | null };
  student: { full_name: string; admission_no: string; class_name?: string | null };
  term: string | null;
  academicYear: number | null;
  rows: FeeStatementRow[];
  totalBilled: number;
  totalPaid: number;
  outstanding: number;
  generatedAt: string;
}

function formatKES(n: number) {
  return `KES ${Number(n ?? 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function StatementDocument({ data }: { data: StatementPdfData }) {
  const termLabel = `${data.term ?? 'All terms'} • ${data.academicYear ?? new Date().getFullYear()}`;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{data.school.name}</Text>
          {data.school.motto && <Text style={styles.sub}>{data.school.motto}</Text>}
          <Text style={styles.sub}>{[data.school.county, data.school.region, data.school.country].filter(Boolean).join(', ')}</Text>
          <Text style={{ fontSize: 12, fontWeight: 'bold', marginTop: 6 }}>FEE STATEMENT</Text>
          <Text style={styles.sub}>{data.student.full_name} · {data.student.admission_no} · {data.student.class_name ?? ''}</Text>
          <Text style={styles.sub}>{termLabel}</Text>
        </View>

        <View style={styles.th}>
          <Text style={{ width: '12%' }}>Date</Text>
          <Text style={{ width: '22%' }}>Description</Text>
          <Text style={{ width: '10%' }}>Term</Text>
          <Text style={{ width: '12%', textAlign: 'right' }}>Amount</Text>
          <Text style={{ width: '12%', textAlign: 'right' }}>Balance</Text>
          <Text style={{ width: '16%' }}>Receipt</Text>
          <Text style={{ width: '16%' }}>Paid by</Text>
        </View>
        {data.rows.map((r, i) => (
          <View key={i} style={styles.tr}>
            <Text style={{ width: '12%' }}>{r.occurred_at ? new Date(r.occurred_at).toLocaleDateString() : '—'}</Text>
            <Text style={{ width: '22%' }}>{r.description ?? '—'}</Text>
            <Text style={{ width: '10%' }}>{r.term ?? '—'}</Text>
            <Text style={{ width: '12%', textAlign: 'right' }}>{formatKES(r.amount)}</Text>
            <Text style={{ width: '12%', textAlign: 'right' }}>{formatKES(r.running_balance)}</Text>
            <Text style={{ width: '16%' }}>{r.receipt_number ?? '—'}</Text>
            <Text style={{ width: '16%' }}>{r.paid_by ?? '—'}</Text>
          </View>
        ))}

        <View style={{ marginTop: 12 }}>
          <Text style={{ fontSize: 10, fontWeight: 'bold' }}>Total billed: {formatKES(data.totalBilled)}</Text>
          <Text style={{ fontSize: 10, fontWeight: 'bold' }}>Total paid: {formatKES(data.totalPaid)}</Text>
          <Text style={{ fontSize: 10, fontWeight: 'bold' }}>Outstanding balance: {formatKES(data.outstanding)}</Text>
        </View>
        <View style={styles.footer}>
          <Text>Generated {data.generatedAt}</Text>
        </View>
      </Page>
    </Document>
  );
}
