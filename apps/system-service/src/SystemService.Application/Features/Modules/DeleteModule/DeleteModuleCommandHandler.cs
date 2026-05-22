using MediatR;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Domain.Exceptions;

namespace SystemService.Application.Features.Modules.DeleteModule;

public sealed class DeleteModuleCommandHandler(IModuleRepository modules)
    : IRequestHandler<DeleteModuleCommand, bool>
{
    public async Task<bool> Handle(DeleteModuleCommand request, CancellationToken cancellationToken)
    {
        var m = await modules.FindByIdAsync(request.Id, cancellationToken)
                ?? throw new NotFoundException("Module", request.Id);

        if (await modules.HasRolePermissionsAsync(m.Id, cancellationToken))
        {
            throw new BusinessRuleViolationException("Không thể xóa phân hệ đang được cấp quyền cho 1 hoặc nhiều vai trò.");
        }

        modules.Remove(m);
        return true;
    }
}
