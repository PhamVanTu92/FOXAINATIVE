using KnowledgeService.Application.Common.Abstractions;
using KnowledgeService.Domain.Entities;
using KnowledgeService.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace KnowledgeService.Infrastructure.Persistence.Repositories;

public class KnowledgeDocumentRepository : IKnowledgeDocumentRepository
{
    private readonly KnowledgeDbContext _db;
    public KnowledgeDocumentRepository(KnowledgeDbContext db) => _db = db;

    public async Task<KnowledgeDocument?> GetByIdAsync(Guid id, CancellationToken ct)
        => await _db.KnowledgeDocuments
            .Include(x => x.KnowledgeBases)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

    public async Task<KnowledgeDocument?> GetByIdWithVersionsAsync(Guid id, CancellationToken ct)
        => await _db.KnowledgeDocuments
            .Include(x => x.KnowledgeBases)
            .Include(x => x.Versions)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

    public async Task<(IReadOnlyList<KnowledgeDocument> Items, int Total)> ListAsync(
        Guid? knowledgeBaseId, string? status, string? search,
        int page, int pageSize, CancellationToken ct)
    {
        var query = _db.KnowledgeDocuments
            .Include(x => x.KnowledgeBases)
            .AsNoTracking();

        if (knowledgeBaseId.HasValue)
            query = query.Where(x => x.KnowledgeBases.Any(kb => kb.Id == knowledgeBaseId.Value));

        if (!string.IsNullOrWhiteSpace(status) &&
            Enum.TryParse<DocumentStatus>(status, ignoreCase: true, out var statusEnum))
            query = query.Where(x => x.Status == statusEnum);

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(x => EF.Functions.ILike(x.Title, $"%{search}%"));

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(x => x.UpdatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, total);
    }

    public async Task<IReadOnlyList<KnowledgeDocumentVersion>> ListVersionsAsync(
        Guid documentId, CancellationToken ct)
        => await _db.KnowledgeDocumentVersions
            .AsNoTracking()
            .Where(x => x.DocumentId == documentId)
            .OrderBy(x => x.CreatedAt)
            .ToListAsync(ct);

    public async Task AddAsync(KnowledgeDocument document, CancellationToken ct)
        => await _db.KnowledgeDocuments.AddAsync(document, ct);

    public async Task AddToKnowledgeBaseAsync(Guid documentId, Guid knowledgeBaseId, CancellationToken ct)
    {
        var alreadyLinked = await _db.KnowledgeBaseDocuments
            .AnyAsync(x => x.KnowledgeDocumentId == documentId && x.KnowledgeBaseId == knowledgeBaseId, ct);
        if (!alreadyLinked)
            await _db.KnowledgeBaseDocuments.AddAsync(
                new KnowledgeBaseDocument { KnowledgeBaseId = knowledgeBaseId, KnowledgeDocumentId = documentId, CreatedAt = DateTime.UtcNow }, ct);
    }

    public async Task RemoveFromKnowledgeBaseAsync(Guid documentId, Guid knowledgeBaseId, CancellationToken ct)
    {
        var link = await _db.KnowledgeBaseDocuments
            .FindAsync(new object[] { knowledgeBaseId, documentId }, ct);
        if (link is not null)
            _db.KnowledgeBaseDocuments.Remove(link);
    }

    public void Update(KnowledgeDocument document)
        => _db.KnowledgeDocuments.Update(document);

    public void AddVersion(KnowledgeDocumentVersion version)
        => _db.KnowledgeDocumentVersions.Add(version);
}
