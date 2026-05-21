using MediatR;
using SystemService.Application.Features.Permissions.Dtos;

namespace SystemService.Application.Features.Permissions.GetPermission;

public sealed record GetPermissionQuery(Guid Id) : IRequest<PermissionDto>;
