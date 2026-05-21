using SystemService.Application.Common.Markers;
using SystemService.Application.Features.Roles.Dtos;

namespace SystemService.Application.Features.Roles.AssignPermissions;

public sealed record AssignPermissionsCommand(Guid RoleId, IReadOnlyCollection<string> PermissionCodes)
    : ITransactionalRequest<RoleDto>;
