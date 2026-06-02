using FluentValidation;
using KnowledgeService.Domain.Enums;

namespace KnowledgeService.Application.Features.KnowledgeDocuments.Upload;

public class UploadDocumentCommandValidator : AbstractValidator<UploadDocumentCommand>
{
    public UploadDocumentCommandValidator()
    {
        RuleFor(x => x.KnowledgeBaseId).NotEmpty().WithMessage("KnowledgeBaseId là bắt buộc khi upload tài liệu.");
        RuleFor(x => x.Title).NotEmpty().MaximumLength(500);
        RuleFor(x => x.FileType)
            .NotEmpty()
            .Must(ft => Enum.TryParse<FileType>(ft, out _))
            .WithMessage("FileType không hợp lệ. Chấp nhận: Word, Excel, PDF, Image, PowerPoint, Text.");
        RuleFor(x => x.FileSizeMb).GreaterThanOrEqualTo(0);
    }
}
