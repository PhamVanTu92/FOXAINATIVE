import { ChatbotChatView } from '@/modules/chatbot';

export default function Page({ params }: { params: { id: string } }) {
  return <ChatbotChatView lookup={{ byId: params.id }} />;
}
