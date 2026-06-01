using KnowledgeService.Application.Common.Abstractions;
using KnowledgeService.Domain.Entities;
using KnowledgeService.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace KnowledgeService.Infrastructure.Persistence.Repositories;

public class KnowledgeFileRepository : IKnowledgeFileRepository
{
    private readonly KnowledgeDbContext _db;
    public KnowledgeFileRepository(KnowledgeDbContext db) => _db = db;

    public async Task<KnowledgeFile?> GetByIdAsync(Guid id, CancellationToken ct)
        => await _db.KnowledgeFiles
            .Include(x => x.KnowledgeBases)
            .Include(x => x.Permissions)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

    public async Task<(IReadOnlyList<KnowledgeFile> Items, int Total)> ListAsync(
        Guid knowledgeBaseId, string? search, FileType? fileType, int page, int pageSize, CancellationToken ct)
    {
        var query = _db.KnowledgeFiles
            .Include(x => x.KnowledgeBases)
            .Include(x => x.Permissions)
            .Where(x => x.KnowledgeBases.Any(kb => kb.Id == knowledgeBaseId))
            .AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(x => EF.Functions.ILike(x.FileName, $"%{search}%"));

        if (fileType.HasValue)
            query = query.Where(x => x.FileType == fileType.Value);

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(x => x.UploadedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, total);
    }

    public async Task<(IReadOnlyList<KnowledgeFile> Items, int Total, Dictionary<FileType, int> TypeCounts)> ListAllAsync(
        string? search, FileType? fileType, int page, int pageSize, CancellationToken ct)
    {
        var baseFilter = _db.KnowledgeFiles.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
            baseFilter = baseFilter.Where(x => EF.Functions.ILike(x.FileName, $"%{search}%"));

        var typeCounts = await baseFilter
            .GroupBy(x => x.FileType)
            .Select(g => new { Type = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        var counts = typeCounts.ToDictionary(x => x.Type, x => x.Count);

        IQueryable<KnowledgeFile> filteredQuery = baseFilter
            .Include(x => x.KnowledgeBases)
            .Include(x => x.Permissions);

        if (fileType.HasValue)
            filteredQuery = filteredQuery.Where(x => x.FileType == fileType.Value);

        var total = await filteredQuery.CountAsync(ct);
        var items = await filteredQuery
            .OrderByDescending(x => x.UploadedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, total, counts);
    }

    public Task<KnowledgeFile?> GetBySourceDocumentIdAsync(Guid documentId, CancellationToken ct)
        => _db.KnowledgeFiles
            .Include(x => x.KnowledgeBases)
            .FirstOrDefaultAsync(f => f.SourceDocumentId == documentId, ct);

    public Task<bool> IsInKnowledgeBaseAsync(Guid fileId, Guid knowledgeBaseId, CancellationToken ct)
        => _db.KnowledgeBaseFiles
            .AnyAsync(x => x.KnowledgeFileId == fileId && x.KnowledgeBaseId == knowledgeBaseId, ct);

    public async Task AddAsync(KnowledgeFile file, CancellationToken ct)
        => await _db.KnowledgeFiles.AddAsync(file, ct);

    public async Task AddToKnowledgeBaseAsync(Guid fileId, Guid knowledgeBaseId, CancellationToken ct)
    {
        var alreadyLinked = await _db.KnowledgeBaseFiles
            .AnyAsync(x => x.KnowledgeFileId == fileId && x.KnowledgeBaseId == knowledgeBaseId, ct);
        if (!alreadyLinked)
            await _db.KnowledgeBaseFiles.AddAsync(
                new KnowledgeBaseFile { KnowledgeBaseId = knowledgeBaseId, KnowledgeFileId = fileId, CreatedAt = DateTime.UtcNow }, ct);
    }

    public async Task RemoveFromKnowledgeBaseAsync(Guid fileId, Guid knowledgeBaseId, CancellationToken ct)
    {
        var link = await _db.KnowledgeBaseFiles
            .FindAsync(new object[] { knowledgeBaseId, fileId }, ct);
        if (link is not null)
            _db.KnowledgeBaseFiles.Remove(link);
    }

    public async Task RemoveFromAllKnowledgeBasesAsync(Guid fileId, CancellationToken ct)
    {
        var links = await _db.KnowledgeBaseFiles
            .Where(x => x.KnowledgeFileId == fileId)
            .ToListAsync(ct);
        _db.KnowledgeBaseFiles.RemoveRange(links);
    }

    public void Update(KnowledgeFile file)
        => _db.KnowledgeFiles.Update(file);

    public void Delete(KnowledgeFile file)
        => _db.KnowledgeFiles.Remove(file);

    public void RemovePermissions(IEnumerable<KnowledgeFilePermission> permissions)
        => _db.KnowledgeFilePermissions.RemoveRange(permissions);

    public async Task AddPermissionsAsync(IEnumerable<KnowledgeFilePermission> permissions, CancellationToken ct)
        => await _db.KnowledgeFilePermissions.AddRangeAsync(permissions, ct);
}
