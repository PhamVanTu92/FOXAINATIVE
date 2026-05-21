using SystemService.Application.Common.Markers;

namespace SystemService.Application.Features.Users.UnassignRole;

public sealed record UnassignRoleCommand(Guid UserId, string RoleCode) : ITransactionalRequest<bool>;
