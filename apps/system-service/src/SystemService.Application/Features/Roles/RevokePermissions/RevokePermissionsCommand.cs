using SystemService.Application.Common.Markers;
using SystemService.Application.Features.Roles.Dtos;

namespace SystemService.Application.Features.Roles.RevokePermissions;

public sealed record RevokePermissionsCommand(Guid RoleId, IReadOnlyCollection<string> PermissionCodes)
    : ITransactionalRequest<RoleDto>;
