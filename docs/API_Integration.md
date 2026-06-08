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
9. [Nhóm phân hệ (Module Groups)](#9-nhóm-phân-hệ-module-groups)
10. [Phân hệ (Modules)](#10-phân-hệ-modules)
11. [Hành động phân quyền (Permission Actions)](#11-hành-động-phân-quyền-permission-actions)
12. [Hành động được phép của phân hệ (Module Actions)](#12-hành-động-được-phép-của-phân-hệ-module-actions)

> **Xem nhanh endpoint mới:**  
> `GET /api/knowledge-bases/stats` — [4.1 Thống kê bộ tri thức](#41-thống-kê-bộ-tri-thức) *(cập nhật — thêm `pdfFilesCount`, `filesByKnowledgeBase`)*  
> `GET /api/system/stats` — [8.1 Thống kê hệ thống](#81-thống-kê-hệ-thống) *(mới)*  
> `GET /api/knowledge-bases/files` — [4.7 Danh sách tệp toàn bộ bộ tri thức](#47-danh-sách-tệp-toàn-bộ-bộ-tri-thức)  
> `PATCH /api/knowledge-bases/files/:fileId` — [4.8 Đổi tên / Chuyển bộ tri thức cho tệp](#48-đổi-tên--chuyển-bộ-tri-thức-cho-tệp)  
> `POST /api/knowledge-files` — [5.8 Tải lên tệp không cần chọn bộ tri thức](#58-tải-lên-tệp-không-cần-chọn-bộ-tri-thức) *(mới — `knowledgeBaseId` tùy chọn)*  
> `POST /api/module-groups` — [9.2 Tạo nhóm phân hệ](#92-tạo-nhóm-phân-hệ) *(mới)*  
> `POST /api/modules` — [10.2 Tạo phân hệ](#102-tạo-phân-hệ) *(cập nhật — thêm `actionIds`)*  
> `PATCH /api/modules/:id` — [10.4 Cập nhật phân hệ](#104-cập-nhật-phân-hệ) *(cập nhật — thêm `updateActions`, `actionIds`)*  
> `POST /api/permission-actions` — [11.2 Tạo hành động phân quyền](#112-tạo-hành-động-phân-quyền) *(mới)*  
> `PUT /api/modules/:id/actions` — [12.1 Gán hành động cho phân hệ](#121-gán-hành-động-cho-phân-hệ) *(mới)*

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

### 5.8 Tải lên tệp không cần chọn bộ tri thức

Endpoint đứng độc lập (không nằm dưới `:kbId`), cho phép tải lên tệp mà **không bắt buộc gắn vào bộ tri thức**. Bỏ trống `knowledgeBaseId` để tạo tệp chưa phân loại (`knowledgeBaseId = null`); hoặc gửi kèm `knowledgeBaseId` để gắn vào một bộ tri thức cụ thể.

```
POST /api/knowledge-files
Content-Type: multipart/form-data
```

**Form fields:**

| Field | Bắt buộc | Mô tả |
|-------|----------|-------|
| `file` | Không | File đính kèm (max 50MB) |
| `knowledgeBaseId` | Không | UUID bộ tri thức. Bỏ trống = tệp chưa phân loại (`null`) |
| `fileName` | Không | Tên hiển thị (mặc định: tên file gốc) |
| `fileType` | Không | Tự động phát hiện từ extension nếu không gửi |
| `permittedDepartments` | Không | JSON string: `[{"departmentId":"...","departmentName":"..."}]` |

**Ví dụ (curl) — không gắn bộ tri thức:**
```bash
curl -X POST "http://localhost:3001/api/knowledge-files" \
  -H "Authorization: Bearer <token>" \
  -F "file=@/path/to/document.pdf"
```

**Ví dụ (curl) — gắn vào một bộ tri thức:**
```bash
curl -X POST "http://localhost:3001/api/knowledge-files" \
  -H "Authorization: Bearer <token>" \
  -F "file=@/path/to/document.pdf" \
  -F "knowledgeBaseId=kb-uuid-001"
```

**Response 201:** object tệp vừa tạo (giống 1 phần tử trong [5.1 Danh sách tệp](#51-danh-sách-tệp)). Khi không gắn bộ tri thức, `knowledgeBaseId` trả về rỗng/`null` và `knowledgeBaseName` rỗng.

> Quy ước extension → FileType giống [5.2 Tải lên tệp mới](#52-tải-lên-tệp-mới). Quyền yêu cầu: `KNOWLEDGE_UPLOAD` / `CREATE`.

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

---

## 9. Nhóm phân hệ (Module Groups)

Nhóm phân hệ là cấp phân loại cao nhất trong cấu hình phân quyền — mỗi nhóm chứa nhiều **Phân hệ** (xem [mục 10](#10-phân-hệ-modules)). Ví dụ nhóm `QUAN_LY_HE_THONG` gồm các phân hệ `VAI_TRO`, `NGUOI_DUNG`, `TO_CHUC`.

**Quyền yêu cầu:** `ROLE_CONFIG`

---

### 9.1 Danh sách nhóm phân hệ

```
GET /api/module-groups
```

**Query params:**

| Param | Kiểu | Mặc định | Mô tả |
|-------|------|----------|-------|
| `activeOnly` | boolean | `false` | `true` = chỉ trả nhóm đang kích hoạt |

**Ví dụ:**
```
GET /api/module-groups
GET /api/module-groups?activeOnly=true
```

**Response 200:**
```json
{
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-100000000001",
      "code": "QUAN_LY_HE_THONG",
      "name": "Quản lý hệ thống",
      "description": "Nhóm chức năng cấu hình hệ thống",
      "sortOrder": 1,
      "isActive": true,
      "modules": [
        {
          "id": "550e8400-e29b-41d4-a716-200000000001",
          "code": "VAI_TRO",
          "name": "Cấu hình vai trò",
          "sortOrder": 1,
          "isActive": true
        },
        {
          "id": "550e8400-e29b-41d4-a716-200000000002",
          "code": "NGUOI_DUNG",
          "name": "Quản lý người dùng",
          "sortOrder": 2,
          "isActive": true
        }
      ],
      "createdAt": "2026-01-01T00:00:00Z",
      "updatedAt": "2026-01-01T00:00:00Z"
    }
  ]
}
```

| Field | Kiểu | Mô tả |
|-------|------|-------|
| `id` | UUID | ID nhóm |
| `code` | string | Mã định danh duy nhất (`UPPER_SNAKE_CASE`) |
| `name` | string | Tên hiển thị |
| `description` | string \| null | Mô tả |
| `sortOrder` | number | Thứ tự hiển thị |
| `isActive` | boolean | Trạng thái kích hoạt |
| `modules` | array | Danh sách phân hệ thuộc nhóm (tóm tắt) |

---

### 9.2 Tạo nhóm phân hệ

```
POST /api/module-groups
```

**Quyền:** `ROLE_CONFIG / CREATE`

**Body:**
```json
{
  "code": "TRI_THUC_AI",
  "name": "Tri thức AI",
  "description": "Nhóm chức năng quản lý bộ tri thức và kiểm duyệt nội dung",
  "sortOrder": 2
}
```

| Field | Bắt buộc | Ràng buộc |
|-------|----------|-----------|
| `code` | **Có** | `UPPER_SNAKE_CASE`, bắt đầu bằng chữ cái (`^[A-Z][A-Z0-9_]*$`), max 100 ký tự, **duy nhất toàn hệ thống** |
| `name` | **Có** | Không rỗng, max 200 ký tự |
| `description` | Không | Max 500 ký tự |
| `sortOrder` | **Có** | Số nguyên ≥ 0 |

**Response 201:**
```json
{
  "id": "550e8400-e29b-41d4-a716-100000000002",
  "code": "TRI_THUC_AI",
  "name": "Tri thức AI",
  "description": "Nhóm chức năng quản lý bộ tri thức và kiểm duyệt nội dung",
  "sortOrder": 2,
  "isActive": true,
  "modules": [],
  "createdAt": "2026-06-04T08:00:00Z",
  "updatedAt": "2026-06-04T08:00:00Z"
}
```

**Lỗi:**

| Mã | Nguyên nhân |
|----|-------------|
| 400 | `code` không đúng định dạng, `name` rỗng, `sortOrder` thiếu |
| 422 | `code` đã tồn tại trong hệ thống |

---

### 9.3 Chi tiết nhóm phân hệ

```
GET /api/module-groups/:id
```

**Response 200:** object nhóm phân hệ đầy đủ (cấu trúc giống 1 phần tử trong [9.1](#91-danh-sách-nhóm-phân-hệ), bao gồm `modules`).

**Lỗi:**

| Mã | Nguyên nhân |
|----|-------------|
| 404 | Nhóm phân hệ không tồn tại |

---

### 9.4 Cập nhật nhóm phân hệ

```
PATCH /api/module-groups/:id
```

**Quyền:** `ROLE_CONFIG / UPDATE`

**Body (tất cả optional — gửi ít nhất 1 field):**
```json
{
  "name": "Tri thức AI & Chatbot",
  "description": "Quản lý tri thức, phê duyệt và chatbot AI",
  "sortOrder": 3,
  "isActive": true
}
```

> `code` không thể thay đổi sau khi tạo.

**Response 200:** object nhóm phân hệ sau khi cập nhật.

**Lỗi:**

| Mã | Nguyên nhân |
|----|-------------|
| 404 | Nhóm phân hệ không tồn tại |

---

### 9.5 Xóa nhóm phân hệ

```
DELETE /api/module-groups/:id
```

**Quyền:** `ROLE_CONFIG / DELETE`

**Response:** `204 No Content`

**Lỗi:**

| Mã | Nguyên nhân |
|----|-------------|
| 404 | Nhóm phân hệ không tồn tại |
| 422 | Nhóm còn phân hệ con — phải xóa tất cả phân hệ trước |

---

## 10. Phân hệ (Modules)

Phân hệ là đơn vị phân quyền chi tiết — mỗi phân hệ tương ứng 1 màn hình hoặc tính năng trong giao diện, nằm trong một **Nhóm phân hệ** (xem [mục 9](#9-nhóm-phân-hệ-module-groups)). Khi cấu hình quyền cho vai trò, admin chọn từng cặp `(Phân hệ, Hành động)`.

**Quyền yêu cầu:** `ROLE_CONFIG`

---

### 10.1 Danh sách phân hệ

```
GET /api/modules
```

**Query params:**

| Param | Kiểu | Mặc định | Mô tả |
|-------|------|----------|-------|
| `groupId` | UUID | — | Lọc theo nhóm phân hệ |
| `activeOnly` | boolean | `false` | `true` = chỉ trả phân hệ đang kích hoạt |

**Ví dụ:**
```
GET /api/modules
GET /api/modules?groupId=550e8400-e29b-41d4-a716-100000000001&activeOnly=true
```

**Response 200:**
```json
{
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-200000000001",
      "groupId": "550e8400-e29b-41d4-a716-100000000001",
      "groupCode": "QUAN_LY_HE_THONG",
      "groupName": "Quản lý hệ thống",
      "code": "VAI_TRO",
      "name": "Cấu hình vai trò",
      "description": "Quản lý danh sách vai trò và phân quyền",
      "sortOrder": 1,
      "isActive": true,
      "createdAt": "2026-01-01T00:00:00Z",
      "updatedAt": "2026-01-01T00:00:00Z",
      "allowedActions": [
        { "id": "uuid-action-read",   "code": "READ",   "name": "Xem",  "sortOrder": 1 },
        { "id": "uuid-action-create", "code": "CREATE", "name": "Thêm", "sortOrder": 2 },
        { "id": "uuid-action-update", "code": "UPDATE", "name": "Sửa",  "sortOrder": 3 },
        { "id": "uuid-action-delete", "code": "DELETE", "name": "Xóa",  "sortOrder": 4 }
      ]
    }
  ]
}
```

| Field | Kiểu | Mô tả |
|-------|------|-------|
| `id` | UUID | ID phân hệ |
| `groupId` | UUID | ID nhóm phân hệ cha |
| `groupCode` | string | Mã nhóm phân hệ cha |
| `groupName` | string | Tên nhóm phân hệ cha |
| `code` | string | Mã định danh duy nhất (`UPPER_SNAKE_CASE`) |
| `name` | string | Tên hiển thị |
| `description` | string \| null | Mô tả |
| `sortOrder` | number | Thứ tự hiển thị trong nhóm |
| `isActive` | boolean | Trạng thái kích hoạt |
| `allowedActions` | array | Danh sách hành động được phép hiển thị cho phân hệ này trong lưới phân quyền (sắp xếp theo `sortOrder`) |

**Cấu trúc `allowedActions[n]`:**

| Field | Kiểu | Mô tả |
|-------|------|-------|
| `id` | UUID | ID hành động |
| `code` | string | Mã hành động (`READ`, `CREATE`, `UPDATE`, `DELETE`, `EXPORT`, ...) |
| `name` | string | Tên hiển thị (cột trong lưới phân quyền) |
| `sortOrder` | number | Thứ tự cột |

> **UI phân quyền sử dụng `allowedActions` để:** (1) quyết định cột nào hiển thị cho từng hàng (phân hệ); (2) tránh hiển thị checkbox không có nghĩa — ví dụ phân hệ "Dashboard" chỉ có `READ` + `EXPORT`, không hiện cột `CREATE`/`DELETE`.

---

### 10.2 Tạo phân hệ

```
POST /api/modules
```

**Quyền:** `ROLE_CONFIG / CREATE`

**Body:**
```json
{
  "groupId": "550e8400-e29b-41d4-a716-100000000001",
  "code": "TO_CHUC",
  "name": "Cơ cấu tổ chức",
  "description": "Quản lý sơ đồ tổ chức và phòng ban",
  "sortOrder": 3,
  "actionIds": [
    "uuid-action-read",
    "uuid-action-create",
    "uuid-action-update",
    "uuid-action-delete"
  ]
}
```

| Field | Bắt buộc | Ràng buộc |
|-------|----------|-----------|
| `groupId` | **Có** | UUID hợp lệ, nhóm phân hệ phải tồn tại |
| `code` | **Có** | `UPPER_SNAKE_CASE`, bắt đầu bằng chữ cái (`^[A-Z][A-Z0-9_]*$`), max 100 ký tự, **duy nhất toàn hệ thống** |
| `name` | **Có** | Không rỗng, max 200 ký tự |
| `description` | Không | Max 500 ký tự |
| `sortOrder` | **Có** | Số nguyên ≥ 0 |
| `actionIds` | Không | Mảng UUID hành động phân quyền. Bỏ trống hoặc không gửi = phân hệ chưa cấu hình cột action |

**Response 201:**
```json
{
  "id": "550e8400-e29b-41d4-a716-200000000003",
  "groupId": "550e8400-e29b-41d4-a716-100000000001",
  "groupCode": "QUAN_LY_HE_THONG",
  "groupName": "Quản lý hệ thống",
  "code": "TO_CHUC",
  "name": "Cơ cấu tổ chức",
  "description": "Quản lý sơ đồ tổ chức và phòng ban",
  "sortOrder": 3,
  "isActive": true,
  "createdAt": "2026-06-04T08:30:00Z",
  "updatedAt": "2026-06-04T08:30:00Z",
  "allowedActions": [
    { "id": "uuid-action-read",   "code": "READ",   "name": "Xem",  "sortOrder": 1 },
    { "id": "uuid-action-create", "code": "CREATE", "name": "Thêm", "sortOrder": 2 },
    { "id": "uuid-action-update", "code": "UPDATE", "name": "Sửa",  "sortOrder": 3 },
    { "id": "uuid-action-delete", "code": "DELETE", "name": "Xóa",  "sortOrder": 4 }
  ]
}
```

**Lỗi:**

| Mã | Nguyên nhân |
|----|-------------|
| 400 | `groupId` không phải UUID, `code` sai định dạng, `name` rỗng, `sortOrder` thiếu |
| 404 | `groupId` không tồn tại |
| 422 | `code` đã tồn tại trong hệ thống |

---

### 10.3 Chi tiết phân hệ

```
GET /api/modules/:id
```

**Response 200:** object phân hệ đầy đủ bao gồm `allowedActions` (cấu trúc giống 1 phần tử trong [10.1](#101-danh-sách-phân-hệ)).

**Lỗi:**

| Mã | Nguyên nhân |
|----|-------------|
| 404 | Phân hệ không tồn tại |

---

### 10.4 Cập nhật phân hệ

```
PATCH /api/modules/:id
```

**Quyền:** `ROLE_CONFIG / UPDATE`

**Body (tất cả optional — gửi ít nhất 1 field):**
```json
{
  "groupId": "550e8400-e29b-41d4-a716-100000000002",
  "name": "Cơ cấu tổ chức (cập nhật)",
  "description": "Mô tả mới",
  "sortOrder": 4,
  "isActive": false,
  "updateActions": true,
  "actionIds": [
    "uuid-action-read",
    "uuid-action-create",
    "uuid-action-update",
    "uuid-action-delete",
    "uuid-action-export"
  ]
}
```

| Field | Bắt buộc | Mô tả |
|-------|----------|-------|
| `groupId` | Không | Chuyển phân hệ sang nhóm khác |
| `name` | Không | Tên hiển thị mới |
| `description` | Không | Mô tả mới (gửi chuỗi rỗng `""` để xóa) |
| `sortOrder` | Không | Thứ tự hiển thị mới |
| `isActive` | Không | Kích hoạt / vô hiệu hóa |
| `updateActions` | Không | `true` = thay thế toàn bộ danh sách action bằng `actionIds`. `false` (mặc định) = giữ nguyên |
| `actionIds` | Không | Mảng UUID hành động mới. Chỉ có hiệu lực khi `updateActions = true`. Gửi mảng rỗng `[]` = xóa toàn bộ action của phân hệ |

> - `code` không thể thay đổi sau khi tạo.
> - Để **thay đổi actions**: gửi `updateActions: true` kèm `actionIds` mới — server sẽ xóa toàn bộ cấu hình cũ và thay bằng danh sách mới.
> - Để **giữ nguyên actions**: bỏ qua `updateActions` (hoặc `false`) — bất kể `actionIds` có trong body hay không.

**Response 200:** object phân hệ sau khi cập nhật, bao gồm `allowedActions` phản ánh trạng thái mới.

**Lỗi:**

| Mã | Nguyên nhân |
|----|-------------|
| 404 | Phân hệ không tồn tại |
| 404 | `groupId` mới không tồn tại |
| 404 | Một trong các `actionIds` không tồn tại |

---

### 10.5 Xóa phân hệ

```
DELETE /api/modules/:id
```

**Quyền:** `ROLE_CONFIG / DELETE`

**Response:** `204 No Content`

**Lỗi:**

| Mã | Nguyên nhân |
|----|-------------|
| 404 | Phân hệ không tồn tại |
| 422 | Phân hệ đang được dùng trong cấu hình quyền của vai trò hoặc người dùng |

---

## 11. Hành động phân quyền (Permission Actions)

Hành động phân quyền định nghĩa **loại thao tác** mà một vai trò có thể thực hiện trên một Phân hệ — ví dụ `READ`, `CREATE`, `UPDATE`, `DELETE`, `APPROVE`, `EXPORT`. Khi gán quyền cho vai trò, admin chọn từng cặp `(Phân hệ, Hành động)` (xem [3.4 Gán / Thu hồi quyền cho vai trò](#34-gán--thu-hồi-quyền-cho-vai-trò)).

**Quyền yêu cầu:** `ROLE_CONFIG`

---

### 11.1 Danh sách hành động phân quyền

```
GET /api/permission-actions
```

**Query params:**

| Param | Kiểu | Mặc định | Mô tả |
|-------|------|----------|-------|
| `activeOnly` | boolean | `false` | `true` = chỉ trả hành động đang kích hoạt |

**Ví dụ:**
```
GET /api/permission-actions
GET /api/permission-actions?activeOnly=true
```

**Response 200:**
```json
{
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-300000000001",
      "code": "READ",
      "name": "Xem",
      "description": "Xem danh sách và chi tiết",
      "sortOrder": 1,
      "isActive": true,
      "createdAt": "2026-01-01T00:00:00Z",
      "updatedAt": "2026-01-01T00:00:00Z"
    },
    {
      "id": "550e8400-e29b-41d4-a716-300000000002",
      "code": "CREATE",
      "name": "Tạo mới",
      "description": "Tạo bản ghi mới",
      "sortOrder": 2,
      "isActive": true,
      "createdAt": "2026-01-01T00:00:00Z",
      "updatedAt": "2026-01-01T00:00:00Z"
    }
  ]
}
```

| Field | Kiểu | Mô tả |
|-------|------|-------|
| `id` | UUID | ID hành động |
| `code` | string | Mã định danh duy nhất (`UPPER_SNAKE_CASE`, max 32 ký tự) |
| `name` | string | Tên hiển thị |
| `description` | string \| null | Mô tả |
| `sortOrder` | number | Thứ tự hiển thị trong lưới phân quyền |
| `isActive` | boolean | Trạng thái kích hoạt |

---

### 11.2 Tạo hành động phân quyền

```
POST /api/permission-actions
```

**Quyền:** `ROLE_CONFIG / CREATE`

**Body:**
```json
{
  "code": "EXPORT",
  "name": "Xuất dữ liệu",
  "description": "Xuất danh sách ra file Excel / PDF",
  "sortOrder": 5
}
```

| Field | Bắt buộc | Ràng buộc |
|-------|----------|-----------|
| `code` | **Có** | `UPPER_SNAKE_CASE`, bắt đầu bằng chữ cái (`^[A-Z][A-Z0-9_]*$`), **max 32 ký tự**, duy nhất toàn hệ thống |
| `name` | **Có** | Không rỗng, max 100 ký tự |
| `description` | Không | Max 500 ký tự |
| `sortOrder` | **Có** | Số nguyên ≥ 0 |

> **Gợi ý mã chuẩn:** `READ` · `CREATE` · `UPDATE` · `DELETE` · `APPROVE` · `UPLOAD` · `EXPORT` · `IMPORT`

**Response 201:**
```json
{
  "id": "550e8400-e29b-41d4-a716-300000000005",
  "code": "EXPORT",
  "name": "Xuất dữ liệu",
  "description": "Xuất danh sách ra file Excel / PDF",
  "sortOrder": 5,
  "isActive": true,
  "createdAt": "2026-06-04T09:00:00Z",
  "updatedAt": "2026-06-04T09:00:00Z"
}
```

**Lỗi:**

| Mã | Nguyên nhân |
|----|-------------|
| 400 | `code` sai định dạng hoặc vượt 32 ký tự, `name` rỗng, `sortOrder` thiếu |
| 422 | `code` đã tồn tại trong hệ thống |

---

### 11.3 Chi tiết hành động phân quyền

```
GET /api/permission-actions/:id
```

**Response 200:** object hành động đầy đủ (cấu trúc giống 1 phần tử trong [11.1](#111-danh-sách-hành-động-phân-quyền)).

**Lỗi:**

| Mã | Nguyên nhân |
|----|-------------|
| 404 | Hành động không tồn tại |

---

### 11.4 Cập nhật hành động phân quyền

```
PATCH /api/permission-actions/:id
```

**Quyền:** `ROLE_CONFIG / UPDATE`

**Body (tất cả optional — gửi ít nhất 1 field):**
```json
{
  "name": "Xuất dữ liệu (Excel/PDF)",
  "description": "Xuất báo cáo ra file",
  "sortOrder": 6,
  "isActive": true
}
```

> `code` không thể thay đổi sau khi tạo.

**Response 200:** object hành động sau khi cập nhật.

**Lỗi:**

| Mã | Nguyên nhân |
|----|-------------|
| 404 | Hành động không tồn tại |

---

### 11.5 Xóa hành động phân quyền

```
DELETE /api/permission-actions/:id
```

**Quyền:** `ROLE_CONFIG / DELETE`

**Response:** `204 No Content`

**Lỗi:**

| Mã | Nguyên nhân |
|----|-------------|
| 404 | Hành động không tồn tại |
| 422 | Hành động đang được dùng trong cấu hình quyền của vai trò hoặc người dùng |

---

## 12. Hành động được phép của phân hệ (Module Actions)

Xác định **tập hợp hành động (cột)** hiển thị trong lưới phân quyền cho từng phân hệ (hàng). Ví dụ: phân hệ "Dashboard" chỉ hiển thị cột `XEM` và `XUẤT`; phân hệ "Cấu hình người dùng" hiển thị đầy đủ 5 cột.

Dữ liệu này được trả về tự động qua field `allowedActions` trong mọi response của **[mục 10 Phân hệ](#10-phân-hệ-modules)**. Endpoint riêng dưới đây dùng khi cần thao tác nhanh mà không cần gọi `PATCH /api/modules/:id`.

**Quyền yêu cầu:** `ROLE_CONFIG / UPDATE`

---

### 12.1 Gán hành động cho phân hệ

```
PUT /api/modules/:id/actions
```

Thay thế **toàn bộ** danh sách action của phân hệ bằng danh sách mới. Tương đương gọi `PATCH /api/modules/:id` với `updateActions: true`.

**Body:**
```json
{
  "actionIds": [
    "uuid-action-read",
    "uuid-action-create",
    "uuid-action-update",
    "uuid-action-delete",
    "uuid-action-export"
  ]
}
```

> Gửi `actionIds: []` để xóa toàn bộ action của phân hệ (phân hệ sẽ không hiển thị cột nào trong lưới phân quyền).

**Response 200:**
```json
{
  "id": "550e8400-e29b-41d4-a716-200000000001",
  "code": "USER_CONFIG",
  "name": "Cấu hình người dùng",
  "allowedActions": [
    { "id": "uuid-action-read",   "code": "READ",   "name": "Xem",  "sortOrder": 1 },
    { "id": "uuid-action-create", "code": "CREATE", "name": "Thêm", "sortOrder": 2 },
    { "id": "uuid-action-update", "code": "UPDATE", "name": "Sửa",  "sortOrder": 3 },
    { "id": "uuid-action-delete", "code": "DELETE", "name": "Xóa",  "sortOrder": 4 },
    { "id": "uuid-action-export", "code": "EXPORT", "name": "Xuất", "sortOrder": 5 }
  ]
}
```

**Lỗi:**

| Mã | Nguyên nhân |
|----|-------------|
| 404 | Phân hệ không tồn tại |
| 404 | Một trong các `actionIds` không tồn tại |

---

### 12.2 Mặc định action theo loại phân hệ

Khi seed dữ liệu, hệ thống tự động gán action mặc định cho từng phân hệ:

| Phân hệ | Actions mặc định |
|---------|-----------------|
| Dashboard, Báo cáo & Thống kê | READ, EXPORT |
| Thông báo | READ |
| Cấu hình vai trò, Cơ cấu tổ chức, Cấu hình OCR, Thiết lập bot | READ, CREATE, UPDATE, DELETE |
| Cấu hình người dùng | READ, CREATE, UPDATE, DELETE, EXPORT |
| Quản lý tri thức, Kết nối dữ liệu tự động | READ, CREATE, UPDATE, DELETE, EXPORT |
| Kiểm duyệt & Phê duyệt, OCR & Chuẩn hóa | READ, UPDATE, DELETE |
| Upload tài liệu, Nhận dạng OCR | READ, CREATE, DELETE |
| Quản lý Chứng từ | READ, UPDATE, DELETE, EXPORT |
| Bot Kế toán, Bot CSKH | READ, CREATE, UPDATE, DELETE |
