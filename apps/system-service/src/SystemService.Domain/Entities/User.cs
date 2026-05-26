using SystemService.Domain.Common;
using SystemService.Domain.Enums;

namespace SystemService.Domain.Entities;

public class User : BaseEntity, IAggregateRoot
{
    /// <summary>Tên đăng nhập (lowercase, dot/dash/underscore). Unique.</summary>
    public string Username { get; set; } = default!;
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

    /// <summary>
    /// Per-user permission overrides — ghi đè quyền mặc định của role.
    /// Effective = (role grants ∪ user GRANT) ∖ user DENY.
    /// </summary>
    public ICollection<UserPermissionOverride> PermissionOverrides { get; set; } = new List<UserPermissionOverride>();
}
