using SystemService.Application.Features.PermissionActions.Dtos;

namespace SystemService.Application.Features.ModuleGroups.Dtos;

public sealed record ModuleGroupDto(
    Guid Id,
    string Code,
    string Name,
    string? Description,
    int SortOrder,
    bool IsActive,
    IReadOnlyList<ModuleSummaryDto> Modules,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public sealed record ModuleSummaryDto(
    Guid Id,
    string Code,
    string Name,
    int SortOrder,
    bool IsActive,
    IReadOnlyList<PermissionActionDto> AllowedActions);
