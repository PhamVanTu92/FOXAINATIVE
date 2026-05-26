using SystemService.Application.Common.Markers;

namespace SystemService.Application.Features.Modules.DeleteModule;

public sealed record DeleteModuleCommand(Guid Id) : ITransactionalRequest<bool>;
