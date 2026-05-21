using MediatR;
using SystemService.Application.Abstractions.Clock;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Application.Abstractions.Security;
using SystemService.Domain.Exceptions;

namespace SystemService.Application.Features.Users.ChangePassword;

public sealed class ChangePasswordCommandHandler(
    IUserRepository users,
    IRefreshTokenRepository refreshTokens,
    IPasswordHasher hasher,
    IDateTimeProvider clock) : IRequestHandler<ChangePasswordCommand, bool>
{
    public async Task<bool> Handle(ChangePasswordCommand request, CancellationToken cancellationToken)
    {
        var user = await users.FindByIdAsync(request.UserId, cancellationToken)
                   ?? throw new NotFoundException("User", request.UserId);

        if (!hasher.Verify(request.OldPassword, user.PasswordHash))
        {
            throw new UnauthorizedException("Mật khẩu hiện tại không đúng.");
        }

        user.PasswordHash = hasher.Hash(request.NewPassword);
        await refreshTokens.RevokeAllForUserAsync(user.Id, clock.UtcNow, cancellationToken);
        return true;
    }
}
