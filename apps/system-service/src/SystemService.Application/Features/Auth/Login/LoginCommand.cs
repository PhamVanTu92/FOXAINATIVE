using MediatR;
using SystemService.Application.Features.Auth.Dtos;

namespace SystemService.Application.Features.Auth.Login;

public sealed record LoginCommand(string Email, string Password) : IRequest<LoginResponse>;
