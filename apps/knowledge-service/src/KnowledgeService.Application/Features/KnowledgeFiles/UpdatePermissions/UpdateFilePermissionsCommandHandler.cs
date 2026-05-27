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
        file.Permissions.Clear();
        foreach (var d in cmd.PermittedDepartments)
        {
            file.Permissions.Add(new KnowledgeFilePermission
            {
                KnowledgeFileId = file.Id,
                DepartmentId = d.DepartmentId,
                DepartmentName = d.DepartmentName,
                CreatedAt = now,
                UpdatedAt = now
            });
        }
        file.UpdatedAt = now;

        _repo.Update(file);
        await _uow.SaveChangesAsync(ct);

        return file.Adapt<KnowledgeFileDto>();
    }
}
