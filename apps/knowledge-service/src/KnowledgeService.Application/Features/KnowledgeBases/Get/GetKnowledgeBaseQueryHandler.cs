using KnowledgeService.Application.Common.Abstractions;
using KnowledgeService.Application.Common.Exceptions;
using KnowledgeService.Application.Features.KnowledgeBases.Dtos;
using KnowledgeService.Domain.Entities;
using Mapster;
using MediatR;

namespace KnowledgeService.Application.Features.KnowledgeBases.Get;

public class GetKnowledgeBaseQueryHandler : IRequestHandler<GetKnowledgeBaseQuery, KnowledgeBaseDto>
{
    private readonly IKnowledgeBaseRepository _repo;

    public GetKnowledgeBaseQueryHandler(IKnowledgeBaseRepository repo) => _repo = repo;

    public async Task<KnowledgeBaseDto> Handle(GetKnowledgeBaseQuery query, CancellationToken ct)
    {
        var kb = await _repo.GetByIdWithFilesAsync(query.Id, ct)
            ?? throw new NotFoundException(nameof(KnowledgeBase), query.Id);

        return kb.Adapt<KnowledgeBaseDto>();
    }
}
