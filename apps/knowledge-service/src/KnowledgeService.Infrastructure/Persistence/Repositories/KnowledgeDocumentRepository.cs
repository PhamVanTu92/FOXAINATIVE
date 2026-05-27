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
        => await _db.KnowledgeDocuments.FirstOrDefaultAsync(x => x.Id == id, ct);

    public async Task<KnowledgeDocument?> GetByIdWithVersionsAsync(Guid id, CancellationToken ct)
        => await _db.KnowledgeDocuments
            .Include(x => x.Versions)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

    public async Task<(IReadOnlyList<KnowledgeDocument> Items, int Total)> ListAsync(
        Guid? knowledgeBaseId, string? status, string? search,
        int page, int pageSize, CancellationToken ct)
    {
        var query = _db.KnowledgeDocuments.AsNoTracking();

        if (knowledgeBaseId.HasValue)
            query = query.Where(x => x.KnowledgeBaseId == knowledgeBaseId.Value);

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

    public void Update(KnowledgeDocument document)
        => _db.KnowledgeDocuments.Update(document);
}
