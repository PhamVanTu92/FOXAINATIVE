using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using SystemService.Application.Abstractions.Persistence;

namespace SystemService.Infrastructure.Persistence;

public sealed class UnitOfWork(SystemDbContext db) : IUnitOfWork
{
    public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default) =>
        db.SaveChangesAsync(cancellationToken);

    public async Task<T> ExecuteInTransactionAsync<T>(
        Func<CancellationToken, Task<T>> action,
        CancellationToken cancellationToken = default)
    {
        var strategy = db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync<T>(async ct =>
        {
            await using IDbContextTransaction tx = await db.Database.BeginTransactionAsync(ct);
            try
            {
                var result = await action(ct);
                await db.SaveChangesAsync(ct);
                await tx.CommitAsync(ct);
                return result;
            }
            catch
            {
                await tx.RollbackAsync(ct);
                throw;
            }
        }, cancellationToken);
    }
}
