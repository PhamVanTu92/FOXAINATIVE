using KnowledgeService.Application.Common.Abstractions;
using KnowledgeService.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace KnowledgeService.Infrastructure.Persistence.Repositories;

public class KnowledgeBaseRepository : IKnowledgeBaseRepository
{
    private readonly KnowledgeDbContext _db;
    public KnowledgeBaseRepository(KnowledgeDbContext db) => _db = db;

    public async Task<KnowledgeBase?> GetByIdAsync(Guid id, CancellationToken ct)
        => await _db.KnowledgeBases
            .Include(x => x.Permissions)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

    public async Task<KnowledgeBase?> GetByIdWithFilesAsync(Guid id, CancellationToken ct)
        => await _db.KnowledgeBases
            .Include(x => x.Permissions)
            .Include(x => x.Files).ThenInclude(f => f.Permissions)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

    public async Task<bool> ExistsByCodeAsync(string code, CancellationToken ct)
        => await _db.KnowledgeBases.AnyAsync(x => x.Code == code.ToUpperInvariant(), ct);

    public async Task<(IReadOnlyList<KnowledgeBase> Items, int Total)> ListAsync(
        string? search, Guid? departmentId, int page, int pageSize, CancellationToken ct)
    {
        var query = _db.KnowledgeBases
            .Include(x => x.Permissions)
            .Include(x => x.Files)
            .AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(x =>
                EF.Functions.ILike(x.Name, $"%{search}%") ||
                EF.Functions.ILike(x.Code, $"%{search}%"));

        if (departmentId.HasValue)
            query = query.Where(x =>
                x.ManagingDepartmentId == departmentId.Value ||
                x.Permissions.Any(p => p.DepartmentId == departmentId.Value));

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(x => x.UpdatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, total);
    }

    public async Task<(int totalBases, int totalFiles, int departmentsUsing, DateTime? lastUpdatedAt)> GetStatsAsync(CancellationToken ct)
    {
        var totalBases = await _db.KnowledgeBases.CountAsync(ct);
        var totalFiles = await _db.KnowledgeFiles.CountAsync(ct);
        var lastUpdatedAt = await _db.KnowledgeBases
            .OrderByDescending(x => x.UpdatedAt)
            .Select(x => (DateTime?)x.UpdatedAt)
            .FirstOrDefaultAsync(ct);

        // DISTINCT departments: managing + permitted
        var managingDepts = await _db.KnowledgeBases
            .Select(x => x.ManagingDepartmentId).Distinct().ToListAsync(ct);
        var permittedDepts = await _db.KnowledgeBasePermissions
            .Select(x => x.DepartmentId).Distinct().ToListAsync(ct);
        var departmentsUsing = managingDepts.Union(permittedDepts).Distinct().Count();

        return (totalBases, totalFiles, departmentsUsing, lastUpdatedAt);
    }

    public async Task AddAsync(KnowledgeBase kb, CancellationToken ct)
        => await _db.KnowledgeBases.AddAsync(kb, ct);

    public void Update(KnowledgeBase kb)
        => _db.KnowledgeBases.Update(kb);

    public void Delete(KnowledgeBase kb)
        => _db.KnowledgeBases.Remove(kb);
}
