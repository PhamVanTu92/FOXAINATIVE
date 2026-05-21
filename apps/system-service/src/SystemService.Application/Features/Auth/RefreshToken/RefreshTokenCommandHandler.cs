using MediatR;
using SystemService.Application.Abstractions.Clock;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Application.Abstractions.Security;
using SystemService.Application.Features.Auth.Dtos;
using SystemService.Application.Features.Auth.Login;
using SystemService.Domain.Entities;
using SystemService.Domain.Enums;
using SystemService.Domain.Exceptions;

namespace SystemService.Application.Features.Auth.RefreshToken;

public sealed class RefreshTokenCommandHandler(
    IRefreshTokenRepository refreshTokens,
    IUserRepository users,
    IJwtTokenService jwt,
    IDateTimeProvider clock,
    IUnitOfWork unitOfWork) : IRequestHandler<RefreshTokenCommand, LoginResponse>
{
    public async Task<LoginResponse> Handle(RefreshTokenCommand request, CancellationToken cancellationToken)
    {
        var providedHash = jwt.HashRefreshToken(request.RefreshToken);
        var stored = await refreshTokens.FindByHashAsync(providedHash, cancellationToken)
                     ?? throw new UnauthorizedException("Refresh token không hợp lệ.");

        var now = clock.UtcNow;
        if (!stored.IsActive(now))
        {
            throw new UnauthorizedException("Refresh token đã hết hạn hoặc bị thu hồi.");
        }

        var user = await users.FindByIdWithRolesAndPermissionsAsync(stored.UserId, cancellationToken)
                   ?? throw new UnauthorizedException("Tài khoản không tồn tại.");

        if (user.Status != UserStatus.Active)
        {
            throw new UnauthorizedException("Tài khoản không khả dụng.");
        }

        var (roles, permissions) = LoginCommandHandler.ExtractRolesAndPermissions(user);
        var newAccess = jwt.CreateAccessToken(user, roles, permissions);

        var newRefreshRaw = jwt.CreateRefreshToken();
        var newRefreshHash = jwt.HashRefreshToken(newRefreshRaw);

        stored.Revoke(now, newRefreshHash);
        refreshTokens.Add(new Domain.Entities.RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            TokenHash = newRefreshHash,
            ExpiresAt = now.AddDays(30),
        });

        await unitOfWork.SaveChangesAsync(cancellationToken);

        return new LoginResponse(
            AccessToken: newAccess.Token,
            RefreshToken: newRefreshRaw,
            ExpiresIn: newAccess.ExpiresInSeconds,
            User: new UserProfileDto(
                user.Id,
                user.Email,
                user.FullName,
                roles,
                permissions,
                user.OrganizationId));
    }
}
