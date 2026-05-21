using MediatR;
using SystemService.Application.Abstractions.Clock;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Application.Features.Users.Dtos;
using SystemService.Application.Features.Users.Mappings;
using SystemService.Domain.Enums;
using SystemService.Domain.Exceptions;

namespace SystemService.Application.Features.Users.ChangeStatus;

public sealed class ChangeStatusCommandHandler(
    IUserRepository users,
    IRefreshTokenRepository refreshTokens,
    IDateTimeProvider clock) : IRequestHandler<ChangeStatusCommand, UserDto>
{
    public async Task<UserDto> Handle(ChangeStatusCommand request, CancellationToken cancellationToken)
    {
        var user = await users.FindByIdWithRolesAndPermissionsAsync(request.UserId, cancellationToken)
                   ?? throw new NotFoundException("User", request.UserId);

        user.Status = request.Status;

        if (request.Status is UserStatus.Locked or UserStatus.Inactive)
        {
            await refreshTokens.RevokeAllForUserAsync(user.Id, clock.UtcNow, cancellationToken);
        }

        return user.ToDto();
    }
}
