using Microsoft.EntityFrameworkCore;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Domain.Entities;

namespace SystemService.Infrastructure.Persistence.Repositories;

public sealed class OrganizationRepository(SystemDbContext db) : IOrganizationRepository
{
    public Task<OrganizationNode?> FindByIdAsync(Guid id, CancellationToken ct = default) =>
        db.OrganizationNodes.Include(o => o.Manager).FirstOrDefaultAsync(o => o.Id == id, ct);

    public Task<OrganizationNode?> FindByCodeAsync(string code, CancellationToken ct = default) =>
        db.OrganizationNodes.Include(o => o.Manager).FirstOrDefaultAsync(o => o.Code == code, ct);

    public Task<bool> CodeExistsAsync(string code, CancellationToken ct = default) =>
        db.OrganizationNodes.AnyAsync(o => o.Code == code, ct);

    public Task<bool> HasChildrenAsync(Guid nodeId, CancellationToken ct = default) =>
        db.OrganizationNodes.AnyAsync(o => o.ParentId == nodeId, ct);

    public Task<bool> HasUsersAsync(Guid nodeId, CancellationToken ct = default) =>
        db.Users.AnyAsync(u => u.OrganizationId == nodeId, ct);

    public async Task<IReadOnlyList<OrganizationNode>> GetTreeAsync(Guid? rootId, CancellationToken ct = default)
    {
        if (rootId is null)
        {
            return await db.OrganizationNodes
                .Include(o => o.Manager)
                .OrderBy(o => o.Path)
                .ToListAsync(ct);
        }

        var root = await db.OrganizationNodes.FirstOrDefaultAsync(o => o.Id == rootId.Value, ct);
        if (root is null)
        {
            return Array.Empty<OrganizationNode>();
        }

        var prefix = root.Path;
        return await db.OrganizationNodes
            .Include(o => o.Manager)
            .Where(o => o.Path == prefix || o.Path.StartsWith(prefix + "/"))
            .OrderBy(o => o.Path)
            .ToListAsync(ct);
    }

    public async Task<(IReadOnlyList<OrganizationNode> Items, long Total)> SearchAsync(
        int page, int pageSize, string? search, CancellationToken ct = default)
    {
        var query = db.OrganizationNodes.Include(o => o.Manager).AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = $"%{search.Trim()}%";
            query = query.Where(o =>
                EF.Functions.ILike(o.Name, pattern) ||
                EF.Functions.ILike(o.Code, pattern));
        }

        var total = await query.LongCountAsync(ct);
        var items = await query
            .OrderBy(o => o.Path)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, total);
    }

    public async Task<IReadOnlyList<OrganizationNode>> GetDescendantsAsync(string pathPrefix, CancellationToken ct = default) =>
        await db.OrganizationNodes
            .Where(o => o.Path.StartsWith(pathPrefix + "/"))
            .ToListAsync(ct);

    public void Add(OrganizationNode node) => db.OrganizationNodes.Add(node);

    public void Remove(OrganizationNode node) => db.OrganizationNodes.Remove(node);
}
