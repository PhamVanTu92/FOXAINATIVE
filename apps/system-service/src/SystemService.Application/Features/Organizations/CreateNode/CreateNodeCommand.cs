using SystemService.Application.Common.Markers;
using SystemService.Application.Features.Organizations.Dtos;

namespace SystemService.Application.Features.Organizations.CreateNode;

public sealed record CreateNodeCommand(string Code, string Name, Guid? ParentId) : ITransactionalRequest<OrganizationNodeDto>;
