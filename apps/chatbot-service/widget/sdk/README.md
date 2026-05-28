# FoxAI Widget SDK

Embeddable chat widget SDK for FoxAI chatbot.

## 📁 Project Structure

```
sdk/
├── src/
│   ├── index.ts              # Entry point
│   ├── types/
│   │   └── index.ts          # TypeScript interfaces
│   ├── core/
│   │   ├── constants.ts      # Constants & config keys
│   │   ├── config.ts         # Default configuration
│   │   └── state.ts          # Global state management
│   ├── api/
│   │   ├── client.ts         # HTTP API client
│   │   └── streaming.ts      # SSE streaming handler
│   ├── ui/
│   │   ├── components.ts     # UI components
│   │   ├── chat.ts           # Chat logic
│   │   └── audio.ts          # Audio recording
│   ├── utils/
│   │   ├── fingerprint.ts    # Browser fingerprint
│   │   ├── storage.ts        # LocalStorage wrapper
│   │   ├── markdown.ts       # Markdown parser
│   │   └── helpers.ts        # Utility functions
│   └── styles/
│       └── widget.css        # Widget styles
├── dist/                     # Build output
├── package.json
├── tsconfig.json
└── rollup.config.js
```

## 🚀 Installation & Build

```bash
# Install dependencies
npm install

# Development build (with watch)
npm run dev

# Development build (with .env.development)
npm run build:dev

# Production build (with .env.production)
npm run build:prod

# Standard build (with .env)
npm run build

# Type checking
npm run typecheck
```

## 🔧 Environment Configuration

The SDK supports multiple environment configurations using `.env` files:

- `.env` - Default configuration
- `.env.development` - Development overrides
- `.env.production` - Production overrides

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Base API URL | https://devaibigdata.foxai.com.vn:5720/query |
| `VITE_API_VERSION` | API version | v1 |
| `VITE_DEFAULT_PROVIDER_LLM` | Default LLM provider | openai |
| `VITE_DEFAULT_PROVIDER_STORAGE` | Default storage provider | qdrant |
| `VITE_DEFAULT_PROVIDER_EMBEDDING` | Default embedding provider | openai |
| `VITE_DEFAULT_COLLECTION_NAME` | Default collection name | FOXAI |
| `VITE_DEFAULT_BOT_NAME` | Bot display name | Trợ lý Cấp nước Phú Thọ |
| `VITE_DEFAULT_BOT_AVATAR` | Bot avatar URL | (default avatar URL) |
| `VITE_DEFAULT_GREETING` | Default greeting message | Xin chào! Tôi có thể giúp gì cho bạn? |
| `VITE_DEFAULT_PRIMARY_COLOR` | UI primary color | #0066cc |
| `VITE_DEBUG_MODE` | Enable debug logging | false |
| `VITE_LOG_LEVEL` | Logging level | info |

### Example .env.production

```env
VITE_API_BASE_URL=https://api.laovietbank.com/query
VITE_DEFAULT_COLLECTION_NAME=LAOVIETBANK_PROD
VITE_DEFAULT_BOT_NAME=Trợ lý Ngân hàng Lào Việt
VITE_DEFAULT_PRIMARY_COLOR=#d4a574
VITE_DEBUG_MODE=false
VITE_LOG_LEVEL=error
```

## 📦 Output

After build, you'll get:

- `dist/sdk.js` - UMD bundle (for browsers, `<script>` tag)
- `dist/sdk.esm.js` - ES Module (for modern bundlers)
- `dist/sdk.js.map` - Source map for debugging
- `dist/types/` - TypeScript declarations

## 🔧 Usage

### Method 1: Script Tag (Recommended)

```html
<script src="https://your-cdn.com/sdk.js"></script>
<script>
    FoxAI.init({
        apiUrl: 'https://api.foxai.com.vn',
        uiConfig: {
            botName: 'Trợ lý AI',
            primaryColor: '#0066cc'
        }
    });
</script>
```

### Method 2: With Data Attributes

```html
<script 
    src="https://your-cdn.com/sdk.js"
    data-api-url="https://api.foxai.com.vn"
    data-bot-name="Trợ lý AI"
    data-color="#0066cc"
></script>
```

### Method 3: Async Init

```html
<script>
    window.foxaiAsyncInit = function() {
        FoxAI.init({
            apiUrl: 'https://api.foxai.com.vn'
        });
    };
</script>
<script src="https://your-cdn.com/sdk.js" async></script>
```

### Method 4: ES Module

```javascript
import FoxAI from '@foxai/widget-sdk';

FoxAI.init({
    apiUrl: 'https://api.foxai.com.vn'
});
```

## ⚙️ Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiUrl` | string | `https://devaibigdata.foxai.com.vn:5720/query` | API base URL |
| `providerLlm` | string | Build-time env | LLM provider, can be overridden explicitly via `FoxAI.init(...)` |
| `providerStorage` | string | Build-time env | Storage provider, can be overridden explicitly via `FoxAI.init(...)` |
| `providerEmbedding` | string | Build-time env | Embedding provider, can be overridden explicitly via `FoxAI.init(...)` |
| `collectionName` | string | `FOXAI` | Vector collection name |

### UI Config Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `position` | `'left' \| 'right'` | `right` | Widget position |
| `hideGreeting` | boolean | `false` | Hide greeting message |
| `theme` | `'light' \| 'dark'` | `light` | Color theme |
| `primaryColor` | string | `#0066cc` | Primary color (hex) |
| `botName` | string | `Trợ lý Cấp nước Phú Thọ` | Bot display name |
| `botAvatar` | string | URL | Bot avatar image URL |
| `greetingMessage` | string | `Xin chào!...` | Welcome message |

## 📝 API Reference

### `FoxAI.init(config?)`

Initialize the widget with optional configuration.

```javascript
await FoxAI.init({
    apiUrl: 'https://api.example.com',
    uiConfig: {
        botName: 'My Bot'
    }
});
```

### `FoxAI.open()`

Open the chat window programmatically.

```javascript
FoxAI.open();
```

### `FoxAI.close()`

Close the chat window programmatically.

```javascript
FoxAI.close();
```

### `FoxAI.destroy()`

Remove the widget from the page completely.

```javascript
FoxAI.destroy();
```

## 🔄 Development

```bash
# Watch mode for development
npm run dev

# Build for production
npm run build:prod

# Clean dist folder
npm run clean
```

## 📄 License

MIT © FoxAI
