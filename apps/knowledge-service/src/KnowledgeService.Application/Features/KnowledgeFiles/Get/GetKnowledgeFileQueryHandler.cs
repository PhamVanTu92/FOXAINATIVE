using KnowledgeService.Application.Common.Abstractions;
using KnowledgeService.Application.Common.Exceptions;
using KnowledgeService.Application.Features.KnowledgeFiles.Dtos;
using KnowledgeService.Domain.Entities;
using Mapster;
using MediatR;

namespace KnowledgeService.Application.Features.KnowledgeFiles.Get;

public class GetKnowledgeFileQueryHandler : IRequestHandler<GetKnowledgeFileQuery, KnowledgeFileDto>
{
    private readonly IKnowledgeFileRepository _repo;

    public GetKnowledgeFileQueryHandler(IKnowledgeFileRepository repo) => _repo = repo;

    public async Task<KnowledgeFileDto> Handle(GetKnowledgeFileQuery query, CancellationToken ct)
    {
        var file = await _repo.GetByIdAsync(query.Id, ct)
            ?? throw new NotFoundException(nameof(KnowledgeFile), query.Id);

        if (!file.KnowledgeBases.Any(kb => kb.Id == query.KnowledgeBaseId))
            throw new NotFoundException(nameof(KnowledgeFile), query.Id);

        return file.Adapt<KnowledgeFileDto>();
    }
}
