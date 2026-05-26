namespace SystemService.Application.Features.Modules.Dtos;

public sealed record ModuleDto(
    Guid Id,
    Guid GroupId,
    string GroupCode,
    string GroupName,
    string Code,
    string Name,
    string? Description,
    int SortOrder,
    bool IsActive,
    DateTime CreatedAt,
    DateTime UpdatedAt);
