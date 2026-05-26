namespace SystemService.Infrastructure.Persistence.Seeding;

internal static class RoleSeedData
{
    public const string SuperAdminCode = "SUPER_ADMIN";
    public const string AdminCode = "ADMIN";
    public const string UserCode = "USER";

    public static readonly RoleSeed[] All =
    {
        new(SuperAdminCode, "Super Admin", "Toàn quyền hệ thống, không thể xóa.", IsSystem: true),
        new(AdminCode, "Administrator", "Quản trị nghiệp vụ.", IsSystem: true),
        new(UserCode, "End User", "Người dùng cơ bản, chỉ truy cập đọc.", IsSystem: true),
    };

    /// <summary>
    /// Default grants per role: code role → spec (cell trong UI grid).
    /// - SUPER_ADMIN: GrantAll = mọi (module × action).
    /// - ADMIN: cấp cụ thể, không Xóa cấu hình hệ thống.
    /// - USER: chỉ Xem.
    /// </summary>
    public static readonly Dictionary<string, RoleGrantSpec> Grants = new()
    {
        [SuperAdminCode] = new RoleGrantSpec(GrantAll: true, Specific: new Dictionary<string, string[]>()),
        [AdminCode] = new RoleGrantSpec(
            GrantAll: false,
            Specific: new Dictionary<string, string[]>
            {
                ["DASHBOARD"]            = new[] { "READ" },
                ["REPORTS"]              = new[] { "READ", "EXPORT" },
                ["NOTIFICATIONS"]        = new[] { "READ" },
                ["ROLE_CONFIG"]          = new[] { "READ" },
                ["USER_CONFIG"]          = new[] { "READ", "CREATE", "UPDATE" },
                ["ORG_STRUCTURE"]        = new[] { "READ", "CREATE", "UPDATE" },
                ["OCR_CONFIG"]           = new[] { "READ", "CREATE", "UPDATE" },
                ["CHATBOT_CONFIG"]       = new[] { "READ", "CREATE", "UPDATE" },
                ["KNOWLEDGE_MGMT"]       = new[] { "READ", "CREATE", "UPDATE", "DELETE" },
                ["KNOWLEDGE_REVIEW"]     = new[] { "READ", "UPDATE" },
                ["KNOWLEDGE_UPLOAD"]     = new[] { "READ", "CREATE" },
                ["DATA_AUTO_SYNC"]       = new[] { "READ", "CREATE", "UPDATE" },
                ["OCR_NORMALIZE"]        = new[] { "READ", "UPDATE" },
                ["OCR_RECOGNIZE"]        = new[] { "READ", "CREATE" },
                ["DOC_MGMT"]             = new[] { "READ", "UPDATE", "EXPORT" },
                ["CHATBOT_ACCOUNTING"]   = new[] { "READ" },
                ["CHATBOT_CSKH"]         = new[] { "READ" },
            }),
        [UserCode] = new RoleGrantSpec(
            GrantAll: false,
            Specific: new Dictionary<string, string[]>
            {
                ["DASHBOARD"]          = new[] { "READ" },
                ["REPORTS"]            = new[] { "READ" },
                ["NOTIFICATIONS"]      = new[] { "READ" },
                ["KNOWLEDGE_MGMT"]     = new[] { "READ" },
                ["DOC_MGMT"]           = new[] { "READ" },
                ["CHATBOT_ACCOUNTING"] = new[] { "READ" },
                ["CHATBOT_CSKH"]       = new[] { "READ" },
            }),
    };

    public sealed record RoleSeed(string Code, string Name, string Description, bool IsSystem);

    /// <summary>
    /// GrantAll = true → cấp tất cả (module × action) hiện có trong DB.
    /// GrantAll = false → chỉ cấp các cell trong Specific dictionary (module_code → action_codes[]).
    /// </summary>
    public sealed record RoleGrantSpec(bool GrantAll, Dictionary<string, string[]> Specific);
}
