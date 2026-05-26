using SystemService.Application.Features.ModuleGroups.Dtos;
using SystemService.Domain.Entities;

namespace SystemService.Application.Features.ModuleGroups.Mappings;

internal static class ModuleGroupDtoMapping
{
    public static ModuleGroupDto ToDto(this ModuleGroup g)
    {
        var modules = g.Modules?
            .OrderBy(m => m.SortOrder).ThenBy(m => m.Name)
            .Select(m => new ModuleSummaryDto(m.Id, m.Code, m.Name, m.SortOrder, m.IsActive))
            .ToList() ?? new List<ModuleSummaryDto>();

        return new ModuleGroupDto(
            Id: g.Id,
            Code: g.Code,
            Name: g.Name,
            Description: g.Description,
            SortOrder: g.SortOrder,
            IsActive: g.IsActive,
            Modules: modules,
            CreatedAt: g.CreatedAt,
            UpdatedAt: g.UpdatedAt);
    }
}
