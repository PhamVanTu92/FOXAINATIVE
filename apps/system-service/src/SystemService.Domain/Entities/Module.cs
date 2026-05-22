using SystemService.Domain.Common;

namespace SystemService.Domain.Entities;

/// <summary>
/// Phân hệ cụ thể trong UI (vd "Dashboard", "Cấu hình vai trò", "Quản lý tri thức", ...).
/// Mỗi module là 1 row trong grid phân quyền; có thể được gán nhiều Action qua RolePermission.
/// </summary>
public class Module : BaseEntity, IAggregateRoot
{
    public Guid GroupId { get; set; }
    public string Code { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;

    public ModuleGroup Group { get; set; } = default!;
    public ICollection<RolePermission> RolePermissions { get; set; } = new List<RolePermission>();
}
