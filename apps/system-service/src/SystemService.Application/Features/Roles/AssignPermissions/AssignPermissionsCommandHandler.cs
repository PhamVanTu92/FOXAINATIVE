using MediatR;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Application.Features.Roles.Dtos;
using SystemService.Application.Features.Roles.Mappings;
using SystemService.Domain.Entities;
using SystemService.Domain.Exceptions;

namespace SystemService.Application.Features.Roles.AssignPermissions;

public sealed class AssignPermissionsCommandHandler(
    IRoleRepository roles,
    IPermissionRepository permissions) : IRequestHandler<AssignPermissionsCommand, RoleDto>
{
    public async Task<RoleDto> Handle(AssignPermissionsCommand request, CancellationToken cancellationToken)
    {
        var role = await roles.FindByIdWithPermissionsAsync(request.RoleId, cancellationToken)
                   ?? throw new NotFoundException("Role", request.RoleId);

        var codes = request.PermissionCodes?.Where(c => !string.IsNullOrWhiteSpace(c)).Distinct().ToList()
                    ?? new List<string>();
        if (codes.Count == 0)
        {
            return role.ToDto();
        }

        var perms = await permissions.FindByCodesAsync(codes, cancellationToken);
        var missing = codes.Except(perms.Select(p => p.Code)).ToList();
        if (missing.Count > 0)
        {
            throw new NotFoundException("Permission", string.Join(", ", missing));
        }

        var current = role.RolePermissions.Select(rp => rp.PermissionId).ToHashSet();
        foreach (var perm in perms)
        {
            if (current.Contains(perm.Id)) continue;
            role.RolePermissions.Add(new RolePermission
            {
                Role = role,
                Permission = perm,
            });
        }

        return role.ToDto();
    }
}
