using MediatR;
using SystemService.Application.Abstractions.Clock;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Domain.Enums;
using SystemService.Domain.Exceptions;

namespace SystemService.Application.Features.Users.DeleteUser;

public sealed class DeleteUserCommandHandler(
    IUserRepository users,
    IRefreshTokenRepository refreshTokens,
    IDateTimeProvider clock) : IRequestHandler<DeleteUserCommand, bool>
{
    public async Task<bool> Handle(DeleteUserCommand request, CancellationToken cancellationToken)
    {
        var user = await users.FindByIdAsync(request.Id, cancellationToken)
                   ?? throw new NotFoundException("User", request.Id);

        user.Status = UserStatus.Inactive;
        await refreshTokens.RevokeAllForUserAsync(user.Id, clock.UtcNow, cancellationToken);
        return true;
    }
}
