using MediatR;
using SystemService.Application.Features.PermissionActions.Dtos;

namespace SystemService.Application.Features.PermissionActions.GetPermissionAction;

public sealed record GetPermissionActionQuery(Guid Id) : IRequest<PermissionActionDto>;
