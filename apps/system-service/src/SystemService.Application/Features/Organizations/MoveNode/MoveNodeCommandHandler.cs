using MediatR;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Application.Features.Organizations.Dtos;
using SystemService.Application.Features.Organizations.Mappings;
using SystemService.Domain.Entities;
using SystemService.Domain.Exceptions;

namespace SystemService.Application.Features.Organizations.MoveNode;

public sealed class MoveNodeCommandHandler(IOrganizationRepository organizations)
    : IRequestHandler<MoveNodeCommand, OrganizationNodeDto>
{
    public async Task<OrganizationNodeDto> Handle(MoveNodeCommand request, CancellationToken cancellationToken)
    {
        var node = await organizations.FindByIdAsync(request.Id, cancellationToken)
                   ?? throw new NotFoundException("OrganizationNode", request.Id);

        OrganizationNode? newParent = null;
        if (request.NewParentId is { } newParentId && newParentId != Guid.Empty)
        {
            if (newParentId == node.Id)
            {
                throw new CircularOrganizationTreeException("Một đơn vị không thể là cha của chính nó.");
            }

            newParent = await organizations.FindByIdAsync(newParentId, cancellationToken)
                        ?? throw new NotFoundException("OrganizationNode", newParentId);

            if (newParent.IsDescendantOf(node))
            {
                throw new CircularOrganizationTreeException(
                    "Không thể di chuyển vào nhánh con của chính nó (tạo vòng lặp trong cây).");
            }
        }

        if (node.ParentId == newParent?.Id)
        {
            return node.ToDto();
        }

        var oldPath = node.Path;
        var descendants = await organizations.GetDescendantsAsync(oldPath, cancellationToken);

        node.ParentId = newParent?.Id;
        node.Level = newParent is null ? 0 : newParent.Level + 1;
        node.Path = OrganizationNode.BuildPath(newParent?.Path, node.Code);

        foreach (var d in descendants)
        {
            var suffix = d.Path.Substring(oldPath.Length);
            d.Path = node.Path + suffix;
            d.Level = node.Level + suffix.Count(c => c == '/');
        }

        return node.ToDto();
    }
}
