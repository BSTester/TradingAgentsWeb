import ReportView from './ReportView';

// Server-rendered dynamic route: /reports/<id> is resolved at request time.
export default function ReportDetailPage() {
  return <ReportView />;
}
