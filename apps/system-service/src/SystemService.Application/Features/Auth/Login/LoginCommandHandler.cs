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
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var user = await users.FindByEmailWithRolesAndPermissionsAsync(normalizedEmail, cancellationToken)
                   ?? throw new UnauthorizedException("Email hoặc mật khẩu không đúng.");

        if (user.Status != UserStatus.Active)
        {
            throw new UnauthorizedException("Tài khoản không khả dụng. Vui lòng liên hệ quản trị viên.");
        }

        if (!hasher.Verify(request.Password, user.PasswordHash))
        {
            throw new UnauthorizedException("Email hoặc mật khẩu không đúng.");
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

    internal static (IReadOnlyCollection<string> Roles, IReadOnlyCollection<string> Permissions) ExtractRolesAndPermissions(User user)
    {
        var roles = user.UserRoles.Select(ur => ur.Role.Code).Distinct().ToArray();
        var permissions = user.UserRoles
            .SelectMany(ur => ur.Role.RolePermissions)
            .Select(rp => rp.Permission.Code)
            .Distinct()
            .ToArray();
        return (roles, permissions);
    }
}
