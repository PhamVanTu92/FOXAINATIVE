using MediatR;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Domain.Entities;
using SystemService.Domain.Exceptions;

namespace SystemService.Application.Features.Users.AssignRole;

public sealed class AssignRoleCommandHandler(
    IUserRepository users,
    IRoleRepository roles) : IRequestHandler<AssignRoleCommand, bool>
{
    public async Task<bool> Handle(AssignRoleCommand request, CancellationToken cancellationToken)
    {
        var user = await users.FindByIdWithRolesAndPermissionsAsync(request.UserId, cancellationToken)
                   ?? throw new NotFoundException("User", request.UserId);

        var role = await roles.FindByCodeAsync(request.RoleCode, cancellationToken)
                   ?? throw new NotFoundException("Role", request.RoleCode);

        if (user.UserRoles.Any(ur => ur.RoleId == role.Id))
        {
            return true;
        }

        user.UserRoles.Add(new UserRole
        {
            UserId = user.Id,
            RoleId = role.Id,
            User = user,
            Role = role,
            AssignedAt = DateTime.UtcNow,
        });

        return true;
    }
}
