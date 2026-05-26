using SystemService.Application.Common.Markers;
using SystemService.Application.Features.Users.Permissions.Dtos;

namespace SystemService.Application.Features.Users.Permissions.SetUserPermissions;

/// <summary>
/// FE gửi state cuối cùng của UI grid: tập cell user muốn ACTIVE.
/// Server diff vs role grants → tính ra GRANT (cell mới ngoài role) và DENY (cell trong role bị bỏ).
/// Idempotent: gọi lại cùng input sẽ ra cùng kết quả.
/// </summary>
public sealed record SetUserPermissionsCommand(
    Guid UserId,
    IReadOnlyCollection<UserPermissionPair> EffectiveGrants) : ITransactionalRequest<UserEffectivePermissionsDto>;

public sealed record UserPermissionPair(Guid ModuleId, Guid ActionId);
