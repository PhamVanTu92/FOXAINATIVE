using SystemService.Domain.Common;

namespace SystemService.Domain.Entities;

public class RefreshToken : BaseEntity, IAggregateRoot
{
    public Guid UserId { get; set; }
    public string TokenHash { get; set; } = default!;
    public DateTime ExpiresAt { get; set; }
    public DateTime? RevokedAt { get; set; }
    public string? ReplacedByTokenHash { get; set; }

    public User User { get; set; } = default!;

    public bool IsActive(DateTime now) => RevokedAt is null && now < ExpiresAt;

    public void Revoke(DateTime now, string? replacedByHash = null)
    {
        RevokedAt = now;
        ReplacedByTokenHash = replacedByHash;
    }
}
