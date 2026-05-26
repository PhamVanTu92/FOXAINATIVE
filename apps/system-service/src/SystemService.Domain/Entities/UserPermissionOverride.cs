using SystemService.Domain.Enums;

namespace SystemService.Domain.Entities;

/// <summary>
/// Quyền cá nhân ghi đè role: mỗi row = 1 ô trong grid phân quyền của user.
/// Composite PK (user_id, module_id, action_id) — không cho phép 2 effect cho cùng cell.
/// </summary>
public class UserPermissionOverride
{
    public Guid UserId { get; set; }
    public Guid ModuleId { get; set; }
    public Guid ActionId { get; set; }
    public PermissionEffect Effect { get; set; } = PermissionEffect.Grant;
    public DateTime GrantedAt { get; set; } = DateTime.UtcNow;
    public Guid? GrantedBy { get; set; }

    public User User { get; set; } = default!;
    public Module Module { get; set; } = default!;
    public PermissionAction Action { get; set; } = default!;
}
