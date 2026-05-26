using SystemService.Application.Common.Markers;

namespace SystemService.Application.Features.Users.AssignRole;

public sealed record AssignRoleCommand(Guid UserId, string RoleCode) : ITransactionalRequest<bool>;
