using Foxai.Common;
using Foxai.System.V1;
using Grpc.Core;
using MediatR;
using SystemService.Api.Mapping;
using SystemService.Application.Features.Auth.Login;
using SystemService.Application.Features.Auth.Logout;
using SystemService.Application.Features.Auth.RefreshToken;
using SystemService.Application.Features.Auth.ValidateToken;

namespace SystemService.Api.GrpcServices;

public sealed class AuthGrpcService(ISender sender) : AuthService.AuthServiceBase
{
    public override async Task<LoginResponse> Login(LoginRequest request, ServerCallContext context)
    {
        var result = await sender.Send(new LoginCommand(request.Login, request.Password), context.CancellationToken);
        return result.ToProto();
    }

    public override async Task<LoginResponse> RefreshToken(RefreshTokenRequest request, ServerCallContext context)
    {
        var result = await sender.Send(new RefreshTokenCommand(request.RefreshToken), context.CancellationToken);
        return result.ToProto();
    }

    public override async Task<ValidateTokenResponse> ValidateToken(ValidateTokenRequest request, ServerCallContext context)
    {
        var result = await sender.Send(new ValidateTokenQuery(request.AccessToken), context.CancellationToken);
        var response = new ValidateTokenResponse { Valid = result.Valid };
        if (result.User is not null)
        {
            response.User = result.User.ToProto();
        }
        if (!string.IsNullOrEmpty(result.Error))
        {
            response.Error = result.Error;
        }
        return response;
    }

    public override async Task<EmptyResponse> Logout(LogoutRequest request, ServerCallContext context)
    {
        await sender.Send(new LogoutCommand(request.RefreshToken), context.CancellationToken);
        return AuthMappings.Empty();
    }
}
