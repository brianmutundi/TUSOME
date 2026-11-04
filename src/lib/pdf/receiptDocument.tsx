import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: 'Helvetica' },
  header: { textAlign: 'center', marginBottom: 16, borderBottom: '1 solid #e5e7eb', paddingBottom: 12 },
  title: { fontSize: 16, fontWeight: 'bold', marginBottom: 2 },
  sub: { fontSize: 9, color: '#6b7280', marginBottom: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  label: { color: '#6b7280', fontSize: 10 },
  value: { fontSize: 10, fontWeight: 'bold' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  cell: { width: '50%', marginBottom: 6 },
  footer: { marginTop: 20, borderTop: '1 solid #e5e7eb', paddingTop: 8, fontSize: 9, color: '#6b7280', textAlign: 'center' },
});

export interface ReceiptPdfData {
  school: { name: string; motto?: string | null; county?: string | null; region?: string | null; country?: string | null; contact_phone?: string | null; contact_email?: string | null };
  receipt: { receipt_number: string; amount_paid: number; payment_method: string; reference_number?: string | null; paid_at: string };
  payment: { amount: number; paid_by?: string | null; academic_year?: number | null; term?: string | null };
  student: { full_name: string; admission_no: string; class_name?: string | null };
  balanceRemaining: number;
  receivedBy?: string | null;
}

function formatKES(n: number) {
  return `KES ${Number(n ?? 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function ReceiptDocument({ data }: { data: ReceiptPdfData }) {
  const termLabel = `${data.payment.term ?? 'Term 1'} • ${data.payment.academic_year ?? new Date().getFullYear()}`;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{data.school.name}</Text>
          {data.school.motto && <Text style={styles.sub}>{data.school.motto}</Text>}
          <Text style={styles.sub}>{[data.school.county, data.school.region, data.school.country].filter(Boolean).join(', ')}</Text>
          <Text style={styles.sub}>{data.school.contact_phone ? `Tel: ${data.school.contact_phone}` : ''} {data.school.contact_email ? `Email: ${data.school.contact_email}` : ''}</Text>
          <Text style={{ fontSize: 12, fontWeight: 'bold', marginTop: 6 }}>RECEIPT</Text>
        </View>

        <View style={styles.grid}>
          <View style={styles.cell}><Text style={styles.label}>Receipt No.</Text><Text style={styles.value}>{data.receipt.receipt_number}</Text></View>
          <View style={styles.cell}><Text style={styles.label}>Date/Time</Text><Text style={styles.value}>{new Date(data.receipt.paid_at).toLocaleString()}</Text></View>
          <View style={styles.cell}><Text style={styles.label}>Student</Text><Text style={styles.value}>{data.student.full_name}</Text></View>
          <View style={styles.cell}><Text style={styles.label}>Adm No.</Text><Text style={styles.value}>{data.student.admission_no}</Text></View>
          <View style={styles.cell}><Text style={styles.label}>Grade</Text><Text style={styles.value}>{data.student.class_name ?? '—'}</Text></View>
          <View style={styles.cell}><Text style={styles.label}>Term</Text><Text style={styles.value}>{termLabel}</Text></View>
          <View style={styles.cell}><Text style={styles.label}>Amount paid</Text><Text style={styles.value}>{formatKES(data.receipt.amount_paid)}</Text></View>
          <View style={styles.cell}><Text style={styles.label}>Method</Text><Text style={styles.value}>{data.receipt.payment_method}</Text></View>
          <View style={styles.cell}><Text style={styles.label}>Reference</Text><Text style={styles.value}>{data.receipt.reference_number ?? '—'}</Text></View>
          <View style={styles.cell}><Text style={styles.label}>Paid by</Text><Text style={styles.value}>{data.payment.paid_by ?? '—'}</Text></View>
          <View style={styles.cell}><Text style={styles.label}>Balance remaining</Text><Text style={styles.value}>{formatKES(data.balanceRemaining)}</Text></View>
          <View style={styles.cell}><Text style={styles.label}>Received by</Text><Text style={styles.value}>{data.receivedBy ?? '—'}</Text></View>
        </View>

        <View style={styles.footer}>
          <Text>Thank you for your payment.</Text>
        </View>
      </Page>
    </Document>
  );
}
