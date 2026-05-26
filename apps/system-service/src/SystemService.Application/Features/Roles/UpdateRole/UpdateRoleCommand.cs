using SystemService.Application.Common.Markers;
using SystemService.Application.Features.Roles.Dtos;

namespace SystemService.Application.Features.Roles.UpdateRole;

public sealed record UpdateRoleCommand(Guid Id, string? Name, string? Description) : ITransactionalRequest<RoleDto>;
