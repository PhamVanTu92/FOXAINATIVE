namespace SystemService.Domain.Entities;

/// <summary>
/// Bảng liên kết xác định Module được phép sử dụng những Action nào trong UI phân quyền.
/// Ví dụ: Module "Dashboard" chỉ có READ + EXPORT; Module "Cấu hình vai trò" có đầy đủ CRUD.
/// </summary>
public class ModuleAction
{
    public Guid ModuleId { get; set; }
    public Guid ActionId { get; set; }

    public Module Module { get; set; } = default!;
    public PermissionAction Action { get; set; } = default!;
}
