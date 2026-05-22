namespace SystemService.Domain.Enums;

/// <summary>
/// Hiệu lực của 1 row trong user_permission_overrides:
/// GRANT = cộng thêm cell (Module × Action) ngoài role.
/// DENY  = trừ bớt cell (Module × Action) khỏi role.
/// </summary>
public enum PermissionEffect
{
    Grant = 0,
    Deny = 1,
}
