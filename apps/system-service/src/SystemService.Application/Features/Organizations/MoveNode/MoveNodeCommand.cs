using SystemService.Application.Common.Markers;
using SystemService.Application.Features.Organizations.Dtos;

namespace SystemService.Application.Features.Organizations.MoveNode;

public sealed record MoveNodeCommand(Guid Id, Guid? NewParentId) : ITransactionalRequest<OrganizationNodeDto>;
