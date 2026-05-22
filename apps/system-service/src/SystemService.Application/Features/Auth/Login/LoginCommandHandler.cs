using MediatR;
using SystemService.Application.Abstractions.Clock;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Application.Abstractions.Security;
using SystemService.Application.Features.Auth.Dtos;
using SystemService.Domain.Entities;
using SystemService.Domain.Enums;
using SystemService.Domain.Exceptions;

namespace SystemService.Application.Features.Auth.Login;

public sealed class LoginCommandHandler(
    IUserRepository users,
    IRefreshTokenRepository refreshTokens,
    IPasswordHasher hasher,
    IJwtTokenService jwt,
    IDateTimeProvider clock,
    IUnitOfWork unitOfWork) : IRequestHandler<LoginCommand, LoginResponse>
{
    public async Task<LoginResponse> Handle(LoginCommand request, CancellationToken cancellationToken)
    {
        var login = request.Login.Trim().ToLowerInvariant();
        var user = await users.FindByLoginWithGrantsAsync(login, cancellationToken)
                   ?? throw new UnauthorizedException("Tên đăng nhập hoặc mật khẩu không đúng.");

        if (user.Status != UserStatus.Active)
        {
            throw new UnauthorizedException("Tài khoản không khả dụng. Vui lòng liên hệ quản trị viên.");
        }

        if (!hasher.Verify(request.Password, user.PasswordHash))
        {
            throw new UnauthorizedException("Tên đăng nhập hoặc mật khẩu không đúng.");
        }

        var (roles, permissions) = ExtractRolesAndPermissions(user);
        var access = jwt.CreateAccessToken(user, roles, permissions);

        var refreshTokenRaw = jwt.CreateRefreshToken();
        var refreshTokenHash = jwt.HashRefreshToken(refreshTokenRaw);

        var now = clock.UtcNow;
        refreshTokens.Add(new Domain.Entities.RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            TokenHash = refreshTokenHash,
            ExpiresAt = now.AddDays(30),
        });

        user.LastLoginAt = now;
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return new LoginResponse(
            AccessToken: access.Token,
            RefreshToken: refreshTokenRaw,
            ExpiresIn: access.ExpiresInSeconds,
            User: new UserProfileDto(
                user.Id,
                user.Email,
                user.FullName,
                roles,
                permissions,
                user.OrganizationId));
    }

    /// <summary>
    /// Tính effective claims để embed vào JWT.
    /// - Roles: list role code.
    /// - Permissions: (∪ role grants) ∪ (user GRANT overrides) ∖ (user DENY overrides),
    ///   format "MODULE_CODE.ACTION_CODE" cho API Gateway authorize endpoint nhanh.
    /// </summary>
    internal static (IReadOnlyCollection<string> Roles, IReadOnlyCollection<string> Permissions) ExtractRolesAndPermissions(User user)
    {
        var roles = user.UserRoles.Select(ur => ur.Role.Code).Distinct().ToArray();

        var effective = new HashSet<string>(StringComparer.Ordinal);

        foreach (var rp in user.UserRoles.SelectMany(ur => ur.Role.RolePermissions))
        {
            if (rp.Module is null || rp.Action is null) continue;
            effective.Add($"{rp.Module.Code}.{rp.Action.Code}");
        }

        foreach (var up in user.PermissionOverrides)
        {
            if (up.Module is null || up.Action is null) continue;
            var key = $"{up.Module.Code}.{up.Action.Code}";
            if (up.Effect == PermissionEffect.Grant) effective.Add(key);
            else effective.Remove(key);
        }

        return (roles, effective.ToArray());
    }
}
