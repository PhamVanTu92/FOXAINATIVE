using KnowledgeService.Application.Common.Abstractions;
using KnowledgeService.Application.Common.Exceptions;
using KnowledgeService.Application.Features.KnowledgeFiles.Dtos;
using KnowledgeService.Domain.Entities;
using KnowledgeService.Domain.Enums;
using Mapster;
using MediatR;

namespace KnowledgeService.Application.Features.KnowledgeFiles.Add;

public class AddKnowledgeFileCommandHandler : IRequestHandler<AddKnowledgeFileCommand, KnowledgeFileDto>
{
    private readonly IKnowledgeBaseRepository _kbRepo;
    private readonly IKnowledgeFileRepository _fileRepo;
    private readonly IUnitOfWork _uow;

    public AddKnowledgeFileCommandHandler(
        IKnowledgeBaseRepository kbRepo,
        IKnowledgeFileRepository fileRepo,
        IUnitOfWork uow)
    {
        _kbRepo = kbRepo;
        _fileRepo = fileRepo;
        _uow = uow;
    }

    public async Task<KnowledgeFileDto> Handle(AddKnowledgeFileCommand cmd, CancellationToken ct)
    {
        var kb = await _kbRepo.GetByIdAsync(cmd.KnowledgeBaseId, ct)
            ?? throw new NotFoundException(nameof(KnowledgeBase), cmd.KnowledgeBaseId);

        var fileType = Enum.Parse<FileType>(cmd.FileType);
        var now = DateTime.UtcNow;

        var file = new KnowledgeFile
        {
            KnowledgeBaseId = cmd.KnowledgeBaseId,
            FileName = cmd.FileName,
            FileType = fileType,
            FileSizeMb = cmd.FileSizeMb,
            StoragePath = cmd.StoragePath,
            UploadedBy = cmd.UploadedBy,
            UploadedAt = now,
            CreatedAt = now,
            UpdatedAt = now,
            Permissions = cmd.PermittedDepartments.Select(d => new KnowledgeFilePermission
            {
                DepartmentId = d.DepartmentId,
                DepartmentName = d.DepartmentName,
                CreatedAt = now,
                UpdatedAt = now
            }).ToList()
        };

        kb.UpdatedAt = now;
        _kbRepo.Update(kb);

        await _fileRepo.AddAsync(file, ct);
        await _uow.SaveChangesAsync(ct);

        return file.Adapt<KnowledgeFileDto>();
    }
}
