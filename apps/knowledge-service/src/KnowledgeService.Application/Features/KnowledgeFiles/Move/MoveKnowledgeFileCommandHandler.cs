using KnowledgeService.Application.Common.Abstractions;
using KnowledgeService.Application.Common.Exceptions;
using KnowledgeService.Application.Features.KnowledgeFiles.Dtos;
using KnowledgeService.Domain.Entities;
using Mapster;
using MediatR;

namespace KnowledgeService.Application.Features.KnowledgeFiles.Move;

public class MoveKnowledgeFileCommandHandler : IRequestHandler<MoveKnowledgeFileCommand, KnowledgeFileDto>
{
    private readonly IKnowledgeFileRepository _fileRepo;
    private readonly IKnowledgeBaseRepository _kbRepo;
    private readonly IUnitOfWork _uow;

    public MoveKnowledgeFileCommandHandler(
        IKnowledgeFileRepository fileRepo,
        IKnowledgeBaseRepository kbRepo,
        IUnitOfWork uow)
    {
        _fileRepo = fileRepo;
        _kbRepo = kbRepo;
        _uow = uow;
    }

    public async Task<KnowledgeFileDto> Handle(MoveKnowledgeFileCommand cmd, CancellationToken ct)
    {
        var file = await _fileRepo.GetByIdAsync(cmd.FileId, ct)
            ?? throw new NotFoundException(nameof(KnowledgeFile), cmd.FileId);

        if (!string.IsNullOrWhiteSpace(cmd.FileName))
            file.FileName = cmd.FileName.Trim();

        if (cmd.TargetKnowledgeBaseId.HasValue &&
            cmd.TargetKnowledgeBaseId.Value != file.KnowledgeBaseId)
        {
            var targetKb = await _kbRepo.GetByIdAsync(cmd.TargetKnowledgeBaseId.Value, ct)
                ?? throw new NotFoundException(nameof(KnowledgeBase), cmd.TargetKnowledgeBaseId.Value);

            file.KnowledgeBaseId = targetKb.Id;
            file.KnowledgeBase = targetKb;
        }

        file.UpdatedAt = DateTime.UtcNow;

        _fileRepo.Update(file);
        await _uow.SaveChangesAsync(ct);

        return file.Adapt<KnowledgeFileDto>();
    }
}
