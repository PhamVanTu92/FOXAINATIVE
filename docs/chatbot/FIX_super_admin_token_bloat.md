# Handoff: Sửa JWT super_admin phình vượt cookie → hỏng đăng nhập

**Người nhận:** dev **system-service** (đây là thay đổi *bên ngoài* phạm vi chatbot-service/index-service nên team chatbot không tự áp).
**Mức độ:** chặn đăng nhập (production blocker), nhưng đã có vá tạm bằng dọn data.
**Ngày:** 2026-06-08

---

## 1. Triệu chứng
Bấm **Đăng nhập** → `POST /api/auth/login` trả **200**, nhưng màn hình kẹt ở trang đăng nhập,
Network thấy redirect vòng về `/dang-nhap?redirect=%2F`.

## 2. Nguyên nhân gốc
- web-portal lưu access token vào **cookie** `access_token` bằng JS
  (`apps/web-portal/src/stores/auth.ts` → `document.cookie = "access_token=<JWT>..."`),
  rồi `middleware.ts` chặn route dựa trên cookie này.
- Trình duyệt giới hạn **~4096 bytes cho mỗi cookie**. Khi JWT vượt mức này, cookie bị
  **âm thầm loại bỏ** (không lỗi). → `middleware` không thấy `access_token` → đá về `/dang-nhap`.
- JWT của **SUPER_ADMIN** đo được **4575 bytes** (chứa **110 permission**).
- Phần phình chính: **super_admin được cấp đủ 5 action (CREATE/READ/UPDATE/DELETE/EXPORT)
  trên MỖI per-bot module `CHATBOT_<32-hex>`** (mỗi chatbot tạo runtime sinh 1 module).
  5 bot × 5 action = 25 permission ≈ 1.4 KB. Số này **tăng không giới hạn theo số chatbot**.
- Các permission này **vô dụng**: super_admin **bypass** mọi check
  (gateway: route `/api/chatbot/*` chỉ qua `JwtAuthGuard`, không guard permission;
   chatbot-service: `is_admin() → True`). Chúng chỉ tổ làm vỡ cookie.

## 3. Vì sao tái phát
`SeedRolesAsync` trong `DataSeeder.cs` chạy **mỗi lần system-service khởi động**.
Với role `GrantAll` (chỉ `SUPER_ADMIN`), nó cấp **mọi (module × action) hiện có trong DB**,
gồm cả per-bot module tạo lúc runtime. ⇒ Dọn data xong, **restart là phình lại**.

```
RoleSeedData.Grants:  [SUPER_ADMIN] = RoleGrantSpec(GrantAll: true, ...)   // chỉ role này
DataSeeder.SeedRolesAsync():  if (spec.GrantAll) { foreach module × foreach action → grant }
```

---

## 4. Vá tạm ĐÃ áp (chỉ là data, không sửa code service nào)
Đã xoá 25 grant rác của super_admin trên per-bot module trên DB **prod** `native_system_db`:

```sql
DELETE FROM role_permissions rp
USING modules m, roles r
WHERE rp.module_id = m.id
  AND rp.role_id   = r.id
  AND r.code = 'SUPER_ADMIN'
  AND m.code ~ '^CHATBOT_[0-9A-F]{32}$';
-- DELETE 25  → token 4575 → 2921 bytes, login chạy lại.
```
> ⚠️ Vá này **mất tác dụng sau lần restart system-service kế tiếp** (mục 3). Cần fix code dưới đây.

---

## 5. FIX TRIỆT ĐỂ (áp vào system-service)

**File:** `apps/system-service/src/SystemService.Infrastructure/Persistence/Seeding/DataSeeder.cs`
**Ý tưởng:** trong nhánh `GrantAll`, **bỏ qua per-bot module `CHATBOT_<32-hex>`**.
Super_admin vẫn được cấp đủ mọi module thật khác (gồm `CHATBOT_CONFIG`), chỉ không cấp
per-bot module (vốn nó bypass nên không cần). Token không bao giờ phình theo số chatbot nữa.

### 5.1. Sửa nhánh GrantAll (khoảng dòng 167–174)

```diff
             var targetPairs = new HashSet<(Guid ModuleId, Guid ActionId)>();
             if (spec.GrantAll)
             {
-                foreach (var module in allModules.Values)
-                foreach (var action in allActions.Values)
-                {
-                    targetPairs.Add((module.Id, action.Id));
-                }
+                foreach (var module in allModules.Values)
+                {
+                    // Bỏ qua per-bot chatbot module (CHATBOT_<32 hex>): mỗi chatbot
+                    // sinh 1 module lúc runtime nên tăng không giới hạn. SUPER_ADMIN
+                    // vốn bypass mọi check (gateway /api/chatbot/* chỉ JwtAuthGuard,
+                    // chatbot-service is_admin→True) nên cấp ở đây chỉ làm JWT phình
+                    // vượt giới hạn ~4KB của cookie trình duyệt → hỏng đăng nhập.
+                    // CHATBOT_CONFIG và mọi module thật khác vẫn được cấp đủ.
+                    if (IsPerBotChatbotModule(module.Code)) continue;
+                    foreach (var action in allActions.Values)
+                    {
+                        targetPairs.Add((module.Id, action.Id));
+                    }
+                }
             }
```

### 5.2. Thêm helper (đặt trong class `DataSeeder`, ví dụ ngay trên `SeedRolesAsync`)

```csharp
// Per-bot chatbot module được chatbot-service mirror với code CHATBOT_<uuid hex 32 ký tự>
// (xem apps/chatbot-service/joint/utils/system_modules.py). CHATBOT_CONFIG và các module
// có tên khác KHÔNG khớp pattern này nên vẫn được GrantAll bình thường.
private static readonly System.Text.RegularExpressions.Regex PerBotChatbotModuleRegex =
    new("^CHATBOT_[0-9A-F]{32}$",
        System.Text.RegularExpressions.RegexOptions.IgnoreCase
        | System.Text.RegularExpressions.RegexOptions.Compiled);

private static bool IsPerBotChatbotModule(string code) =>
    PerBotChatbotModuleRegex.IsMatch(code);
```

> Không cần thêm `using` nếu để full-qualify như trên. Nếu muốn gọn, thêm
> `using System.Text.RegularExpressions;` ở đầu file rồi rút gọn còn `Regex` / `RegexOptions`.

### 5.3. Sau khi deploy
- Code mới **ngăn** seeder cấp lại per-bot grant cho super_admin. Seeder chỉ *thêm*, không *xoá*,
  nên với DB đang chạy hãy chạy 1 lần câu SQL ở **mục 4** để dọn grant cũ (prod đã dọn rồi).
- Kiểm tra: đăng nhập `admin` → đo token < 4096:
  ```bash
  curl -s -X POST http://localhost:3001/api/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"username":"admin","password":"<mật khẩu>"}' \
  | python3 -c "import sys,json;t=json.load(sys.stdin)['accessToken'];print('token bytes:',len(t))"
  ```

---

## 6. Phương án dự phòng (nếu chưa kịp sửa code)
Để middleware không phụ thuộc cookie giới hạn 4KB, web-portal có thể đổi sang đọc token từ
header/`httpOnly` session thay vì cookie thường — nhưng đó là thay đổi lớn hơn ở web-portal.
Khuyến nghị dùng fix mục 5 (nhỏ, đúng gốc).

## 7. Ảnh hưởng phụ cần biết
- Sau fix, trong **ma trận phân quyền**, super_admin sẽ hiển thị **không tick** ở các per-bot
  chatbot module. Đây là **đúng** về mặt chức năng (super_admin bypass, không cần quyền), chỉ là
  nhìn hơi lạ. Quyền per-bot cho các role thường (vd NHAN_VIEN.READ = quyền chat) **không bị ảnh hưởng**
  (chúng do luồng AssignPermissions tạo, không phải GrantAll).
