namespace KnowledgeService.Application.Common.Exceptions;

public class NotFoundException : Exception
{
    public NotFoundException(string name, object key)
        : base($"'{name}' ({key}) không tìm thấy.") { }
}
