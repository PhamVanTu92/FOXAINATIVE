namespace SystemService.Application.Features.Organizations.Dtos;

public sealed record OrganizationNodeDto(
    Guid Id,
    string Code,
    string Name,
    Guid? ParentId,
    string? ParentName,
    Guid? ManagerId,
    string? ManagerName,
    int Level,
    string Path,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    IReadOnlyList<OrganizationNodeDto> Children);
