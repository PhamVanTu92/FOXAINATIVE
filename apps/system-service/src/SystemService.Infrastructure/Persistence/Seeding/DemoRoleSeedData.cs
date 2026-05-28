namespace SystemService.Infrastructure.Persistence.Seeding;

/// <summary>
/// Business roles to fill demo data (beyond the 3 system roles).
/// </summary>
internal static class DemoRoleSeedData
{
    public const string KeToanTruong   = "KE_TOAN_TRUONG";
    public const string NhanVienKeToan = "NHAN_VIEN_KE_TOAN";
    public const string TruongPhong    = "TRUONG_PHONG";
    public const string NhanVienOcr    = "NHAN_VIEN_OCR";
    public const string NhanVien       = "NHAN_VIEN";

    public static readonly RoleSeedData.RoleSeed[] All =
    {
        new(KeToanTruong,   "Kế toán trưởng",       "Phụ trách kế toán và tài chính.", IsSystem: false),
        new(NhanVienKeToan, "Nhân viên kế toán",     "Xử lý chứng từ kế toán hàng ngày.", IsSystem: false),
        new(TruongPhong,    "Trưởng phòng",          "Quản lý phòng ban, phê duyệt nội dung.", IsSystem: false),
        new(NhanVienOcr,    "Nhân viên OCR",         "Vận hành pipeline nhận dạng tài liệu.", IsSystem: false),
        new(NhanVien,       "Nhân viên",             "Nhân viên tổng hợp, quyền cơ bản.", IsSystem: false),
    };

    /// <summary>
    /// Permission grants per business role: module_code → action_codes[].
    /// </summary>
    public static readonly Dictionary<string, Dictionary<string, string[]>> Grants = new()
    {
        [KeToanTruong] = new Dictionary<string, string[]>
        {
            ["DASHBOARD"]          = new[] { "READ" },
            ["REPORTS"]            = new[] { "READ", "EXPORT" },
            ["NOTIFICATIONS"]      = new[] { "READ" },
            ["USER_CONFIG"]        = new[] { "READ" },
            ["KNOWLEDGE_MGMT"]     = new[] { "READ" },
            ["KNOWLEDGE_REVIEW"]   = new[] { "READ", "UPDATE" },
            ["OCR_RECOGNIZE"]      = new[] { "READ", "CREATE", "UPDATE" },
            ["DOC_MGMT"]           = new[] { "READ", "CREATE", "UPDATE", "EXPORT" },
            ["CHATBOT_ACCOUNTING"] = new[] { "READ" },
        },

        [NhanVienKeToan] = new Dictionary<string, string[]>
        {
            ["DASHBOARD"]          = new[] { "READ" },
            ["NOTIFICATIONS"]      = new[] { "READ" },
            ["OCR_RECOGNIZE"]      = new[] { "READ", "CREATE" },
            ["DOC_MGMT"]           = new[] { "READ", "UPDATE" },
            ["CHATBOT_ACCOUNTING"] = new[] { "READ" },
        },

        [TruongPhong] = new Dictionary<string, string[]>
        {
            ["DASHBOARD"]          = new[] { "READ" },
            ["REPORTS"]            = new[] { "READ", "EXPORT" },
            ["NOTIFICATIONS"]      = new[] { "READ" },
            ["USER_CONFIG"]        = new[] { "READ" },
            ["KNOWLEDGE_MGMT"]     = new[] { "READ", "CREATE", "UPDATE" },
            ["KNOWLEDGE_REVIEW"]   = new[] { "READ", "UPDATE" },
            ["KNOWLEDGE_UPLOAD"]   = new[] { "READ", "CREATE" },
            ["OCR_RECOGNIZE"]      = new[] { "READ", "CREATE" },
            ["DOC_MGMT"]           = new[] { "READ", "CREATE", "UPDATE", "EXPORT" },
            ["CHATBOT_ACCOUNTING"] = new[] { "READ" },
            ["CHATBOT_CSKH"]       = new[] { "READ" },
        },

        [NhanVienOcr] = new Dictionary<string, string[]>
        {
            ["DASHBOARD"]      = new[] { "READ" },
            ["NOTIFICATIONS"]  = new[] { "READ" },
            ["OCR_RECOGNIZE"]  = new[] { "READ", "CREATE", "UPDATE" },
            ["OCR_NORMALIZE"]  = new[] { "READ" },
            ["DOC_MGMT"]       = new[] { "READ", "UPDATE" },
        },

        [NhanVien] = new Dictionary<string, string[]>
        {
            ["DASHBOARD"]          = new[] { "READ" },
            ["NOTIFICATIONS"]      = new[] { "READ" },
            ["DOC_MGMT"]           = new[] { "READ" },
            ["CHATBOT_ACCOUNTING"] = new[] { "READ" },
            ["CHATBOT_CSKH"]       = new[] { "READ" },
        },
    };
}
