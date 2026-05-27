using SystemService.Application.Common.Markers;

namespace SystemService.Application.Features.ModuleGroups.DeleteModuleGroup;

public sealed record DeleteModuleGroupCommand(Guid Id) : ITransactionalRequest<bool>;
