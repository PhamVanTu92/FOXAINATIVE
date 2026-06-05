using KnowledgeService.Domain.Entities;
using KnowledgeService.Domain.Enums;

namespace KnowledgeService.Application.Common.Abstractions;

public interface IKnowledgeFileRepository
{
    Task<KnowledgeFile?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<(IReadOnlyList<KnowledgeFile> Items, int Total)> ListAsync(
        Guid knowledgeBaseId, string? search, FileType? fileType, int page, int pageSize, CancellationToken ct = default);
    Task<KnowledgeFile?> GetBySourceDocumentIdAsync(Guid documentId, CancellationToken ct = default);
    Task AddAsync(KnowledgeFile file, CancellationToken ct = default);
    void Update(KnowledgeFile file);
    void Delete(KnowledgeFile file);
    void RemovePermissions(IEnumerable<KnowledgeFilePermission> permissions);
    Task AddPermissionsAsync(IEnumerable<KnowledgeFilePermission> permissions, CancellationToken ct);
}
