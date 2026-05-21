using SystemService.Application.Common.Markers;
using SystemService.Application.Features.Roles.Dtos;

namespace SystemService.Application.Features.Roles.CreateRole;

public sealed record CreateRoleCommand(
    string Code,
    string Name,
    string? Description,
    IReadOnlyCollection<string> PermissionCodes) : ITransactionalRequest<RoleDto>;
