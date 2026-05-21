using MediatR;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Domain.Exceptions;

namespace SystemService.Application.Features.Roles.DeleteRole;

public sealed class DeleteRoleCommandHandler(
    IRoleRepository roles,
    IUserRepository users) : IRequestHandler<DeleteRoleCommand, bool>
{
    public async Task<bool> Handle(DeleteRoleCommand request, CancellationToken cancellationToken)
    {
        var role = await roles.FindByIdAsync(request.Id, cancellationToken)
                   ?? throw new NotFoundException("Role", request.Id);

        if (role.IsSystem)
        {
            throw new SystemRoleProtectedException(role.Code);
        }

        var inUse = await users.CountUsersWithRoleAsync(role.Id, cancellationToken);
        if (inUse > 0)
        {
            throw new BusinessRuleViolationException($"Không thể xóa role '{role.Code}' vì đang được {inUse} người dùng sử dụng.");
        }

        roles.Remove(role);
        return true;
    }
}
