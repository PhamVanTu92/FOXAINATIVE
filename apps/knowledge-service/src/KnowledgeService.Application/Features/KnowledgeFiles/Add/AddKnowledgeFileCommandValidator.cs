using FluentValidation;
using KnowledgeService.Domain.Enums;

namespace KnowledgeService.Application.Features.KnowledgeFiles.Add;

public class AddKnowledgeFileCommandValidator : AbstractValidator<AddKnowledgeFileCommand>
{
    public AddKnowledgeFileCommandValidator()
    {
        RuleFor(x => x.FileName)
            .NotEmpty().WithMessage("Tên tệp không được để trống.")
            .MaximumLength(500).WithMessage("Tên tệp tối đa 500 ký tự.");

        RuleFor(x => x.FileType)
            .NotEmpty()
            .Must(ft => Enum.TryParse<FileType>(ft, out _))
            .WithMessage("Loại tệp không hợp lệ. Chấp nhận: Word, Excel, PDF, Image.");

        RuleFor(x => x.FileSizeMb)
            .GreaterThan(0).When(x => x.FileSizeMb != 0)
            .WithMessage("Kích thước tệp phải lớn hơn 0.");
    }
}
