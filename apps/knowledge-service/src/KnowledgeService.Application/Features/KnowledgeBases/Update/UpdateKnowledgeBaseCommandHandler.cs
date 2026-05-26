using KnowledgeService.Application.Common.Abstractions;
using KnowledgeService.Application.Common.Exceptions;
using KnowledgeService.Application.Features.KnowledgeBases.Dtos;
using KnowledgeService.Domain.Entities;
using Mapster;
using MediatR;

namespace KnowledgeService.Application.Features.KnowledgeBases.Update;

public class UpdateKnowledgeBaseCommandHandler : IRequestHandler<UpdateKnowledgeBaseCommand, KnowledgeBaseDto>
{
    private readonly IKnowledgeBaseRepository _repo;
    private readonly IUnitOfWork _uow;

    public UpdateKnowledgeBaseCommandHandler(IKnowledgeBaseRepository repo, IUnitOfWork uow)
    {
        _repo = repo;
        _uow = uow;
    }

    public async Task<KnowledgeBaseDto> Handle(UpdateKnowledgeBaseCommand cmd, CancellationToken ct)
    {
        var kb = await _repo.GetByIdAsync(cmd.Id, ct)
            ?? throw new NotFoundException(nameof(KnowledgeBase), cmd.Id);

        var now = DateTime.UtcNow;
        kb.Name = cmd.Name;
        kb.Description = cmd.Description;
        kb.ManagingDepartmentId = cmd.ManagingDepartmentId;
        kb.ManagingDepartmentName = cmd.ManagingDepartmentName;
        kb.UpdatedAt = now;

        kb.Permissions.Clear();
        foreach (var d in cmd.PermittedDepartments)
        {
            kb.Permissions.Add(new KnowledgeBasePermission
            {
                KnowledgeBaseId = kb.Id,
                DepartmentId = d.DepartmentId,
                DepartmentName = d.DepartmentName,
                CreatedAt = now,
                UpdatedAt = now
            });
        }

        _repo.Update(kb);
        await _uow.SaveChangesAsync(ct);

        return kb.Adapt<KnowledgeBaseDto>();
    }
}
