using SystemService.Application.Features.Roles.Dtos;
using SystemService.Domain.Entities;

namespace SystemService.Application.Features.Roles.Mappings;

internal static class RoleDtoMapping
{
    public static RoleDto ToDto(this Role role)
    {
        var grants = role.RolePermissions?
            .Where(rp => rp.Module is not null && rp.Action is not null)
            .Select(rp => new RoleGrantDto(
                ModuleId:   rp.ModuleId,
                ModuleCode: rp.Module.Code,
                ModuleName: rp.Module.Name,
                ActionId:   rp.ActionId,
                ActionCode: rp.Action.Code,
                ActionName: rp.Action.Name))
            .OrderBy(g => g.ModuleCode).ThenBy(g => g.ActionCode)
            .ToArray() ?? Array.Empty<RoleGrantDto>();

        return new RoleDto(
            Id: role.Id,
            Code: role.Code,
            Name: role.Name,
            Description: role.Description,
            IsSystem: role.IsSystem,
            Grants: grants,
            CreatedAt: role.CreatedAt,
            UpdatedAt: role.UpdatedAt);
    }
}
