using MediatR;

namespace SystemService.Application.Features.Auth.Logout;

public sealed record LogoutCommand(string RefreshToken) : IRequest<bool>;
