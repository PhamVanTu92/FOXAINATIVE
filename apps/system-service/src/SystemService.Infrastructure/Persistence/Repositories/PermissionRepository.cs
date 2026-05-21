using Microsoft.EntityFrameworkCore;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Domain.Entities;

namespace SystemService.Infrastructure.Persistence.Repositories;

public sealed class PermissionRepository(SystemDbContext db) : IPermissionRepository
{
    public Task<Permission?> FindByIdAsync(Guid id, CancellationToken ct = default) =>
        db.Permissions.FirstOrDefaultAsync(p => p.Id == id, ct);

    public async Task<IReadOnlyList<Permission>> ListAsync(string? module, CancellationToken ct = default)
    {
        var query = db.Permissions.AsQueryable();
        if (!string.IsNullOrWhiteSpace(module))
        {
            query = query.Where(p => p.Module == module);
        }
        return await query.OrderBy(p => p.Module).ThenBy(p => p.Code).ToListAsync(ct);
    }

    public async Task<IReadOnlyList<Permission>> FindByCodesAsync(IEnumerable<string> codes, CancellationToken ct = default)
    {
        var codeList = codes.Distinct().ToList();
        return await db.Permissions.Where(p => codeList.Contains(p.Code)).ToListAsync(ct);
    }
}
