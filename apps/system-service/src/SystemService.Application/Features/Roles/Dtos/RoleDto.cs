namespace SystemService.Application.Features.Roles.Dtos;

public sealed record RoleDto(
    Guid Id,
    string Code,
    string Name,
    string? Description,
    bool IsSystem,
    IReadOnlyCollection<string> Permissions,
    DateTime CreatedAt,
    DateTime UpdatedAt);
