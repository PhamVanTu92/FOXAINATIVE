using MediatR;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Application.Features.Roles.Dtos;
using SystemService.Application.Features.Roles.Mappings;
using SystemService.Domain.Entities;
using SystemService.Domain.Exceptions;

namespace SystemService.Application.Features.Roles.AssignPermissions;

public sealed class AssignPermissionsCommandHandler(
    IRoleRepository roles,
    IModuleRepository modules,
    IPermissionActionRepository actions) : IRequestHandler<AssignPermissionsCommand, RoleDto>
{
    public async Task<RoleDto> Handle(AssignPermissionsCommand request, CancellationToken cancellationToken)
    {
        var role = await roles.FindByIdWithGrantsAsync(request.RoleId, cancellationToken)
                   ?? throw new NotFoundException("Role", request.RoleId);

        var pairs = (request.Grants ?? Array.Empty<RolePermissionPair>())
            .Where(p => p.ModuleId != Guid.Empty && p.ActionId != Guid.Empty)
            .Distinct()
            .ToList();
        if (pairs.Count == 0)
        {
            return role.ToDto();
        }

        // Validate IDs exist
        var moduleIds = pairs.Select(p => p.ModuleId).Distinct().ToList();
        var actionIds = pairs.Select(p => p.ActionId).Distinct().ToList();

        var foundModules = (await modules.FindByIdsAsync(moduleIds, cancellationToken)).ToDictionary(m => m.Id);
        var missingModules = moduleIds.Where(id => !foundModules.ContainsKey(id)).ToList();
        if (missingModules.Count > 0)
        {
            throw new NotFoundException("Module", string.Join(", ", missingModules));
        }

        var foundActions = (await actions.FindByIdsAsync(actionIds, cancellationToken)).ToDictionary(a => a.Id);
        var missingActions = actionIds.Where(id => !foundActions.ContainsKey(id)).ToList();
        if (missingActions.Count > 0)
        {
            throw new NotFoundException("PermissionAction", string.Join(", ", missingActions));
        }

        var existing = role.RolePermissions.Select(rp => (rp.ModuleId, rp.ActionId)).ToHashSet();
        foreach (var pair in pairs)
        {
            if (existing.Contains((pair.ModuleId, pair.ActionId))) continue;

            role.RolePermissions.Add(new RolePermission
            {
                Role = role,
                RoleId = role.Id,
                ModuleId = pair.ModuleId,
                ActionId = pair.ActionId,
                Module = foundModules[pair.ModuleId],
                Action = foundActions[pair.ActionId],
                GrantedAt = DateTime.UtcNow,
            });
        }

        return role.ToDto();
    }
}
