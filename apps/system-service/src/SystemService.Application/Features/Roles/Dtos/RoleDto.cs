namespace SystemService.Application.Features.Roles.Dtos;

public sealed record RoleDto(
    Guid Id,
    string Code,
    string Name,
    string? Description,
    bool IsSystem,
    IReadOnlyCollection<RoleGrantDto> Grants,
    DateTime CreatedAt,
    DateTime UpdatedAt);

/// <summary>
/// 1 ô đánh dấu trong UI grid phân quyền: Role được cấp Action trên Module.
/// </summary>
public sealed record RoleGrantDto(
    Guid ModuleId,
    string ModuleCode,
    string ModuleName,
    Guid ActionId,
    string ActionCode,
    string ActionName);
