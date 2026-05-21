using SystemService.Application.Common.Markers;
using SystemService.Application.Features.Users.Dtos;

namespace SystemService.Application.Features.Users.UpdateUser;

public sealed record UpdateUserCommand(
    Guid Id,
    string? FullName,
    string? Phone,
    string? AvatarUrl,
    Guid? OrganizationId) : ITransactionalRequest<UserDto>;
