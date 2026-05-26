import { OcrSchemaEditView } from '@/modules/ocr';

export default function Page({ params }: { params: { id: string } }) {
  return <OcrSchemaEditView id={params.id} />;
}
