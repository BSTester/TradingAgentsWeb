import { PageLoading } from '@/components/ui/PageLoading';

/** Route-level loading boundary inherited by every application route. */
export default function Loading() {
  return <PageLoading message="正在加载工作台…" />;
}
