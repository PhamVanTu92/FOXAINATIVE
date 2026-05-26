using MediatR;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Domain.Exceptions;

namespace SystemService.Application.Features.Users.UnassignRole;

public sealed class UnassignRoleCommandHandler(
    IUserRepository users,
    IRoleRepository roles) : IRequestHandler<UnassignRoleCommand, bool>
{
    private const string SuperAdminCode = "SUPER_ADMIN";

    public async Task<bool> Handle(UnassignRoleCommand request, CancellationToken cancellationToken)
    {
        var user = await users.FindByIdWithGrantsAsync(request.UserId, cancellationToken)
                   ?? throw new NotFoundException("User", request.UserId);

        var role = await roles.FindByCodeAsync(request.RoleCode, cancellationToken)
                   ?? throw new NotFoundException("Role", request.RoleCode);

        var assignment = user.UserRoles.FirstOrDefault(ur => ur.RoleId == role.Id);
        if (assignment is null)
        {
            return true;
        }

        if (role.Code == SuperAdminCode)
        {
            var totalSuperAdmins = await users.CountUsersWithRoleAsync(role.Id, cancellationToken);
            if (totalSuperAdmins <= 1)
            {
                throw new BusinessRuleViolationException("Không thể gỡ vai trò SUPER_ADMIN cuối cùng khỏi hệ thống.");
            }
        }

        user.UserRoles.Remove(assignment);
        return true;
    }
}
