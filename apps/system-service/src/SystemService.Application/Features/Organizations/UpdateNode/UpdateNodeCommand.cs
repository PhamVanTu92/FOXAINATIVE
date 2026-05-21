using SystemService.Application.Common.Markers;
using SystemService.Application.Features.Organizations.Dtos;

namespace SystemService.Application.Features.Organizations.UpdateNode;

public sealed record UpdateNodeCommand(Guid Id, string? Name) : ITransactionalRequest<OrganizationNodeDto>;
