using MediatR;
using SystemService.Application.Features.Auth.Dtos;

namespace SystemService.Application.Features.Auth.ValidateToken;

public sealed record ValidateTokenQuery(string AccessToken) : IRequest<ValidateTokenResult>;

public sealed record ValidateTokenResult(bool Valid, UserProfileDto? User, string? Error);
