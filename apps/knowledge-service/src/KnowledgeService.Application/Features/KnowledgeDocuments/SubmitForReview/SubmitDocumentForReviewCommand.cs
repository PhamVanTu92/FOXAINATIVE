using KnowledgeService.Application.Features.KnowledgeDocuments.Dtos;
using MediatR;

namespace KnowledgeService.Application.Features.KnowledgeDocuments.SubmitForReview;

public record SubmitDocumentForReviewCommand(Guid Id) : IRequest<KnowledgeDocumentDto>;
