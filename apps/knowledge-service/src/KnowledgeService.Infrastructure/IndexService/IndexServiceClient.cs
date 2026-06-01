using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using KnowledgeService.Application.Common.Abstractions;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace KnowledgeService.Infrastructure.IndexService;

public sealed partial class IndexServiceClient(
    HttpClient http,
    IHttpContextAccessor httpContextAccessor,
    IConfiguration config,
    ILogger<IndexServiceClient> logger) : IIndexServiceClient
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public async Task<Guid?> CreateCollectionAsync(string collectionName, string? description, CancellationToken ct = default)
    {
        var sanitized = SanitizeCollectionName(collectionName);
        var hasAuth = !string.IsNullOrEmpty(httpContextAccessor.HttpContext?.Request.Headers.Authorization.ToString());
        logger.LogInformation(
            "IndexService CreateCollection → name='{Sanitized}' (original='{Original}'), baseUrl='{BaseUrl}', hasAuth={HasAuth}",
            sanitized, collectionName, http.BaseAddress, hasAuth);
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, "/v1/collections/collections");
            AddAuth(request);
            request.Content = JsonContent.Create(new
            {
                collection_name = collectionName,
                description = description ?? string.Empty
            });

            using var response = await http.SendAsync(request, ct);
            var body = await response.Content.ReadAsStringAsync(ct);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("IndexService CreateCollection FAILED ({Status}): {Body}", response.StatusCode, body);
                return null;
            }

            logger.LogInformation("IndexService CreateCollection OK ({Status}): {Body}", response.StatusCode, body);
            var result = JsonSerializer.Deserialize<CreateCollectionResponse>(body, JsonOptions);
            return result?.Info?.CollectionId;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "IndexService CreateCollection EXCEPTION for '{Name}'", collectionName);
            return null;
        }
    }

    public async Task UploadAndProcessDocumentAsync(
        Guid collectionId,
        string fileUrl,
        string fileName,
        string fileExtension,
        string version,
        CancellationToken ct = default)
    {
        var resolvedUrl = ResolveInternalUrl(fileUrl);
        logger.LogInformation(
            "IndexService UploadAndProcess → collectionId={CollectionId}, fileUrl='{FileUrl}' (resolved='{Resolved}'), fileName='{FileName}', ext={Ext}, version={Version}",
            collectionId, fileUrl, resolvedUrl, fileName, fileExtension, version);
        try
        {
            // Step 1: download file qua internal URL
            using var fileResponse = await http.GetAsync(resolvedUrl, ct);
            logger.LogInformation("IndexService Step1 Download → status={Status}", fileResponse.StatusCode);
            if (!fileResponse.IsSuccessStatusCode)
            {
                var errBody = await fileResponse.Content.ReadAsStringAsync(ct);
                logger.LogWarning("IndexService Download FAILED ({Status}): {Body}", fileResponse.StatusCode, errBody);
                return;
            }

            await using var fileStream = await fileResponse.Content.ReadAsStreamAsync(ct);
            var fullName = $"{fileName}.{fileExtension}";

            // Step 2: batch-upload (multipart/form-data)
            using var uploadRequest = new HttpRequestMessage(HttpMethod.Post,
                $"/v1/collections/{collectionId}/documents/batch-upload");
            AddAuth(uploadRequest);

            using var form = new MultipartFormDataContent();
            var streamContent = new StreamContent(fileStream);
            streamContent.Headers.ContentType = new MediaTypeHeaderValue(GetMimeType(fileExtension));
            form.Add(streamContent, "files", fullName);
            uploadRequest.Content = form;

            using var uploadResponse = await http.SendAsync(uploadRequest, ct);
            var uploadBody = await uploadResponse.Content.ReadAsStringAsync(ct);
            logger.LogInformation("IndexService Step2 BatchUpload → status={Status}, body={Body}",
                uploadResponse.StatusCode, uploadBody);
            if (!uploadResponse.IsSuccessStatusCode)
            {
                logger.LogWarning("IndexService BatchUpload FAILED ({Status}): {Body}", uploadResponse.StatusCode, uploadBody);
                return;
            }

            var uploadResult = JsonSerializer.Deserialize<BatchUploadResponse>(uploadBody, JsonOptions);
            var documentIds = uploadResult?.Info?.Documents
                .Where(d => d.DocumentId is not null)
                .Select(d => d.DocumentId!)
                .ToList() ?? [];

            logger.LogInformation("IndexService BatchUpload documentIds=[{Ids}]", string.Join(",", documentIds));

            if (documentIds.Count == 0)
            {
                logger.LogWarning("IndexService BatchUpload returned no document_ids for collection {CollectionId}", collectionId);
                return;
            }

            // Step 3: batch-process
            using var processRequest = new HttpRequestMessage(HttpMethod.Post,
                $"/v1/collections/{collectionId}/documents/batch-process");
            AddAuth(processRequest);
            var processingType = fileExtension.ToLower() is "xls" or "xlsx" ? "excel" : "document_structured_llm";
            var now = DateTime.UtcNow;
            processRequest.Content = JsonContent.Create(new
            {
                document_ids = documentIds,
                processing_type = processingType,
                version,
                effective_from = now,
                effective_to = now.AddDays(10)
            });

            using var processResponse = await http.SendAsync(processRequest, ct);
            var processBody = await processResponse.Content.ReadAsStringAsync(ct);
            logger.LogInformation("IndexService Step3 BatchProcess → status={Status}, body={Body}",
                processResponse.StatusCode, processBody);
            if (!processResponse.IsSuccessStatusCode)
            {
                logger.LogWarning("IndexService BatchProcess FAILED ({Status}): {Body}", processResponse.StatusCode, processBody);
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "IndexService UploadAndProcess EXCEPTION for collection {CollectionId}", collectionId);
        }
    }

    private string ResolveInternalUrl(string url)
    {
        var internalBase = config["FILE_BASE_URL_INTERNAL"];

        // Relative path (stored after storagePath refactor): prefix with internal base or PUBLIC_URL
        if (!url.StartsWith("http://", StringComparison.OrdinalIgnoreCase) &&
            !url.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
        {
            var baseUrl = !string.IsNullOrEmpty(internalBase)
                ? internalBase.TrimEnd('/')
                : (config["PUBLIC_URL"] ?? "http://localhost:3001").TrimEnd('/');
            return $"{baseUrl}/{url.TrimStart('/')}";
        }

        // Absolute URL: replace host with internal base if configured (backward compat with old data)
        if (string.IsNullOrEmpty(internalBase)) return url;
        var uri = new Uri(url);
        var internalUri = new Uri(internalBase);
        var builder = new UriBuilder(uri)
        {
            Scheme = internalUri.Scheme,
            Host = internalUri.Host,
            Port = internalUri.Port
        };
        return builder.Uri.ToString();
    }

    private void AddAuth(HttpRequestMessage request)
    {
        var authHeader = httpContextAccessor.HttpContext?.Request.Headers.Authorization.ToString();
        if (!string.IsNullOrEmpty(authHeader))
            request.Headers.TryAddWithoutValidation("Authorization", authHeader);
    }

    /// <summary>
    /// Chuyển tên bộ tri thức thành collection_name hợp lệ:
    /// lowercase, chỉ a-z 0-9 _ -, bắt đầu/kết thúc bằng alphanumeric, 3-100 ký tự.
    /// </summary>
    [GeneratedRegex(@"[^a-z0-9_\-]")]
    private static partial Regex InvalidCollectionChars();

    private static string SanitizeCollectionName(string name)
    {
        // Lowercase + thay ký tự không hợp lệ bằng underscore
        var sanitized = InvalidCollectionChars().Replace(name.ToLowerInvariant(), "_");
        // Bỏ underscore/hyphen ở đầu và cuối
        sanitized = sanitized.Trim('_', '-');
        // Đảm bảo tối thiểu 3 ký tự
        if (sanitized.Length < 3)
            sanitized = sanitized.PadRight(3, '0');
        // Cắt tối đa 100 ký tự rồi trim lại ký tự không hợp lệ ở cuối
        if (sanitized.Length > 100)
            sanitized = sanitized[..100].TrimEnd('_', '-');
        return sanitized;
    }

    private static string GetMimeType(string ext) => ext.ToLower() switch
    {
        "pdf"            => "application/pdf",
        "docx"           => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "doc"            => "application/msword",
        "xlsx"           => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "xls"            => "application/vnd.ms-excel",
        "pptx"           => "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "txt"            => "text/plain",
        "png"            => "image/png",
        "jpg" or "jpeg"  => "image/jpeg",
        _                => "application/octet-stream"
    };
}
