namespace SystemService.Application.Features.Permissions.Dtos;

public sealed record PermissionDto(
    Guid Id,
    string Code,
    string Name,
    string Module,
    string Action,
    string Resource);
