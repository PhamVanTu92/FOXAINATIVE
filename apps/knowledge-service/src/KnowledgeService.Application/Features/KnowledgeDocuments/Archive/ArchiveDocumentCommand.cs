using KnowledgeService.Application.Features.KnowledgeDocuments.Dtos;
using MediatR;

namespace KnowledgeService.Application.Features.KnowledgeDocuments.Archive;

public record ArchiveDocumentCommand(Guid Id) : IRequest<KnowledgeDocumentDto>;
