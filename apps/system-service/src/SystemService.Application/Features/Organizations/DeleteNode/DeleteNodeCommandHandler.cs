using MediatR;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Domain.Exceptions;

namespace SystemService.Application.Features.Organizations.DeleteNode;

public sealed class DeleteNodeCommandHandler(IOrganizationRepository organizations)
    : IRequestHandler<DeleteNodeCommand, bool>
{
    public async Task<bool> Handle(DeleteNodeCommand request, CancellationToken cancellationToken)
    {
        var node = await organizations.FindByIdAsync(request.Id, cancellationToken)
                   ?? throw new NotFoundException("OrganizationNode", request.Id);

        if (await organizations.HasChildrenAsync(node.Id, cancellationToken))
        {
            throw new BusinessRuleViolationException("Không thể xóa đơn vị tổ chức còn đơn vị con.");
        }

        if (await organizations.HasUsersAsync(node.Id, cancellationToken))
        {
            throw new BusinessRuleViolationException("Không thể xóa đơn vị tổ chức còn người dùng trực thuộc.");
        }

        organizations.Remove(node);
        return true;
    }
}
