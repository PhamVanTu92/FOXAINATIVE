using SystemService.Domain.Common;
using SystemService.Domain.Enums;

namespace SystemService.Domain.Entities;

public class User : BaseEntity, IAggregateRoot
{
    public string Email { get; set; } = default!;
    public string PasswordHash { get; set; } = default!;
    public string FullName { get; set; } = default!;
    public string? Phone { get; set; }
    public string? AvatarUrl { get; set; }
    public UserStatus Status { get; set; } = UserStatus.Active;
    public Guid? OrganizationId { get; set; }
    public DateTime? LastLoginAt { get; set; }

    public OrganizationNode? Organization { get; set; }
    public ICollection<UserRole> UserRoles { get; set; } = new List<UserRole>();
    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
}
