namespace SystemService.Domain.Entities;

/// <summary>
/// Junction table cấp quyền cho Role: mỗi row = 1 ô đánh dấu trong UI grid
/// (Role được phép Action X trên Module Y).
/// </summary>
public class RolePermission
{
    public Guid RoleId { get; set; }
    public Guid ModuleId { get; set; }
    public Guid ActionId { get; set; }
    public DateTime GrantedAt { get; set; } = DateTime.UtcNow;
    public Guid? GrantedBy { get; set; }

    public Role Role { get; set; } = default!;
    public Module Module { get; set; } = default!;
    public PermissionAction Action { get; set; } = default!;
}
