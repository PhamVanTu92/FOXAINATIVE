# Handoff (system-service): Gỡ 2 module chatbot mock khỏi seed

**Người nhận:** dev **system-service** (ngoài phạm vi chatbot-service/index-service).
**Đã vá tạm bằng dọn DB** (xem mục 3); cần sửa seed để khỏi tái sinh khi restart.
**Ngày:** 2026-06-08

---

## 1. Triệu chứng
Ma trận phân quyền mục **"CHATBOT AI THÔNG MINH"** hiện **7 bot**, nhưng thực tế chỉ có **5 bot thật**.
Hai dòng đầu — **"Bot Kế toán Nội bộ"** (`CHATBOT_ACCOUNTING`) và **"Bot CSKH - Kinh doanh"**
(`CHATBOT_CSKH`) — là **dữ liệu seed demo**, không ứng với chatbot thật nào.

5 bot thật (tạo runtime qua chatbot-service, code `CHATBOT_<uuid hex>`):
Chatbot Nội bộ, Bot tra cứu nội quy công ty, Bot ngân hàng, Chatbot R&D, Chat bot a Toan.

## 2. Nguyên nhân
`CHATBOT_ACCOUNTING` và `CHATBOT_CSKH` được **seed cứng** trong code. `DataSeeder` chạy mỗi lần
system-service khởi động → tạo lại module + grant cho role ⇒ **xóa DB xong, restart là chúng quay lại**.

## 3. Vá tạm ĐÃ áp (chỉ DB, không sửa code)
```sql
-- FK role_permissions / module_actions / user_permission_overrides đều ON DELETE CASCADE
DELETE FROM modules WHERE code IN ('CHATBOT_ACCOUNTING','CHATBOT_CSKH');
-- DELETE 2 → matrix còn đúng 5 bot thật.
```
> ⚠️ Mất tác dụng sau lần restart system-service kế tiếp. Cần sửa seed dưới đây.

## 4. FIX TRIỆT ĐỂ — gỡ khỏi seed (3 file)

### 4.1. `ModuleSeedData.cs` (dòng ~49–53) — bỏ 2 module, để nhóm rỗng
```diff
         new("CHATBOT_AI", "Chatbot AI thông minh", "Các bot hội thoại nội bộ.", 50, new ModuleSeed[]
-        {
-            new("CHATBOT_ACCOUNTING", "Bot Kế toán Nội bộ",    "Bot phục vụ phòng kế toán.",         10, ReadCrud),
-            new("CHATBOT_CSKH",       "Bot CSKH - Kinh doanh", "Bot phục vụ kinh doanh & CSKH.",     20, ReadCrud),
-        }),
+        {
+            // Các bot hội thoại được tạo động qua chatbot-service (module CHATBOT_<uuid>),
+            // không seed cứng ở đây nữa.
+        }),
```

### 4.2. `RoleSeedData.cs` — bỏ grant ở role ADMIN (dòng 44–45) và USER (dòng 56–57)
```diff
                 ["DOC_MGMT"]             = new[] { "READ", "UPDATE", "EXPORT" },
-                ["CHATBOT_ACCOUNTING"]   = new[] { "READ" },
-                ["CHATBOT_CSKH"]         = new[] { "READ" },
             }),
```
```diff
                 ["DOC_MGMT"]           = new[] { "READ" },
-                ["CHATBOT_ACCOUNTING"] = new[] { "READ" },
-                ["CHATBOT_CSKH"]       = new[] { "READ" },
             }),
```

### 4.3. `DemoRoleSeedData.cs` — xoá mọi dòng `CHATBOT_ACCOUNTING` / `CHATBOT_CSKH`
Các dòng ~38, 47, 61–62, 79–80 (grep `CHATBOT_ACCOUNTING|CHATBOT_CSKH` để chắc chắn):
```bash
grep -nE "CHATBOT_ACCOUNTING|CHATBOT_CSKH" \
  src/SystemService.Infrastructure/Persistence/Seeding/DemoRoleSeedData.cs
```
Xoá hết các entry đó (chúng chỉ cấp READ cho 2 module mock).

### 4.4. Sau khi deploy
- `DataSeeder` chỉ *thêm*, không *xoá* → với DB đang chạy đã dọn ở mục 3 là đủ; môi trường khác
  chạy lại câu SQL mục 3 một lần.
- Verify: nhóm CHATBOT_AI chỉ còn module `CHATBOT_<uuid>` của bot thật:
  ```sql
  SELECT m.code, m.name FROM modules m JOIN module_groups g ON g.id=m.group_id
  WHERE g.code='CHATBOT_AI' ORDER BY m.sort_order;
  ```

## 5. (Tùy chọn, frontend) dọn route cũ
`web-portal/src/lib/route-permissions.ts` còn 2 rule cứng `'/chatbot/ke-toan' → CHATBOT_ACCOUNTING`
và `'/chatbot/cskh' → CHATBOT_CSKH`. Vô hại (route đó không dùng) nhưng có thể xoá cho gọn.
