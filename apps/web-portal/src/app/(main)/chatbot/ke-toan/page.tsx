import { Suspense } from 'react';
import { ChatbotChatView } from '@/modules/chatbot';

export default function Page() {
  return (
    <Suspense>
      <ChatbotChatView lookup={{ byPurpose: 'other', byNameContains: 'kế toán' }} />
    </Suspense>
  );
}
