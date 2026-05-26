using KnowledgeService.Application.Common.Abstractions;

namespace KnowledgeService.Infrastructure.Persistence.Repositories;

public class UnitOfWork : IUnitOfWork
{
    private readonly KnowledgeDbContext _db;
    public UnitOfWork(KnowledgeDbContext db) => _db = db;
    public Task<int> SaveChangesAsync(CancellationToken ct) => _db.SaveChangesAsync(ct);
}
