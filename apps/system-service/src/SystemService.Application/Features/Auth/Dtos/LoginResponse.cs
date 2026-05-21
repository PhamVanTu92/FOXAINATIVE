namespace SystemService.Application.Features.Auth.Dtos;

public sealed record LoginResponse(
    string AccessToken,
    string RefreshToken,
    long ExpiresIn,
    UserProfileDto User);
