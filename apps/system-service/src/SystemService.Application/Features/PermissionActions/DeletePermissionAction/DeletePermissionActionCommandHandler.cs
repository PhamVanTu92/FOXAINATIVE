using MediatR;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Domain.Exceptions;

namespace SystemService.Application.Features.PermissionActions.DeletePermissionAction;

public sealed class DeletePermissionActionCommandHandler(IPermissionActionRepository actions)
    : IRequestHandler<DeletePermissionActionCommand, bool>
{
    public async Task<bool> Handle(DeletePermissionActionCommand request, CancellationToken cancellationToken)
    {
        var a = await actions.FindByIdAsync(request.Id, cancellationToken)
                ?? throw new NotFoundException("PermissionAction", request.Id);

        if (await actions.HasRolePermissionsAsync(a.Id, cancellationToken))
        {
            throw new BusinessRuleViolationException("Không thể xóa quyền (action) đang được cấp cho 1 hoặc nhiều vai trò.");
        }

        actions.Remove(a);
        return true;
    }
}
