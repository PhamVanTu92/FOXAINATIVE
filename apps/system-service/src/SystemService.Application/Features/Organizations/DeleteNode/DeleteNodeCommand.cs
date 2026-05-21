using SystemService.Application.Common.Markers;

namespace SystemService.Application.Features.Organizations.DeleteNode;

public sealed record DeleteNodeCommand(Guid Id) : ITransactionalRequest<bool>;
