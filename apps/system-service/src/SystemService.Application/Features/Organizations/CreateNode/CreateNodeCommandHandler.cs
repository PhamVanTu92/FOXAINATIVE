using MediatR;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Application.Features.Organizations.Dtos;
using SystemService.Application.Features.Organizations.Mappings;
using SystemService.Domain.Entities;
using SystemService.Domain.Exceptions;

namespace SystemService.Application.Features.Organizations.CreateNode;

public sealed class CreateNodeCommandHandler(IOrganizationRepository organizations)
    : IRequestHandler<CreateNodeCommand, OrganizationNodeDto>
{
    public async Task<OrganizationNodeDto> Handle(CreateNodeCommand request, CancellationToken cancellationToken)
    {
        var code = request.Code.Trim();
        if (await organizations.CodeExistsAsync(code, cancellationToken))
        {
            throw new CodeAlreadyExistsException("OrganizationNode", code);
        }

        OrganizationNode? parent = null;
        if (request.ParentId is { } parentId)
        {
            parent = await organizations.FindByIdAsync(parentId, cancellationToken)
                     ?? throw new NotFoundException("OrganizationNode", parentId);
        }

        var node = new OrganizationNode
        {
            Id = Guid.NewGuid(),
            Code = code,
            Name = request.Name.Trim(),
            ParentId = parent?.Id,
            Level = parent is null ? 0 : parent.Level + 1,
            Path = OrganizationNode.BuildPath(parent?.Path, code),
        };

        organizations.Add(node);
        return node.ToDto();
    }
}
