using MediatR;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Domain.Exceptions;

namespace SystemService.Application.Features.ModuleGroups.DeleteModuleGroup;

public sealed class DeleteModuleGroupCommandHandler(IModuleGroupRepository groups)
    : IRequestHandler<DeleteModuleGroupCommand, bool>
{
    public async Task<bool> Handle(DeleteModuleGroupCommand request, CancellationToken cancellationToken)
    {
        var g = await groups.FindByIdAsync(request.Id, cancellationToken)
                ?? throw new NotFoundException("ModuleGroup", request.Id);

        if (await groups.HasModulesAsync(g.Id, cancellationToken))
        {
            throw new BusinessRuleViolationException("Không thể xóa nhóm phân hệ còn module con. Hãy xóa hoặc chuyển module trước.");
        }

        groups.Remove(g);
        return true;
    }
}
