using SystemService.Application.Common.Markers;
using SystemService.Application.Features.ModuleGroups.Dtos;

namespace SystemService.Application.Features.ModuleGroups.CreateModuleGroup;

public sealed record CreateModuleGroupCommand(
    string Code,
    string Name,
    string? Description,
    int SortOrder) : ITransactionalRequest<ModuleGroupDto>;
