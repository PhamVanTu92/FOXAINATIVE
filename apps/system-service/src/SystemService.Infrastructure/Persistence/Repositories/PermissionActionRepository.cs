using Microsoft.EntityFrameworkCore;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Domain.Entities;

namespace SystemService.Infrastructure.Persistence.Repositories;

public sealed class PermissionActionRepository(SystemDbContext db) : IPermissionActionRepository
{
    public Task<PermissionAction?> FindByIdAsync(Guid id, CancellationToken ct = default) =>
        db.PermissionActions.FirstOrDefaultAsync(a => a.Id == id, ct);

    public Task<PermissionAction?> FindByCodeAsync(string code, CancellationToken ct = default) =>
        db.PermissionActions.FirstOrDefaultAsync(a => a.Code == code, ct);

    public Task<bool> CodeExistsAsync(string code, CancellationToken ct = default) =>
        db.PermissionActions.AnyAsync(a => a.Code == code, ct);

    public async Task<IReadOnlyList<PermissionAction>> ListAsync(bool activeOnly, CancellationToken ct = default)
    {
        var query = db.PermissionActions.AsQueryable();
        if (activeOnly) query = query.Where(a => a.IsActive);

        return await query
            .OrderBy(a => a.SortOrder)
            .ThenBy(a => a.Name)
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<PermissionAction>> FindByIdsAsync(IEnumerable<Guid> ids, CancellationToken ct = default)
    {
        var idList = ids.Distinct().ToList();
        return await db.PermissionActions.Where(a => idList.Contains(a.Id)).ToListAsync(ct);
    }

    public Task<bool> HasRolePermissionsAsync(Guid actionId, CancellationToken ct = default) =>
        db.RolePermissions.AnyAsync(rp => rp.ActionId == actionId, ct);

    public void Add(PermissionAction action) => db.PermissionActions.Add(action);

    public void Remove(PermissionAction action) => db.PermissionActions.Remove(action);
}
