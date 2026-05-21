# TÀI LIỆU ĐẶC TẢ NGHIỆP VỤ: QUẢN LÝ DANH SÁCH CHỨNG TỪ

> **Mã tài liệu:** BA-OCR-03
> **Phiên bản:** 1.0
> **Phân hệ:** Quản lý vòng đời Chứng từ (Document Lifecycle Management)
> **Vai trò trong hệ thống:** Module Quản trị & Tích hợp (Governance & Integration Layer)

---

## 1. Tổng quan phân hệ

### 1.1. Mục đích
Phân hệ **Quản lý Chứng từ** là **điểm tập kết cuối cùng** của toàn bộ luồng OCR. Đây là nơi lưu trữ tập trung toàn bộ chứng từ đã được số hóa từ phân hệ [[Nhan_dang_Chung_tu_OCR]], đồng thời là nơi diễn ra các hoạt động:
- **Tra cứu & Lọc** chứng từ theo nhiều tiêu chí.
- **Phê duyệt vòng đời** chứng từ (Nháp → Xác nhận → Chuyển kho).
- **Kết xuất dữ liệu** ra Excel để báo cáo, đối soát.
- **Đẩy vào Kho tri thức / ERP** để phục vụ phân tích và tích hợp downstream.

> **Triết lý nghiệp vụ:** "Một chứng từ chỉ thực sự có giá trị khi nó được tra cứu được, phê duyệt được, và sử dụng được trong hệ thống lớn hơn."

### 1.2. Vai trò
- **Single Source of Truth (SSoT):** Là nguồn dữ liệu chính thống về chứng từ đã số hóa.
- **Kiểm soát chất lượng:** Cơ chế trạng thái giúp tách bạch dữ liệu thô (chưa duyệt) khỏi dữ liệu chính thức.
- **Cầu nối tích hợp:** Đầu nối với ERP, DMS, BI và AI Knowledge Base.

### 1.3. Đối tượng sử dụng

| Vai trò | Quyền hạn | Mô tả |
|---|---|---|
| **Kế toán trưởng** | Xem + Phê duyệt + Chuyển kho + Export | Người ra quyết định cuối về tính hợp lệ của chứng từ. |
| **Quản lý Tài chính (CFO/FA)** | Xem + Export | Sử dụng dữ liệu để phân tích, ra báo cáo. |
| **Admin hệ thống** | Toàn quyền | Quản trị, sửa lỗi, audit log. |
| **Nhân viên kế toán** | Xem + Sửa chứng từ Nháp | Hoàn thiện chứng từ trước khi trình duyệt. |

---

## 2. Đặc tả Vòng đời & Trạng thái chứng từ (Document Lifecycle Statuses)

> Vòng đời chứng từ được thiết kế theo nguyên tắc **một chiều (one-way)** – mỗi bước tiến lên đều khóa khả năng quay lại để đảm bảo tính toàn vẹn (data integrity).

```
   ┌─────────┐         ┌─────────────┐         ┌──────────────────┐
   │ 🟡 Nháp │ ───────▶│ 🟢 Đã xác   │ ───────▶│ 🔵 Đã chuyển kho │
   │  Draft  │         │   nhận      │         │   Processed      │
   │         │         │  Confirmed  │         │                  │
   └─────────┘         └─────────────┘         └──────────────────┘
   ✏️ Sửa/Xóa         🔒 Khóa Sửa/Xóa        🔒 Bất biến hoàn toàn
```

### 2.1. 🟡 Trạng thái **Nháp (Draft)**

| Thuộc tính | Chi tiết |
|---|---|
| **Định nghĩa** | Trạng thái khởi tạo – AI vừa quét xong và lưu lại, hoặc người dùng đã lưu nhưng chưa xác nhận. |
| **Quyền thao tác** | ✅ Xem  ✅ Sửa  ✅ Xóa  ✅ Chuyển sang `Đã xác nhận`  ❌ Không thể chuyển kho |
| **Mục đích nghiệp vụ** | Cho phép kế toán hoàn thiện dữ liệu trước khi trình duyệt. |
| **Hiển thị** | Badge màu vàng/xám với chữ `Nháp` |

### 2.2. 🟢 Trạng thái **Đã xác nhận (Confirmed)**

| Thuộc tính | Chi tiết |
|---|---|
| **Định nghĩa** | Người có thẩm quyền đã review và xác nhận tính chính xác của dữ liệu. |
| **Quyền thao tác** | ✅ Xem  ❌ **Khóa Sửa**  ❌ **Khóa Xóa**  ✅ Chuyển sang `Đã chuyển kho`  ✅ Export Excel |
| **Mục đích nghiệp vụ** | **Bảo vệ tính toàn vẹn (Data Integrity)** – ngăn chỉnh sửa số liệu đã được xác thực. |
| **Hiển thị** | Badge màu xanh lá với chữ `Đã xác nhận` |

> **⚠️ Lưu ý nghiệp vụ:** Để sửa chứng từ ở trạng thái này, người dùng phải có quyền `Admin` và phải `Revert về Nháp` qua audit log – mọi thay đổi đều được lưu vết.

### 2.3. 🔵 Trạng thái **Đã chuyển kho (Processed / Integrated)**

| Thuộc tính | Chi tiết |
|---|---|
| **Định nghĩa** | Chứng từ đã được đồng bộ thành công sang hệ thống ERP / Kho tri thức / DMS bên ngoài. |
| **Quyền thao tác** | ✅ Xem  ❌ Sửa  ❌ Xóa  ❌ Không thể đổi trạng thái  ✅ Export Excel (read-only) |
| **Mục đích nghiệp vụ** | **Bất biến (Immutable)** – đảm bảo tính nhất quán giữa hệ thống OCR và hệ thống đích. |
| **Hiển thị** | Badge màu xanh dương với chữ `Đã chuyển kho` |

> **🔒 Quy tắc bảo toàn:** Khi chứng từ đã ở trạng thái này, mọi sửa đổi phải thực hiện ở **hệ thống đích (ERP)**, không thực hiện ngược tại hệ thống OCR.

---

## 3. Bộ lọc nâng cao & Tìm kiếm thông minh (Advanced Filter & Smart Search)

### 3.1. Tìm kiếm đa năng (Universal Search)

| Tiêu chí | Hành vi |
|---|---|
| **Phạm vi tìm kiếm** | Tìm theo **Mã chứng từ** hoặc **Tên chứng từ** (full-text search). |
| **Cơ chế** | Tìm kiếm **fuzzy matching** – không phân biệt hoa thường, không cần khớp 100%. |
| **Realtime** | Kết quả update ngay khi gõ (debounce 300ms để tránh quá tải). |
| **Highlight** | Từ khóa được highlight màu vàng trong bảng kết quả. |

### 3.2. Bộ lọc kết hợp (Combined Filters)

Cho phép kết hợp nhiều bộ lọc song song để thu hẹp kết quả:

| Bộ lọc | Loại | Giá trị |
|---|---|---|
| **Loại chứng từ** | Dropdown | `Hóa đơn`, `Phiếu thu`, `Phiếu chi`, `Hợp đồng`, `Bảng kê`, `Tất cả` |
| **Trạng thái** | Multi-select | `Nháp`, `Đã xác nhận`, `Đã chuyển kho` (có thể chọn nhiều) |
| **Khoảng thời gian** | Date Range | Lọc theo ngày tạo hoặc ngày phát hành chứng từ. |
| **Người tạo** | Dropdown | Lọc theo nhân viên đã tải lên. |
| **Mã số thuế người bán** | Textbox | Tìm chính xác nhà cung cấp. |

> **Quy tắc lọc kết hợp:** Các bộ lọc áp dụng theo logic `AND` (giao). Ví dụ: `Loại = Hóa đơn` **AND** `Trạng thái = Nháp` **AND** `Tháng 5/2026`.

### 3.3. Lưu bộ lọc yêu thích (Saved Filters)
- Cho phép người dùng lưu lại tổ hợp bộ lọc thường dùng (VD: "Hóa đơn Nháp tháng này").
- Truy cập nhanh qua dropdown `Bộ lọc đã lưu`.

---

## 4. Thao tác dữ liệu lớn (Bulk Actions)

### 4.1. Cơ chế chọn hàng loạt
| Thành phần | Mô tả |
|---|---|
| **Checkbox đầu mỗi dòng** | Cho phép chọn từng chứng từ riêng lẻ. |
| **Checkbox header (Select All)** | Chọn tất cả chứng từ trên trang hiện tại. |
| **Tùy chọn "Chọn tất cả X bản ghi đang lọc"** | Khi click Select All, hệ thống gợi ý mở rộng chọn toàn bộ kết quả lọc (không chỉ trang hiện tại). |
| **Bộ đếm** | Hiển thị `Đã chọn N chứng từ` ở thanh action. |

### 4.2. Các tác vụ Bulk được hỗ trợ

| Tác vụ | Điều kiện áp dụng | Mô tả |
|---|---|---|
| **🗑️ Xóa hàng loạt** | Chỉ áp dụng cho chứng từ **Nháp** | Xóa nhiều chứng từ Nháp cùng lúc. Có cảnh báo confirm. |
| **✅ Xác nhận hàng loạt** | Chỉ áp dụng cho chứng từ **Nháp** + không có lỗi logic | Chuyển nhiều chứng từ từ Nháp → Đã xác nhận. |
| **📤 Xuất Excel hàng loạt** | Áp dụng mọi trạng thái | Tải về file Excel chứa tất cả chứng từ đã chọn. |
| **📦 Chuyển vào kho tri thức** | Chỉ áp dụng cho chứng từ **Đã xác nhận** | Đẩy đồng bộ sang DMS/AI Knowledge Base. |

> **⚠️ Quy tắc kiểm tra:** Khi tác vụ Bulk gặp chứng từ không đủ điều kiện (VD: chứng từ Đã xác nhận trong danh sách Xóa), hệ thống **báo cáo riêng** các bản ghi thất bại thay vì hủy toàn bộ.

---

## 5. Kết xuất dữ liệu & Giá trị tích hợp hệ thống (Data Export & Integration)

### 5.1. Tính năng Xuất dữ liệu ra Excel (Excel Export)

#### 5.1.1. Cấu trúc file Excel xuất ra
File `.xlsx` gồm **2 sheet** liên kết, đảm bảo cấu trúc Master-Detail:

**📄 Sheet 1: `Master_Data`** – Dữ liệu cấp chứng từ (1 dòng = 1 chứng từ)

| Cột | Tên cột | Kiểu dữ liệu |
|---|---|---|
| A | Mã chứng từ | Text |
| B | Loại chứng từ | Text |
| C | Số hóa đơn | Text |
| D | Ngày phát hành | Date |
| E | Mã số thuế người bán | Text |
| F | Tên người bán | Text |
| G | Tổng tiền hàng | Number |
| H | Tiền thuế VAT | Number |
| I | Tổng thanh toán | Number |
| J | Trạng thái | Text |
| K | Người tạo | Text |
| L | Ngày tạo | DateTime |

**📄 Sheet 2: `Line_Items`** – Chi tiết hàng hóa (N dòng/chứng từ, liên kết qua Mã chứng từ)

| Cột | Tên cột | Kiểu dữ liệu |
|---|---|---|
| A | Mã chứng từ (FK) | Text |
| B | STT | Number |
| C | Tên hàng hóa/dịch vụ | Text |
| D | ĐVT | Text |
| E | Số lượng | Number |
| F | Đơn giá | Number |
| G | Thành tiền | Number |

#### 5.1.2. Tính năng nâng cao của Export
- **Định dạng số tiền:** Áp dụng format `#,##0` cho cột tiền tệ.
- **Format ngày:** `dd/MM/yyyy` thống nhất.
- **Freeze pane:** Cố định hàng tiêu đề.
- **Filter sẵn:** Bật AutoFilter trên hàng tiêu đề.
- **Hyperlink:** Cột `Mã chứng từ` ở sheet `Line_Items` link sang sheet `Master_Data` để tra cứu nhanh.

> **Giá trị nghiệp vụ:** Kế toán có thể dùng file Excel này để đối soát với báo cáo thuế, kê khai VAT, hoặc import vào phần mềm kế toán Misa/Fast.

### 5.2. Tính năng "Chuyển vào kho tri thức" (Push to Knowledge Base)

> Đây là tính năng **chiến lược** – biến dữ liệu OCR thành **tài sản tri thức của doanh nghiệp**.

#### 5.2.1. Định nghĩa nghiệp vụ
"Chuyển vào kho tri thức" là hành động đẩy chứng từ đã xác nhận vào hệ thống:
- **DMS (Document Management System):** Lưu trữ file gốc + metadata có thể tra cứu.
- **AI Knowledge Base (Vector DB):** Index dữ liệu chứng từ thành vector embedding, sẵn sàng cho tìm kiếm ngữ nghĩa và RAG (Retrieval Augmented Generation).

#### 5.2.2. Luồng xử lý ngầm

```
[Chứng từ Đã xác nhận]
        │
        ├──▶ [DMS] Lưu file gốc + metadata structured
        │
        ├──▶ [Data Warehouse] Đẩy vào BI để phân tích xu hướng chi tiêu
        │
        ├──▶ [Vector DB] Embedding nội dung → tìm kiếm ngữ nghĩa
        │
        └──▶ [ERP] (tùy chọn) Đồng bộ sang hệ thống kế toán
        
   ✅ Trạng thái chứng từ tự động chuyển: Đã xác nhận → Đã chuyển kho
```

#### 5.2.3. Giá trị mang lại (Business Value)

| Giá trị | Ứng dụng thực tế |
|---|---|
| **Phân tích xu hướng chi tiêu** | Trả lời câu hỏi: "Tháng nào chi tiêu cho NCC X cao nhất?", "Chi phí thiết bị tăng/giảm bao nhiêu %?" |
| **Tìm kiếm ngữ nghĩa (Semantic Search)** | Người dùng có thể hỏi: *"Tìm các hóa đơn mua văn phòng phẩm trên 5 triệu trong Q1"* – AI hiểu ngữ nghĩa và trả lời. |
| **Phát hiện bất thường (Anomaly Detection)** | AI cảnh báo chứng từ có giá trị bất thường (cao hơn 3 lần trung bình NCC). |
| **Phát hiện chứng từ trùng** | So sánh embedding để tránh nhập trùng hóa đơn. |
| **Báo cáo tự động** | AI tổng hợp báo cáo chi tiêu hàng tháng từ kho tri thức. |
| **Tích hợp Chatbot nội bộ** | Nhân viên hỏi: *"Cho tôi xem hóa đơn của công ty ABC tháng 4"* – chatbot trả lời ngay. |

#### 5.2.4. Điều kiện thực hiện

| Điều kiện | Kiểm tra |
|---|---|
| **Trạng thái chứng từ** | Phải là `Đã xác nhận`. |
| **Tính đầy đủ dữ liệu** | Không có trường bắt buộc nào rỗng. |
| **Ràng buộc số học** | `Tổng tiền + Thuế = Thanh toán` phải hợp lệ. |
| **Không trùng lặp** | Hệ thống tự check trùng Số hóa đơn + MST trước khi đẩy. |

> **🚀 Kết quả cuối cùng:** Sau khi `Chuyển vào kho tri thức` thành công, chứng từ chuyển sang trạng thái `Đã chuyển kho` và trở thành **bất biến**, đồng thời dữ liệu của nó đã có mặt và sẵn sàng phục vụ phân tích trong hệ thống Kho tri thức của doanh nghiệp.

---

> 📌 **Tài liệu liên quan:**
> - [[Thiet_lap_Chung_tu_OCR]] – Cung cấp schema để chứng từ tuân thủ cấu trúc thống nhất.
> - [[Nhan_dang_Chung_tu_OCR]] – Nguồn cung cấp chứng từ đã số hóa cho phân hệ này.

---

## 📋 Tổng kết luồng End-to-End

```
┌──────────────────────┐    ┌──────────────────────┐    ┌──────────────────────┐
│  Màn hình 1:         │    │  Màn hình 2:         │    │  Màn hình 3:         │
│  THIẾT LẬP OCR       │───▶│  NHẬN DẠNG OCR       │───▶│  QUẢN LÝ CHỨNG TỪ    │
│                      │    │                      │    │                      │
│  • Tạo Schema mẫu    │    │  • Upload file       │    │  • Lưu trữ tập trung │
│  • Định nghĩa trường │    │  • AI quét + bóc tách│    │  • Phê duyệt vòng đời│
│  • Cấu hình Header/  │    │  • Người dùng đối    │    │  • Export Excel      │
│    Footer            │    │    chiếu/sửa         │    │  • Đẩy Kho tri thức  │
│                      │    │  • Xác nhận          │    │                      │
└──────────────────────┘    └──────────────────────┘    └──────────────────────┘
        Admin                Nhân viên Kế toán          Kế toán trưởng / FA / Admin
```
