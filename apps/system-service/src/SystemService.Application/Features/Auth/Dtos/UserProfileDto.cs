namespace SystemService.Application.Features.Auth.Dtos;

public sealed record UserProfileDto(
    Guid Id,
    string Email,
    string FullName,
    IReadOnlyCollection<string> Roles,
    IReadOnlyCollection<string> Permissions,
    Guid? OrganizationId);
