namespace SystemService.Application.Features.PermissionActions.Dtos;

public sealed record PermissionActionDto(
    Guid Id,
    string Code,
    string Name,
    string? Description,
    int SortOrder,
    bool IsActive,
    DateTime CreatedAt,
    DateTime UpdatedAt);
