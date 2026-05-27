using SystemService.Application.Common.Markers;
using SystemService.Application.Features.ModuleGroups.Dtos;

namespace SystemService.Application.Features.ModuleGroups.UpdateModuleGroup;

public sealed record UpdateModuleGroupCommand(
    Guid Id,
    string? Name,
    string? Description,
    int? SortOrder,
    bool? IsActive) : ITransactionalRequest<ModuleGroupDto>;
