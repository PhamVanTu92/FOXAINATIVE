using SystemService.Application.Common.Markers;

namespace SystemService.Application.Features.Roles.DeleteRole;

public sealed record DeleteRoleCommand(Guid Id) : ITransactionalRequest<bool>;
