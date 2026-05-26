using KnowledgeService.Domain.Entities;

namespace KnowledgeService.Application.Common.Abstractions;

public interface IKnowledgeDocumentRepository
{
    Task<KnowledgeDocument?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<KnowledgeDocument?> GetByIdWithVersionsAsync(Guid id, CancellationToken ct = default);
    Task<(IReadOnlyList<KnowledgeDocument> Items, int Total)> ListAsync(
        Guid? knowledgeBaseId, string? status, string? search,
        int page, int pageSize, CancellationToken ct = default);
    Task<IReadOnlyList<KnowledgeDocumentVersion>> ListVersionsAsync(
        Guid documentId, CancellationToken ct = default);
    Task AddAsync(KnowledgeDocument document, CancellationToken ct = default);
    void Update(KnowledgeDocument document);
}
