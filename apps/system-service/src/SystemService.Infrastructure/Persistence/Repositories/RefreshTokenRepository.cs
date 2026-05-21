using Microsoft.EntityFrameworkCore;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Domain.Entities;

namespace SystemService.Infrastructure.Persistence.Repositories;

public sealed class RefreshTokenRepository(SystemDbContext db) : IRefreshTokenRepository
{
    public Task<RefreshToken?> FindByHashAsync(string tokenHash, CancellationToken ct = default) =>
        db.RefreshTokens
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.TokenHash == tokenHash, ct);

    public async Task<IReadOnlyList<RefreshToken>> FindActiveByUserAsync(Guid userId, DateTime nowUtc, CancellationToken ct = default) =>
        await db.RefreshTokens
            .Where(t => t.UserId == userId && t.RevokedAt == null && t.ExpiresAt > nowUtc)
            .ToListAsync(ct);

    public void Add(RefreshToken token) => db.RefreshTokens.Add(token);

    public async Task RevokeAllForUserAsync(Guid userId, DateTime nowUtc, CancellationToken ct = default)
    {
        var active = await db.RefreshTokens
            .Where(t => t.UserId == userId && t.RevokedAt == null && t.ExpiresAt > nowUtc)
            .ToListAsync(ct);

        foreach (var token in active)
        {
            token.Revoke(nowUtc);
        }
    }
}
