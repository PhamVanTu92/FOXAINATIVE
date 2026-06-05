using KnowledgeService.Application.Features.KnowledgeFiles.Dtos;
using MediatR;

namespace KnowledgeService.Application.Features.KnowledgeFiles.Move;

public record MoveKnowledgeFileCommand(
    Guid FileId,
    string? FileName,
    Guid? TargetKnowledgeBaseId
) : IRequest<KnowledgeFileDto>;
