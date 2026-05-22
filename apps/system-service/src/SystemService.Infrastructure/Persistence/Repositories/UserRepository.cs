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

    public Task<User?> FindByUsernameAsync(string username, CancellationToken ct = default) =>
        db.Users.FirstOrDefaultAsync(u => u.Username == username, ct);

    public Task<User?> FindByIdWithGrantsAsync(Guid id, CancellationToken ct = default) =>
        BuildWithGrantsQuery().FirstOrDefaultAsync(u => u.Id == id, ct);

    public Task<User?> FindByEmailWithGrantsAsync(string email, CancellationToken ct = default) =>
        BuildWithGrantsQuery().FirstOrDefaultAsync(u => u.Email == email, ct);

    public Task<User?> FindByLoginWithGrantsAsync(string login, CancellationToken ct = default) =>
        BuildWithGrantsQuery().FirstOrDefaultAsync(u => u.Email == login || u.Username == login, ct);

    public Task<bool> EmailExistsAsync(string email, CancellationToken ct = default) =>
        db.Users.AnyAsync(u => u.Email == email, ct);

    public Task<bool> UsernameExistsAsync(string username, CancellationToken ct = default) =>
        db.Users.AnyAsync(u => u.Username == username, ct);

    public async Task<IReadOnlyList<(Guid ModuleId, Guid ActionId, PermissionEffect Effect)>>
        GetPermissionOverridesAsync(Guid userId, CancellationToken ct = default)
    {
        return await db.UserPermissionOverrides
            .Where(up => up.UserId == userId)
            .Select(up => new ValueTuple<Guid, Guid, PermissionEffect>(up.ModuleId, up.ActionId, up.Effect))
            .ToListAsync(ct);
    }

    public async Task ReplacePermissionOverridesAsync(
        Guid userId,
        IReadOnlyCollection<UserPermissionOverride> overrides,
        CancellationToken ct = default)
    {
        // Use raw SQL DELETE to bypass EF identity map — avoids PK conflict when a new override
        // has the same (userId, moduleId, actionId) as an existing one marked Deleted in the tracker.
        await db.Database.ExecuteSqlRawAsync(
            "DELETE FROM user_permission_overrides WHERE user_id = {0}",
            new object[] { userId },
            ct);

        // Detach stale override entities from the tracker and clear the User's nav collection
        // so the subsequent re-query (GetUserPermissionsQuery) starts from a clean slate.
        var stale = db.ChangeTracker
            .Entries<UserPermissionOverride>()
            .Where(e => e.Entity.UserId == userId)
            .ToList();

        var trackedUser = db.Users.Local.FirstOrDefault(u => u.Id == userId);
        trackedUser?.PermissionOverrides.Clear();

        foreach (var e in stale) e.State = EntityState.Detached;

        if (overrides.Count > 0)
        {
            await db.UserPermissionOverrides.AddRangeAsync(overrides, ct);
        }
    }

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
            query = query.Where(u =>
                EF.Functions.ILike(u.Email, pattern)
                || EF.Functions.ILike(u.Username, pattern)
                || EF.Functions.ILike(u.FullName, pattern));
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
            ("username", "desc") => query.OrderByDescending(u => u.Username),
            ("username", _) => query.OrderBy(u => u.Username),
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

    private IQueryable<User> BuildWithGrantsQuery() =>
        db.Users
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
                .ThenInclude(r => r.RolePermissions).ThenInclude(rp => rp.Module).ThenInclude(m => m.Group)
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
                .ThenInclude(r => r.RolePermissions).ThenInclude(rp => rp.Action)
            .Include(u => u.PermissionOverrides).ThenInclude(up => up.Module).ThenInclude(m => m.Group)
            .Include(u => u.PermissionOverrides).ThenInclude(up => up.Action);
}
