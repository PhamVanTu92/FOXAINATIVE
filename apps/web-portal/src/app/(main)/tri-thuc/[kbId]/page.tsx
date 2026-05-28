import { KnowledgeDetailView } from '@/modules/tri-thuc';
export default function Page({ params }: { params: { kbId: string } }) {
  return <KnowledgeDetailView kbId={params.kbId} />;
}
