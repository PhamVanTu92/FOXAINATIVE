namespace SystemService.Application.Features.Users.Permissions.Dtos;

/// <summary>
/// Trả về snapshot quyền của 1 user cho UI grid:
/// - RoleGrants: các cell mặc định do role cấp (không thể bỏ thông qua revoke role grant trực tiếp).
/// - Overrides: các cell user-level override (GRANT thêm hoặc DENY bớt).
/// - Effective: cell cuối cùng (đã merge) — FE dùng để render checkbox.
/// </summary>
public sealed record UserEffectivePermissionsDto(
    Guid UserId,
    IReadOnlyCollection<UserPermissionCellDto> RoleGrants,
    IReadOnlyCollection<UserPermissionOverrideCellDto> Overrides,
    IReadOnlyCollection<UserPermissionCellDto> Effective);

public sealed record UserPermissionCellDto(
    Guid ModuleId,
    string ModuleCode,
    string ModuleName,
    Guid ActionId,
    string ActionCode,
    string ActionName);

public sealed record UserPermissionOverrideCellDto(
    Guid ModuleId,
    string ModuleCode,
    Guid ActionId,
    string ActionCode,
    string Effect); // "GRANT" | "DENY"
