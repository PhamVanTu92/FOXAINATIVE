using MediatR;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Application.Features.Users.Permissions.Dtos;
using SystemService.Application.Features.Users.Permissions.GetUserPermissions;
using SystemService.Domain.Entities;
using SystemService.Domain.Enums;
using SystemService.Domain.Exceptions;

namespace SystemService.Application.Features.Users.Permissions.SetUserPermissions;

public sealed class SetUserPermissionsCommandHandler(
    IUserRepository users,
    IUnitOfWork unitOfWork,
    ISender sender)
    : IRequestHandler<SetUserPermissionsCommand, UserEffectivePermissionsDto>
{
    public async Task<UserEffectivePermissionsDto> Handle(
        SetUserPermissionsCommand request,
        CancellationToken cancellationToken)
    {
        var user = await users.FindByIdWithGrantsAsync(request.UserId, cancellationToken)
                   ?? throw new NotFoundException("User", request.UserId);

        // Tập cell user muốn ACTIVE (từ FE).
        var desired = new HashSet<(Guid ModuleId, Guid ActionId)>(
            request.EffectiveGrants.Select(g => (g.ModuleId, g.ActionId)));

        // Tập cell role mặc định cấp.
        var roleGranted = new HashSet<(Guid ModuleId, Guid ActionId)>(
            user.UserRoles
                .SelectMany(ur => ur.Role.RolePermissions)
                .Select(rp => (rp.ModuleId, rp.ActionId)));

        // Diff:
        // - GRANT override = cell trong desired nhưng KHÔNG có trong roleGranted.
        // - DENY override  = cell trong roleGranted nhưng KHÔNG có trong desired.
        var grants = desired.Except(roleGranted).ToArray();
        var denies = roleGranted.Except(desired).ToArray();

        var newOverrides = new List<UserPermissionOverride>(grants.Length + denies.Length);
        foreach (var (moduleId, actionId) in grants)
        {
            newOverrides.Add(new UserPermissionOverride
            {
                UserId = user.Id,
                ModuleId = moduleId,
                ActionId = actionId,
                Effect = PermissionEffect.Grant,
                GrantedAt = DateTime.UtcNow,
            });
        }
        foreach (var (moduleId, actionId) in denies)
        {
            newOverrides.Add(new UserPermissionOverride
            {
                UserId = user.Id,
                ModuleId = moduleId,
                ActionId = actionId,
                Effect = PermissionEffect.Deny,
                GrantedAt = DateTime.UtcNow,
            });
        }

        await users.ReplacePermissionOverridesAsync(user.Id, newOverrides, cancellationToken);

        // Flush ngay để re-query thấy state mới (không lẫn deleted/added trong cùng change tracker).
        // UnitOfWorkBehavior cuối pipeline sẽ là no-op vì đã commit ở đây.
        await unitOfWork.SaveChangesAsync(cancellationToken);

        // Re-query để build response (tránh duplicate logic merge).
        return await sender.Send(new GetUserPermissionsQuery(user.Id), cancellationToken);
    }
}
