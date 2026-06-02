using KnowledgeService.Application.Common.Abstractions;
using KnowledgeService.Application.Common.Exceptions;
using KnowledgeService.Domain.Entities;
using MediatR;
using Microsoft.Extensions.Logging;

namespace KnowledgeService.Application.Features.KnowledgeFiles.Delete;

public class DeleteKnowledgeFileCommandHandler : IRequestHandler<DeleteKnowledgeFileCommand, Unit>
{
    private readonly IKnowledgeFileRepository _repo;
    private readonly IUnitOfWork _uow;
    private readonly IIndexServiceClient _indexServiceClient;
    private readonly ILogger<DeleteKnowledgeFileCommandHandler> _logger;

    public DeleteKnowledgeFileCommandHandler(
        IKnowledgeFileRepository repo,
        IUnitOfWork uow,
        IIndexServiceClient indexServiceClient,
        ILogger<DeleteKnowledgeFileCommandHandler> logger)
    {
        _repo = repo;
        _uow = uow;
        _indexServiceClient = indexServiceClient;
        _logger = logger;
    }

    public async Task<Unit> Handle(DeleteKnowledgeFileCommand cmd, CancellationToken ct)
    {
        var file = await _repo.GetByIdAsync(cmd.Id, ct)
            ?? throw new NotFoundException(nameof(KnowledgeFile), cmd.Id);

        if (file.KnowledgeBaseId != cmd.KnowledgeBaseId)
            throw new NotFoundException(nameof(KnowledgeFile), cmd.Id);

        // Xóa document trên index-service trước (best-effort) nếu file đã được index
        if (file.DocumentIndexId.HasValue)
        {
            _logger.LogInformation(
                "DeleteKnowledgeFile → deleting from index-service fileId={FileId}, documentIndexId={DocumentIndexId}",
                file.Id, file.DocumentIndexId.Value);
            await _indexServiceClient.DeleteDocumentAsync(file.DocumentIndexId.Value, ct);
        }
        else
        {
            _logger.LogInformation(
                "DeleteKnowledgeFile → SKIP index-service: fileId={FileId} has no DocumentIndexId", file.Id);
        }

        _repo.Delete(file);
        await _uow.SaveChangesAsync(ct);
        return Unit.Value;
    }
}
