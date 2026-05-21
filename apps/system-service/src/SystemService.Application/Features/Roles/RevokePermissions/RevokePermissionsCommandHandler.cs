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
        var role = await roles.FindByIdWithPermissionsAsync(request.RoleId, cancellationToken)
                   ?? throw new NotFoundException("Role", request.RoleId);

        if (role.Code == SuperAdminCode)
        {
            throw new SystemRoleProtectedException(role.Code);
        }

        var codes = request.PermissionCodes?.Where(c => !string.IsNullOrWhiteSpace(c)).Distinct().ToHashSet()
                    ?? new HashSet<string>();
        if (codes.Count == 0)
        {
            return role.ToDto();
        }

        var toRemove = role.RolePermissions
            .Where(rp => codes.Contains(rp.Permission.Code))
            .ToList();

        foreach (var rp in toRemove)
        {
            role.RolePermissions.Remove(rp);
        }

        return role.ToDto();
    }
}
