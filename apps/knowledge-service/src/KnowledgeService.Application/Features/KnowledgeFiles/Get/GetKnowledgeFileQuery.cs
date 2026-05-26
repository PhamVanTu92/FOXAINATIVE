using KnowledgeService.Application.Features.KnowledgeFiles.Dtos;
using MediatR;

namespace KnowledgeService.Application.Features.KnowledgeFiles.Get;

public record GetKnowledgeFileQuery(Guid Id, Guid KnowledgeBaseId) : IRequest<KnowledgeFileDto>;
