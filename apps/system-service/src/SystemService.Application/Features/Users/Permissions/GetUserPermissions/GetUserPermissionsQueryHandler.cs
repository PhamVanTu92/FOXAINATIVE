using MediatR;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Application.Features.Users.Permissions.Dtos;
using SystemService.Domain.Enums;
using SystemService.Domain.Exceptions;

namespace SystemService.Application.Features.Users.Permissions.GetUserPermissions;

public sealed class GetUserPermissionsQueryHandler(IUserRepository users)
    : IRequestHandler<GetUserPermissionsQuery, UserEffectivePermissionsDto>
{
    public async Task<UserEffectivePermissionsDto> Handle(
        GetUserPermissionsQuery request,
        CancellationToken cancellationToken)
    {
        var user = await users.FindByIdWithGrantsAsync(request.UserId, cancellationToken)
                   ?? throw new NotFoundException("User", request.UserId);

        // Role grants (cells từ role).
        var roleGrants = user.UserRoles
            .SelectMany(ur => ur.Role.RolePermissions)
            .Where(rp => rp.Module is not null && rp.Action is not null)
            .Select(rp => new UserPermissionCellDto(
                rp.ModuleId, rp.Module.Code, rp.Module.Name,
                rp.ActionId, rp.Action.Code, rp.Action.Name))
            .Distinct()
            .ToArray();

        // Overrides (raw).
        var overrides = user.PermissionOverrides
            .Where(up => up.Module is not null && up.Action is not null)
            .Select(up => new UserPermissionOverrideCellDto(
                up.ModuleId, up.Module.Code,
                up.ActionId, up.Action.Code,
                up.Effect == PermissionEffect.Grant ? "GRANT" : "DENY"))
            .ToArray();

        // Effective merged (FE dùng để render checkbox).
        var effectiveKeys = new HashSet<(Guid ModuleId, Guid ActionId)>(
            roleGrants.Select(g => (g.ModuleId, g.ActionId)));

        foreach (var up in user.PermissionOverrides)
        {
            if (up.Module is null || up.Action is null) continue;
            var key = (up.ModuleId, up.ActionId);
            if (up.Effect == PermissionEffect.Grant) effectiveKeys.Add(key);
            else effectiveKeys.Remove(key);
        }

        // Lookup module/action info để build cell DTO cho cả GRANT-from-override (không có trong roleGrants).
        var lookup = roleGrants.ToDictionary(g => (g.ModuleId, g.ActionId), g => g);
        foreach (var up in user.PermissionOverrides)
        {
            if (up.Module is null || up.Action is null) continue;
            var key = (up.ModuleId, up.ActionId);
            if (!lookup.ContainsKey(key))
            {
                lookup[key] = new UserPermissionCellDto(
                    up.ModuleId, up.Module.Code, up.Module.Name,
                    up.ActionId, up.Action.Code, up.Action.Name);
            }
        }

        var effective = effectiveKeys
            .Where(lookup.ContainsKey)
            .Select(k => lookup[k])
            .ToArray();

        return new UserEffectivePermissionsDto(user.Id, roleGrants, overrides, effective);
    }
}
