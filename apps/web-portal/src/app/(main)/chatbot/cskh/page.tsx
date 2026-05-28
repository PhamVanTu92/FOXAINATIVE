import { ChatbotChatView } from '@/modules/chatbot';

export default function Page() {
  return <ChatbotChatView lookup={{ byPurpose: 'customer_care', byNameContains: 'cskh' }} />;
}
