using SystemService.Application.Common.Markers;
using SystemService.Application.Features.Users.Dtos;

namespace SystemService.Application.Features.Users.CreateUser;

public sealed record CreateUserCommand(
    string Username,
    string Email,
    string Password,
    string FullName,
    string? Phone,
    Guid? OrganizationId,
    IReadOnlyCollection<string> RoleCodes) : ITransactionalRequest<UserDto>;
