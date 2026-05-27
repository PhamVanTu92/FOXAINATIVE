using KnowledgeService.Domain.Entities;

namespace KnowledgeService.Application.Common.Abstractions;

public interface IKnowledgeBaseRepository
{
    Task<KnowledgeBase?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<KnowledgeBase?> GetByIdWithFilesAsync(Guid id, CancellationToken ct = default);
    Task<bool> ExistsByCodeAsync(string code, CancellationToken ct = default);
    Task<(IReadOnlyList<KnowledgeBase> Items, int Total)> ListAsync(
        string? search, Guid? departmentId, int page, int pageSize, CancellationToken ct = default);
    Task<(int totalBases, int totalFiles, int departmentsUsing, DateTime? lastUpdatedAt)> GetStatsAsync(CancellationToken ct = default);
    Task AddAsync(KnowledgeBase kb, CancellationToken ct = default);
    void Update(KnowledgeBase kb);
    void Delete(KnowledgeBase kb);
}
