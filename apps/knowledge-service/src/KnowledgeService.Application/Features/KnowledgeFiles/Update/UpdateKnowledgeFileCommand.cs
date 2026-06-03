using KnowledgeService.Application.Features.KnowledgeBases.Dtos;
using KnowledgeService.Application.Features.KnowledgeFiles.Dtos;
using MediatR;

namespace KnowledgeService.Application.Features.KnowledgeFiles.Update;

public record UpdateKnowledgeFileCommand(
    Guid Id,
    Guid? KnowledgeBaseId,
    string FileName,
    string FileType,
    decimal FileSizeMb
) : IRequest<KnowledgeFileDto>;
