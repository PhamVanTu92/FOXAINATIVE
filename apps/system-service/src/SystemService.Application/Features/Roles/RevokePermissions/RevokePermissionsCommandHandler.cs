using MediatR;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Application.Features.Roles.Dtos;
using SystemService.Application.Features.Roles.Mappings;
using SystemService.Domain.Exceptions;

namespace SystemService.Application.Features.Roles.RevokePermissions;

public sealed class RevokePermissionsCommandHandler(IRoleRepository roles)
    : IRequestHandler<RevokePermissionsCommand, RoleDto>
{
    private const string SuperAdminCode = "SUPER_ADMIN";

    public async Task<RoleDto> Handle(RevokePermissionsCommand request, CancellationToken cancellationToken)
    {
        var role = await roles.FindByIdWithGrantsAsync(request.RoleId, cancellationToken)
                   ?? throw new NotFoundException("Role", request.RoleId);

        if (role.Code == SuperAdminCode)
        {
            throw new SystemRoleProtectedException(role.Code);
        }

        var toRevoke = (request.Grants ?? Array.Empty<AssignPermissions.RolePermissionPair>())
            .Where(p => p.ModuleId != Guid.Empty && p.ActionId != Guid.Empty)
            .Select(p => (p.ModuleId, p.ActionId))
            .ToHashSet();

        if (toRevoke.Count == 0)
        {
            return role.ToDto();
        }

        var removing = role.RolePermissions
            .Where(rp => toRevoke.Contains((rp.ModuleId, rp.ActionId)))
            .ToList();

        foreach (var rp in removing)
        {
            role.RolePermissions.Remove(rp);
        }

        return role.ToDto();
    }
}
