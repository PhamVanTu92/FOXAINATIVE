using SystemService.Domain.Common;

namespace SystemService.Domain.Entities;

/// <summary>
/// Hành động phân quyền: Xem, Thêm, Sửa, Xóa, Xuất, ... (column trong grid).
/// Có thể mở rộng động (vd Approve, Export PDF, ...).
/// </summary>
public class PermissionAction : BaseEntity, IAggregateRoot
{
    public string Code { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;

    public ICollection<ModuleAction> ModuleActions { get; set; } = new List<ModuleAction>();
    public ICollection<RolePermission> RolePermissions { get; set; } = new List<RolePermission>();
    public ICollection<UserPermissionOverride> UserPermissionOverrides { get; set; } = new List<UserPermissionOverride>();
}
