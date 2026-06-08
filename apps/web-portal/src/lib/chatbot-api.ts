/**
 * Chatbot API — typed wrappers cho module Cấu hình & Chat chatbot AI.
 *
 * Backend: chatbot-service (Python/FastAPI), proxied qua api-gateway tại
 * `/api/chatbot/v1/...`. Auth bằng JWT Bearer trong localStorage.access_token
 * (giống pattern users-api.ts).
 *
 * Backend dùng snake_case, frontend dùng camelCase → có mapper 2 chiều:
 *   `toItem(raw)` :  ChatbotOut → ChatbotItem
 *   `toMutate(it)`:  CreateChatbotPayload → ChatbotMutate
 */

// ─── Base URL + auth ──────────────────────────────────────────────────────────

const BASE = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api/chatbot`;

function authHeader(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Format lỗi từ backend thành chuỗi hiển thị được.
 *
 * FastAPI 422 trả về:
 *   { detail: [{ loc: ['body','name'], msg: 'Field required', type: 'missing' }, ...] }
 * Trường hợp khác có thể là:
 *   { detail: 'string error' } hoặc { message: 'error' }
 */
function formatApiError(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const b = body as { detail?: unknown; message?: unknown };
    // detail là array (FastAPI validation)
    if (Array.isArray(b.detail)) {
      const lines = b.detail
        .map((e: unknown) => {
          if (!e || typeof e !== 'object') return null;
          const item = e as { loc?: unknown[]; msg?: string; message?: string };
          const field = Array.isArray(item.loc)
            ? item.loc.filter(p => p !== 'body').join('.')
            : '';
          const msg = item.msg ?? item.message ?? 'invalid';
          return field ? `• ${field}: ${msg}` : `• ${msg}`;
        })
        .filter((x): x is string => Boolean(x));
      if (lines.length) return lines.join('\n');
    }
    if (typeof b.detail === 'string')  return b.detail;
    if (typeof b.message === 'string') return b.message;
  }
  return `HTTP ${status}`;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...authHeader(),
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(formatApiError(body, res.status));
  }
  // 204 No Content
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ─── Types (frontend-facing) ─────────────────────────────────────────────────

/** Khớp với backend enum ChatbotPurpose */
export type ChatbotPurpose = 'customer_care' | 'sales' | 'tech_support' | 'other';
/** Khớp với backend enum ChatbotForm */
export type ChatbotMode = 'chat' | 'voice' | 'both';

export interface TtsVoice {
  id: string;
  name: string;
  language?: string;
  gender?: string;
}
export type OverlapType = 'PERCENT' | 'CHARS';
export type EmbedKind = 'WIDGET' | 'IFRAME' | 'REST';

export interface FAQItem {
  question: string;
  answer: string;
}

export interface KnowledgeBase {
  id: string;
  name: string;
  ownerOrg: string;
}

export interface WidgetSettings {
  welcomeMessage: string;   // tin nhắn chào khi mở widget
  enabled: boolean;         // widget có được nhúng ra ngoài hay không
}

export const DEFAULT_WIDGET: WidgetSettings = {
  welcomeMessage: 'Xin chào! Tôi có thể giúp gì cho bạn?',
  enabled:        true,
};

export interface ChatbotItem {
  id: string;
  name: string;
  shortDescription: string;
  purpose: ChatbotPurpose;
  mode: ChatbotMode;
  active: boolean;

  /** Hướng dẫn hệ thống — định hướng tone & phạm vi cho LLM */
  systemPrompt: string;

  /** Derived: true nếu có ít nhất 1 FAQ (giữ để sidebar/badge cũ vẫn chạy) */
  hasScript: boolean;
  /** Backend luôn log — UI flag thông tin (giữ để badge cũ vẫn chạy) */
  saveHistory: boolean;

  knowledgeBaseIds: string[];
  apiKeyCount: number;

  chunkSize: number;
  overlapType: OverlapType;
  overlapValue: number;

  /** Câu hỏi gợi ý hiển thị trong empty state */
  suggestions: string[];

  /** Kịch bản hỏi-đáp định sẵn (chỉ dùng khi hasScript=true) */
  faqs: FAQItem[];

  /** Cấu hình giao diện widget được nhúng ra ngoài */
  widget: WidgetSettings;

  /** Public widget id (rotatable) — dùng cho embed snippet */
  publicId: string;

  createdAt: string;
  updatedAt: string;
}

export interface CreateChatbotPayload {
  name: string;
  shortDescription?: string;
  purpose: ChatbotPurpose;
  mode: ChatbotMode;
  active: boolean;
  /** Tương thích ngược: vẫn export, không còn dùng trong form mới */
  hasScript?: boolean;
  saveHistory?: boolean;
  /** Cũ — chỉ ID; ưu tiên dùng `collections` (có cả tên) */
  knowledgeBaseIds: string[];
  /** Collections đã chọn — id + name lấy từ index-service */
  collections?: { id: string; name: string }[];
  /** Hướng dẫn hệ thống (System Prompt) */
  systemPrompt?: string;
  /** Danh sách Q&A định sẵn */
  faqs?: FAQItem[];
  /** Cấu hình widget (welcome message + enabled) */
  widget?: WidgetSettings;
}

/**
 * Update payload — superset của Create, tất cả optional vì backend PUT
 * dùng chung schema `ChatbotMutate` (gửi gì update nấy, không gửi giữ nguyên).
 */
export interface UpdateChatbotPayload {
  name?: string;
  shortDescription?: string;
  purpose?: ChatbotPurpose;
  mode?: ChatbotMode;
  active?: boolean;
  saveHistory?: boolean;
  systemPrompt?: string;
  faqs?: FAQItem[];
  knowledgeBaseIds?: string[];
  collections?: { id: string; name: string }[];
  welcomeMessage?: string;
  widget?: WidgetSettings;
  // Chunk config — chưa được backend persist riêng, gửi trong widget_theme cho round-trip
  chunkSize?: number;
  overlapType?: OverlapType;
  overlapValue?: number;
}

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
}

// ─── Constants & labels ──────────────────────────────────────────────────────

export const PURPOSE_LABELS: Record<ChatbotPurpose, string> = {
  customer_care: 'CSKH / Bán hàng',
  sales:         'Kinh doanh',
  tech_support:  'Hỗ trợ kỹ thuật',
  other:         'Khác (nội bộ, lãnh đạo, ...)',
};

export const MODE_LABELS: Record<ChatbotMode, string> = {
  chat:  'Chat',
  voice: 'Voice',
  both:  'Chat + Voice',
};

// ─── Backend ↔ Frontend mapping ──────────────────────────────────────────────

interface ChatbotOut {
  id: string;
  user_id: string;
  name: string;
  purpose: string;
  form: string;
  description?: string | null;
  system_prompt?: string | null;
  faqs?: Record<string, unknown>[] | null;
  collections?: { collection_name?: string; collection_id?: string }[];
  llm_provider?: string | null;
  embedding_provider?: string | null;
  welcome_message?: string | null;
  widget_theme?: Record<string, unknown> | null;
  public_id: string;
  is_active: boolean;
  is_widget_active?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

/** Convert backend purpose string → UI enum. Unknown / legacy values map về 'customer_care'. */
function purposeBackendToUi(s: string): ChatbotPurpose {
  const v = (s || '').toLowerCase();
  if (v === 'customer_care' || v === 'cskh' || v.includes('customer') || v.includes('care')) return 'customer_care';
  if (v === 'sales' || v.includes('kinh_doanh') || v.includes('bán'))   return 'sales';
  if (v === 'tech_support' || v.includes('tech') || v.includes('support')) return 'tech_support';
  return 'other';
}

/** UI value đã trùng backend enum → identity. */
function purposeUiToBackend(p: ChatbotPurpose): string { return p; }

/** Convert backend form string → UI enum. */
function modeBackendToUi(form: string): ChatbotMode {
  const v = (form || '').toLowerCase();
  if (v === 'voice')                       return 'voice';
  if (v === 'both' || v === 'chat_voice')  return 'both';
  return 'chat';
}

/** UI value đã trùng backend enum → identity. */
function modeUiToBackend(m: ChatbotMode): string { return m; }

function parseFaqs(raw: Record<string, unknown>[] | null | undefined): FAQItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(r => ({
      question: typeof r.question === 'string' ? r.question : '',
      answer:   typeof r.answer   === 'string' ? r.answer   : '',
    }))
    .filter(f => f.question.trim() || f.answer.trim());
}

function parseWidget(raw: Record<string, unknown> | null | undefined): WidgetSettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_WIDGET };
  const get = <T>(k: string, fallback: T): T => {
    const v = raw[k];
    return v === undefined || v === null ? fallback : (v as T);
  };
  return {
    welcomeMessage: get('welcomeMessage', DEFAULT_WIDGET.welcomeMessage),
    enabled:        get('enabled',        DEFAULT_WIDGET.enabled),
  };
}

function toItem(r: ChatbotOut): ChatbotItem {
  const purpose = purposeBackendToUi(r.purpose);
  const faqs    = parseFaqs(r.faqs);
  const widget  = parseWidget(r.widget_theme);
  // welcome_message từ backend ưu tiên hơn widget.welcomeMessage nếu có
  if (r.welcome_message) widget.welcomeMessage = r.welcome_message;
  return {
    id:               r.id,
    name:             r.name,
    shortDescription: r.description ?? '',
    purpose,
    mode:             modeBackendToUi(r.form),
    active:           r.is_active,
    systemPrompt:     r.system_prompt ?? '',
    hasScript:        faqs.length > 0,
    saveHistory:      true, // backend always logs; UI flag is informational
    knowledgeBaseIds: (r.collections ?? [])
      .map(c => c.collection_id ?? c.collection_name)
      .filter((x): x is string => typeof x === 'string'),
    apiKeyCount:      r.is_widget_active ? 1 : 0,
    chunkSize:        512,
    overlapType:      'PERCENT',
    overlapValue:     10,
    suggestions:      defaultSuggestions(purpose),
    faqs,
    widget,
    publicId:         r.public_id,
    createdAt:        r.created_at ?? new Date().toISOString(),
    updatedAt:        r.updated_at ?? new Date().toISOString(),
  };
}

function toMutate(p: CreateChatbotPayload): Record<string, unknown> {
  const widget = p.widget ?? DEFAULT_WIDGET;
  // p.collections (mới) ưu tiên — chứa cả name; fallback knowledgeBaseIds (cũ)
  const collections =
    p.collections?.map(c => ({ collection_id: c.id, collection_name: c.name })) ??
    p.knowledgeBaseIds.map(id => ({ collection_id: id, collection_name: id }));
  return {
    name:            p.name,
    purpose:         purposeUiToBackend(p.purpose),
    form:            modeUiToBackend(p.mode),
    description:     p.shortDescription ?? null,
    is_active:       p.active,
    system_prompt:   p.systemPrompt ?? null,
    faqs:            (p.faqs ?? []).map(f => ({ question: f.question, answer: f.answer })),
    welcome_message: widget.welcomeMessage || null,
    widget_theme: {
      welcomeMessage: widget.welcomeMessage,
      enabled:        widget.enabled,
    },
    collections,
  };
}

function defaultSuggestions(purpose: ChatbotPurpose): string[] {
  switch (purpose) {
    case 'customer_care':
      return [
        'Sản phẩm nổi bật nhất là gì?',
        'Chính sách đổi trả hàng',
        'Chương trình ưu đãi hiện tại',
        'Liên hệ hỗ trợ kỹ thuật',
      ];
    case 'sales':
      return ['Doanh số tháng này?', 'Top khách hàng tiềm năng', 'Báo giá sản phẩm A'];
    case 'tech_support':
      return ['Hướng dẫn cài đặt', 'Khắc phục sự cố thường gặp', 'Liên hệ kỹ thuật viên'];
    case 'other':
    default:
      return [
        'Quy trình nội bộ là gì?',
        'Hướng dẫn lập báo cáo',
        'Chính sách phúc lợi nhân viên',
        'Quy định nghỉ phép',
      ];
  }
}

// ─── chatbotApi ──────────────────────────────────────────────────────────────

export const chatbotApi = {
  /**
   * Liệt kê chatbot.
   * - `'manage'` (mặc định): danh sách để quản lý (màn "Thiết lập bot hội thoại") —
   *   admin / người có `CHATBOT_CONFIG.READ` thấy tất cả, còn lại chỉ thấy bot mình tạo.
   * - `'chat'`: danh sách bot user ĐƯỢC CHAT — bot mình sở hữu ∪ được cấp quyền XEM
   *   per-bot (`CHATBOT_<id>.READ`) ∪ (admin thấy hết). Dùng cho sidebar/menu chọn bot.
   */
  async list(scope: 'manage' | 'chat' = 'manage'): Promise<ChatbotItem[]> {
    const qs = scope === 'chat' ? '?scope=chat' : '';
    const raw = await req<ChatbotOut[]>(`/v1/chatbots${qs}`);
    return raw.map(toItem);
  },

  async get(id: string): Promise<ChatbotItem | null> {
    try {
      const raw = await req<ChatbotOut>(`/v1/chatbots/${id}`);
      return toItem(raw);
    } catch (e: unknown) {
      const msg = (e as Error).message;
      if (msg.includes('404')) return null;
      throw e;
    }
  },

  async create(payload: CreateChatbotPayload): Promise<ChatbotItem> {
    const raw = await req<ChatbotOut>('/v1/chatbots', {
      method: 'POST',
      body: JSON.stringify(toMutate(payload)),
    });
    return toItem(raw);
  },

  async update(id: string, payload: UpdateChatbotPayload): Promise<ChatbotItem> {
    // Backend PUT dùng chung schema `ChatbotMutate` với POST — `name` bắt buộc.
    // Lấy bot hiện tại làm baseline rồi merge các field user thay đổi.
    const cur = await chatbotApi.get(id);
    if (!cur) throw new Error('Không tìm thấy chatbot');

    const merged: CreateChatbotPayload = {
      name:             payload.name             ?? cur.name,
      shortDescription: payload.shortDescription ?? cur.shortDescription,
      purpose:          payload.purpose          ?? cur.purpose,
      mode:             payload.mode             ?? cur.mode,
      active:           payload.active           ?? cur.active,
      systemPrompt:     payload.systemPrompt     ?? cur.systemPrompt,
      faqs:             payload.faqs             ?? cur.faqs,
      collections:      payload.collections
        ?? (payload.knowledgeBaseIds
          ? payload.knowledgeBaseIds.map(cid => ({ id: cid, name: cid }))
          : cur.knowledgeBaseIds.map(cid => ({ id: cid, name: cid }))),
      knowledgeBaseIds: payload.knowledgeBaseIds ?? cur.knowledgeBaseIds,
      widget:           payload.widget
        ?? (payload.welcomeMessage !== undefined
          ? { ...cur.widget, welcomeMessage: payload.welcomeMessage }
          : cur.widget),
    };

    const body = toMutate(merged);
    // chunkSize/overlap — không có chỗ trong ChatbotMutate, nhét vào widget_theme
    if (payload.chunkSize !== undefined
        || payload.overlapType !== undefined
        || payload.overlapValue !== undefined) {
      body.widget_theme = {
        ...(body.widget_theme as Record<string, unknown> | undefined),
        chunkSize:    payload.chunkSize    ?? cur.chunkSize,
        overlapType:  payload.overlapType  ?? cur.overlapType,
        overlapValue: payload.overlapValue ?? cur.overlapValue,
      };
    }

    const raw = await req<ChatbotOut>(`/v1/chatbots/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    return toItem(raw);
  },

  async remove(id: string): Promise<void> {
    await req<void>(`/v1/chatbots/${id}`, { method: 'DELETE' });
  },
};

// ─── Knowledge bases (chưa có endpoint riêng → mock cho tới khi backend ready) ─

const KB_MOCK: KnowledgeBase[] = [
  { id: 'kb-acc',  name: 'Tri thức Kế toán – Tài chính', ownerOrg: 'Phòng Kế toán - Tài chính' },
  { id: 'kb-hr',   name: 'Tri thức Nhân sự & Lao động',  ownerOrg: 'Phòng Nhân sự' },
  { id: 'kb-it',   name: 'Tri thức Công nghệ & AI',      ownerOrg: 'Phòng CNTT' },
  { id: 'kb-sale', name: 'Tri thức Kinh doanh & Bán hàng', ownerOrg: 'Phòng Kinh doanh' },
  { id: 'kb-leg',  name: 'Tri thức Pháp chế',             ownerOrg: 'Phòng Pháp chế' },
];

// ─── Conversations ────────────────────────────────────────────────────────────

export interface ConversationItem {
  id: string;
  title: string;
  chatbotId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ConvOut {
  id: string;
  title?: string | null;
  chatbot_id?: string | null;
  created_at?: string;
  updated_at?: string;
  deleted?: boolean;
}

interface MsgOut {
  message?: {
    id: string;
    type: 'human' | 'ai' | string;
    contents?: string;
    created_at?: string;
  };
}

function toConv(c: ConvOut): ConversationItem {
  return {
    id:         c.id,
    title:      c.title ?? '',
    chatbotId:  c.chatbot_id ?? null,
    createdAt:  c.created_at ?? '',
    updatedAt:  c.updated_at ?? c.created_at ?? '',
  };
}

export const conversationsApi = {
  /** Liệt kê conversations của user hiện tại. Filter theo chatbotId ở client. */
  async list(opts: { chatbotId?: string; pageSize?: number } = {}): Promise<ConversationItem[]> {
    const q = new URLSearchParams();
    q.set('page', '1');
    q.set('page_size', String(opts.pageSize ?? 50));
    const body = await req<{ info?: { data?: { conversations?: ConvOut[] } } }>(
      `/v1/conversations?${q}`,
    );
    const items = (body.info?.data?.conversations ?? []).map(toConv);
    return opts.chatbotId
      ? items.filter(c => c.chatbotId === opts.chatbotId)
      : items;
  },

  /** Load toàn bộ messages của 1 conversation (sắp xếp theo thời gian tăng dần). */
  /**
   * Load toàn bộ messages của 1 conversation.
   * Backend cap page_size ≤ 100 nên tự paginate khi conv dài.
   */
  async getMessages(conversationId: string): Promise<ChatMessage[]> {
    const PAGE_SIZE = 100;
    const acc: ChatMessage[] = [];
    let page = 1;
    while (true) {
      const q = new URLSearchParams();
      q.set('page', String(page));
      q.set('page_size', String(PAGE_SIZE));
      const body = await req<{ info?: { data?: { messages?: MsgOut[] } } }>(
        `/v1/conversations/${conversationId}/messages?${q}`,
      );
      const items = body.info?.data?.messages ?? [];
      const mapped = items
        .map(it => {
          const m = it.message;
          if (!m) return null;
          return {
            id:        m.id,
            role:      (m.type === 'human' ? 'user' : 'assistant') as ChatRole,
            content:   m.contents ?? '',
            createdAt: m.created_at ?? new Date().toISOString(),
          } satisfies ChatMessage;
        })
        .filter((m): m is ChatMessage => m !== null);
      acc.push(...mapped);
      if (items.length < PAGE_SIZE) break;
      page += 1;
      if (page > 20) break; // hard cap 2000 messages — đủ cho mọi case thực tế
    }
    return acc;
  },

  async remove(conversationId: string): Promise<void> {
    await req<void>(`/v1/conversations/${conversationId}`, { method: 'DELETE' });
  },
};

// ─── Knowledge bases (legacy mock) ────────────────────────────────────────────

export const knowledgeBasesApi = {
  async list(): Promise<KnowledgeBase[]> {
    // TODO: thay bằng GET /api/knowledge/collections khi knowledge-service ready
    await new Promise(r => setTimeout(r, 60));
    return [...KB_MOCK];
  },
};

// ─── Chat streaming (SSE) ────────────────────────────────────────────────────

export interface ChatStreamEvent {
  name?: string;
  type: string;            // 'message_chunk' | 'message_complete' | 'audio_chunk' | 'conversation_started' | ...
  id?: string;
  content?: string;
  language?: string;
  finishReason?: string;
  artifact?: unknown;
  conversation_id?: string;
  // audio_chunk fields
  seq?: number;
  audio?: string;          // base64 WAV
  audio_format?: string;
}

export interface ChatStreamArgs {
  botId: string;                                       // ChatbotItem.id
  message: string;
  conversationId?: string | null;
  inlineAudio?: boolean;                               // true = bật audio_chunk streaming
  voiceId?: string;                                    // voice_id gửi lên backend cho inline TTS
  onChunk: (text: string) => void;
  onAudioChunk?: (seq: number, audioBase64: string) => void;
  onMeta?: (meta: { conversationId?: string }) => void;
  /** Text generation hoàn tất (message_complete). Audio_chunks có thể vẫn đang đến. */
  onTextDone?: () => void;
  /** SSE stream thực sự đóng — sau khi tất cả audio_chunk đã được gửi. */
  onDone?: () => void;
  onError?: (err: Error) => void;
  signal?: AbortSignal;
}

/** Trả về function huỷ stream. */
export const chatApi = {
  stream(args: ChatStreamArgs): () => void {
    const controller = new AbortController();
    const signal = args.signal ?? controller.signal;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`${BASE}/v1/agents/chat/stream`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
            ...authHeader(),
          },
          body: JSON.stringify({
            message:         args.message,
            conversation_id: args.conversationId ?? null,
            chatbot_id:      args.botId,
            ...(args.inlineAudio              ? { inline_audio: true }          : {}),
            ...(args.inlineAudio && args.voiceId ? { voice_id: args.voiceId }  : {}),
          }),
          signal,
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(formatApiError(body, res.status));
        }
        if (!res.body) throw new Error('Server không trả về stream body');

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        let metaSent = false;

        /**
         * Tách 1 frame SSE ra khỏi buffer. Theo spec, frame được phân cách bằng
         * blank line — có thể là "\n\n", "\r\n\r\n" hoặc "\r\r". sse_starlette
         * dùng "\r\n\r\n", còn nhiều server khác dùng "\n\n". Hỗ trợ cả hai.
         */
        function takeFrame(): string | null {
          let earliest = -1;
          let sepLen = 0;
          for (const sep of ['\r\n\r\n', '\n\n', '\r\r']) {
            const idx = buf.indexOf(sep);
            if (idx >= 0 && (earliest < 0 || idx < earliest)) {
              earliest = idx;
              sepLen = sep.length;
            }
          }
          if (earliest < 0) return null;
          const frame = buf.slice(0, earliest);
          buf = buf.slice(earliest + sepLen);
          return frame;
        }

        while (!cancelled) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });

          let frame: string | null;
          while ((frame = takeFrame()) !== null) {
            // Một frame có thể chứa nhiều dòng (event:/data:/id:/retry:/comment),
            // theo spec dòng kết thúc bằng \r\n hoặc \n hoặc \r.
            for (const rawLine of frame.split(/\r\n|\n|\r/)) {
              if (!rawLine.startsWith('data:')) continue;
              // SSE: "data:" + optional space + payload
              const payload = rawLine.slice(5).replace(/^ /, '').trim();
              if (!payload || payload === '[DONE]') continue;
              try {
                const ev = JSON.parse(payload) as ChatStreamEvent;
                if (!metaSent && ev.conversation_id) {
                  args.onMeta?.({ conversationId: ev.conversation_id });
                  metaSent = true;
                }
                if (ev.type === 'message_chunk' && ev.content) {
                  args.onChunk(ev.content);
                }
                if (ev.type === 'audio_chunk' && typeof ev.audio === 'string') {
                  args.onAudioChunk?.(ev.seq ?? 0, ev.audio);
                }
                if (ev.type === 'message_complete' || ev.finishReason) {
                  args.onTextDone?.();
                }
              } catch {
                // bỏ qua keepalive / dữ liệu không-JSON
              }
            }
          }
        }
        args.onDone?.();
      } catch (e: unknown) {
        if ((e as Error).name === 'AbortError') return;
        args.onError?.(e as Error);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  },

  /**
   * Text-to-Speech: gọi POST /v1/tts/synthesize, backend trả audio/wav 24kHz/16-bit/mono
   * (đã wrap RIFF/WAVE header sẵn, dùng trực tiếp với `new Audio(blob)` được).
   *
   * `publicId` (bot.publicId) — backend gate TTS theo `bot.form ∈ {voice, both}`.
   * Nếu bot ở mode chat → trả 403, hàm này throw.
   */
  async getVoices(): Promise<TtsVoice[]> {
    try {
      const res = await fetch(`${BASE}/v1/tts/voices`, { headers: authHeader() });
      if (!res.ok) return [];
      const json = await res.json().catch(() => []);
      return Array.isArray(json) ? json : (json.voices ?? json.data ?? []);
    } catch {
      return [];
    }
  },

  async synthesize(text: string, publicId?: string, voiceId?: string): Promise<Blob> {
    const res = await fetch(`${BASE}/v1/tts/synthesize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
      },
      body: JSON.stringify({
        text,
        public_id: publicId ?? null,
        voice_id: voiceId ?? null,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(formatApiError(body, res.status));
    }
    return await res.blob();
  },

  /** Một-lần gửi non-stream — wrapper trên stream, gom tất cả chunk thành 1 message. */
  async send(botId: string, message: string, conversationId?: string | null): Promise<{
    content: string;
    conversationId?: string;
  }> {
    return new Promise((resolve, reject) => {
      let acc = '';
      let convId: string | undefined;
      chatApi.stream({
        botId, message, conversationId,
        onChunk: (t) => { acc += t; },
        onMeta:  (m) => { convId = m.conversationId; },
        onDone:  ()  => resolve({ content: acc, conversationId: convId }),
        onError: (e) => reject(e),
      });
    });
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function buildEmbedSnippet(bot: ChatbotItem, kind: EmbedKind): string {
  const publicId = bot.publicId || bot.id;
  if (kind === 'WIDGET') {
    const greeting = bot.widget?.welcomeMessage ?? DEFAULT_WIDGET.welcomeMessage;
    return `<!-- FOXAI Chatbot Widget: ${MODE_LABELS[bot.mode]} -->
<script
  src="${BASE}/dist/sdk.js"
  data-chatbot-id="${publicId}"
  data-api-url="${BASE}"
  data-bot-name="${bot.name}"
  data-position="bottom-right"
  data-greeting="${greeting}"
  async>
</script>`;
  }
  if (kind === 'IFRAME') {
    return `<iframe
  src="${BASE}/widget/embed?bot=${publicId}"
  width="380"
  height="560"
  style="border:0;border-radius:12px;box-shadow:0 8px 24px rgba(15,23,42,.12);"
  allow="clipboard-write *"
></iframe>`;
  }
  return `# Gửi câu hỏi tới chatbot (REST API)
curl -X POST ${BASE}/v1/agents/public/chat/public \\
  -H "Content-Type: application/json" \\
  -d '{
    "message": "Xin chào, bạn có thể giúp gì?",
    "public_id": "${publicId}",
    "client_id": "u-12345"
  }'`;
}
