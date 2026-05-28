import { ChatbotChatView } from '@/modules/chatbot';

export default function Page() {
  return <ChatbotChatView lookup={{ byPurpose: 'other', byNameContains: 'kế toán' }} />;
}
