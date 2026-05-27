using SystemService.Application.Common.Markers;

namespace SystemService.Application.Features.PermissionActions.DeletePermissionAction;

public sealed record DeletePermissionActionCommand(Guid Id) : ITransactionalRequest<bool>;
