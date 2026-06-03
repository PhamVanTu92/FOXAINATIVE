using KnowledgeService.Application.Common.Abstractions;
using KnowledgeService.Application.Common.Exceptions;
using KnowledgeService.Application.Features.KnowledgeDocuments.Dtos;
using KnowledgeService.Domain.Entities;
using Mapster;
using MediatR;

namespace KnowledgeService.Application.Features.KnowledgeDocuments.CreateVersion;

public class CreateDocumentVersionCommandHandler
    : IRequestHandler<CreateDocumentVersionCommand, KnowledgeDocumentDetailDto>
{
    private readonly IKnowledgeDocumentRepository _repo;
    private readonly IUnitOfWork _uow;

    public CreateDocumentVersionCommandHandler(IKnowledgeDocumentRepository repo, IUnitOfWork uow)
    {
        _repo = repo;
        _uow = uow;
    }

    public async Task<KnowledgeDocumentDetailDto> Handle(CreateDocumentVersionCommand cmd, CancellationToken ct)
    {
        var doc = await _repo.GetByIdWithVersionsAsync(cmd.Id, ct)
            ?? throw new NotFoundException(nameof(KnowledgeDocument), cmd.Id);

        // CreateNewVersion trả về version mới; thêm qua DbSet.Add → đảm bảo trạng thái Added
        var newVersion = doc.CreateNewVersion(cmd.ChangeNote, cmd.ContentSummary, cmd.CreatedBy);
        _repo.AddVersion(newVersion);

        await _uow.SaveChangesAsync(ct);

        return doc.Adapt<KnowledgeDocumentDetailDto>();
    }
}
