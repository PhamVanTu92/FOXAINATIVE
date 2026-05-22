using MediatR;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Application.Features.ModuleGroups.Dtos;
using SystemService.Application.Features.ModuleGroups.Mappings;
using SystemService.Domain.Exceptions;

namespace SystemService.Application.Features.ModuleGroups.UpdateModuleGroup;

public sealed class UpdateModuleGroupCommandHandler(IModuleGroupRepository groups)
    : IRequestHandler<UpdateModuleGroupCommand, ModuleGroupDto>
{
    public async Task<ModuleGroupDto> Handle(UpdateModuleGroupCommand request, CancellationToken cancellationToken)
    {
        var g = await groups.FindByIdAsync(request.Id, cancellationToken)
                ?? throw new NotFoundException("ModuleGroup", request.Id);

        if (request.Name is not null) g.Name = request.Name.Trim();
        if (request.Description is not null)
        {
            g.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
        }
        if (request.SortOrder.HasValue) g.SortOrder = request.SortOrder.Value;
        if (request.IsActive.HasValue) g.IsActive = request.IsActive.Value;

        return g.ToDto();
    }
}
