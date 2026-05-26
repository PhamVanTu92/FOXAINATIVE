using MediatR;

namespace KnowledgeService.Application.Features.KnowledgeBases.Delete;

public record DeleteKnowledgeBaseCommand(Guid Id) : IRequest<Unit>;
