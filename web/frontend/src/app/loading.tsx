import { PageLoading } from '@/components/ui/PageLoading';

/** Route-level loading fallback shared by every existing App Router page. */
export default function Loading() {
  return <PageLoading message="正在打开工作台..." />;
}
