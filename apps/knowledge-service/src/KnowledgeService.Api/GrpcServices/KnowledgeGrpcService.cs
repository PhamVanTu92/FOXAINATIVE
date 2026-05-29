using Grpc.Core;
using KnowledgeService.Api.Protos;
using KnowledgeService.Application.Features.KnowledgeBases.Create;
using KnowledgeService.Application.Features.KnowledgeBases.Delete;
using KnowledgeService.Application.Features.KnowledgeBases.Dtos;
using KnowledgeService.Application.Features.KnowledgeBases.Get;
using KnowledgeService.Application.Features.KnowledgeBases.List;
using KnowledgeService.Application.Features.KnowledgeBases.Stats;
using KnowledgeService.Application.Features.KnowledgeBases.Update;
using KnowledgeService.Application.Features.KnowledgeDocuments.Approve;
using KnowledgeService.Application.Features.KnowledgeDocuments.Archive;
using KnowledgeService.Application.Features.KnowledgeDocuments.CreateVersion;
using KnowledgeService.Application.Features.KnowledgeDocuments.Dtos;
using KnowledgeService.Application.Features.KnowledgeDocuments.Get;
using KnowledgeService.Application.Features.KnowledgeDocuments.List;
using KnowledgeService.Application.Features.KnowledgeDocuments.ListVersions;
using KnowledgeService.Application.Features.KnowledgeDocuments.RequestRevision;
using KnowledgeService.Application.Features.KnowledgeDocuments.ReturnToDraft;
using KnowledgeService.Application.Features.KnowledgeDocuments.Rollback;
using KnowledgeService.Application.Features.KnowledgeDocuments.SubmitForReview;
using KnowledgeService.Application.Features.KnowledgeDocuments.Upload;
using KnowledgeService.Application.Features.KnowledgeFiles.Add;
using KnowledgeService.Application.Features.KnowledgeFiles.Delete;
using KnowledgeService.Application.Features.KnowledgeFiles.Dtos;
using KnowledgeService.Application.Features.KnowledgeFiles.Get;
using KnowledgeService.Application.Features.KnowledgeFiles.List;
using KnowledgeService.Application.Features.KnowledgeFiles.ListAll;
using KnowledgeService.Application.Features.KnowledgeFiles.Update;
using KnowledgeService.Application.Features.KnowledgeFiles.UpdatePermissions;
using MediatR;

namespace KnowledgeService.Api.GrpcServices;

public class KnowledgeGrpcService : Protos.KnowledgeService.KnowledgeServiceBase
{
    private readonly IMediator _mediator;
    public KnowledgeGrpcService(IMediator mediator) => _mediator = mediator;

    // ─── Knowledge Bases ─────────────────────────────────────────────────────

    public override async Task<ListKnowledgeBasesResponse> ListKnowledgeBases(
        ListKnowledgeBasesRequest request, ServerCallContext context)
    {
        Guid? deptId = Guid.TryParse(request.DepartmentId, out var d) ? d : null;
        var result = await _mediator.Send(new ListKnowledgeBasesQuery(
            string.IsNullOrEmpty(request.Search) ? null : request.Search,
            deptId, request.Page > 0 ? request.Page : 1,
            request.PageSize > 0 ? request.PageSize : 20));

        var response = new ListKnowledgeBasesResponse
        {
            Total = result.Total,
            Page = result.Page,
            PageSize = result.PageSize
        };
        response.Items.AddRange(result.Items.Select(ToProto));
        return response;
    }

    public override async Task<KnowledgeBaseMessage> GetKnowledgeBase(
        GetKnowledgeBaseRequest request, ServerCallContext context)
    {
        var kb = await _mediator.Send(new GetKnowledgeBaseQuery(Guid.Parse(request.Id)));
        return ToProto(kb);
    }

    public override async Task<KnowledgeBaseMessage> CreateKnowledgeBase(
        CreateKnowledgeBaseRequest request, ServerCallContext context)
    {
        var depts = request.PermittedDepartments.Select(d => new DepartmentRefDto
        {
            DepartmentId = Guid.Parse(d.DepartmentId),
            DepartmentName = d.DepartmentName
        }).ToList();

        Guid? createdBy = Guid.TryParse(request.CreatedBy, out var cb) ? cb : null;

        var result = await _mediator.Send(new CreateKnowledgeBaseCommand(
            request.Code, request.Name,
            string.IsNullOrEmpty(request.Description) ? null : request.Description,
            Guid.Parse(request.ManagingDepartmentId), request.ManagingDepartmentName,
            depts, createdBy));

        return ToProto(result);
    }

    public override async Task<KnowledgeBaseMessage> UpdateKnowledgeBase(
        UpdateKnowledgeBaseRequest request, ServerCallContext context)
    {
        var depts = request.PermittedDepartments.Select(d => new DepartmentRefDto
        {
            DepartmentId = Guid.Parse(d.DepartmentId),
            DepartmentName = d.DepartmentName
        }).ToList();

        var result = await _mediator.Send(new UpdateKnowledgeBaseCommand(
            Guid.Parse(request.Id), request.Name,
            string.IsNullOrEmpty(request.Description) ? null : request.Description,
            Guid.Parse(request.ManagingDepartmentId), request.ManagingDepartmentName,
            depts));

        return ToProto(result);
    }

    public override async Task<DeleteResponse> DeleteKnowledgeBase(
        DeleteKnowledgeBaseRequest request, ServerCallContext context)
    {
        await _mediator.Send(new DeleteKnowledgeBaseCommand(Guid.Parse(request.Id)));
        return new DeleteResponse { Success = true };
    }

    public override async Task<StatsMessage> GetStats(GetStatsRequest request, ServerCallContext context)
    {
        var stats = await _mediator.Send(new GetStatsQuery());
        return new StatsMessage
        {
            TotalKnowledgeBases = stats.TotalKnowledgeBases,
            TotalFiles = stats.TotalFiles,
            DepartmentsUsingCount = stats.DepartmentsUsingCount,
            LastUpdatedAt = stats.LastUpdatedAt?.ToString("O") ?? ""
        };
    }

    // ─── Knowledge Files ─────────────────────────────────────────────────────

    public override async Task<ListKnowledgeFilesResponse> ListKnowledgeFiles(
        ListKnowledgeFilesRequest request, ServerCallContext context)
    {
        var result = await _mediator.Send(new ListKnowledgeFilesQuery(
            Guid.Parse(request.KnowledgeBaseId),
            string.IsNullOrEmpty(request.Search) ? null : request.Search,
            string.IsNullOrEmpty(request.FileType) ? null : request.FileType,
            request.Page > 0 ? request.Page : 1,
            request.PageSize > 0 ? request.PageSize : 50));

        var response = new ListKnowledgeFilesResponse
        {
            Total = result.Total,
            Page = result.Page,
            PageSize = result.PageSize
        };
        response.Items.AddRange(result.Items.Select(ToProto));
        return response;
    }

    public override async Task<KnowledgeFileMessage> GetKnowledgeFile(
        GetKnowledgeFileRequest request, ServerCallContext context)
    {
        var result = await _mediator.Send(new GetKnowledgeFileQuery(
            Guid.Parse(request.Id), Guid.Parse(request.KnowledgeBaseId)));
        return ToProto(result);
    }

    public override async Task<KnowledgeFileMessage> AddKnowledgeFile(
        AddKnowledgeFileRequest request, ServerCallContext context)
    {
        var depts = request.PermittedDepartments.Select(d => new DepartmentRefDto
        {
            DepartmentId = Guid.Parse(d.DepartmentId),
            DepartmentName = d.DepartmentName
        }).ToList();

        Guid? uploadedBy = Guid.TryParse(request.UploadedBy, out var ub) ? ub : null;

        var result = await _mediator.Send(new AddKnowledgeFileCommand(
            Guid.Parse(request.KnowledgeBaseId), request.FileName, request.FileType,
            (decimal)request.FileSizeMb, depts, uploadedBy,
            string.IsNullOrEmpty(request.StoragePath) ? null : request.StoragePath));

        return ToProto(result);
    }

    public override async Task<KnowledgeFileMessage> UpdateKnowledgeFile(
        UpdateKnowledgeFileRequest request, ServerCallContext context)
    {
        var result = await _mediator.Send(new UpdateKnowledgeFileCommand(
            Guid.Parse(request.Id), Guid.Parse(request.KnowledgeBaseId),
            request.FileName, request.FileType, (decimal)request.FileSizeMb));

        return ToProto(result);
    }

    public override async Task<DeleteResponse> DeleteKnowledgeFile(
        DeleteKnowledgeFileRequest request, ServerCallContext context)
    {
        await _mediator.Send(new DeleteKnowledgeFileCommand(
            Guid.Parse(request.Id), Guid.Parse(request.KnowledgeBaseId)));
        return new DeleteResponse { Success = true };
    }

    public override async Task<KnowledgeFileMessage> UpdateFilePermissions(
        UpdateFilePermissionsRequest request, ServerCallContext context)
    {
        var depts = request.PermittedDepartments.Select(d => new DepartmentRefDto
        {
            DepartmentId = Guid.Parse(d.DepartmentId),
            DepartmentName = d.DepartmentName
        }).ToList();

        var result = await _mediator.Send(new UpdateFilePermissionsCommand(
            Guid.Parse(request.Id), Guid.Parse(request.KnowledgeBaseId), depts));

        return ToProto(result);
    }

    public override async Task<ListAllKnowledgeFilesResponse> ListAllKnowledgeFiles(
        ListAllKnowledgeFilesRequest request, ServerCallContext context)
    {
        var result = await _mediator.Send(new ListAllKnowledgeFilesQuery(
            string.IsNullOrEmpty(request.Search) ? null : request.Search,
            string.IsNullOrEmpty(request.FileType) ? null : request.FileType,
            request.Page > 0 ? request.Page : 1,
            request.PageSize > 0 ? request.PageSize : 50));

        var response = new ListAllKnowledgeFilesResponse
        {
            Total = result.Total,
            Page = result.Page,
            PageSize = result.PageSize,
            Counts = new AllFileCountsMessage
            {
                Word = result.Counts.Word,
                Excel = result.Counts.Excel,
                Pdf = result.Counts.Pdf,
                Image = result.Counts.Image,
                PowerPoint = result.Counts.PowerPoint,
                Text = result.Counts.Text,
                Total = result.Counts.Total
            }
        };
        response.Items.AddRange(result.Items.Select(ToProto));
        return response;
    }

    // ─── Knowledge Documents ─────────────────────────────────────────────────

    public override async Task<KnowledgeDocumentMessage> UploadDocument(
        UploadDocumentRequest request, ServerCallContext context)
    {
        Guid? uploadedBy = Guid.TryParse(request.UploadedBy, out var ub) ? ub : null;
        var result = await _mediator.Send(new UploadDocumentCommand(
            Guid.Parse(request.KnowledgeBaseId),
            request.Title,
            request.FileType,
            (decimal)request.FileSizeMb,
            string.IsNullOrEmpty(request.ContentSummary) ? null : request.ContentSummary,
            string.IsNullOrEmpty(request.Note) ? null : request.Note,
            uploadedBy,
            string.IsNullOrEmpty(request.StoragePath) ? null : request.StoragePath));
        return ToProto(result);
    }

    public override async Task<KnowledgeDocumentMessage> GetDocument(
        GetDocumentRequest request, ServerCallContext context)
    {
        var result = await _mediator.Send(new GetDocumentQuery(Guid.Parse(request.Id)));
        return ToProto(result);
    }

    public override async Task<ListDocumentsResponse> ListDocuments(
        ListDocumentsRequest request, ServerCallContext context)
    {
        Guid? kbId = string.IsNullOrEmpty(request.KnowledgeBaseId)
            ? null
            : Guid.TryParse(request.KnowledgeBaseId, out var kb) ? kb : null;

        var result = await _mediator.Send(new ListDocumentsQuery(
            kbId,
            string.IsNullOrEmpty(request.Status) ? null : request.Status,
            string.IsNullOrEmpty(request.Search) ? null : request.Search,
            request.Page > 0 ? request.Page : 1,
            request.PageSize > 0 ? request.PageSize : 20));

        var response = new ListDocumentsResponse
        {
            Total = result.Total,
            Page = result.Page,
            PageSize = result.PageSize
        };
        response.Items.AddRange(result.Items.Select(ToProto));
        return response;
    }

    public override async Task<KnowledgeDocumentMessage> SubmitDocumentForReview(
        DocumentActionRequest request, ServerCallContext context)
    {
        var result = await _mediator.Send(new SubmitDocumentForReviewCommand(Guid.Parse(request.Id)));
        return ToProto(result);
    }

    public override async Task<KnowledgeDocumentMessage> ApproveDocument(
        DocumentActionRequest request, ServerCallContext context)
    {
        var result = await _mediator.Send(new ApproveDocumentCommand(Guid.Parse(request.Id)));
        return ToProto(result);
    }

    public override async Task<KnowledgeDocumentMessage> ReturnDocumentToDraft(
        DocumentActionRequest request, ServerCallContext context)
    {
        var result = await _mediator.Send(new ReturnDocumentToDraftCommand(Guid.Parse(request.Id)));
        return ToProto(result);
    }

    public override async Task<KnowledgeDocumentMessage> RequestDocumentRevision(
        RequestDocumentRevisionRequest request, ServerCallContext context)
    {
        var result = await _mediator.Send(
            new RequestDocumentRevisionCommand(Guid.Parse(request.Id), request.RevisionNote));
        return ToProto(result);
    }

    public override async Task<KnowledgeDocumentMessage> ArchiveDocument(
        DocumentActionRequest request, ServerCallContext context)
    {
        var result = await _mediator.Send(new ArchiveDocumentCommand(Guid.Parse(request.Id)));
        return ToProto(result);
    }

    public override async Task<KnowledgeDocumentMessage> RollbackDocument(
        DocumentActionRequest request, ServerCallContext context)
    {
        var result = await _mediator.Send(new RollbackDocumentCommand(Guid.Parse(request.Id)));
        return ToProto(result);
    }

    public override async Task<KnowledgeDocumentMessage> CreateDocumentVersion(
        CreateDocumentVersionRequest request, ServerCallContext context)
    {
        Guid? createdBy = Guid.TryParse(request.CreatedBy, out var cb) ? cb : null;
        var result = await _mediator.Send(new CreateDocumentVersionCommand(
            Guid.Parse(request.Id),
            request.ChangeNote,
            string.IsNullOrEmpty(request.ContentSummary) ? null : request.ContentSummary,
            createdBy));
        return ToProto(result);
    }

    public override async Task<ListDocumentVersionsResponse> ListDocumentVersions(
        ListDocumentVersionsRequest request, ServerCallContext context)
    {
        var versions = await _mediator.Send(
            new ListDocumentVersionsQuery(Guid.Parse(request.DocumentId)));
        var response = new ListDocumentVersionsResponse();
        response.Items.AddRange(versions.Select(ToProto));
        return response;
    }

    // ─── Mapping helpers ─────────────────────────────────────────────────────

    private static KnowledgeBaseMessage ToProto(Application.Features.KnowledgeBases.Dtos.KnowledgeBaseDto dto)
    {
        var msg = new KnowledgeBaseMessage
        {
            Id = dto.Id.ToString(),
            Code = dto.Code,
            Name = dto.Name,
            Description = dto.Description ?? "",
            ManagingDepartmentId = dto.ManagingDepartmentId.ToString(),
            ManagingDepartmentName = dto.ManagingDepartmentName,
            FileCounts = new FileCounts
            {
                Word = dto.FileCounts.Word,
                Excel = dto.FileCounts.Excel,
                Pdf = dto.FileCounts.Pdf,
                Image = dto.FileCounts.Image
            },
            TotalFiles = dto.TotalFiles,
            CreatedAt = dto.CreatedAt.ToString("O"),
            UpdatedAt = dto.UpdatedAt.ToString("O"),
            CollectionId = dto.CollectionId?.ToString() ?? ""
        };
        msg.Permissions.AddRange(dto.Permissions.Select(p => new DepartmentRef
        {
            DepartmentId = p.DepartmentId.ToString(),
            DepartmentName = p.DepartmentName
        }));
        return msg;
    }

    private static KnowledgeFileMessage ToProto(KnowledgeFileDto dto)
    {
        var msg = new KnowledgeFileMessage
        {
            Id = dto.Id.ToString(),
            KnowledgeBaseId = dto.KnowledgeBaseId.ToString(),
            KnowledgeBaseName = dto.KnowledgeBaseName ?? "",
            FileName = dto.FileName,
            FileType = dto.FileType,
            FileSizeMb = (double)dto.FileSizeMb,
            StoragePath = dto.StoragePath ?? "",
            UploadedAt = dto.UploadedAt.ToString("O"),
            UpdatedAt = dto.UpdatedAt.ToString("O")
        };
        msg.Permissions.AddRange(dto.Permissions.Select(p => new DepartmentRef
        {
            DepartmentId = p.DepartmentId.ToString(),
            DepartmentName = p.DepartmentName
        }));
        return msg;
    }

    private static KnowledgeDocumentMessage ToProto(KnowledgeDocumentDto dto)
        => new KnowledgeDocumentMessage
        {
            Id = dto.Id.ToString(),
            KnowledgeBaseId = dto.KnowledgeBaseId.ToString(),
            KnowledgeBaseName = dto.KnowledgeBaseName,
            Title = dto.Title,
            FileType = dto.FileType,
            FileSizeMb = (double)dto.FileSizeMb,
            StoragePath = dto.StoragePath ?? "",
            UploadedBy = dto.UploadedBy ?? "",
            UploadedAt = dto.UploadedAt.ToString("O"),
            Status = dto.Status,
            CurrentVersion = dto.CurrentVersion,
            VersionCount = dto.VersionCount,
            CreatedAt = dto.CreatedAt.ToString("O"),
            UpdatedAt = dto.UpdatedAt.ToString("O"),
        };

    private static KnowledgeDocumentVersionMessage ToProto(KnowledgeDocumentVersionDto dto)
        => new KnowledgeDocumentVersionMessage
        {
            Id = dto.Id.ToString(),
            DocumentId = dto.DocumentId.ToString(),
            VersionNumber = dto.VersionNumber,
            ChangeNote = dto.ChangeNote,
            ContentSummary = dto.ContentSummary ?? "",
            Status = dto.Status,
            CreatedBy = dto.CreatedBy ?? "",
            CreatedAt = dto.CreatedAt.ToString("O"),
        };
}
