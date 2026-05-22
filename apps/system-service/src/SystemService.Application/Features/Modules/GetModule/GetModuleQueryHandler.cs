using MediatR;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Application.Features.Modules.Dtos;
using SystemService.Application.Features.Modules.Mappings;
using SystemService.Domain.Exceptions;

namespace SystemService.Application.Features.Modules.GetModule;

public sealed class GetModuleQueryHandler(IModuleRepository modules)
    : IRequestHandler<GetModuleQuery, ModuleDto>
{
    public async Task<ModuleDto> Handle(GetModuleQuery request, CancellationToken cancellationToken)
    {
        var m = await modules.FindByIdAsync(request.Id, cancellationToken)
                ?? throw new NotFoundException("Module", request.Id);
        return m.ToDto();
    }
}
