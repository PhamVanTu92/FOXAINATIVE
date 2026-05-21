using SystemService.Domain.Entities;

namespace SystemService.Application.Abstractions.Security;

public interface IJwtTokenService
{
    AccessTokenResult CreateAccessToken(User user, IReadOnlyCollection<string> roles, IReadOnlyCollection<string> permissions);

    string CreateRefreshToken();

    string HashRefreshToken(string token);

    ValidatedAccessToken? ValidateAccessToken(string accessToken);
}

public sealed record AccessTokenResult(string Token, DateTime ExpiresAtUtc, long ExpiresInSeconds, string Jti);

public sealed record ValidatedAccessToken(Guid UserId, string Email, IReadOnlyCollection<string> Roles, IReadOnlyCollection<string> Permissions);
