# TÀI LIỆU ĐẶC TẢ NGHIỆP VỤ: QUẢN LÝ TRI THỨC

> **Mã tài liệu:** BA-KB-01
> **Phiên bản:** 1.0
> **Phân hệ:** Quản Lý Tri Thức (Knowledge Base Management)
> **Service:** `knowledge-service` (.NET 9 + EF Core + PostgreSQL)
> **Port:** gRPC 50052 · HTTP 3005

---

## 1. Tổng quan phân hệ

### 1.1. Mục đích

Phân hệ **Quản Lý Tri Thức** là kho lưu trữ tập trung tài liệu nội bộ của tổ chức, phục vụ hai mục tiêu song song:

1. **Kho tài liệu có cấu trúc:** Nhóm tài liệu thành các *bộ tri thức* theo chủ đề/phòng ban, kiểm soát quyền truy cập đến từng tệp.
2. **Nền tảng dữ liệu cho AI:** Cung cấp tài liệu cho module Chatbot AI (vector embedding) để trả lời câu hỏi của người dùng dựa trên nội dung thực tế của tổ chức.

> **Liên kết hệ thống:** Tài liệu lưu trong Quản Lý Tri Thức sẽ được nạp vào `chatbot-service` (pgvector) để phục vụ RAG (Retrieval Augmented Generation).

### 1.2. Vai trò

| Khía cạnh | Mô tả |
|---|---|
| **Tổ chức** | Gom nhóm tài liệu theo chủ đề thành các "bộ tri thức" (KB001, KB002...) |
| **Phân quyền** | Kiểm soát phòng ban nào được xem bộ tri thức / từng tệp cụ thể |
| **Chuẩn hóa** | Theo dõi loại tệp (Word/Excel/PDF/Ảnh), kích thước, ngày tải lên |
| **Tích hợp AI** | Làm nguồn dữ liệu để Chatbot AI trả lời câu hỏi nghiệp vụ |

### 1.3. Đối tượng sử dụng

| Vai trò | Quyền hạn | Tần suất |
|---|---|---|
| **Admin / Ban Giám đốc** | Toàn quyền: Tạo/Sửa/Xóa bộ tri thức, phân quyền | Trung bình |
| **Trưởng phòng** | Quản lý bộ tri thức thuộc phòng mình, tải tệp lên | Cao |
| **Nhân viên** | Xem và tải xuống tệp được phân quyền | Rất cao |
| **AI Engine** | Đọc nội dung tệp để xây dựng vector index | Tự động |

---

## 2. Luồng xử lý nghiệp vụ (Workflow)

### 2.1. Luồng quản lý bộ tri thức

```mermaid
flowchart TD
    A[Truy cập Quản lý Tri thức] --> B[Xem danh sách bộ tri thức]
    B --> C{Chọn hành động}
    C -->|Tạo mới| D[Nhập Mã, Tên, Mô tả]
    D --> E[Chọn Phòng ban quản lý]
    E --> F[Chọn Phân quyền truy cập]
    F --> G{Validate}
    G -->|Hợp lệ| H[Tạo bộ tri thức]
    G -->|Lỗi| D
    H --> I[Hiển thị card trên danh sách]
    C -->|Sửa| J[Mở modal Sửa bộ tri thức]
    J --> K[Chỉnh sửa thông tin]
    K --> L[Lưu thay đổi]
    C -->|Xóa| M{Có tệp bên trong?}
    M -->|Có| N[Cảnh báo: Xóa sẽ xóa cả tệp]
    N --> O{Xác nhận?}
    O -->|Có| P[Xóa bộ tri thức + tệp]
    O -->|Không| B
    M -->|Không| P
    C -->|Xem chi tiết| Q[Vào trang chi tiết tệp]
```

### 2.2. Luồng quản lý tệp tri thức

```mermaid
flowchart TD
    A[Vào trang chi tiết bộ tri thức] --> B[Xem danh sách tệp]
    B --> C{Chọn hành động}
    C -->|Tải lên tệp| D[Nhập Tên tệp, Loại, Kích thước]
    D --> E[Chọn Phân quyền phòng ban]
    E --> F[Thêm tệp vào bộ tri thức]
    C -->|Phân quyền| G[Mở modal Phân quyền tệp]
    G --> H[Chọn/bỏ chọn phòng ban]
    H --> I[Lưu phân quyền]
    C -->|Sửa tệp| J[Sửa thông tin tệp]
    J --> K[Lưu thay đổi]
    C -->|Xóa tệp| L[Xác nhận xóa]
    L --> M[Xóa tệp khỏi bộ tri thức]
```

---

## 3. Màn hình & Chức năng chi tiết

### 3.1. Trang Danh sách Bộ tri thức (`/tri-thuc`)

#### Thanh thống kê (Stats Bar)

| Thẻ thống kê | Mô tả | Cách tính |
|---|---|---|
| **Tổng bộ tri thức** | Tổng số bộ tri thức đang hoạt động | COUNT(knowledge_bases) |
| **Tổng tệp tri thức** | Tổng số tệp trong toàn bộ hệ thống | COUNT(knowledge_files) |
| **Phòng ban sử dụng** | Số phòng ban có ít nhất 1 bộ tri thức được phân quyền | COUNT DISTINCT(department_id) |
| **Cập nhật gần nhất** | Ngày cập nhật gần nhất của bất kỳ bộ tri thức nào | MAX(updated_at) |

#### Bộ lọc & Tìm kiếm

| Control | Loại | Mô tả |
|---|---|---|
| Ô tìm kiếm | Text input | Tìm theo tên hoặc mã bộ tri thức (ILIKE) |
| Lọc phòng ban | Dropdown | Lọc theo phòng ban quản lý hoặc phòng ban có quyền truy cập |

#### Hiển thị Card

Mỗi card bộ tri thức hiển thị:

| Thông tin | Mô tả |
|---|---|
| **Mã bộ tri thức** | # KB001 |
| **Tên** | Tri thức Kế toán – Tài chính |
| **Mô tả** | Tóm tắt nội dung |
| **Số tệp** | Icon + số tệp |
| **Ngày cập nhật** | Ngày cập nhật gần nhất |
| **Phân quyền** | Danh sách phòng ban badge (màu theo phòng ban) |
| **Thống kê loại tệp** | Word ×N, Excel ×N, PDF ×N, Ảnh ×N |

#### Nút hành động

| Nút | Hành động |
|---|---|
| **Xuất Excel** | Export danh sách bộ tri thức ra file .xlsx |
| **+ Tạo bộ tri thức** | Mở modal Tạo bộ tri thức mới |
| Click vào card | Vào trang chi tiết bộ tri thức |

---

### 3.2. Modal Tạo bộ tri thức mới

| Trường | Loại | Bắt buộc | Validation |
|---|---|---|---|
| **Mã bộ tri thức** | Text | ✅ | Unique, max 20 ký tự, chỉ chấp nhận chữ hoa + số + dấu gạch |
| **Tên bộ tri thức** | Text | ✅ | Max 200 ký tự |
| **Mô tả** | Textarea | ❌ | Max 1000 ký tự |
| **Phòng ban quản lý** | Dropdown | ✅ | Chọn 1 phòng ban từ danh sách |
| **Phân quyền truy cập** | Checkbox list | ❌ | Để trống = tất cả phòng ban được dùng |

**Quy tắc:** Mã bộ tri thức phải unique trong toàn hệ thống. Nếu trùng → hiển thị lỗi "Mã bộ tri thức đã tồn tại".

---

### 3.3. Modal Sửa bộ tri thức

Tương tự modal Tạo, nhưng:
- Tất cả trường được điền sẵn giá trị hiện tại.
- Mã bộ tri thức **không được phép thay đổi** (readonly).
- Nút hành động: **Hủy** / **Lưu**.

---

### 3.4. Trang Chi tiết bộ tri thức (`/tri-thuc/{id}`)

#### Header

| Thành phần | Mô tả |
|---|---|
| Nút **← Quay lại** | Quay về danh sách |
| **Tên bộ tri thức** | Hiển thị tên đầy đủ |
| **Mã – Quản lý bởi** | KB001 - Quản lý bởi: Phòng Kế toán - Tài chính |
| Nút **Sửa bộ tri thức** | Mở modal sửa |
| Nút **Tải lên tệp** | Mở modal tải tệp lên |

#### Thẻ thống kê tệp

4 thẻ: Word, Excel, PDF, Hình ảnh – mỗi thẻ hiển thị số tệp của loại đó.

#### Bộ lọc tệp

| Control | Mô tả |
|---|---|
| Tìm kiếm tên tệp | Text input, ILIKE |
| Lọc loại tệp | Dropdown: Tất cả / Word / Excel / PDF / Hình ảnh |

#### Bảng danh sách tệp

| Cột | Mô tả |
|---|---|
| **STT** | Số thứ tự |
| **Tên tệp** | Tên file + icon loại |
| **Loại** | Badge: Word / Excel / PDF / Hình ảnh |
| **Kích thước** | Định dạng: X.X MB |
| **Ngày tải lên** | YYYY-MM-DD |
| **Phân quyền phòng ban** | Danh sách badge phòng ban |
| **Thao tác** | 3 icon: 🔒 Phân quyền, ✏️ Sửa, 🗑️ Xóa |

---

### 3.5. Modal Tải lên tệp tri thức

| Trường | Loại | Bắt buộc | Validation |
|---|---|---|---|
| **Tên tệp** | Text | ✅ | Max 500 ký tự |
| **Loại tệp** | Dropdown | ✅ | Word / Excel / PDF / Hình ảnh |
| **Kích thước (MB)** | Number | ❌ | > 0, max 4 chữ số thập phân |
| **Phân quyền phòng ban** | Checkbox list | ❌ | Để trống = tất cả phòng ban |

> **Ghi chú:** Giai đoạn đầu chỉ lưu metadata (tên, loại, kích thước). Storage thực tế (upload file vật lý) sẽ tích hợp sau với MinIO/S3.

---

### 3.6. Modal Phân quyền tệp tri thức

- Hiển thị tên tệp đang cấu hình quyền.
- Gợi ý: "Để trống = tất cả phòng ban đều được sử dụng tệp này."
- Checkbox list các phòng ban.
- Nút: **Hủy** / **Lưu phân quyền**.

---

### 3.7. Xuất Excel

Xuất file `.xlsx` gồm 2 sheet:

**Sheet 1 – Danh sách bộ tri thức:**

| Cột | Nguồn |
|---|---|
| Mã bộ tri thức | code |
| Tên bộ tri thức | name |
| Mô tả | description |
| Phòng ban quản lý | managing_department_name |
| Số tệp | file_count |
| Ngày cập nhật | updated_at |

**Sheet 2 – Chi tiết tệp:**

| Cột | Nguồn |
|---|---|
| Mã bộ tri thức | knowledge_base.code |
| Tên bộ tri thức | knowledge_base.name |
| Tên tệp | file_name |
| Loại tệp | file_type |
| Kích thước (MB) | file_size_mb |
| Ngày tải lên | uploaded_at |

---

## 4. Đặc tả API (REST – HTTP 3005)

### 4.1. Knowledge Bases

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/api/knowledge-bases` | Danh sách (filter: search, departmentId, page, pageSize) |
| `POST` | `/api/knowledge-bases` | Tạo mới |
| `GET` | `/api/knowledge-bases/stats` | Thống kê dashboard |
| `GET` | `/api/knowledge-bases/export` | Xuất Excel (.xlsx) |
| `GET` | `/api/knowledge-bases/{id}` | Chi tiết bộ tri thức + danh sách tệp |
| `PUT` | `/api/knowledge-bases/{id}` | Cập nhật |
| `DELETE` | `/api/knowledge-bases/{id}` | Xóa (cascade xóa tệp) |

### 4.2. Knowledge Files

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/api/knowledge-bases/{kbId}/files` | Danh sách tệp (filter: search, fileType) |
| `POST` | `/api/knowledge-bases/{kbId}/files` | Thêm tệp |
| `PUT` | `/api/knowledge-bases/{kbId}/files/{fileId}` | Sửa tệp |
| `DELETE` | `/api/knowledge-bases/{kbId}/files/{fileId}` | Xóa tệp |
| `PUT` | `/api/knowledge-bases/{kbId}/files/{fileId}/permissions` | Cập nhật phân quyền tệp |

### 4.3. Departments (Read-only cache)

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/api/departments` | Danh sách phòng ban (từ System Service) |

### 4.4. Request/Response mẫu

#### POST `/api/knowledge-bases`

```json
// Request
{
  "code": "KB006",
  "name": "Tri thức Pháp lý",
  "description": "Văn bản pháp luật, quy định thuế, nghị định...",
  "managingDepartmentId": "uuid-bang-giam-doc",
  "managingDepartmentName": "Ban Giám đốc",
  "permittedDepartmentIds": ["uuid-phong-a", "uuid-phong-b"]
}

// Response 201 Created
{
  "id": "uuid-kb",
  "code": "KB006",
  "name": "Tri thức Pháp lý",
  "description": "...",
  "managingDepartmentId": "uuid-bang-giam-doc",
  "managingDepartmentName": "Ban Giám đốc",
  "permissions": [
    { "departmentId": "uuid-phong-a", "departmentName": "Phòng A" }
  ],
  "fileCounts": { "word": 0, "excel": 0, "pdf": 0, "image": 0 },
  "createdAt": "2026-05-26T10:00:00Z",
  "updatedAt": "2026-05-26T10:00:00Z"
}
```

#### GET `/api/knowledge-bases/stats`

```json
{
  "totalKnowledgeBases": 5,
  "totalFiles": 20,
  "departmentsUsingCount": 6,
  "lastUpdatedAt": "2026-05-08T00:00:00Z"
}
```

#### POST `/api/knowledge-bases/{kbId}/files`

```json
// Request
{
  "fileName": "Quy trình kế toán nội bộ 2025.docx",
  "fileType": "Word",
  "fileSizeMb": 1.8,
  "permittedDepartmentIds": ["uuid-phong-ke-toan"]
}

// Response 201 Created
{
  "id": "uuid-file",
  "knowledgeBaseId": "uuid-kb",
  "fileName": "Quy trình kế toán nội bộ 2025.docx",
  "fileType": "Word",
  "fileSizeMb": 1.8,
  "uploadedAt": "2026-04-22T00:00:00Z",
  "permissions": [
    { "departmentId": "uuid-phong-ke-toan", "departmentName": "Phòng Kế toán - Tài chính" }
  ]
}
```

---

## 5. Thiết kế cơ sở dữ liệu (PostgreSQL – `knowledge_db`)

### 5.1. Sơ đồ ERD

```
knowledge_bases
    ├── id (PK, UUID)
    ├── code (UNIQUE, VARCHAR 20)
    ├── name (VARCHAR 200)
    ├── description (TEXT, nullable)
    ├── managing_department_id (UUID)
    ├── managing_department_name (VARCHAR 200)
    ├── created_by (UUID, nullable)
    ├── created_at (TIMESTAMPTZ)
    └── updated_at (TIMESTAMPTZ)
         │
         ├─── knowledge_base_permissions (N:M phòng ban)
         │       ├── id (PK, UUID)
         │       ├── knowledge_base_id (FK)
         │       ├── department_id (UUID)
         │       └── department_name (VARCHAR 200)
         │
         └─── knowledge_files (1:N)
                 ├── id (PK, UUID)
                 ├── knowledge_base_id (FK)
                 ├── file_name (VARCHAR 500)
                 ├── file_type (ENUM: Word/Excel/PDF/Image)
                 ├── file_size_mb (DECIMAL 10,4)
                 ├── storage_path (VARCHAR 1000, nullable)
                 ├── uploaded_by (UUID, nullable)
                 ├── uploaded_at (TIMESTAMPTZ)
                 └── updated_at (TIMESTAMPTZ)
                          │
                          └─── knowledge_file_permissions (N:M phòng ban)
                                  ├── id (PK, UUID)
                                  ├── knowledge_file_id (FK)
                                  ├── department_id (UUID)
                                  └── department_name (VARCHAR 200)
```

### 5.2. Indexes

| Bảng | Index | Mục đích |
|---|---|---|
| `knowledge_bases` | `UNIQUE (code)` | Đảm bảo mã duy nhất |
| `knowledge_bases` | `INDEX (managing_department_id)` | Lọc theo phòng ban quản lý |
| `knowledge_bases` | `INDEX (updated_at DESC)` | Sắp xếp theo ngày cập nhật |
| `knowledge_base_permissions` | `INDEX (knowledge_base_id)` | Join query |
| `knowledge_base_permissions` | `INDEX (department_id)` | Lọc theo phòng ban |
| `knowledge_files` | `INDEX (knowledge_base_id)` | Lọc tệp theo bộ tri thức |
| `knowledge_files` | `INDEX (file_type)` | Lọc theo loại tệp |
| `knowledge_file_permissions` | `INDEX (knowledge_file_id)` | Join query |

---

## 6. Quy tắc nghiệp vụ (Business Rules)

### 6.1. Phân quyền

| Rule | Mô tả |
|---|---|
| **BR-001** | Nếu `permissions` của bộ tri thức rỗng → tất cả phòng ban đều có quyền xem |
| **BR-002** | Nếu `permissions` của bộ tri thức không rỗng → chỉ phòng ban được chọn mới xem được |
| **BR-003** | Phân quyền tệp (file permissions) **ghi đè** phân quyền bộ tri thức. Người dùng phải có quyền ở cả bộ tri thức VÀ tệp (nếu tệp có phân quyền riêng) |
| **BR-004** | Nếu `file permissions` rỗng → áp dụng phân quyền của bộ tri thức cha |

### 6.2. Quản lý tệp

| Rule | Mô tả |
|---|---|
| **BR-005** | Mã bộ tri thức phải unique, không thay đổi sau khi tạo |
| **BR-006** | Xóa bộ tri thức → cascade xóa tất cả tệp và phân quyền liên quan |
| **BR-007** | Kích thước tệp là thông tin nhập tay (metadata), không validate thực tế trong giai đoạn 1 |
| **BR-008** | Không giới hạn số tệp trong 1 bộ tri thức |

### 6.3. Thống kê

| Rule | Mô tả |
|---|---|
| **BR-009** | "Phòng ban sử dụng" = DISTINCT số phòng ban có quyền truy cập bất kỳ bộ tri thức nào (bao gồm phòng ban quản lý) |
| **BR-010** | "Cập nhật gần nhất" = MAX(updated_at) của toàn bộ knowledge_bases |

---

## 7. Đặc tả gRPC (Inter-service)

Service `knowledge-service` expose gRPC tại port **50052** để API Gateway proxy:

```protobuf
service KnowledgeService {
  // Knowledge Bases
  rpc ListKnowledgeBases(ListKnowledgeBasesRequest) returns (ListKnowledgeBasesResponse);
  rpc GetKnowledgeBase(GetKnowledgeBaseRequest) returns (KnowledgeBaseResponse);
  rpc CreateKnowledgeBase(CreateKnowledgeBaseRequest) returns (KnowledgeBaseResponse);
  rpc UpdateKnowledgeBase(UpdateKnowledgeBaseRequest) returns (KnowledgeBaseResponse);
  rpc DeleteKnowledgeBase(DeleteKnowledgeBaseRequest) returns (DeleteResponse);
  rpc GetStats(GetStatsRequest) returns (StatsResponse);

  // Knowledge Files
  rpc ListKnowledgeFiles(ListKnowledgeFilesRequest) returns (ListKnowledgeFilesResponse);
  rpc AddKnowledgeFile(AddKnowledgeFileRequest) returns (KnowledgeFileResponse);
  rpc UpdateKnowledgeFile(UpdateKnowledgeFileRequest) returns (KnowledgeFileResponse);
  rpc DeleteKnowledgeFile(DeleteKnowledgeFileRequest) returns (DeleteResponse);
  rpc UpdateFilePermissions(UpdateFilePermissionsRequest) returns (KnowledgeFileResponse);
}
```

---

## 8. Yêu cầu phi chức năng

| Yêu cầu | Mô tả |
|---|---|
| **Hiệu năng** | API danh sách phản hồi < 200ms (pagination mặc định 20 items/trang) |
| **Bảo mật** | Tất cả endpoint yêu cầu JWT bearer token hợp lệ từ system-service |
| **Logging** | Serilog ghi log theo chuẩn structured logging (request/response, exception) |
| **Health Check** | Endpoint `/health` kiểm tra kết nối PostgreSQL |
| **Migration** | Auto-migrate khi khởi động (môi trường Development và khi KNOWLEDGE_SERVICE_AUTOMIGRATE=true) |
| **Seeding** | Seed dữ liệu mẫu 5 bộ tri thức + 20 tệp khi KNOWLEDGE_SERVICE_SEED=true |

---

## 9. Cấu hình & Triển khai

### 9.1. Environment Variables

| Biến | Mô tả | Giá trị mẫu |
|---|---|---|
| `KNOWLEDGE_DATABASE_URL` | PostgreSQL connection string (native) | `postgresql://kb_user:kb_pass@localhost:5435/knowledge_db` |
| `KNOWLEDGE_DATABASE_URL_DOCKER` | PostgreSQL connection string (Docker) | `postgresql://kb_user:kb_pass@knowledge-db:5432/knowledge_db` |
| `GRPC_PORT` | gRPC port | `50052` |
| `HTTP_PORT` | HTTP port | `3005` |
| `KNOWLEDGE_SERVICE_AUTOMIGRATE` | Tự động chạy migration | `true` |
| `KNOWLEDGE_SERVICE_SEED` | Seed dữ liệu mẫu | `true` |

### 9.2. Docker Compose

- **Service:** `knowledge-service`
- **Database:** `knowledge-db` (PostgreSQL 16, host port 5435)
- **Depends on:** `knowledge-db`
- **Host ports:** `52052:50052` (gRPC), `3005:3005` (HTTP)

---

## 10. Kế hoạch phát triển

### Giai đoạn 1 (Sprint hiện tại)
- [x] Đặc tả nghiệp vụ
- [ ] knowledge-service: Domain + Application + Infrastructure + Api
- [ ] CRUD bộ tri thức + tệp (metadata only)
- [ ] Phân quyền theo phòng ban
- [ ] Seeding dữ liệu mẫu

### Giai đoạn 2
- [ ] Upload file vật lý (MinIO/S3 integration)
- [ ] API Gateway proxy routes `/tri-thuc/*`
- [ ] Web Portal UI implementation

### Giai đoạn 3
- [ ] Tích hợp chatbot-service (vector embedding khi tệp được upload)
- [ ] Export Excel với ClosedXML
- [ ] Full-text search (pg_trgm)
