using SystemService.Domain.Entities;

namespace SystemService.Application.Abstractions.Persistence;

public interface IRefreshTokenRepository
{
    Task<RefreshToken?> FindByHashAsync(string tokenHash, CancellationToken ct = default);

    Task<IReadOnlyList<RefreshToken>> FindActiveByUserAsync(Guid userId, DateTime nowUtc, CancellationToken ct = default);

    void Add(RefreshToken token);

    Task RevokeAllForUserAsync(Guid userId, DateTime nowUtc, CancellationToken ct = default);
}
