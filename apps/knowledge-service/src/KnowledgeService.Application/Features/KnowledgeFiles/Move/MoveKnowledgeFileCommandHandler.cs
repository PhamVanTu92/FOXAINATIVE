using KnowledgeService.Application.Common.Abstractions;
using KnowledgeService.Application.Common.Exceptions;
using KnowledgeService.Application.Features.KnowledgeFiles.Dtos;
using KnowledgeService.Domain.Entities;
using Mapster;
using MediatR;

namespace KnowledgeService.Application.Features.KnowledgeFiles.Move;

public class MoveKnowledgeFileCommandHandler : IRequestHandler<MoveKnowledgeFileCommand, KnowledgeFileDto>
{
    private readonly IKnowledgeFileRepository _fileRepo;
    private readonly IKnowledgeBaseRepository _kbRepo;
    private readonly IUnitOfWork _uow;

    public MoveKnowledgeFileCommandHandler(
        IKnowledgeFileRepository fileRepo,
        IKnowledgeBaseRepository kbRepo,
        IUnitOfWork uow)
    {
        _fileRepo = fileRepo;
        _kbRepo = kbRepo;
        _uow = uow;
    }

    public async Task<KnowledgeFileDto> Handle(MoveKnowledgeFileCommand cmd, CancellationToken ct)
    {
        var file = await _fileRepo.GetByIdAsync(cmd.FileId, ct)
            ?? throw new NotFoundException(nameof(KnowledgeFile), cmd.FileId);

        if (!string.IsNullOrWhiteSpace(cmd.FileName))
            file.FileName = cmd.FileName.Trim();

        if (cmd.TargetKnowledgeBaseId.HasValue)
        {
            // Xác nhận KB đích tồn tại
            _ = await _kbRepo.GetByIdAsync(cmd.TargetKnowledgeBaseId.Value, ct)
                ?? throw new NotFoundException(nameof(KnowledgeBase), cmd.TargetKnowledgeBaseId.Value);

            // Thêm liên kết tới KB đích (idempotent — bỏ qua nếu đã liên kết)
            await _fileRepo.AddToKnowledgeBaseAsync(file.Id, cmd.TargetKnowledgeBaseId.Value, ct);
        }
        else
        {
            // null = bỏ gán khỏi tất cả bộ tri thức
            await _fileRepo.RemoveFromAllKnowledgeBasesAsync(file.Id, ct);
        }

        file.UpdatedAt = DateTime.UtcNow;

        _fileRepo.Update(file);
        await _uow.SaveChangesAsync(ct);

        // Reload để trả về KnowledgeBases đã cập nhật
        var updated = await _fileRepo.GetByIdAsync(file.Id, ct);
        return updated!.Adapt<KnowledgeFileDto>();
    }
}
