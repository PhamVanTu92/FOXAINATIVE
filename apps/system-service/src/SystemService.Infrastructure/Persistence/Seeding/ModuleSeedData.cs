namespace SystemService.Infrastructure.Persistence.Seeding;

/// <summary>
/// Cấu trúc menu / phân hệ mặc định, khớp với UI Web Portal (xem screenshot "Cấu hình vai trò").
/// </summary>
internal static class ModuleSeedData
{
    public static readonly GroupSeed[] Groups =
    {
        new("OVERVIEW", "Tổng quan", "Dashboard và báo cáo tổng hợp.", 10, new ModuleSeed[]
        {
            new("DASHBOARD",     "Dashboard",         "Bảng điều khiển tổng quan.",     10),
            new("REPORTS",       "Báo cáo & Thống kê", "Báo cáo nghiệp vụ & thống kê.", 20),
            new("NOTIFICATIONS", "Thông báo",         "Thông báo hệ thống.",            30),
        }),

        new("SYSTEM_CONFIG", "Cấu hình hệ thống", "Quản trị người dùng, vai trò, tổ chức.", 20, new ModuleSeed[]
        {
            new("ROLE_CONFIG",        "Cấu hình vai trò",       "RBAC: vai trò + ma trận phân quyền.", 10),
            new("USER_CONFIG",        "Cấu hình người dùng",    "Quản lý tài khoản người dùng.",        20),
            new("ORG_STRUCTURE",      "Cơ cấu tổ chức",         "Cây tổ chức / phòng ban.",             30),
            new("OCR_CONFIG",         "Cấu hình OCR",           "Thiết lập schema chứng từ OCR.",       40),
            new("CHATBOT_CONFIG",     "Thiết lập bot hội thoại", "Cấu hình bot AI hội thoại.",          50),
        }),

        new("AI_KNOWLEDGE", "Tri thức AI", "Quản lý knowledge base và pipelines AI.", 30, new ModuleSeed[]
        {
            new("KNOWLEDGE_MGMT",   "Quản lý tri thức",         "Quản lý tài liệu knowledge base.",      10),
            new("KNOWLEDGE_REVIEW", "Kiểm duyệt & Phê duyệt",   "Workflow phê duyệt nội dung tri thức.", 20),
            new("KNOWLEDGE_UPLOAD", "Upload tài liệu",          "Upload nguồn dữ liệu vào knowledge base.", 30),
            new("DATA_AUTO_SYNC",   "Kết nối dữ liệu tự động",  "Tích hợp + sync dữ liệu nguồn ngoài.",  40),
            new("OCR_NORMALIZE",    "OCR & Chuẩn hóa nội dung", "Xử lý OCR + chuẩn hóa nội dung trước khi index.", 50),
        }),

        new("DOC_PROCESS", "Xử lý tài liệu", "Pipeline OCR và quản lý chứng từ.", 40, new ModuleSeed[]
        {
            new("OCR_RECOGNIZE", "Nhận dạng OCR",     "Chạy OCR trên file / ảnh.",            10),
            new("DOC_MGMT",      "Quản lý Chứng từ",  "Tra cứu + duyệt chứng từ đã OCR.",     20),
        }),

        new("CHATBOT_AI", "Chatbot AI thông minh", "Các bot hội thoại nội bộ.", 50, new ModuleSeed[]
        {
            new("CHATBOT_ACCOUNTING", "Bot Kế toán Nội bộ", "Bot phục vụ phòng kế toán.",   10),
            new("CHATBOT_CSKH",       "Bot CSKH - Kinh doanh", "Bot phục vụ kinh doanh & CSKH.", 20),
        }),
    };

    public sealed record GroupSeed(string Code, string Name, string Description, int SortOrder, ModuleSeed[] Modules);
    public sealed record ModuleSeed(string Code, string Name, string Description, int SortOrder);
}
