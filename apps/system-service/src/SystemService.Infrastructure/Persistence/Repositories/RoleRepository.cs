using Microsoft.EntityFrameworkCore;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Domain.Entities;

namespace SystemService.Infrastructure.Persistence.Repositories;

public sealed class RoleRepository(SystemDbContext db) : IRoleRepository
{
    public Task<Role?> FindByIdAsync(Guid id, CancellationToken ct = default) =>
        db.Roles.FirstOrDefaultAsync(r => r.Id == id, ct);

    public Task<Role?> FindByIdWithPermissionsAsync(Guid id, CancellationToken ct = default) =>
        db.Roles
            .Include(r => r.RolePermissions).ThenInclude(rp => rp.Permission)
            .FirstOrDefaultAsync(r => r.Id == id, ct);

    public Task<Role?> FindByCodeAsync(string code, CancellationToken ct = default) =>
        db.Roles.FirstOrDefaultAsync(r => r.Code == code, ct);

    public Task<Role?> FindByCodeWithPermissionsAsync(string code, CancellationToken ct = default) =>
        db.Roles
            .Include(r => r.RolePermissions).ThenInclude(rp => rp.Permission)
            .FirstOrDefaultAsync(r => r.Code == code, ct);

    public Task<bool> CodeExistsAsync(string code, CancellationToken ct = default) =>
        db.Roles.AnyAsync(r => r.Code == code, ct);

    public async Task<(IReadOnlyList<Role> Items, long Total)> SearchAsync(
        int page,
        int pageSize,
        string? search,
        bool includePermissions,
        string? sortBy,
        string? sortOrder,
        CancellationToken ct = default)
    {
        var query = db.Roles.AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = $"%{search.Trim()}%";
            query = query.Where(r => EF.Functions.ILike(r.Code, pattern) || EF.Functions.ILike(r.Name, pattern));
        }

        var total = await query.LongCountAsync(ct);

        query = (sortBy?.ToLowerInvariant(), sortOrder) switch
        {
            ("code", "desc") => query.OrderByDescending(r => r.Code),
            ("code", _) => query.OrderBy(r => r.Code),
            ("name", "desc") => query.OrderByDescending(r => r.Name),
            ("name", _) => query.OrderBy(r => r.Name),
            (_, "asc") => query.OrderBy(r => r.CreatedAt),
            _ => query.OrderByDescending(r => r.CreatedAt),
        };

        query = query.Skip((page - 1) * pageSize).Take(pageSize);

        if (includePermissions)
        {
            query = query.Include(r => r.RolePermissions).ThenInclude(rp => rp.Permission);
        }

        var items = await query.ToListAsync(ct);
        return (items, total);
    }

    public async Task<IReadOnlyList<Role>> FindByCodesAsync(IEnumerable<string> codes, CancellationToken ct = default)
    {
        var codeList = codes.Distinct().ToList();
        return await db.Roles.Where(r => codeList.Contains(r.Code)).ToListAsync(ct);
    }

    public void Add(Role role) => db.Roles.Add(role);

    public void Remove(Role role) => db.Roles.Remove(role);
}
