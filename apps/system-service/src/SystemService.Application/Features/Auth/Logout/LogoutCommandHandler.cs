using MediatR;
using SystemService.Application.Abstractions.Clock;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Application.Abstractions.Security;

namespace SystemService.Application.Features.Auth.Logout;

public sealed class LogoutCommandHandler(
    IRefreshTokenRepository refreshTokens,
    IJwtTokenService jwt,
    IDateTimeProvider clock,
    IUnitOfWork unitOfWork) : IRequestHandler<LogoutCommand, bool>
{
    public async Task<bool> Handle(LogoutCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.RefreshToken))
        {
            return true;
        }

        var hash = jwt.HashRefreshToken(request.RefreshToken);
        var token = await refreshTokens.FindByHashAsync(hash, cancellationToken);
        if (token is null || token.RevokedAt is not null)
        {
            return true;
        }

        token.Revoke(clock.UtcNow);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return true;
    }
}
