import { redirect } from 'next/navigation';

// Transcripts are per student. Send the nav entry to the student list, where each profile links to its transcript.
export default function TranscriptIndexPage() {
  redirect('/analytics/students');
}
