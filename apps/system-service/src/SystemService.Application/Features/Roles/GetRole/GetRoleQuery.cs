using MediatR;
using SystemService.Application.Features.Roles.Dtos;

namespace SystemService.Application.Features.Roles.GetRole;

public sealed record GetRoleQuery(Guid Id) : IRequest<RoleDto>;
