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

        // Xóa permission cũ qua DbSet.RemoveRange → đảm bảo trạng thái Deleted
        _repo.RemovePermissions(kb.Permissions.ToList());

        // Thêm permission mới qua DbSet.AddRange → đảm bảo trạng thái Added
        var newPermissions = cmd.PermittedDepartments.Select(d => new KnowledgeBasePermission
        {
            KnowledgeBaseId = kb.Id,
            DepartmentId = d.DepartmentId,
            DepartmentName = d.DepartmentName,
            CreatedAt = now,
            UpdatedAt = now
        }).ToList();
        await _repo.AddPermissionsAsync(newPermissions, ct);

        await _uow.SaveChangesAsync(ct);

        kb.Permissions = newPermissions;
        return kb.Adapt<KnowledgeBaseDto>();
    }
}
