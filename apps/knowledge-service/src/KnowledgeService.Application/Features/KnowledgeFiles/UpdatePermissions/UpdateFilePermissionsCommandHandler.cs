using KnowledgeService.Application.Common.Abstractions;
using KnowledgeService.Application.Common.Exceptions;
using KnowledgeService.Application.Features.KnowledgeFiles.Dtos;
using KnowledgeService.Domain.Entities;
using Mapster;
using MediatR;

namespace KnowledgeService.Application.Features.KnowledgeFiles.UpdatePermissions;

public class UpdateFilePermissionsCommandHandler : IRequestHandler<UpdateFilePermissionsCommand, KnowledgeFileDto>
{
    private readonly IKnowledgeFileRepository _repo;
    private readonly IUnitOfWork _uow;

    public UpdateFilePermissionsCommandHandler(IKnowledgeFileRepository repo, IUnitOfWork uow)
    {
        _repo = repo;
        _uow = uow;
    }

    public async Task<KnowledgeFileDto> Handle(UpdateFilePermissionsCommand cmd, CancellationToken ct)
    {
        var file = await _repo.GetByIdAsync(cmd.Id, ct)
            ?? throw new NotFoundException(nameof(KnowledgeFile), cmd.Id);

        if (file.KnowledgeBaseId != cmd.KnowledgeBaseId)
            throw new NotFoundException(nameof(KnowledgeFile), cmd.Id);

        var now = DateTime.UtcNow;
        file.UpdatedAt = now;

        // Xóa permission cũ qua DbSet.RemoveRange → đảm bảo trạng thái Deleted
        _repo.RemovePermissions(file.Permissions.ToList());

        // Thêm permission mới qua DbSet.AddRange → đảm bảo trạng thái Added
        var newPermissions = cmd.PermittedDepartments.Select(d => new KnowledgeFilePermission
        {
            KnowledgeFileId = file.Id,
            DepartmentId = d.DepartmentId,
            DepartmentName = d.DepartmentName,
            CreatedAt = now,
            UpdatedAt = now
        }).ToList();
        await _repo.AddPermissionsAsync(newPermissions, ct);

        await _uow.SaveChangesAsync(ct);

        file.Permissions = newPermissions;
        return file.Adapt<KnowledgeFileDto>();
    }
}
