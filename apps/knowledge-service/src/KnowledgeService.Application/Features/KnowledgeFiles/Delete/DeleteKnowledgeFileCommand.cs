using MediatR;

namespace KnowledgeService.Application.Features.KnowledgeFiles.Delete;

public record DeleteKnowledgeFileCommand(Guid Id, Guid KnowledgeBaseId) : IRequest<Unit>;
