# Tài liệu tích hợp API — FoxAI Platform

**Base URL:** `http://localhost:3001` (môi trường dev)  
**Content-Type mặc định:** `application/json`  
**Encoding:** UTF-8

---

## Mục lục

1. [Xác thực & Token](#1-xác-thực--token)
2. [Quản lý Người dùng](#2-quản-lý-người-dùng)
3. [Quản lý Vai trò](#3-quản-lý-vai-trò)
4. [Bộ tri thức](#4-bộ-tri-thức)
5. [Tệp tri thức](#5-tệp-tri-thức)
6. [Tài liệu tri thức (Workflow kiểm duyệt)](#6-tài-liệu-tri-thức--workflow-kiểm-duyệt)
7. [Quy ước chung](#7-quy-ước-chung)
8. [Thống kê Dashboard](#8-thống-kê-dashboard)

> **Xem nhanh endpoint mới:**  
> `GET /api/knowledge-bases/stats` — [4.1 Thống kê bộ tri thức](#41-thống-kê-bộ-tri-thức) *(cập nhật — thêm `pdfFilesCount`, `filesByKnowledgeBase`)*  
> `GET /api/system/stats` — [8.1 Thống kê hệ thống](#81-thống-kê-hệ-thống) *(mới)*  
> `GET /api/knowledge-bases/files` — [4.7 Danh sách tệp toàn bộ bộ tri thức](#47-danh-sách-tệp-toàn-bộ-bộ-tri-thức)  
> `PATCH /api/knowledge-bases/files/:fileId` — [4.8 Đổi tên / Chuyển bộ tri thức cho tệp](#48-đổi-tên--chuyển-bộ-tri-thức-cho-tệp)

---

## 1. Xác thực & Token

Tất cả API (trừ nhóm `/api/auth/*`) đều yêu cầu header:

```
Authorization: Bearer <accessToken>
```

### 1.1 Đăng nhập

```
POST /api/auth/login
```

**Body:**
```json
{
  "username": "admin",
  "password": "Admin@123"
}
```

> `username` có thể là tên đăng nhập (lowercase) hoặc email — server tự phát hiện.

**Response 200:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4...",
  "expiresIn": 604800,
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "username": "admin",
    "email": "admin@foxai.vn",
    "fullName": "Quản trị viên",
    "roles": ["ADMIN"]
  }
}
```

**Lỗi:**
| Mã | Nguyên nhân |
|----|-------------|
| 401 | Sai username hoặc password |
| 400 | Thiếu trường bắt buộc |

---

### 1.2 Làm mới Access Token

```
POST /api/auth/refresh
```

**Body:**
```json
{
  "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4..."
}
```

**Response 200:** cấu trúc giống login (trả về cặp token mới).

---

### 1.3 Xác minh Token

```
POST /api/auth/validate
```

**Body:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response 200:**
```json
{
  "valid": true,
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "roles": ["ADMIN"]
}
```

---

### 1.4 Đăng xuất

```
POST /api/auth/logout
```

**Body:**
```json
{
  "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4..."
}
```

**Response:** `204 No Content`

---

## 2. Quản lý Người dùng

### 2.1 Danh sách người dùng

```
GET /api/users
```

**Query params:**

| Param | Kiểu | Mặc định | Mô tả |
|-------|------|----------|-------|
| `page` | number | 1 | Trang |
| `pageSize` | number | 20 | Số bản ghi/trang (max 100) |
| `search` | string | — | Tìm theo tên, email, username |
| `status` | string | — | `ACTIVE` \| `INACTIVE` \| `LOCKED` |
| `organizationId` | UUID | — | Lọc theo đơn vị |
| `sortBy` | string | — | Tên trường sắp xếp |
| `sortOrder` | string | — | `asc` \| `desc` |

**Ví dụ:**
```
GET /api/users?page=1&pageSize=20&status=ACTIVE&search=nguyen
```

**Response 200:**
```json
{
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "username": "nguyenvana",
      "email": "nguyenvana@foxai.vn",
      "fullName": "Nguyễn Văn A",
      "phone": "0901234567",
      "status": "ACTIVE",
      "roles": [
        { "code": "KB_MANAGER", "name": "Quản lý tri thức" }
      ],
      "createdAt": "2026-01-15T08:00:00Z"
    }
  ],
  "total": 42,
  "page": 1,
  "pageSize": 20
}
```

---

### 2.2 Tạo người dùng

```
POST /api/users
```

**Body:**
```json
{
  "username": "nguyenvanb",
  "email": "nguyenvanb@foxai.vn",
  "password": "Secure@123",
  "fullName": "Nguyễn Văn B",
  "phone": "0909876543",
  "organizationId": "550e8400-e29b-41d4-a716-000000000001",
  "roleCodes": ["KB_VIEWER"]
}
```

> - `username`: chữ thường, bắt đầu bằng chữ cái, chỉ dùng `a-z 0-9 . _ -`  
> - `password`: tối thiểu 8 ký tự  
> - `organizationId`, `roleCodes`: tùy chọn

**Response 201:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440002",
  "username": "nguyenvanb",
  "email": "nguyenvanb@foxai.vn",
  "fullName": "Nguyễn Văn B",
  "status": "ACTIVE",
  "roles": [{ "code": "KB_VIEWER", "name": "Xem tri thức" }],
  "createdAt": "2026-05-26T09:00:00Z"
}
```

---

### 2.3 Chi tiết người dùng

```
GET /api/users/:id
```

**Response 200:** object người dùng đầy đủ (giống 1 phần tử trong danh sách).

---

### 2.4 Cập nhật thông tin

```
PATCH /api/users/:id
```

**Body (tất cả optional):**
```json
{
  "fullName": "Nguyễn Văn B (updated)",
  "phone": "0912345678",
  "avatarUrl": "https://cdn.foxai.vn/avatars/abc.jpg",
  "organizationId": "550e8400-e29b-41d4-a716-000000000002"
}
```

**Response 200:** object người dùng đã cập nhật.

---

### 2.5 Xóa người dùng

```
DELETE /api/users/:id
```

**Response:** `204 No Content`

---

### 2.6 Đổi mật khẩu

```
POST /api/users/:id/change-password
```

**Body:**
```json
{
  "oldPassword": "OldPass@123",
  "newPassword": "NewPass@456"
}
```

**Response:** `204 No Content`

---

### 2.7 Thay đổi trạng thái tài khoản

```
POST /api/users/:id/change-status
```

**Body:**
```json
{
  "status": "LOCKED"
}
```

> Giá trị hợp lệ: `ACTIVE` | `INACTIVE` | `LOCKED`

**Response 200:** object người dùng với trạng thái mới.

---

### 2.8 Gán / Gỡ vai trò

```
POST /api/users/:id/roles        ← gán
DELETE /api/users/:id/roles/:roleCode  ← gỡ
```

**Body (chỉ cho gán):**
```json
{
  "roleCode": "KB_MANAGER"
}
```

**Response:** `204 No Content`

---

### 2.9 Lấy & Cập nhật quyền hạn trực tiếp

```
GET /api/users/:id/permissions
```

**Response 200:**
```json
{
  "effectiveGrants": [
    { "moduleId": "uuid-module-1", "actionId": "uuid-action-read" },
    { "moduleId": "uuid-module-2", "actionId": "uuid-action-write" }
  ]
}
```

```
PUT /api/users/:id/permissions
```

**Body:** Danh sách đầy đủ các cặp (module, action) user được phép sau khi sửa. Server tự tính diff so với quyền role.

```json
{
  "effectiveGrants": [
    { "moduleId": "uuid-module-1", "actionId": "uuid-action-read" },
    { "moduleId": "uuid-module-1", "actionId": "uuid-action-write" }
  ]
}
```

---

## 3. Quản lý Vai trò

### 3.1 Danh sách vai trò

```
GET /api/roles
```

**Query params:**

| Param | Kiểu | Mô tả |
|-------|------|-------|
| `page` | number | — |
| `pageSize` | number | — |
| `search` | string | Tìm theo tên/mô tả |
| `includeGrants` | boolean | Kèm danh sách quyền (`true`/`false`) |

**Response 200:**
```json
{
  "items": [
    {
      "id": "uuid-role-1",
      "code": "KB_MANAGER",
      "name": "Quản lý tri thức",
      "description": "Toàn quyền trên bộ tri thức",
      "grants": []
    }
  ],
  "total": 5,
  "page": 1,
  "pageSize": 20
}
```

---

### 3.2 Tạo vai trò

```
POST /api/roles
```

**Body:**
```json
{
  "name": "Biên tập viên",
  "description": "Soạn thảo và nộp tài liệu để duyệt"
}
```

> `code` tùy chọn — nếu không gửi, server tự sinh từ `name` (ví dụ: `BIEN_TAP_VIEN`).

**Response 201:**
```json
{
  "id": "uuid-role-2",
  "code": "BIEN_TAP_VIEN",
  "name": "Biên tập viên",
  "description": "Soạn thảo và nộp tài liệu để duyệt",
  "grants": []
}
```

---

### 3.3 Chi tiết / Cập nhật / Xóa vai trò

```
GET    /api/roles/:id
PATCH  /api/roles/:id   ← body: { "name": "...", "description": "..." }
DELETE /api/roles/:id   ← response: 204
```

---

### 3.4 Gán / Thu hồi quyền cho vai trò

```
POST   /api/roles/:id/permissions   ← gán
DELETE /api/roles/:id/permissions   ← thu hồi
```

**Body (giống nhau):**
```json
{
  "grants": [
    { "moduleId": "uuid-module-kb", "actionId": "uuid-action-read" },
    { "moduleId": "uuid-module-kb", "actionId": "uuid-action-upload" }
  ]
}
```

**Response 200:** object vai trò với danh sách grants đã cập nhật.

---

## 4. Bộ tri thức

### 4.1 Thống kê bộ tri thức

```
GET /api/knowledge-bases/stats
```

Trả về tổng quan số liệu của toàn bộ kho tri thức, bao gồm số lượng file PDF và phân bổ tệp theo từng bộ tri thức (dùng cho biểu đồ dashboard).

**Response 200:**
```json
{
  "totalKnowledgeBases": 11,
  "totalFiles": 25,
  "departmentsUsingCount": 9,
  "pdfFilesCount": 10,
  "filesByKnowledgeBase": [
    { "knowledgeBaseName": "Tri thức Kinh doanh & Bán hàng", "fileCount": 5 },
    { "knowledgeBaseName": "Tri thức Kế toán – Tài chính",   "fileCount": 5 },
    { "knowledgeBaseName": "Tri thức Công nghệ & AI",         "fileCount": 4 },
    { "knowledgeBaseName": "Tri thức Nhân sự & Lao động",     "fileCount": 4 },
    { "knowledgeBaseName": "Quy định & Pháp lý",              "fileCount": 3 },
    { "knowledgeBaseName": "Bộ tri thức Luật công đoàn",      "fileCount": 2 }
  ],
  "lastUpdatedAt": "2026-05-26T07:30:00Z"
}
```

| Field | Kiểu | Mô tả |
|-------|------|-------|
| `totalKnowledgeBases` | number | Tổng số bộ tri thức |
| `totalFiles` | number | Tổng số tệp trong toàn hệ thống |
| `departmentsUsingCount` | number | Số phòng ban đang dùng (managing hoặc có quyền truy cập) |
| `pdfFilesCount` | number | Số tệp định dạng PDF |
| `filesByKnowledgeBase` | array | Danh sách bộ tri thức có tệp, sắp xếp theo số lượng giảm dần |
| `lastUpdatedAt` | ISO 8601 \| null | Thời điểm cập nhật gần nhất |

---

### 4.2 Danh sách bộ tri thức

```
GET /api/knowledge-bases
```

**Query params:**

| Param | Kiểu | Mô tả |
|-------|------|-------|
| `search` | string | Tìm theo tên/mã |
| `departmentId` | UUID | Lọc theo phòng ban |
| `page` | number | Mặc định 1 |
| `pageSize` | number | Mặc định 20, max 100 |

**Response 200:**
```json
{
  "items": [
    {
      "id": "kb-uuid-001",
      "code": "KT-TAICHINH",
      "name": "Tri thức Kế toán – Tài chính",
      "description": "Quy trình, biểu mẫu kế toán nội bộ",
      "managingDepartmentId": "dept-uuid-ketoan",
      "managingDepartmentName": "Phòng Kế toán – Tài chính",
      "permissions": [
        { "departmentId": "dept-uuid-ketoan", "departmentName": "Phòng Kế toán – Tài chính" }
      ],
      "fileCounts": { "word": 4, "excel": 1, "pdf": 1, "image": 0 },
      "totalFiles": 6,
      "createdAt": "2026-01-10T00:00:00Z",
      "updatedAt": "2026-05-20T12:00:00Z"
    }
  ],
  "total": 12,
  "page": 1,
  "pageSize": 20
}
```

---

### 4.3 Tạo bộ tri thức

```
POST /api/knowledge-bases
```

**Body:**
```json
{
  "code": "KT-TAICHINH",
  "name": "Tri thức Kế toán – Tài chính",
  "description": "Quy trình, biểu mẫu kế toán nội bộ",
  "managingDepartmentId": "dept-uuid-ketoan",
  "managingDepartmentName": "Phòng Kế toán – Tài chính",
  "permittedDepartments": [
    { "departmentId": "dept-uuid-ketoan", "departmentName": "Phòng Kế toán – Tài chính" },
    { "departmentId": "dept-uuid-bgd", "departmentName": "Ban Giám đốc" }
  ]
}
```

> - `code`: chữ hoa, số, dấu gạch (`-` `_`), tối đa 20 ký tự  
> - `permittedDepartments`: danh sách phòng ban được truy cập (để trống = tất cả)

**Response 201:** object bộ tri thức vừa tạo.

---

### 4.4 Chi tiết bộ tri thức

```
GET /api/knowledge-bases/:id
```

**Response 200:** object bộ tri thức đầy đủ (giống 1 phần tử trong danh sách).

---

### 4.5 Cập nhật bộ tri thức

```
PUT /api/knowledge-bases/:id
```

**Body:** giống tạo mới nhưng không có `code`.

```json
{
  "name": "Tri thức Kế toán – Tài chính (cập nhật)",
  "description": "Mô tả mới",
  "managingDepartmentId": "dept-uuid-ketoan",
  "managingDepartmentName": "Phòng Kế toán – Tài chính",
  "permittedDepartments": [
    { "departmentId": "dept-uuid-ketoan", "departmentName": "Phòng Kế toán – Tài chính" }
  ]
}
```

---

### 4.6 Xóa bộ tri thức

```
DELETE /api/knowledge-bases/:id
```

**Response:** `204 No Content`

---

### 4.7 Danh sách tệp toàn bộ bộ tri thức

```
GET /api/knowledge-bases/files
```

Trả về danh sách tệp trên **tất cả** bộ tri thức kèm thống kê số lượng theo từng định dạng file. Dùng để hiển thị dashboard tổng quan hoặc tìm kiếm file xuyên bộ tri thức.

**Query params:**

| Param | Kiểu | Mặc định | Mô tả |
|-------|------|----------|-------|
| `search` | string | — | Tìm theo tên file |
| `fileType` | string | — | `Word` \| `Excel` \| `PDF` \| `Image` \| `PowerPoint` \| `Text` — lọc kết quả phân trang, **không** ảnh hưởng đến `counts` |
| `page` | number | 1 | Trang |
| `pageSize` | number | 50 | Số bản ghi/trang (max 200) |

**Ví dụ:**
```
GET /api/knowledge-bases/files?search=quy+trinh&page=1&pageSize=20
GET /api/knowledge-bases/files?fileType=PDF&page=1
```

**Response 200:**
```json
{
  "items": [
    {
      "id": "file-uuid-001",
      "knowledgeBaseId": "kb-uuid-001",
      "knowledgeBaseName": "Tri thức Kế toán – Tài chính",
      "fileName": "Quy trình kế toán nội bộ 2025.docx",
      "fileType": "Word",
      "fileSizeMb": 1.8,
      "storagePath": "http://localhost:3001/uploads/knowledge-files/1748230000-abc123.docx",
      "uploadedAt": "2026-05-20T10:00:00Z",
      "updatedAt": "2026-05-20T10:00:00Z",
      "permissions": [
        { "departmentId": "dept-uuid-ketoan", "departmentName": "Phòng Kế toán – Tài chính" }
      ]
    }
  ],
  "total": 42,
  "page": 1,
  "pageSize": 50,
  "counts": {
    "word": 15,
    "excel": 8,
    "pdf": 12,
    "image": 3,
    "powerPoint": 4,
    "text": 0,
    "total": 42
  }
}
```

> **Lưu ý:** `counts` luôn phản ánh số lượng theo từng định dạng của **toàn bộ** dữ liệu (theo `search` nếu có), bất kể đang lọc `fileType` hay không. `total` trong `counts` là tổng số file thực, còn `total` ngoài cùng là tổng kết quả **sau khi lọc** `fileType`.

---

### 4.8 Đổi tên / Chuyển bộ tri thức cho tệp

```
PATCH /api/knowledge-bases/files/:fileId
```

Cho phép **đổi tên** tệp và/hoặc **chuyển tệp sang bộ tri thức khác** mà không cần biết bộ tri thức hiện tại của tệp. Thường dùng từ màn hình quản lý tệp toàn hệ thống (xem [4.7](#47-danh-sách-tệp-toàn-bộ-bộ-tri-thức)).

**Body (tất cả optional, gửi ít nhất 1 field):**

| Field | Kiểu | Mô tả |
|-------|------|-------|
| `fileName` | string | Tên hiển thị mới (max 500 ký tự) |
| `targetKnowledgeBaseId` | UUID | ID bộ tri thức đích — tệp sẽ được chuyển sang bộ này |

**Ví dụ — đổi tên:**
```json
{
  "fileName": "Quy trình kế toán nội bộ 2026.docx"
}
```

**Ví dụ — chuyển bộ tri thức:**
```json
{
  "targetKnowledgeBaseId": "kb-uuid-002"
}
```

**Ví dụ — vừa đổi tên vừa chuyển:**
```json
{
  "fileName": "Báo cáo tài chính Q1-2026.xlsx",
  "targetKnowledgeBaseId": "kb-uuid-003"
}
```

**Response 200:** object tệp sau khi cập nhật.
```json
{
  "id": "file-uuid-001",
  "knowledgeBaseId": "kb-uuid-003",
  "knowledgeBaseName": "Tri thức Báo cáo – Thống kê",
  "fileName": "Báo cáo tài chính Q1-2026.xlsx",
  "fileType": "Excel",
  "fileSizeMb": 2.4,
  "storagePath": "http://localhost:3001/uploads/knowledge-files/1748230000-abc123.xlsx",
  "uploadedAt": "2026-05-20T10:00:00Z",
  "updatedAt": "2026-05-29T08:15:00Z",
  "permissions": []
}
```

**Lỗi:**

| Mã | Nguyên nhân |
|----|-------------|
| 404 | Tệp không tồn tại |
| 404 | `targetKnowledgeBaseId` không tồn tại |
| 400 | `fileName` rỗng hoặc vượt 500 ký tự |

---

## 5. Tệp tri thức

Base path: `/api/knowledge-bases/:kbId/files`

### 5.1 Danh sách tệp

```
GET /api/knowledge-bases/:kbId/files
```

**Query params:**

| Param | Kiểu | Mô tả |
|-------|------|-------|
| `search` | string | Tìm theo tên file |
| `fileType` | string | `Word` \| `Excel` \| `PDF` \| `Image` \| `PowerPoint` \| `Text` |
| `page` | number | Mặc định 1 |
| `pageSize` | number | Mặc định 50, max 200 |

**Response 200:**
```json
{
  "items": [
    {
      "id": "file-uuid-001",
      "knowledgeBaseId": "kb-uuid-001",
      "knowledgeBaseName": "Tri thức Kế toán – Tài chính",
      "fileName": "Quy trình kế toán nội bộ 2025.docx",
      "fileType": "Word",
      "fileSizeMb": 1.8,
      "storagePath": "http://localhost:3001/uploads/knowledge-files/1748230000-abc123.docx",
      "uploadedAt": "2026-05-20T10:00:00Z",
      "updatedAt": "2026-05-20T10:00:00Z",
      "permissions": [
        { "departmentId": "dept-uuid-ketoan", "departmentName": "Phòng Kế toán – Tài chính" }
      ]
    }
  ],
  "total": 6,
  "page": 1,
  "pageSize": 50
}
```

---

### 5.2 Tải lên tệp mới

```
POST /api/knowledge-bases/:kbId/files
Content-Type: multipart/form-data
```

**Form fields:**

| Field | Bắt buộc | Mô tả |
|-------|----------|-------|
| `file` | Không | File đính kèm (max 50MB) |
| `fileName` | Không | Tên hiển thị (mặc định: tên file gốc) |
| `fileType` | Không | Tự động phát hiện từ extension nếu không gửi |
| `permittedDepartments` | Không | JSON string: `[{"departmentId":"...","departmentName":"..."}]` |

**Ví dụ (curl):**
```bash
curl -X POST "http://localhost:3001/api/knowledge-bases/kb-uuid-001/files" \
  -H "Authorization: Bearer <token>" \
  -F "file=@/path/to/document.pdf" \
  -F 'permittedDepartments=[{"departmentId":"dept-uuid-ketoan","departmentName":"Phòng Kế toán – Tài chính"}]'
```

**Response 201:** object tệp vừa tạo (giống 1 phần tử trong danh sách).

> Extension → FileType tự động: `.pdf`→`PDF`, `.doc/.docx`→`Word`, `.xls/.xlsx`→`Excel`, `.ppt/.pptx`→`PowerPoint`, `.txt`→`Text`, `.jpg/.jpeg/.png/.gif/.webp`→`Image`

---

### 5.3 Chi tiết tệp

```
GET /api/knowledge-bases/:kbId/files/:fileId
```

**Response 200:** object tệp đầy đủ bao gồm `permissions`.

---

### 5.4 Tải xuống / Xem file

```
GET /api/knowledge-bases/:kbId/files/:fileId/file
```

Server redirect `302` đến URL thực của file. Frontend có thể dùng `window.open(url)` hoặc `<a href="...">`.

---

### 5.5 Cập nhật thông tin tệp

```
PUT /api/knowledge-bases/:kbId/files/:fileId
Content-Type: application/json
```

**Body:**
```json
{
  "fileName": "Quy trình kế toán nội bộ 2025 (v2).docx",
  "fileType": "Word",
  "fileSizeMb": 2.1
}
```

> `fileName` và `fileType` là bắt buộc.

**Response 200:** object tệp đã cập nhật.

---

### 5.6 Cập nhật phân quyền tệp

```
PUT /api/knowledge-bases/:kbId/files/:fileId/permissions
Content-Type: application/json
```

**Body:**
```json
{
  "permittedDepartments": [
    { "departmentId": "dept-uuid-ketoan", "departmentName": "Phòng Kế toán – Tài chính" },
    { "departmentId": "dept-uuid-cntt", "departmentName": "Phòng CNTT" }
  ]
}
```

> Gửi mảng rỗng `[]` = tất cả phòng ban đều có quyền.

**Response 200:** object tệp với quyền mới.

---

### 5.7 Xóa tệp

```
DELETE /api/knowledge-bases/:kbId/files/:fileId
```

**Response:** `204 No Content`

---

## 6. Tài liệu tri thức — Workflow kiểm duyệt

Base path: `/api/knowledge-documents`

### Vòng đời tài liệu

```
[Upload] → Draft → [Submit] → Review → [Approve] → Approved → [Archive] → Archived
                               ↓ [Return/Request Revision]
                             Draft
              [Rollback] lùi lại từng bước
              [New Version] → Draft (version mới)
```

---

### 6.1 Upload tài liệu mới

```
POST /api/knowledge-documents
Content-Type: multipart/form-data
```

**Form fields:**

| Field | Bắt buộc | Mô tả |
|-------|----------|-------|
| `knowledgeBaseId` | **Có** | UUID bộ tri thức |
| `title` | **Có** | Tiêu đề tài liệu (max 500 ký tự) |
| `file` | Không | File đính kèm (max 50MB) |
| `fileType` | Không | Tự động từ extension nếu không gửi |
| `contentSummary` | Không | Tóm tắt nội dung |
| `note` | Không | Ghi chú upload |

**Ví dụ (curl):**
```bash
curl -X POST "http://localhost:3001/api/knowledge-documents" \
  -H "Authorization: Bearer <token>" \
  -F "knowledgeBaseId=kb-uuid-001" \
  -F "title=Chuẩn mực kế toán IFRS 2024" \
  -F "contentSummary=Tổng hợp các chuẩn mực IFRS áp dụng năm 2024" \
  -F "file=@/path/to/ifrs2024.pdf"
```

**Response 201:**
```json
{
  "id": "doc-uuid-001",
  "knowledgeBaseId": "kb-uuid-001",
  "knowledgeBaseName": "Tri thức Kế toán – Tài chính",
  "title": "Chuẩn mực kế toán IFRS 2024",
  "fileType": "PDF",
  "fileSizeMb": 3.45,
  "storagePath": "http://localhost:3001/uploads/knowledge-docs/1748230000-xyz789.pdf",
  "uploadedBy": "550e8400-e29b-41d4-a716-446655440001",
  "uploadedAt": "2026-05-26T09:00:00Z",
  "status": "Draft",
  "currentVersion": "v1.0",
  "versionCount": 1,
  "createdAt": "2026-05-26T09:00:00Z",
  "updatedAt": "2026-05-26T09:00:00Z"
}
```

---

### 6.2 Danh sách tài liệu

```
GET /api/knowledge-documents
```

**Query params:**

| Param | Kiểu | Mô tả |
|-------|------|-------|
| `knowledgeBaseId` | UUID | Lọc theo bộ tri thức |
| `status` | string | `Draft` \| `Review` \| `Approved` \| `Archived` |
| `search` | string | Tìm theo tiêu đề |
| `page` | number | Mặc định 1 |
| `pageSize` | number | Mặc định 20, max 100 |

**Ví dụ:**
```
GET /api/knowledge-documents?knowledgeBaseId=kb-uuid-001&status=Approved&page=1
```

**Response 200:**
```json
{
  "items": [
    {
      "id": "doc-uuid-001",
      "knowledgeBaseId": "kb-uuid-001",
      "knowledgeBaseName": "Tri thức Kế toán – Tài chính",
      "title": "Chuẩn mực kế toán IFRS 2024",
      "fileType": "PDF",
      "fileSizeMb": 3.45,
      "storagePath": "http://localhost:3001/uploads/knowledge-docs/1748230000-xyz789.pdf",
      "uploadedBy": "user-uuid-001",
      "uploadedAt": "2026-05-26T09:00:00Z",
      "status": "Approved",
      "currentVersion": "v1.0",
      "versionCount": 1,
      "createdAt": "2026-05-26T09:00:00Z",
      "updatedAt": "2026-05-26T10:30:00Z"
    }
  ],
  "total": 15,
  "page": 1,
  "pageSize": 20
}
```

---

### 6.3 Chi tiết tài liệu

```
GET /api/knowledge-documents/:docId
```

**Response 200:** object tài liệu đầy đủ.

---

### 6.4 Tải xuống / Xem file tài liệu

```
GET /api/knowledge-documents/:docId/file
```

Server redirect `302` đến URL file. Dùng cho preview PDF hoặc tải xuống.

---

### 6.5 Nộp tài liệu để kiểm duyệt

```
POST /api/knowledge-documents/:docId/submit-review
```

> Điều kiện: tài liệu đang ở trạng thái `Draft`

**Body:** không cần  
**Response 200:** object tài liệu với `status: "Review"`

**Lỗi:**
| Mã | Nguyên nhân |
|----|-------------|
| 422 | Tài liệu không ở trạng thái Draft |

---

### 6.6 Phê duyệt tài liệu

```
POST /api/knowledge-documents/:docId/approve
```

> Điều kiện: tài liệu đang ở trạng thái `Review`  
> **Tác động:** tài liệu được chuyển tự động vào danh sách tệp của bộ tri thức tương ứng.

**Body:** không cần  
**Response 200:** object tài liệu với `status: "Approved"`

---

### 6.7 Trả lại bản nháp

```
POST /api/knowledge-documents/:docId/return-draft
```

> Điều kiện: tài liệu đang ở trạng thái `Review`

**Body:** không cần  
**Response 200:** object tài liệu với `status: "Draft"`

---

### 6.8 Yêu cầu chỉnh sửa

```
POST /api/knowledge-documents/:docId/request-revision
```

> Điều kiện: tài liệu đang ở trạng thái `Review`

**Body:**
```json
{
  "revisionNote": "Cần bổ sung phần phụ lục so sánh IFRS vs VAS"
}
```

**Response 200:** object tài liệu với `status: "Draft"`

---

### 6.9 Lưu trữ tài liệu

```
POST /api/knowledge-documents/:docId/archive
```

> Điều kiện: tài liệu đang ở trạng thái `Approved`

**Body:** không cần  
**Response 200:** object tài liệu với `status: "Archived"`

---

### 6.10 Rollback trạng thái

```
POST /api/knowledge-documents/:docId/rollback
```

Lùi lại trạng thái trước đó theo thứ tự:  
`Archived → Approved → Review → Draft`

**Body:** không cần  
**Response 200:** object tài liệu với trạng thái mới.

---

### 6.11 Danh sách phiên bản

```
GET /api/knowledge-documents/:docId/versions
```

**Response 200:**
```json
{
  "items": [
    {
      "id": "ver-uuid-001",
      "documentId": "doc-uuid-001",
      "versionNumber": "v1.0",
      "changeNote": "Phiên bản khởi tạo",
      "contentSummary": "Tổng hợp các chuẩn mực IFRS năm 2024",
      "status": "Approved",
      "createdBy": "user-uuid-001",
      "createdAt": "2026-05-26T09:00:00Z"
    },
    {
      "id": "ver-uuid-002",
      "documentId": "doc-uuid-001",
      "versionNumber": "v1.1",
      "changeNote": "Bổ sung phụ lục so sánh IFRS vs VAS",
      "contentSummary": "",
      "status": "Draft",
      "createdBy": "user-uuid-001",
      "createdAt": "2026-05-26T11:00:00Z"
    }
  ]
}
```

---

### 6.12 Tạo phiên bản mới

```
POST /api/knowledge-documents/:docId/versions
Content-Type: application/json
```

> Tác động: tạo version mới (vX.Y+1), đặt tài liệu về `Draft`.

**Body:**
```json
{
  "changeNote": "Bổ sung phụ lục so sánh IFRS vs VAS",
  "contentSummary": "Thêm bảng so sánh IFRS 9 và VAS 10"
}
```

**Response 200:** object tài liệu với `status: "Draft"` và `currentVersion: "v1.1"`

---

## 8. Thống kê Dashboard

Nhóm endpoint trả về số liệu tổng hợp phục vụ màn hình dashboard quản trị.

---

### 8.1 Thống kê hệ thống

```
GET /api/system/stats
```

Trả về số liệu người dùng, vai trò và phân bổ người dùng theo phòng ban — hiển thị trên card **"Cấu hình hệ thống"** của dashboard.

**Response 200:**
```json
{
  "totalUsers": 22,
  "activeUsers": 17,
  "totalRoles": 9,
  "usersByDepartment": [
    { "departmentName": "Phòng Kế toán & Tài chính",     "userCount": 6 },
    { "departmentName": "Phòng Công nghệ Thông tin",      "userCount": 5 },
    { "departmentName": "Phòng OCR & Xử lý Tài liệu",    "userCount": 5 },
    { "departmentName": "Phòng Kinh doanh & CSKH",        "userCount": 4 },
    { "departmentName": "Phòng nhân sự",                  "userCount": 1 },
    { "departmentName": "FOXAI Corporation",              "userCount": 1 }
  ]
}
```

| Field | Kiểu | Mô tả |
|-------|------|-------|
| `totalUsers` | number | Tổng số tài khoản người dùng |
| `activeUsers` | number | Số tài khoản có trạng thái `ACTIVE` |
| `totalRoles` | number | Tổng số vai trò trong hệ thống |
| `usersByDepartment` | array | Danh sách phòng ban có người dùng, sắp xếp theo số lượng giảm dần (chỉ phòng ban có ít nhất 1 người dùng) |

> **Lưu ý:** Số liệu `Mẫu OCR` (OCR templates) không nằm trong endpoint này — frontend lấy riêng từ OCR service.

---

### 8.2 Thống kê bộ tri thức (tham chiếu)

Xem [4.1 Thống kê bộ tri thức](#41-thống-kê-bộ-tri-thức) — `GET /api/knowledge-bases/stats`

---

## 7. Quy ước chung

### 7.1 Cấu trúc lỗi

Tất cả lỗi trả về dạng:

```json
{
  "statusCode": 422,
  "message": "Tài liệu phải ở trạng thái Review để phê duyệt",
  "error": "Unprocessable Entity"
}
```

Lỗi validation (400):
```json
{
  "statusCode": 400,
  "message": [
    "code must match /^[A-Z0-9\\-_]+$/ regular expression",
    "name should not be empty"
  ],
  "error": "Bad Request"
}
```

### 7.2 Mã HTTP

| Mã | Ý nghĩa |
|----|---------|
| 200 | Thành công |
| 201 | Tạo mới thành công |
| 204 | Thành công, không có dữ liệu trả về |
| 302 | Redirect đến file |
| 400 | Dữ liệu đầu vào không hợp lệ |
| 401 | Chưa xác thực (thiếu/hết hạn token) |
| 403 | Không có quyền |
| 404 | Không tìm thấy tài nguyên |
| 422 | Vi phạm quy tắc nghiệp vụ (sai trạng thái, trùng mã...) |

### 7.3 Kiểu dữ liệu FileType

| Giá trị | Extension tương ứng |
|---------|---------------------|
| `PDF` | `.pdf` |
| `Word` | `.doc`, `.docx` |
| `Excel` | `.xls`, `.xlsx` |
| `PowerPoint` | `.ppt`, `.pptx` |
| `Text` | `.txt` |
| `Image` | `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp` |

### 7.4 Phân trang

Tất cả API danh sách đều trả về:
```json
{
  "items": [...],
  "total": 100,
  "page": 1,
  "pageSize": 20
}
```

### 7.5 Lưu ý multipart/form-data

Khi gửi `permittedDepartments` trong form-data, serialize thành JSON string:

```javascript
// JavaScript fetch
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('permittedDepartments', JSON.stringify([
  { departmentId: 'uuid-1', departmentName: 'Phòng Kế toán' }
]));

fetch('/api/knowledge-bases/kb-id/files', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: formData,
});
```

```javascript
// Axios
const formData = new FormData();
formData.append('file', file);
formData.append('knowledgeBaseId', kbId);
formData.append('title', 'Tiêu đề tài liệu');

axios.post('/api/knowledge-documents', formData, {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'multipart/form-data',
  },
});
```
