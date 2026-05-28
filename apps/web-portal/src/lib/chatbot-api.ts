/**
 * Chatbot API — typed wrappers cho module Cấu hình chatbot AI.
 *
 * Backend chatbot chưa sẵn sàng nên hiện tại sử dụng mock in-memory.
 * Khi backend ready, chỉ cần thay phần body của các method trong `chatbotApi`
 * — interface bên ngoài (kiểu trả về, tham số) giữ nguyên.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type ChatbotPurpose = 'INTERNAL' | 'CSKH' | 'SALES' | 'LEADERSHIP' | 'BOTH';
export type ChatbotMode = 'CHATBOT' | 'API' | 'BOTH';
export type OverlapType = 'PERCENT' | 'CHARS';
export type EmbedKind = 'WIDGET' | 'IFRAME' | 'REST';

export interface KnowledgeBase {
  id: string;
  name: string;
  ownerOrg: string;
}

export interface ChatbotItem {
  id: string;
  name: string;
  shortDescription: string;
  purpose: ChatbotPurpose;
  mode: ChatbotMode;
  active: boolean;

  hasScript: boolean;
  saveHistory: boolean;

  knowledgeBaseIds: string[];
  apiKeyCount: number;

  chunkSize: number;
  overlapType: OverlapType;
  overlapValue: number;

  /** Câu hỏi gợi ý hiển thị trong empty state */
  suggestions: string[];

  createdAt: string;
  updatedAt: string;
}

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
}

export interface CreateChatbotPayload {
  name: string;
  shortDescription?: string;
  purpose: ChatbotPurpose;
  mode: ChatbotMode;
  active: boolean;
  hasScript: boolean;
  saveHistory: boolean;
  knowledgeBaseIds: string[];
}

export interface UpdateChatbotPayload {
  chunkSize?: number;
  overlapType?: OverlapType;
  overlapValue?: number;
  active?: boolean;
}

// ─── Constants & labels ──────────────────────────────────────────────────────

export const PURPOSE_LABELS: Record<ChatbotPurpose, string> = {
  INTERNAL: 'Hỏi đáp nội bộ',
  CSKH: 'CSKH, bán hàng',
  SALES: 'Kinh doanh',
  LEADERSHIP: 'Trợ lý lãnh đạo',
  BOTH: 'Cả hai',
};

export const MODE_LABELS: Record<ChatbotMode, string> = {
  CHATBOT: 'Chatbot',
  API: 'API',
  BOTH: 'Cả hai',
};

// ─── Mock store ──────────────────────────────────────────────────────────────

const KB_MOCK: KnowledgeBase[] = [
  { id: 'kb-acc',  name: 'Tri thức Kế toán – Tài chính', ownerOrg: 'Phòng Kế toán - Tài chính' },
  { id: 'kb-hr',   name: 'Tri thức Nhân sự & Lao động',  ownerOrg: 'Phòng Nhân sự' },
  { id: 'kb-it',   name: 'Tri thức Công nghệ & AI',      ownerOrg: 'Phòng CNTT' },
  { id: 'kb-sale', name: 'Tri thức Kinh doanh & Bán hàng', ownerOrg: 'Phòng Kinh doanh' },
  { id: 'kb-leg',  name: 'Tri thức Pháp chế',             ownerOrg: 'Phòng Pháp chế' },
];

const NOW = new Date().toISOString();

const BOTS_MOCK: ChatbotItem[] = [
  {
    id: 'bot-chatbot-keto',
    name: 'Bot Kế toán Nội bộ',
    shortDescription: 'Hỏi đáp nội bộ',
    purpose: 'INTERNAL',
    mode: 'CHATBOT',
    active: true,
    hasScript: false,
    saveHistory: true,
    knowledgeBaseIds: ['kb-acc', 'kb-leg'],
    apiKeyCount: 0,
    chunkSize: 512,
    overlapType: 'PERCENT',
    overlapValue: 10,
    suggestions: [
      'Quy trình kế toán nội bộ là gì?',
      'Hướng dẫn lập báo cáo tài chính',
      'Chính sách phúc lợi nhân viên',
      'Quy định nghỉ phép năm 2026',
    ],
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'bot-chatbot-mpowhhxt',
    name: 'Bot CSKH - Kinh doanh',
    shortDescription: 'CSKH, bán hàng',
    purpose: 'CSKH',
    mode: 'BOTH',
    active: true,
    hasScript: true,
    saveHistory: true,
    knowledgeBaseIds: ['kb-sale'],
    apiKeyCount: 1,
    chunkSize: 512,
    overlapType: 'PERCENT',
    overlapValue: 10,
    suggestions: [
      'Sản phẩm nổi bật nhất là gì?',
      'Chính sách đổi trả hàng',
      'Chương trình ưu đãi hiện tại',
      'Liên hệ hỗ trợ kỹ thuật',
    ],
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'bot-chatbot-leader',
    name: 'Bot Trợ lý Lãnh đạo',
    shortDescription: 'Trợ lý lãnh đạo',
    purpose: 'LEADERSHIP',
    mode: 'CHATBOT',
    active: false,
    hasScript: false,
    saveHistory: false,
    knowledgeBaseIds: ['kb-acc', 'kb-hr', 'kb-it', 'kb-sale', 'kb-leg'],
    apiKeyCount: 0,
    chunkSize: 768,
    overlapType: 'PERCENT',
    overlapValue: 15,
    suggestions: [
      'Tóm tắt báo cáo tuần này',
      'Đánh giá KPI quý 2',
      'Lịch họp sắp tới',
    ],
    createdAt: NOW,
    updatedAt: NOW,
  },
];

// ─── API surface ─────────────────────────────────────────────────────────────

const delay = (ms = 120) => new Promise<void>(r => setTimeout(r, ms));

let _bots = [...BOTS_MOCK];

export const chatbotApi = {
  async list(): Promise<ChatbotItem[]> {
    await delay();
    return [..._bots];
  },

  async get(id: string): Promise<ChatbotItem | null> {
    await delay();
    return _bots.find(b => b.id === id) ?? null;
  },

  async create(payload: CreateChatbotPayload): Promise<ChatbotItem> {
    await delay();
    const id = `bot-chatbot-${Math.random().toString(36).slice(2, 10)}`;
    const item: ChatbotItem = {
      id,
      name: payload.name,
      shortDescription: payload.shortDescription ?? '',
      purpose: payload.purpose,
      mode: payload.mode,
      active: payload.active,
      hasScript: payload.hasScript,
      saveHistory: payload.saveHistory,
      knowledgeBaseIds: payload.knowledgeBaseIds,
      apiKeyCount: payload.mode === 'CHATBOT' ? 0 : 1,
      chunkSize: 512,
      overlapType: 'PERCENT',
      overlapValue: 10,
      suggestions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    _bots = [..._bots, item];
    return item;
  },

  async update(id: string, payload: UpdateChatbotPayload): Promise<ChatbotItem> {
    await delay();
    let updated: ChatbotItem | undefined;
    _bots = _bots.map<ChatbotItem>(b => {
      if (b.id !== id) return b;
      const next: ChatbotItem = {
        id:               b.id,
        name:             b.name,
        shortDescription: b.shortDescription,
        purpose:          b.purpose,
        mode:             b.mode,
        active:           payload.active       ?? b.active,
        hasScript:        b.hasScript,
        saveHistory:      b.saveHistory,
        knowledgeBaseIds: b.knowledgeBaseIds,
        apiKeyCount:      b.apiKeyCount,
        chunkSize:        payload.chunkSize    ?? b.chunkSize,
        overlapType:      payload.overlapType  ?? b.overlapType,
        overlapValue:     payload.overlapValue ?? b.overlapValue,
        suggestions:      b.suggestions,
        createdAt:        b.createdAt,
        updatedAt:        new Date().toISOString(),
      };
      updated = next;
      return next;
    });
    if (!updated) throw new Error('Không tìm thấy chatbot');
    return updated;
  },

  async remove(id: string): Promise<void> {
    await delay();
    _bots = _bots.filter(b => b.id !== id);
  },
};

export const knowledgeBasesApi = {
  async list(): Promise<KnowledgeBase[]> {
    await delay();
    return [...KB_MOCK];
  },
};

// ─── Chat (mock) ─────────────────────────────────────────────────────────────

export const chatApi = {
  /** Gửi 1 câu hỏi tới bot và trả lời (mock — echo + canned response). */
  async send(botId: string, message: string): Promise<ChatMessage> {
    await delay(450);
    const bot = _bots.find(b => b.id === botId);
    const botName = bot?.name ?? 'Trợ lý AI';
    const reply =
      `Xin chào! Tôi là **${botName}**.\n\n` +
      `Bạn vừa hỏi: "${message}"\n\n` +
      `Đây là phản hồi mẫu. Khi backend chatbot sẵn sàng, câu trả lời sẽ ` +
      `được sinh từ nguồn tri thức đã cấu hình cho bot này.`;
    return {
      id: `msg-${Math.random().toString(36).slice(2, 10)}`,
      role: 'assistant',
      content: reply,
      createdAt: new Date().toISOString(),
    };
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function buildEmbedSnippet(bot: ChatbotItem, kind: EmbedKind): string {
  if (kind === 'WIDGET') {
    return `<!-- FOXAI Chatbot Widget: ${MODE_LABELS[bot.mode]} -->
<script>
  (function(w,d,s,o,f,js,fjs){
    w['FoxAI-Widget']=o;
    w[o]=w[o]||function(){(w[o].q=w[o].q||[]).push(arguments)};
    js=d.createElement(s);fjs=d.getElementsByTagName(s)[0];
    js.id=o;js.src=f;js.async=1;fjs.parentNode.insertBefore(js,fjs);
  }(window,document,'script','foxai','file:///widget/loader.js'));
  foxai('init', {
    botId    : '${bot.id}',
    position : 'bottom-right',
    theme    : 'light',
    lang     : 'vi',
    title    : '${MODE_LABELS[bot.mode]}',
  });
</script>`;
  }
  if (kind === 'IFRAME') {
    return `<iframe
  src="https://chatbot.foxai.vn/embed/${bot.id}"
  width="380"
  height="560"
  style="border:0;border-radius:12px;box-shadow:0 8px 24px rgba(15,23,42,.12);"
  allow="clipboard-write *"
></iframe>`;
  }
  return `# Gửi câu hỏi tới chatbot
curl -X POST https://chatbot.foxai.vn/api/v1/${bot.id}/chat \\
  -H "Authorization: Bearer <API_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "message": "Xin chào, bạn có thể giúp gì?",
    "session_id": "u-12345"
  }'`;
}
