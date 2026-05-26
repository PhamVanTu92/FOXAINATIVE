using Microsoft.EntityFrameworkCore;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Domain.Entities;

namespace SystemService.Infrastructure.Persistence.Repositories;

public sealed class ModuleRepository(SystemDbContext db) : IModuleRepository
{
    public Task<Module?> FindByIdAsync(Guid id, CancellationToken ct = default) =>
        db.Modules.Include(m => m.Group).FirstOrDefaultAsync(m => m.Id == id, ct);

    public Task<Module?> FindByCodeAsync(string code, CancellationToken ct = default) =>
        db.Modules.Include(m => m.Group).FirstOrDefaultAsync(m => m.Code == code, ct);

    public Task<bool> CodeExistsAsync(string code, CancellationToken ct = default) =>
        db.Modules.AnyAsync(m => m.Code == code, ct);

    public async Task<IReadOnlyList<Module>> ListAsync(Guid? groupId, bool activeOnly, CancellationToken ct = default)
    {
        var query = db.Modules.AsQueryable();
        if (groupId is { } gid) query = query.Where(m => m.GroupId == gid);
        if (activeOnly) query = query.Where(m => m.IsActive);

        return await query
            .OrderBy(m => m.SortOrder)
            .ThenBy(m => m.Name)
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<Module>> FindByIdsAsync(IEnumerable<Guid> ids, CancellationToken ct = default)
    {
        var idList = ids.Distinct().ToList();
        return await db.Modules.Where(m => idList.Contains(m.Id)).ToListAsync(ct);
    }

    public Task<bool> HasRolePermissionsAsync(Guid moduleId, CancellationToken ct = default) =>
        db.RolePermissions.AnyAsync(rp => rp.ModuleId == moduleId, ct);

    public void Add(Module module) => db.Modules.Add(module);

    public void Remove(Module module) => db.Modules.Remove(module);
}
