using KnowledgeService.Application.Common.Abstractions;
using KnowledgeService.Application.Common.Exceptions;
using KnowledgeService.Domain.Entities;
using MediatR;

namespace KnowledgeService.Application.Features.KnowledgeBases.Delete;

public class DeleteKnowledgeBaseCommandHandler : IRequestHandler<DeleteKnowledgeBaseCommand, Unit>
{
    private readonly IKnowledgeBaseRepository _repo;
    private readonly IUnitOfWork _uow;

    public DeleteKnowledgeBaseCommandHandler(IKnowledgeBaseRepository repo, IUnitOfWork uow)
    {
        _repo = repo;
        _uow = uow;
    }

    public async Task<Unit> Handle(DeleteKnowledgeBaseCommand cmd, CancellationToken ct)
    {
        var kb = await _repo.GetByIdWithFilesAsync(cmd.Id, ct)
            ?? throw new NotFoundException(nameof(KnowledgeBase), cmd.Id);

        _repo.Delete(kb);
        await _uow.SaveChangesAsync(ct);
        return Unit.Value;
    }
}
