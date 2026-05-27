using SystemService.Domain.Enums;

namespace SystemService.Application.Features.Users.Dtos;

public sealed record UserDto(
    Guid Id,
    string Username,
    string Email,
    string FullName,
    string? Phone,
    string? AvatarUrl,
    UserStatus Status,
    Guid? OrganizationId,
    IReadOnlyCollection<string> Roles,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    DateTime? LastLoginAt);
