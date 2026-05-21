using SystemService.Domain.Entities;

namespace SystemService.Infrastructure.Persistence.Seeding;

internal static class PermissionSeedData
{
    public static IReadOnlyList<Permission> All { get; } = new[]
    {
        Make("USER_CREATE", "Tạo người dùng", "USER", "CREATE", "User"),
        Make("USER_READ", "Xem người dùng", "USER", "READ", "User"),
        Make("USER_UPDATE", "Sửa người dùng", "USER", "UPDATE", "User"),
        Make("USER_DELETE", "Xóa người dùng", "USER", "DELETE", "User"),
        Make("USER_CHANGE_STATUS", "Đổi trạng thái người dùng", "USER", "UPDATE", "UserStatus"),
        Make("USER_ASSIGN_ROLE", "Gán vai trò cho người dùng", "USER", "UPDATE", "UserRole"),

        Make("ROLE_CREATE", "Tạo vai trò", "ROLE", "CREATE", "Role"),
        Make("ROLE_READ", "Xem vai trò", "ROLE", "READ", "Role"),
        Make("ROLE_UPDATE", "Sửa vai trò", "ROLE", "UPDATE", "Role"),
        Make("ROLE_DELETE", "Xóa vai trò", "ROLE", "DELETE", "Role"),
        Make("ROLE_ASSIGN_PERMISSION", "Gán quyền cho vai trò", "ROLE", "UPDATE", "RolePermission"),

        Make("PERMISSION_READ", "Xem danh sách quyền", "PERMISSION", "READ", "Permission"),

        Make("ORG_CREATE", "Tạo đơn vị tổ chức", "ORG", "CREATE", "Organization"),
        Make("ORG_READ", "Xem cơ cấu tổ chức", "ORG", "READ", "Organization"),
        Make("ORG_UPDATE", "Sửa đơn vị tổ chức", "ORG", "UPDATE", "Organization"),
        Make("ORG_DELETE", "Xóa đơn vị tổ chức", "ORG", "DELETE", "Organization"),
        Make("ORG_MOVE", "Di chuyển đơn vị tổ chức", "ORG", "UPDATE", "OrganizationTree"),

        Make("OCR_SCHEMA_MANAGE", "Quản lý schema OCR", "OCR", "MANAGE", "Schema"),
        Make("OCR_DOCUMENT_READ", "Xem chứng từ OCR", "OCR", "READ", "Document"),
        Make("OCR_DOCUMENT_APPROVE", "Phê duyệt chứng từ OCR", "OCR", "APPROVE", "Document"),

        Make("CHATBOT_KB_MANAGE", "Quản lý Knowledge Base", "CHATBOT", "MANAGE", "KnowledgeBase"),
        Make("CHATBOT_KB_APPROVE", "Phê duyệt nội dung Knowledge Base", "CHATBOT", "APPROVE", "KnowledgeBase"),
        Make("CHATBOT_CHAT", "Sử dụng Chatbot AI", "CHATBOT", "EXECUTE", "Chat"),

        Make("SYSTEM_ADMIN", "Quyền quản trị toàn hệ thống", "SYSTEM", "ADMIN", "System"),
    };

    private static Permission Make(string code, string name, string module, string action, string resource) => new()
    {
        Code = code,
        Name = name,
        Module = module,
        Action = action,
        Resource = resource,
    };
}
