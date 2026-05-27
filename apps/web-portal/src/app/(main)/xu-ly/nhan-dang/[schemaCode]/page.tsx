import { NhanDangView } from '@/modules/xu-ly';

export default function Page({ params }: { params: { schemaCode: string } }) {
  return <NhanDangView schemaCode={params.schemaCode} />;
}
