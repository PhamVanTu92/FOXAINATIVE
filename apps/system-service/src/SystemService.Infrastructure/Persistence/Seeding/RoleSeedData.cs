namespace SystemService.Infrastructure.Persistence.Seeding;

internal static class RoleSeedData
{
    public const string SuperAdminCode = "SUPER_ADMIN";
    public const string AdminCode = "ADMIN";
    public const string UserCode = "USER";

    public static readonly RoleSeed[] All =
    {
        new(SuperAdminCode, "Super Admin", "Toàn quyền hệ thống, không thể xóa.", IsSystem: true),
        new(AdminCode, "Administrator", "Quản trị nghiệp vụ, không có quyền SYSTEM_ADMIN.", IsSystem: true),
        new(UserCode, "End User", "Người dùng cơ bản, chỉ truy cập đọc.", IsSystem: true),
    };

    public static readonly Dictionary<string, string[]> RolePermissions = new()
    {
        [SuperAdminCode] = new[]
        {
            "USER_CREATE", "USER_READ", "USER_UPDATE", "USER_DELETE", "USER_CHANGE_STATUS", "USER_ASSIGN_ROLE",
            "ROLE_CREATE", "ROLE_READ", "ROLE_UPDATE", "ROLE_DELETE", "ROLE_ASSIGN_PERMISSION",
            "PERMISSION_READ",
            "ORG_CREATE", "ORG_READ", "ORG_UPDATE", "ORG_DELETE", "ORG_MOVE",
            "OCR_SCHEMA_MANAGE", "OCR_DOCUMENT_READ", "OCR_DOCUMENT_APPROVE",
            "CHATBOT_KB_MANAGE", "CHATBOT_KB_APPROVE", "CHATBOT_CHAT",
            "SYSTEM_ADMIN",
        },
        [AdminCode] = new[]
        {
            "USER_CREATE", "USER_READ", "USER_UPDATE", "USER_CHANGE_STATUS", "USER_ASSIGN_ROLE",
            "ROLE_READ", "ROLE_UPDATE", "ROLE_ASSIGN_PERMISSION",
            "PERMISSION_READ",
            "ORG_CREATE", "ORG_READ", "ORG_UPDATE", "ORG_MOVE",
            "OCR_SCHEMA_MANAGE", "OCR_DOCUMENT_READ", "OCR_DOCUMENT_APPROVE",
            "CHATBOT_KB_MANAGE", "CHATBOT_KB_APPROVE", "CHATBOT_CHAT",
        },
        [UserCode] = new[]
        {
            "USER_READ", "ROLE_READ", "PERMISSION_READ", "ORG_READ",
            "OCR_DOCUMENT_READ", "CHATBOT_CHAT",
        },
    };

    public sealed record RoleSeed(string Code, string Name, string Description, bool IsSystem);
}
