import { Suspense } from 'react';
import { ChatbotChatView } from '@/modules/chatbot';

export default function Page({ params }: { params: { id: string } }) {
  return (
    <Suspense>
      <ChatbotChatView lookup={{ byId: params.id }} />
    </Suspense>
  );
}
