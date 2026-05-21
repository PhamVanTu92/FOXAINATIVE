using SystemService.Application.Features.Roles.Dtos;
using SystemService.Domain.Entities;

namespace SystemService.Application.Features.Roles.Mappings;

internal static class RoleDtoMapping
{
    public static RoleDto ToDto(this Role role)
    {
        var permissions = role.RolePermissions?
            .Where(rp => rp.Permission is not null)
            .Select(rp => rp.Permission.Code)
            .Distinct()
            .ToArray() ?? Array.Empty<string>();

        return new RoleDto(
            Id: role.Id,
            Code: role.Code,
            Name: role.Name,
            Description: role.Description,
            IsSystem: role.IsSystem,
            Permissions: permissions,
            CreatedAt: role.CreatedAt,
            UpdatedAt: role.UpdatedAt);
    }
}
