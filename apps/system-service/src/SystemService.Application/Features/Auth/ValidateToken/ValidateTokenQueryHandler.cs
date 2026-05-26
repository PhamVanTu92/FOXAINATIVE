using MediatR;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Application.Abstractions.Security;
using SystemService.Application.Features.Auth.Dtos;
using SystemService.Application.Features.Auth.Login;
using SystemService.Domain.Enums;

namespace SystemService.Application.Features.Auth.ValidateToken;

public sealed class ValidateTokenQueryHandler(
    IJwtTokenService jwt,
    IUserRepository users) : IRequestHandler<ValidateTokenQuery, ValidateTokenResult>
{
    public async Task<ValidateTokenResult> Handle(ValidateTokenQuery request, CancellationToken cancellationToken)
    {
        var validated = jwt.ValidateAccessToken(request.AccessToken);
        if (validated is null)
        {
            return new ValidateTokenResult(false, null, "Token không hợp lệ hoặc đã hết hạn.");
        }

        var user = await users.FindByIdWithGrantsAsync(validated.UserId, cancellationToken);
        if (user is null || user.Status != UserStatus.Active)
        {
            return new ValidateTokenResult(false, null, "Tài khoản không khả dụng.");
        }

        var (roles, permissions) = LoginCommandHandler.ExtractRolesAndPermissions(user);
        var profile = new UserProfileDto(user.Id, user.Email, user.FullName, roles, permissions, user.OrganizationId);
        return new ValidateTokenResult(true, profile, null);
    }
}
