using MediatR;
using SystemService.Application.Features.Users.Permissions.Dtos;

namespace SystemService.Application.Features.Users.Permissions.GetUserPermissions;

public sealed record GetUserPermissionsQuery(Guid UserId) : IRequest<UserEffectivePermissionsDto>;
