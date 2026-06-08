using SystemService.Application.Features.Modules.Dtos;
using SystemService.Application.Features.PermissionActions.Mappings;
using SystemService.Domain.Entities;

namespace SystemService.Application.Features.Modules.Mappings;

internal static class ModuleDtoMapping
{
    public static ModuleDto ToDto(this Module m) => new(
        Id: m.Id,
        GroupId: m.GroupId,
        GroupCode: m.Group?.Code ?? string.Empty,
        GroupName: m.Group?.Name ?? string.Empty,
        Code: m.Code,
        Name: m.Name,
        Description: m.Description,
        SortOrder: m.SortOrder,
        IsActive: m.IsActive,
        CreatedAt: m.CreatedAt,
        UpdatedAt: m.UpdatedAt,
        AllowedActions: m.AllowedActions
            .OrderBy(ma => ma.Action.SortOrder)
            .Select(ma => ma.Action.ToDto())
            .ToList());
}
