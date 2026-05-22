using SystemService.Domain.Entities;
using SystemService.Domain.Enums;

namespace SystemService.Application.Abstractions.Persistence;

public interface IUserRepository
{
    Task<User?> FindByIdAsync(Guid id, CancellationToken ct = default);

    Task<User?> FindByEmailAsync(string email, CancellationToken ct = default);

    /// <summary>Load User kèm Roles → RolePermissions → Module + Action (cho JWT claims).</summary>
    Task<User?> FindByIdWithGrantsAsync(Guid id, CancellationToken ct = default);

    Task<User?> FindByEmailWithGrantsAsync(string email, CancellationToken ct = default);

    Task<bool> EmailExistsAsync(string email, CancellationToken ct = default);

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
}
