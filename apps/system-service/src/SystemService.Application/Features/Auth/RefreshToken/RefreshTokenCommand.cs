using MediatR;
using SystemService.Application.Features.Auth.Dtos;

namespace SystemService.Application.Features.Auth.RefreshToken;

public sealed record RefreshTokenCommand(string RefreshToken) : IRequest<LoginResponse>;
