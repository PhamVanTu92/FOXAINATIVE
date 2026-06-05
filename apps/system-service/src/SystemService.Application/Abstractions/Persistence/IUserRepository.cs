using SystemService.Domain.Entities;
using SystemService.Domain.Enums;

namespace SystemService.Application.Abstractions.Persistence;

public interface IUserRepository
{
    Task<User?> FindByIdAsync(Guid id, CancellationToken ct = default);

    Task<User?> FindByEmailAsync(string email, CancellationToken ct = default);

    Task<User?> FindByUsernameAsync(string username, CancellationToken ct = default);

    /// <summary>Load User kèm Roles → RolePermissions → Module + Action + UserPermissionOverrides (cho JWT claims).</summary>
    Task<User?> FindByIdWithGrantsAsync(Guid id, CancellationToken ct = default);

    Task<User?> FindByEmailWithGrantsAsync(string email, CancellationToken ct = default);

    /// <summary>Tìm user theo username/email kèm grants — dùng cho login.</summary>
    Task<User?> FindByLoginWithGrantsAsync(string login, CancellationToken ct = default);

    Task<bool> ExistsAsync(Guid id, CancellationToken ct = default);

    Task<bool> EmailExistsAsync(string email, CancellationToken ct = default);

    Task<bool> UsernameExistsAsync(string username, CancellationToken ct = default);

    /// <summary>Lookup pairs (module_id, action_id, effect) — cho UI grid override.</summary>
    Task<IReadOnlyList<(Guid ModuleId, Guid ActionId, Domain.Enums.PermissionEffect Effect)>>
        GetPermissionOverridesAsync(Guid userId, CancellationToken ct = default);

    /// <summary>Replace toàn bộ user_permission_overrides bằng tập mới (idempotent).</summary>
    Task ReplacePermissionOverridesAsync(
        Guid userId,
        IReadOnlyCollection<Domain.Entities.UserPermissionOverride> overrides,
        CancellationToken ct = default);

    Task<(IReadOnlyList<User> Items, long Total)> SearchAsync(
        int page,
        int pageSize,
        string? search,
        UserStatus? status,
        Guid? organizationId,
        string? sortBy,
        string? sortOrder,
        CancellationToken ct = default);

    void Add(User user);

    void Remove(User user);

    Task<int> CountUsersWithRoleAsync(Guid roleId, CancellationToken ct = default);

    Task<(IReadOnlyList<User> Items, long Total)> SearchByOrgIdsAsync(
        IReadOnlyCollection<Guid> organizationIds,
        int page,
        int pageSize,
        CancellationToken ct = default);

    Task<(int TotalUsers, int ActiveUsers, int TotalRoles, IReadOnlyList<(string DepartmentName, int UserCount)> UsersByDepartment)>
        GetSystemStatsAsync(CancellationToken ct = default);
}
