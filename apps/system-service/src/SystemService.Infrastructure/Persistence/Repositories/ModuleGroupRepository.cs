using Microsoft.EntityFrameworkCore;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Domain.Entities;

namespace SystemService.Infrastructure.Persistence.Repositories;

public sealed class ModuleGroupRepository(SystemDbContext db) : IModuleGroupRepository
{
    public Task<ModuleGroup?> FindByIdAsync(Guid id, CancellationToken ct = default) =>
        db.ModuleGroups
            .Include(g => g.Modules.OrderBy(m => m.SortOrder).ThenBy(m => m.Name))
                .ThenInclude(m => m.AllowedActions)
                    .ThenInclude(ma => ma.Action)
            .FirstOrDefaultAsync(g => g.Id == id, ct);

    public Task<ModuleGroup?> FindByCodeAsync(string code, CancellationToken ct = default) =>
        db.ModuleGroups.FirstOrDefaultAsync(g => g.Code == code, ct);

    public Task<bool> CodeExistsAsync(string code, CancellationToken ct = default) =>
        db.ModuleGroups.AnyAsync(g => g.Code == code, ct);

    public async Task<IReadOnlyList<ModuleGroup>> ListWithModulesAsync(bool activeOnly, CancellationToken ct = default)
    {
        var query = db.ModuleGroups.AsQueryable();
        if (activeOnly) query = query.Where(g => g.IsActive);

        return await query
            .Include(g => g.Modules.Where(m => !activeOnly || m.IsActive).OrderBy(m => m.SortOrder).ThenBy(m => m.Name))
                .ThenInclude(m => m.AllowedActions)
                    .ThenInclude(ma => ma.Action)
            .OrderBy(g => g.SortOrder)
            .ThenBy(g => g.Name)
            .ToListAsync(ct);
    }

    public Task<bool> HasModulesAsync(Guid groupId, CancellationToken ct = default) =>
        db.Modules.AnyAsync(m => m.GroupId == groupId, ct);

    public void Add(ModuleGroup group) => db.ModuleGroups.Add(group);

    public void Remove(ModuleGroup group) => db.ModuleGroups.Remove(group);
}
