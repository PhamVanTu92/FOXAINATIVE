using KnowledgeService.Application.Features.KnowledgeBases.Dtos;
using KnowledgeService.Application.Features.KnowledgeFiles.Add;
using KnowledgeService.Application.Features.KnowledgeFiles.Delete;
using KnowledgeService.Application.Features.KnowledgeFiles.List;
using KnowledgeService.Application.Features.KnowledgeFiles.Update;
using KnowledgeService.Application.Features.KnowledgeFiles.UpdatePermissions;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace KnowledgeService.Api.Controllers;

[ApiController]
[Route("api/knowledge-bases/{kbId:guid}/files")]
public class KnowledgeFilesController : ControllerBase
{
    private readonly IMediator _mediator;
    public KnowledgeFilesController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<IActionResult> List(
        Guid kbId,
        [FromQuery] string? search,
        [FromQuery] string? fileType,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default)
    {
        var result = await _mediator.Send(new ListKnowledgeFilesQuery(kbId, search, fileType, page, pageSize), ct);
        return Ok(result);
    }

    [HttpPost]
    public async Task<IActionResult> Add(Guid kbId, [FromBody] AddFileRequest req, CancellationToken ct)
    {
        var cmd = new AddKnowledgeFileCommand(
            kbId, req.FileName, req.FileType, req.FileSizeMb,
            req.PermittedDepartments, req.UploadedBy);

        var result = await _mediator.Send(cmd, ct);
        return StatusCode(201, result);
    }

    [HttpPut("{fileId:guid}")]
    public async Task<IActionResult> Update(Guid kbId, Guid fileId, [FromBody] UpdateFileRequest req, CancellationToken ct)
    {
        var cmd = new UpdateKnowledgeFileCommand(fileId, kbId, req.FileName, req.FileType, req.FileSizeMb);
        var result = await _mediator.Send(cmd, ct);
        return Ok(result);
    }

    [HttpDelete("{fileId:guid}")]
    public async Task<IActionResult> Delete(Guid kbId, Guid fileId, CancellationToken ct)
    {
        await _mediator.Send(new DeleteKnowledgeFileCommand(fileId, kbId), ct);
        return NoContent();
    }

    [HttpPut("{fileId:guid}/permissions")]
    public async Task<IActionResult> UpdatePermissions(
        Guid kbId, Guid fileId,
        [FromBody] UpdateFilePermissionsRequest req,
        CancellationToken ct)
    {
        var cmd = new UpdateFilePermissionsCommand(fileId, kbId, req.PermittedDepartments);
        var result = await _mediator.Send(cmd, ct);
        return Ok(result);
    }
}

// Request models
public record AddFileRequest(
    string FileName,
    string FileType,
    decimal FileSizeMb,
    List<DepartmentRefDto> PermittedDepartments,
    Guid? UploadedBy);

public record UpdateFileRequest(
    string FileName,
    string FileType,
    decimal FileSizeMb);

public record UpdateFilePermissionsRequest(
    List<DepartmentRefDto> PermittedDepartments);
