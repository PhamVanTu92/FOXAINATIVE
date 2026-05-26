using SystemService.Application.Common.Markers;
using SystemService.Application.Features.PermissionActions.Dtos;

namespace SystemService.Application.Features.PermissionActions.CreatePermissionAction;

public sealed record CreatePermissionActionCommand(
    string Code,
    string Name,
    string? Description,
    int SortOrder) : ITransactionalRequest<PermissionActionDto>;
