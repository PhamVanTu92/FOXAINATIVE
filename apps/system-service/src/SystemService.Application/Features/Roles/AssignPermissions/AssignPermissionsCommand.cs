using SystemService.Application.Common.Markers;
using SystemService.Application.Features.Roles.Dtos;

namespace SystemService.Application.Features.Roles.AssignPermissions;

/// <summary>
/// Cấp 1 hoặc nhiều ô trong UI grid cho role: pair (moduleId, actionId).
/// Idempotent — pair đã tồn tại sẽ skip.
/// </summary>
public sealed record AssignPermissionsCommand(
    Guid RoleId,
    IReadOnlyCollection<RolePermissionPair> Grants) : ITransactionalRequest<RoleDto>;

public sealed record RolePermissionPair(Guid ModuleId, Guid ActionId);
