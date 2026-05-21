using MediatR;
using SystemService.Application.Features.Permissions.Dtos;

namespace SystemService.Application.Features.Permissions.ListPermissions;

public sealed record ListPermissionsQuery(string? Module) : IRequest<IReadOnlyList<PermissionDto>>;
