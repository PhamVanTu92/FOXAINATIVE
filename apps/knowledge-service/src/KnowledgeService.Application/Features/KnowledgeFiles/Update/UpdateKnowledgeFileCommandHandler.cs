using KnowledgeService.Application.Common.Abstractions;
using KnowledgeService.Application.Common.Exceptions;
using KnowledgeService.Application.Features.KnowledgeFiles.Dtos;
using KnowledgeService.Domain.Entities;
using KnowledgeService.Domain.Enums;
using Mapster;
using MediatR;

namespace KnowledgeService.Application.Features.KnowledgeFiles.Update;

public class UpdateKnowledgeFileCommandHandler : IRequestHandler<UpdateKnowledgeFileCommand, KnowledgeFileDto>
{
    private readonly IKnowledgeFileRepository _repo;
    private readonly IUnitOfWork _uow;

    public UpdateKnowledgeFileCommandHandler(IKnowledgeFileRepository repo, IUnitOfWork uow)
    {
        _repo = repo;
        _uow = uow;
    }

    public async Task<KnowledgeFileDto> Handle(UpdateKnowledgeFileCommand cmd, CancellationToken ct)
    {
        var file = await _repo.GetByIdAsync(cmd.Id, ct)
            ?? throw new NotFoundException(nameof(KnowledgeFile), cmd.Id);

        if (file.KnowledgeBaseId != cmd.KnowledgeBaseId)
            throw new NotFoundException(nameof(KnowledgeFile), cmd.Id);

        file.FileName = cmd.FileName;
        file.FileType = Enum.Parse<FileType>(cmd.FileType);
        file.FileSizeMb = cmd.FileSizeMb;
        file.UpdatedAt = DateTime.UtcNow;

        _repo.Update(file);
        await _uow.SaveChangesAsync(ct);

        return file.Adapt<KnowledgeFileDto>();
    }
}
