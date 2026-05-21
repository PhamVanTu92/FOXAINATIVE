using MediatR;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Application.Features.Roles.Dtos;
using SystemService.Application.Features.Roles.Mappings;
using SystemService.Domain.Entities;
using SystemService.Domain.Exceptions;

namespace SystemService.Application.Features.Roles.CreateRole;

public sealed class CreateRoleCommandHandler(
    IRoleRepository roles,
    IPermissionRepository permissions) : IRequestHandler<CreateRoleCommand, RoleDto>
{
    public async Task<RoleDto> Handle(CreateRoleCommand request, CancellationToken cancellationToken)
    {
        var code = request.Code.Trim().ToUpperInvariant();
        if (await roles.CodeExistsAsync(code, cancellationToken))
        {
            throw new CodeAlreadyExistsException("Role", code);
        }

        var role = new Role
        {
            Id = Guid.NewGuid(),
            Code = code,
            Name = request.Name.Trim(),
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            IsSystem = false,
        };

        var requestedCodes = request.PermissionCodes?.Where(c => !string.IsNullOrWhiteSpace(c)).Distinct().ToList()
                             ?? new List<string>();
        if (requestedCodes.Count > 0)
        {
            var perms = await permissions.FindByCodesAsync(requestedCodes, cancellationToken);
            var missing = requestedCodes.Except(perms.Select(p => p.Code)).ToList();
            if (missing.Count > 0)
            {
                throw new NotFoundException("Permission", string.Join(", ", missing));
            }

            foreach (var perm in perms)
            {
                role.RolePermissions.Add(new RolePermission
                {
                    Role = role,
                    Permission = perm,
                });
            }
        }

        roles.Add(role);

        return role.ToDto();
    }
}
