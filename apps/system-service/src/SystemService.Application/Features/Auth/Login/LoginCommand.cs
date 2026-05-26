using MediatR;
using SystemService.Application.Features.Auth.Dtos;

namespace SystemService.Application.Features.Auth.Login;

/// <summary>
/// Login: identifier có thể là username (lowercase) hoặc email (lowercase).
/// </summary>
public sealed record LoginCommand(string Login, string Password) : IRequest<LoginResponse>;
