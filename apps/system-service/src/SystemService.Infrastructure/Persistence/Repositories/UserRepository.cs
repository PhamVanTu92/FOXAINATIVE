using Microsoft.EntityFrameworkCore;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Domain.Entities;
using SystemService.Domain.Enums;

namespace SystemService.Infrastructure.Persistence.Repositories;

public sealed class UserRepository(SystemDbContext db) : IUserRepository
{
    public Task<User?> FindByIdAsync(Guid id, CancellationToken ct = default) =>
        db.Users.FirstOrDefaultAsync(u => u.Id == id, ct);

    public Task<User?> FindByEmailAsync(string email, CancellationToken ct = default) =>
        db.Users.FirstOrDefaultAsync(u => u.Email == email, ct);

    public Task<User?> FindByIdWithRolesAndPermissionsAsync(Guid id, CancellationToken ct = default) =>
        BuildRolesAndPermissionsQuery().FirstOrDefaultAsync(u => u.Id == id, ct);

    public Task<User?> FindByEmailWithRolesAndPermissionsAsync(string email, CancellationToken ct = default) =>
        BuildRolesAndPermissionsQuery().FirstOrDefaultAsync(u => u.Email == email, ct);

    public Task<bool> EmailExistsAsync(string email, CancellationToken ct = default) =>
        db.Users.AnyAsync(u => u.Email == email, ct);

    public async Task<(IReadOnlyList<User> Items, long Total)> SearchAsync(
        int page,
        int pageSize,
        string? search,
        UserStatus? status,
        Guid? organizationId,
        string? sortBy,
        string? sortOrder,
        CancellationToken ct = default)
    {
        var query = db.Users.AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = $"%{search.Trim()}%";
            query = query.Where(u => EF.Functions.ILike(u.Email, pattern) || EF.Functions.ILike(u.FullName, pattern));
        }

        if (status is not null)
        {
            query = query.Where(u => u.Status == status.Value);
        }

        if (organizationId is not null)
        {
            query = query.Where(u => u.OrganizationId == organizationId.Value);
        }

        var total = await query.LongCountAsync(ct);

        query = (sortBy?.ToLowerInvariant(), sortOrder) switch
        {
            ("email", "desc") => query.OrderByDescending(u => u.Email),
            ("email", _) => query.OrderBy(u => u.Email),
            ("fullname", "desc") => query.OrderByDescending(u => u.FullName),
            ("fullname", _) => query.OrderBy(u => u.FullName),
            (_, "asc") => query.OrderBy(u => u.CreatedAt),
            _ => query.OrderByDescending(u => u.CreatedAt),
        };

        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .ToListAsync(ct);

        return (items, total);
    }

    public void Add(User user) => db.Users.Add(user);

    public void Remove(User user) => db.Users.Remove(user);

    public Task<int> CountUsersWithRoleAsync(Guid roleId, CancellationToken ct = default) =>
        db.UserRoles.CountAsync(ur => ur.RoleId == roleId, ct);

    public async Task<(IReadOnlyList<User> Items, long Total)> SearchByOrgIdsAsync(
        IReadOnlyCollection<Guid> organizationIds,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        if (organizationIds.Count == 0)
        {
            return (Array.Empty<User>(), 0);
        }

        var query = db.Users.Where(u => u.OrganizationId != null && organizationIds.Contains(u.OrganizationId.Value));
        var total = await query.LongCountAsync(ct);

        var items = await query
            .OrderByDescending(u => u.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .ToListAsync(ct);

        return (items, total);
    }

    private IQueryable<User> BuildRolesAndPermissionsQuery() =>
        db.Users
            .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
                    .ThenInclude(r => r.RolePermissions)
                        .ThenInclude(rp => rp.Permission);
}
