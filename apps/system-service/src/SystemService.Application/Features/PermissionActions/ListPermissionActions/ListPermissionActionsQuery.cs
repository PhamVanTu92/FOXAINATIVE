using MediatR;
using SystemService.Application.Features.PermissionActions.Dtos;

namespace SystemService.Application.Features.PermissionActions.ListPermissionActions;

public sealed record ListPermissionActionsQuery(bool ActiveOnly) : IRequest<IReadOnlyList<PermissionActionDto>>;
