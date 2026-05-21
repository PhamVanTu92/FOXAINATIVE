using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using SystemService.Application.Abstractions.Clock;
using SystemService.Application.Abstractions.Security;
using SystemService.Domain.Entities;

namespace SystemService.Infrastructure.Security;

public sealed class JwtTokenService(IOptions<JwtOptions> options, IDateTimeProvider clock) : IJwtTokenService
{
    private readonly JwtOptions _options = options.Value;
    private readonly TokenValidationParameters _validationParameters = BuildValidationParameters(options.Value);

    public AccessTokenResult CreateAccessToken(
        User user,
        IReadOnlyCollection<string> roles,
        IReadOnlyCollection<string> permissions)
    {
        var lifetime = _options.ParseAccessTokenLifetime();
        var now = clock.UtcNow;
        var expiresAt = now.Add(lifetime);
        var jti = Guid.NewGuid().ToString("N");

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email),
            new(JwtRegisteredClaimNames.Name, user.FullName),
            new(JwtRegisteredClaimNames.Jti, jti),
        };

        foreach (var role in roles)
        {
            claims.Add(new Claim("roles", role));
        }

        foreach (var permission in permissions)
        {
            claims.Add(new Claim("permissions", permission));
        }

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.Secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _options.Issuer,
            audience: _options.Audience,
            claims: claims,
            notBefore: now,
            expires: expiresAt,
            signingCredentials: creds);

        var tokenString = new JwtSecurityTokenHandler().WriteToken(token);
        return new AccessTokenResult(tokenString, expiresAt, (long)lifetime.TotalSeconds, jti);
    }

    public string CreateRefreshToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(64);
        return Convert.ToBase64String(bytes);
    }

    public string HashRefreshToken(string token)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(token));
        return Convert.ToHexString(bytes);
    }

    public ValidatedAccessToken? ValidateAccessToken(string accessToken)
    {
        if (string.IsNullOrWhiteSpace(accessToken))
        {
            return null;
        }

        try
        {
            var handler = new JwtSecurityTokenHandler { MapInboundClaims = false };
            var principal = handler.ValidateToken(accessToken, _validationParameters, out var validatedToken);

            if (validatedToken is not JwtSecurityToken jwt ||
                !jwt.Header.Alg.Equals(SecurityAlgorithms.HmacSha256, StringComparison.Ordinal))
            {
                return null;
            }

            var sub = principal.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;
            if (!Guid.TryParse(sub, out var userId))
            {
                return null;
            }

            var email = principal.FindFirst(JwtRegisteredClaimNames.Email)?.Value ?? string.Empty;
            var roles = principal.FindAll("roles").Select(c => c.Value).ToArray();
            var permissions = principal.FindAll("permissions").Select(c => c.Value).ToArray();

            return new ValidatedAccessToken(userId, email, roles, permissions);
        }
        catch (Exception ex) when (ex is SecurityTokenException or ArgumentException)
        {
            return null;
        }
    }

    private static TokenValidationParameters BuildValidationParameters(JwtOptions opts) => new()
    {
        ValidateIssuer = true,
        ValidIssuer = opts.Issuer,
        ValidateAudience = true,
        ValidAudience = opts.Audience,
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(opts.Secret)),
        ValidateLifetime = true,
        ClockSkew = TimeSpan.FromSeconds(30),
        ValidAlgorithms = new[] { SecurityAlgorithms.HmacSha256 },
    };
}
