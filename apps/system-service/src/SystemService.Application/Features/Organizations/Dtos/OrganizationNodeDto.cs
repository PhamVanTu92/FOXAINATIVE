namespace SystemService.Application.Features.Organizations.Dtos;

public sealed record OrganizationNodeDto(
    Guid Id,
    string Code,
    string Name,
    Guid? ParentId,
    int Level,
    string Path,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    IReadOnlyList<OrganizationNodeDto> Children);
