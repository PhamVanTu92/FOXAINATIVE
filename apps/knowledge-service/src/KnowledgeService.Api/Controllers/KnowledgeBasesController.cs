using KnowledgeService.Application.Features.KnowledgeBases.Create;
using KnowledgeService.Application.Features.KnowledgeBases.Delete;
using KnowledgeService.Application.Features.KnowledgeBases.Dtos;
using KnowledgeService.Application.Features.KnowledgeBases.Get;
using KnowledgeService.Application.Features.KnowledgeBases.List;
using KnowledgeService.Application.Features.KnowledgeBases.Stats;
using KnowledgeService.Application.Features.KnowledgeBases.Update;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace KnowledgeService.Api.Controllers;

[ApiController]
[Route("api/knowledge-bases")]
public class KnowledgeBasesController : ControllerBase
{
    private readonly IMediator _mediator;
    public KnowledgeBasesController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] string? search,
        [FromQuery] Guid? departmentId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var result = await _mediator.Send(new ListKnowledgeBasesQuery(search, departmentId, page, pageSize), ct);
        return Ok(result);
    }

    [HttpGet("stats")]
    public async Task<IActionResult> Stats(CancellationToken ct)
    {
        var result = await _mediator.Send(new GetStatsQuery(), ct);
        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        var result = await _mediator.Send(new GetKnowledgeBaseQuery(id), ct);
        return Ok(result);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateKnowledgeBaseRequest req, CancellationToken ct)
    {
        var cmd = new CreateKnowledgeBaseCommand(
            req.Code, req.Name, req.Description,
            req.ManagingDepartmentId, req.ManagingDepartmentName,
            req.PermittedDepartments, req.CreatedBy);

        var result = await _mediator.Send(cmd, ct);
        return CreatedAtAction(nameof(Get), new { id = result.Id }, result);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateKnowledgeBaseRequest req, CancellationToken ct)
    {
        var cmd = new UpdateKnowledgeBaseCommand(
            id, req.Name, req.Description,
            req.ManagingDepartmentId, req.ManagingDepartmentName,
            req.PermittedDepartments);

        var result = await _mediator.Send(cmd, ct);
        return Ok(result);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _mediator.Send(new DeleteKnowledgeBaseCommand(id), ct);
        return NoContent();
    }
}

// Request models
public record CreateKnowledgeBaseRequest(
    string Code,
    string Name,
    string? Description,
    Guid ManagingDepartmentId,
    string ManagingDepartmentName,
    List<DepartmentRefDto> PermittedDepartments,
    Guid? CreatedBy);

public record UpdateKnowledgeBaseRequest(
    string Name,
    string? Description,
    Guid ManagingDepartmentId,
    string ManagingDepartmentName,
    List<DepartmentRefDto> PermittedDepartments);
