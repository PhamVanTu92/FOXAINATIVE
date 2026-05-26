using KnowledgeService.Application.Common.Abstractions;
using KnowledgeService.Application.Common.Exceptions;
using KnowledgeService.Domain.Entities;
using MediatR;

namespace KnowledgeService.Application.Features.KnowledgeFiles.Delete;

public class DeleteKnowledgeFileCommandHandler : IRequestHandler<DeleteKnowledgeFileCommand, Unit>
{
    private readonly IKnowledgeFileRepository _repo;
    private readonly IUnitOfWork _uow;

    public DeleteKnowledgeFileCommandHandler(IKnowledgeFileRepository repo, IUnitOfWork uow)
    {
        _repo = repo;
        _uow = uow;
    }

    public async Task<Unit> Handle(DeleteKnowledgeFileCommand cmd, CancellationToken ct)
    {
        var file = await _repo.GetByIdAsync(cmd.Id, ct)
            ?? throw new NotFoundException(nameof(KnowledgeFile), cmd.Id);

        if (file.KnowledgeBaseId != cmd.KnowledgeBaseId)
            throw new NotFoundException(nameof(KnowledgeFile), cmd.Id);

        _repo.Delete(file);
        await _uow.SaveChangesAsync(ct);
        return Unit.Value;
    }
}
