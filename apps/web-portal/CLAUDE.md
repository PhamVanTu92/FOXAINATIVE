# FOXAI Web Portal — UI Building Standards

Tài liệu này là **nguồn quy chuẩn duy nhất** cho toàn bộ UI của web-portal.
Claude Code đọc file này trước khi viết bất kỳ component nào.

---

## 1. Kiến trúc Layer (bắt buộc tuân theo)

### 1.1 Sơ đồ tổng thể

```
src/
├── app/
│   └── (main)/
│       └── <feature>/
│           └── page.tsx              ← Route Layer  (2 dòng, không có logic)
├── modules/
│   └── <feature>/
│       ├── index.ts                  ← Public exports của module
│       ├── views/
│       │   └── <Feature>View.tsx     ← View Layer   (UI + JSX, dùng hook)
│       └── hooks/
│           └── use<Feature>.ts       ← Hook Layer   (state, API, logic)
└── lib/
    └── <feature>-api.ts              ← API Layer    (typed fetch wrappers)
```

### 1.2 Quy tắc từng layer

#### Route Layer — `app/(main)/<feature>/page.tsx`
- **Luôn là 2 dòng**, không có state, không có logic, không có JSX phức tạp.
- Chỉ import View từ module và render.

```tsx
import { FeatureView } from '@/modules/<feature>';
export default function Page() { return <FeatureView />; }
```

#### View Layer — `modules/<feature>/views/<Feature>View.tsx`
- Chỉ chứa JSX và UI logic thuần (className, layout, event handlers).
- **Không gọi API trực tiếp**, không dùng `useState`/`useEffect` cho data fetching.
- Nhận toàn bộ state và actions từ hook qua destructuring.

```tsx
'use client';
export function FeatureView() {
  const { data, loading, error, doSomething } = useFeature();
  return ( /* JSX */ );
}
```

#### Hook Layer — `modules/<feature>/hooks/use<Feature>.ts`
- Chứa toàn bộ state (`useState`), side effects (`useEffect`), API calls.
- Export một object phẳng với tất cả state và actions cần thiết cho View.
- Không import bất kỳ component JSX nào.

```ts
'use client';
export function useFeature() {
  const [data, setData] = useState([]);
  // ... logic
  return { data, loading, error, doSomething };
}
```

#### API Layer — `lib/<feature>-api.ts`
- Typed fetch wrappers, không có state.
- Mỗi function trả về Promise với kiểu rõ ràng.
- Export các interface/type dùng chung cho View và Hook.

#### Module index — `modules/<feature>/index.ts`
- Re-export tất cả View cần dùng từ route layer.
- Không export hook hoặc internal helpers.

```ts
export { FeatureView } from './views/FeatureView';
export { AnotherView } from './views/AnotherView';
```

### 1.3 Ví dụ thực tế (module system)

```
modules/system/
├── index.ts
├── views/
│   ├── UserListView.tsx          → dùng useUsers()
│   ├── RoleConfigView.tsx        → dùng useRoleConfig()
│   ├── ToChucView.tsx            → dùng useToChuc()
│   └── UserPermissionsModal.tsx  → dùng useUserPermissions(userId, roles)
└── hooks/
    ├── useUsers.ts
    ├── useRoleConfig.ts
    ├── useToChuc.ts
    └── useUserPermissions.ts
```

### 1.4 Checklist khi tạo module mới

- [ ] `app/(main)/<feature>/page.tsx` — chỉ 2 dòng, import + render
- [ ] `modules/<feature>/views/<Feature>View.tsx` — JSX only, dùng hook
- [ ] `modules/<feature>/hooks/use<Feature>.ts` — toàn bộ state/logic
- [ ] `lib/<feature>-api.ts` — typed fetch wrappers + interface exports
- [ ] `modules/<feature>/index.ts` — re-export View(s)
- [ ] Không có `useState`/`useEffect`/fetch trong Route hoặc View

---

## 2. Design Tokens — nguồn màu duy nhất

File: `src/styles/tokens.ts`

### 5 màu chủ đạo (Brand)

| Token Tailwind | Hex DEFAULT | Dùng khi nào |
|---|---|---|
| `primary` | `#2563EB` | CTA, link, trạng thái active, focus ring |
| `dark` | `#1E293B` | Sidebar, heading, text đậm, nền tối |
| `success` | `#059669` | Thành công, hoạt động, toggle ON |
| `warning` | `#D97706` | Cảnh báo, chờ xử lý, badge pending |
| `danger` | `#E11D48` | Lỗi, xóa, hành động phá hủy |

### 4 màu accent (Feature colors)

| Token Tailwind | Hex DEFAULT | Dùng khi nào |
|---|---|---|
| `violet` | `#7C3AED` | AI, chatbot, tri thức — feature công nghệ/sáng tạo |
| `teal` | `#0D9488` | OCR, xử lý tài liệu, data pipeline |
| `sky` | `#0284C7` | Info, badge thứ cấp, link phụ (nhẹ hơn primary) |
| `orange` | `#EA580C` | Thông báo, highlight nổi bật (rực hơn warning amber) |

**Quy tắc accent:** Dùng để phân biệt feature area, không dùng thay primary/danger cho CTA hay action buttons.

### Cách dùng trong Tailwind class

```tsx
// ✅ Dùng token semantic
<button className="bg-primary-600 hover:bg-primary-700 text-white" />
<span className="text-success-600 bg-success-50" />
<div className="border-danger-200 bg-danger-50 text-danger-600" />

// ❌ Tránh dùng màu Tailwind raw khi có token tương đương
<button className="bg-blue-600" />   // → thay bằng bg-primary-600
<span className="text-green-600" />  // → thay bằng text-success-600
<div className="text-red-500" />     // → thay bằng text-danger-600
```

### Scale cho mỗi màu (50 → 900)

```
-50   nền rất nhạt (hover background, tint)
-100  nền nhạt (badge background, row highlight)
-200  border nhạt
-300  border vừa
-400  icon tắt / placeholder
-500  màu vừa
-600  DEFAULT — dùng chủ đạo
-700  hover state
-800  active / pressed
-900  text đậm nhất
```

---

## 3. Typography

```tsx
// Heading trang
<h1 className="text-xl font-semibold text-dark-900" />

// Subheading / label section
<h2 className="text-base font-semibold text-dark-800" />

// Body text
<p className="text-sm text-dark-700" />

// Text phụ / mô tả
<p className="text-xs text-dark-500" />

// Placeholder / muted
<span className="text-xs text-dark-400" />

// Code / monospace (username, ID, code)
<code className="text-xs font-mono bg-dark-100 text-dark-600 px-2 py-0.5 rounded border border-dark-200" />
```

---

## 4. Spacing & Layout

```tsx
// Page container
<div className="flex flex-col h-full" />

// Content padding
<div className="px-6 py-5 space-y-5" />

// Card / section gap
<div className="space-y-4" />

// Form field gap
<div className="space-y-4" />

// Inline item gap
<div className="flex items-center gap-2" />
<div className="flex items-center gap-3" />  // toolbar
```

---

## 5. Border Radius

```tsx
rounded-sm    // 4px  — badge nhỏ, tag
rounded       // 6px  — input default
rounded-md    // 8px  — default cho button, input
rounded-lg    // 12px — card, dropdown, popover
rounded-xl    // 16px — modal, panel
rounded-full  // 9999px — toggle, avatar, pill badge
```

---

## 6. Shadows

```tsx
shadow-sm   // card, input focus
shadow      // dropdown, popover
shadow-lg   // modal, dialog
shadow-xl   // tooltip nổi, side panel
```

---

## 7. Component Patterns chuẩn

### Button

```tsx
// Primary
<button className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium
  bg-primary-600 text-white rounded-lg hover:bg-primary-700
  transition-colors disabled:opacity-60">
  <Icon size={14} /> Label
</button>

// Secondary / outline
<button className="flex items-center gap-1.5 px-4 py-2 text-sm
  border border-dark-200 text-dark-600 rounded-lg hover:bg-dark-50
  transition-colors">
  <Icon size={14} /> Label
</button>

// Danger
<button className="px-4 py-2 text-sm bg-danger-600 text-white
  rounded-lg hover:bg-danger-700 disabled:opacity-60">
  Xóa
</button>

// Ghost / icon-only
<button className="p-1.5 text-dark-400 hover:text-primary-600
  hover:bg-primary-50 rounded-lg transition-colors" title="...">
  <Icon size={14} />
</button>
```

### Input / Select

```tsx
// Input chuẩn
<input className="w-full border border-dark-200 rounded-lg px-3 py-2 text-sm
  text-dark-800 placeholder:text-dark-400
  focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
  bg-white" />

// Select chuẩn
<select className="px-3 py-2 text-sm border border-dark-200 rounded-lg
  focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white text-dark-700" />

// Label
<label className="block text-sm font-medium text-dark-700 mb-1">
  Label <span className="text-danger-600">*</span>
</label>
```

### Badge / Status tag

```tsx
// Vai trò (màu theo hash)
<span className="text-xs px-2 py-0.5 rounded-full font-medium
  bg-primary-100 text-primary-700">
  Quản trị hệ thống
</span>

// Status: active
<span className="text-xs px-2 py-0.5 rounded-full font-medium
  bg-success-100 text-success-700">
  Hoạt động
</span>

// Status: inactive
<span className="text-xs px-2 py-0.5 rounded-full font-medium
  bg-dark-100 text-dark-500">
  Vô hiệu
</span>

// Warning
<span className="text-xs px-2 py-0.5 rounded-full font-medium
  bg-warning-100 text-warning-700">
  Chờ xử lý
</span>
```

### Toggle (Status switch)

```tsx
// ON = primary-500, OFF = dark-200
<button className="flex items-center gap-2">
  <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors
    ${active ? 'bg-primary-500' : 'bg-dark-200'}`}>
    <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow
      transition-transform ${active ? 'translate-x-4' : 'translate-x-1'}`} />
  </div>
  <span className={`text-xs font-medium ${active ? 'text-primary-600' : 'text-dark-400'}`}>
    {active ? 'Hoạt động' : 'Vô hiệu'}
  </span>
</button>
```

### Stats Card (4-column grid)

```tsx
<div className="grid grid-cols-4 gap-4">
  <div className="bg-white rounded-xl border border-dark-200 px-5 py-4
    flex items-center justify-between">
    <div>
      <p className="text-xs text-dark-500">Label</p>
      <p className="text-2xl font-bold text-dark-900 mt-1">{value}</p>
    </div>
    <div className="p-2.5 rounded-xl bg-primary-50">
      <Icon className="w-5 h-5 text-primary-500" />
    </div>
  </div>
</div>
```

### Table

```tsx
<div className="bg-white rounded-xl border border-dark-200 shadow-sm overflow-hidden">
  <table className="w-full text-sm">
    <thead>
      <tr className="bg-dark-50 border-b border-dark-200">
        <th className="px-4 py-3 text-left text-xs font-semibold
          text-dark-500 uppercase tracking-wide">
          Cột
        </th>
      </tr>
    </thead>
    <tbody>
      <tr className="border-b last:border-0 hover:bg-dark-50 transition-colors">
        <td className="px-4 py-3 text-dark-700">...</td>
      </tr>
    </tbody>
  </table>
</div>
```

### Modal / Dialog

```tsx
// Backdrop + container
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
  <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4
    max-h-[90vh] overflow-y-auto">

    {/* Header */}
    <div className="flex items-center justify-between px-6 py-4 border-b
      border-dark-200 sticky top-0 bg-white z-10">
      <h2 className="font-semibold text-dark-800">Tiêu đề modal</h2>
      <button onClick={onClose} className="text-dark-400 hover:text-dark-600">
        <X size={18} />
      </button>
    </div>

    {/* Body */}
    <form className="p-6 space-y-4">...</form>

    {/* Footer */}
    <div className="flex justify-end gap-3 px-6 py-4 border-t border-dark-100">
      <button className="...cancel btn...">Hủy</button>
      <button className="...primary btn...">Lưu</button>
    </div>
  </div>
</div>
```

### Error / Alert banner

```tsx
// Error
<div className="flex items-center gap-2 bg-danger-50 border border-danger-200
  text-danger-700 rounded-lg px-4 py-3 text-sm">
  <AlertCircle size={15} className="shrink-0" />
  {message}
</div>

// Warning
<div className="flex items-center gap-2 bg-warning-50 border border-warning-200
  text-warning-700 rounded-lg px-4 py-3 text-sm">
  <AlertTriangle size={15} className="shrink-0" />
  {message}
</div>

// Success
<div className="flex items-center gap-2 bg-success-50 border border-success-200
  text-success-700 rounded-lg px-4 py-3 text-sm">
  <CheckCircle size={15} className="shrink-0" />
  {message}
</div>
```

### Breadcrumb

```tsx
<div className="flex items-center gap-2 px-6 py-4 border-b border-dark-200 bg-white">
  <span className="text-sm text-dark-400">Cấu hình hệ thống</span>
  <ChevronRight size={14} className="text-dark-300" />
  <span className="text-sm font-medium text-dark-700">Tên trang</span>
</div>
```

### Page header

```tsx
<div className="flex items-center gap-2 px-6 py-4 border-b bg-white">
  {/* breadcrumb */}
</div>
<div className="px-6 pt-5 pb-1 bg-white">
  <h1 className="text-xl font-semibold text-dark-800">Tiêu đề trang</h1>
</div>
```

### Toolbar / Filter bar

```tsx
<div className="flex items-center gap-3">
  {/* Search */}
  <div className="relative flex-1 max-w-xs">
    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" />
    <input className="w-full pl-9 pr-3 py-2 text-sm border border-dark-200 rounded-lg
      focus:outline-none focus:ring-2 focus:ring-primary-500" />
  </div>

  {/* Filters */}
  <select className="px-3 py-2 text-sm border border-dark-200 rounded-lg
    focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white text-dark-700" />

  <div className="flex-1" />  {/* spacer */}

  {/* Actions */}
  <button className="...secondary..."><Download size={14} /> Xuất Excel</button>
  <button className="...primary..."><Plus size={14} /> Thêm mới</button>
</div>
```

### Loading / Empty state

```tsx
// Loading row trong table
<tr><td colSpan={8} className="text-center py-12 text-dark-400 text-sm">
  Đang tải...
</td></tr>

// Empty state
<tr><td colSpan={8} className="text-center py-14">
  <Icon className="w-10 h-10 text-dark-200 mx-auto mb-2" />
  <p className="text-dark-400 text-sm">Chưa có dữ liệu nào.</p>
</td></tr>
```

### Pagination

```tsx
<div className="flex items-center justify-between px-4 py-3 border-t border-dark-100
  text-sm text-dark-500">
  <span>Hiển thị 1–20 / {total}</span>
  <div className="flex gap-1">
    <button className="px-2 py-1 border border-dark-200 rounded
      hover:bg-dark-50 disabled:opacity-40">‹</button>
    <button className="px-2.5 py-1 border rounded
      bg-primary-600 text-white border-primary-600">1</button>
    <button className="px-2.5 py-1 border border-dark-200 rounded
      hover:bg-dark-50">2</button>
    <button className="px-2 py-1 border border-dark-200 rounded
      hover:bg-dark-50 disabled:opacity-40">›</button>
  </div>
</div>
```

---

## 8. Avatar / Initials

```tsx
// Avatar tròn với initials (hash color từ tên)
const AVATAR_COLORS = [
  'bg-primary-500', 'bg-purple-500', 'bg-success-600', 'bg-warning-500',
  'bg-danger-500', 'bg-teal-500', 'bg-indigo-500', 'bg-pink-500',
];
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

<div className={`w-8 h-8 rounded-full ${avatarColor(name)}
  flex items-center justify-center text-white text-xs font-semibold shrink-0`}>
  {initials(name)}
</div>
```

---

## 9. Quy tắc Icons

- Thư viện duy nhất: **lucide-react**
- Size chuẩn: `size={14}` trong button/badge, `size={16}` toolbar, `size={18}` modal header, `size={20}` standalone
- Màu icon: `text-dark-400` mặc định, override khi hover với màu semantic

---

## 10. Z-Index layers

| Tầng | Class Tailwind | Dùng cho |
|---|---|---|
| Base | `z-0` | Nội dung trang |
| Sticky header | `z-10` | Thead sticky, header cố định |
| Dropdown | `z-20` | Select, popover |
| Overlay | `z-40` | Backdrop mờ |
| Modal | `z-50` | Dialog, drawer |
| Toast | `z-70` | Thông báo nổi |

---

## 11. Những điều KHÔNG làm

```
❌ Không dùng màu Tailwind raw (blue-600, green-500, red-400…) khi có token tương đương
❌ Không hardcode hex color trong className hoặc style={{}}
❌ Không đặt logic API call trong Route page.tsx
❌ Không tạo component mới cho pattern đã có trong tài liệu này
❌ Không dùng inline style={{ color: '...' }} cho màu semantic
❌ Không dùng class text-gray-* — thay bằng text-dark-*

✅ Token thay thế nhanh:
   blue-*   → primary-*    green-*  → success-*
   red-*    → danger-*     amber-*  → warning-*
   purple-* → violet-*     cyan-*   → teal-*
   gray-*   → dark-*       sky-*    → sky-* (token đã có)
   orange-* → orange-* (token đã có)
```

---

## 12. Checklist trước khi commit UI mới

- [ ] Route page.tsx chỉ import View, không có state/logic
- [ ] Màu dùng từ token (`primary`, `success`, `warning`, `danger`, `dark`, `neutral`)
- [ ] Border radius dùng `rounded-md` / `rounded-lg` / `rounded-xl` (không custom)
- [ ] Icon từ lucide-react, đúng size theo context
- [ ] Loading state, empty state, error state đều có xử lý
- [ ] Modal có backdrop `bg-black/40`, `z-50`, rounded-xl, shadow-2xl
