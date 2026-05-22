using SystemService.Application.Common.Markers;
using SystemService.Application.Features.PermissionActions.Dtos;

namespace SystemService.Application.Features.PermissionActions.UpdatePermissionAction;

public sealed record UpdatePermissionActionCommand(
    Guid Id,
    string? Name,
    string? Description,
    int? SortOrder,
    bool? IsActive) : ITransactionalRequest<PermissionActionDto>;
