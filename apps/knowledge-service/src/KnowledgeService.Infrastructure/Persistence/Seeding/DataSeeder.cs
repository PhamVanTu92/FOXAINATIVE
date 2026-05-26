using KnowledgeService.Domain.Entities;
using KnowledgeService.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace KnowledgeService.Infrastructure.Persistence.Seeding;

public static class DataSeeder
{
    public static async Task SeedAsync(IServiceProvider sp)
    {
        var db = sp.GetRequiredService<KnowledgeDbContext>();
        var logger = sp.GetRequiredService<ILogger<KnowledgeDbContext>>();

        if (await db.KnowledgeBases.AnyAsync())
        {
            logger.LogInformation("Knowledge seed skipped – data already exists.");
            return;
        }

        logger.LogInformation("Seeding knowledge base sample data...");

        // Phòng ban (denormalized IDs)
        var bgdId = Guid.Parse("10000001-0000-0000-0000-000000000001");
        var ktId  = Guid.Parse("10000001-0000-0000-0000-000000000002");
        var nsId  = Guid.Parse("10000001-0000-0000-0000-000000000003");
        var cnttId = Guid.Parse("10000001-0000-0000-0000-000000000004");
        var kdId  = Guid.Parse("10000001-0000-0000-0000-000000000005");
        var aiId  = Guid.Parse("10000001-0000-0000-0000-000000000006");

        var now = DateTime.UtcNow;

        var kbs = new List<KnowledgeBase>
        {
            new KnowledgeBase
            {
                Id = Guid.NewGuid(),
                Code = "KB001",
                Name = "Tri thức Kế toán – Tài chính",
                Description = "Tài liệu quy trình kế toán, báo cáo tài chính, chuẩn mực IFRS và hướng dẫn nội bộ.",
                ManagingDepartmentId = ktId,
                ManagingDepartmentName = "Phòng Kế toán - Tài chính",
                CreatedAt = new DateTime(2026, 4, 22, 0, 0, 0, DateTimeKind.Utc),
                UpdatedAt = new DateTime(2026, 4, 22, 0, 0, 0, DateTimeKind.Utc),
                Permissions = new List<KnowledgeBasePermission>
                {
                    new() { DepartmentId = bgdId, DepartmentName = "Ban Giám đốc", CreatedAt = now, UpdatedAt = now },
                    new() { DepartmentId = ktId, DepartmentName = "Phòng Kế toán - Tài chính", CreatedAt = now, UpdatedAt = now }
                },
                Files = new List<KnowledgeFile>
                {
                    new() { FileName = "Quy trình kế toán nội bộ 2025.docx", FileType = FileType.Word, FileSizeMb = 1.8m, UploadedAt = new DateTime(2026,4,22,0,0,0,DateTimeKind.Utc), CreatedAt = now, UpdatedAt = now, Permissions = new List<KnowledgeFilePermission> { new() { DepartmentId = ktId, DepartmentName = "Phòng Kế toán - Tài chính", CreatedAt = now, UpdatedAt = now } } },
                    new() { FileName = "Báo cáo tài chính quý 1-2026.xlsx", FileType = FileType.Excel, FileSizeMb = 3.2m, UploadedAt = new DateTime(2026,4,15,0,0,0,DateTimeKind.Utc), CreatedAt = now, UpdatedAt = now, Permissions = new List<KnowledgeFilePermission> { new() { DepartmentId = ktId, DepartmentName = "Phòng Kế toán - Tài chính", CreatedAt = now, UpdatedAt = now }, new() { DepartmentId = bgdId, DepartmentName = "Ban Giám đốc", CreatedAt = now, UpdatedAt = now } } },
                    new() { FileName = "Chuẩn mực kế toán IFRS 2024.pdf", FileType = FileType.PDF, FileSizeMb = 5.6m, UploadedAt = new DateTime(2025,12,10,0,0,0,DateTimeKind.Utc), CreatedAt = now, UpdatedAt = now, Permissions = new List<KnowledgeFilePermission> { new() { DepartmentId = ktId, DepartmentName = "Phòng Kế toán - Tài chính", CreatedAt = now, UpdatedAt = now } } },
                    new() { FileName = "Hướng dẫn đối chiếu công nợ.docx", FileType = FileType.Word, FileSizeMb = 0.9m, UploadedAt = new DateTime(2026,1,8,0,0,0,DateTimeKind.Utc), CreatedAt = now, UpdatedAt = now, Permissions = new List<KnowledgeFilePermission> { new() { DepartmentId = ktId, DepartmentName = "Phòng Kế toán - Tài chính", CreatedAt = now, UpdatedAt = now }, new() { DepartmentId = cnttId, DepartmentName = "Phòng CNTT", CreatedAt = now, UpdatedAt = now } } },
                    new() { FileName = "Mẫu biên bản bàn giao chứng từ.docx", FileType = FileType.Word, FileSizeMb = 0.4m, UploadedAt = new DateTime(2025,11,20,0,0,0,DateTimeKind.Utc), CreatedAt = now, UpdatedAt = now, Permissions = new List<KnowledgeFilePermission> { new() { DepartmentId = ktId, DepartmentName = "Phòng Kế toán - Tài chính", CreatedAt = now, UpdatedAt = now } } }
                }
            },
            new KnowledgeBase
            {
                Id = Guid.NewGuid(),
                Code = "KB002",
                Name = "Tri thức Nhân sự & Lao động",
                Description = "Quy chế lương thưởng, hợp đồng lao động, chính sách phúc lợi và quy định nội bộ.",
                ManagingDepartmentId = nsId,
                ManagingDepartmentName = "Phòng Nhân sự",
                CreatedAt = new DateTime(2026, 3, 11, 0, 0, 0, DateTimeKind.Utc),
                UpdatedAt = new DateTime(2026, 3, 11, 0, 0, 0, DateTimeKind.Utc),
                Permissions = new List<KnowledgeBasePermission>
                {
                    new() { DepartmentId = nsId, DepartmentName = "Phòng Nhân sự", CreatedAt = now, UpdatedAt = now },
                    new() { DepartmentId = bgdId, DepartmentName = "Ban Giám đốc", CreatedAt = now, UpdatedAt = now }
                },
                Files = new List<KnowledgeFile>
                {
                    new() { FileName = "Quy chế lương thưởng 2026.docx", FileType = FileType.Word, FileSizeMb = 2.1m, UploadedAt = new DateTime(2026,3,11,0,0,0,DateTimeKind.Utc), CreatedAt = now, UpdatedAt = now, Permissions = new List<KnowledgeFilePermission>() },
                    new() { FileName = "Mẫu hợp đồng lao động.xlsx", FileType = FileType.Excel, FileSizeMb = 0.5m, UploadedAt = new DateTime(2026,2,20,0,0,0,DateTimeKind.Utc), CreatedAt = now, UpdatedAt = now, Permissions = new List<KnowledgeFilePermission>() },
                    new() { FileName = "Chính sách phúc lợi nhân viên.pdf", FileType = FileType.PDF, FileSizeMb = 1.2m, UploadedAt = new DateTime(2026,1,5,0,0,0,DateTimeKind.Utc), CreatedAt = now, UpdatedAt = now, Permissions = new List<KnowledgeFilePermission>() },
                    new() { FileName = "Hướng dẫn onboarding nhân viên mới.pdf", FileType = FileType.PDF, FileSizeMb = 3.8m, UploadedAt = new DateTime(2025,12,1,0,0,0,DateTimeKind.Utc), CreatedAt = now, UpdatedAt = now, Permissions = new List<KnowledgeFilePermission>() }
                }
            },
            new KnowledgeBase
            {
                Id = Guid.NewGuid(),
                Code = "KB003",
                Name = "Tri thức Công nghệ & AI",
                Description = "Tài liệu kỹ thuật hệ thống, hướng dẫn sử dụng OCR, đặc tả API và mô hình AI.",
                ManagingDepartmentId = cnttId,
                ManagingDepartmentName = "Phòng CNTT",
                CreatedAt = new DateTime(2026, 5, 8, 0, 0, 0, DateTimeKind.Utc),
                UpdatedAt = new DateTime(2026, 5, 8, 0, 0, 0, DateTimeKind.Utc),
                Permissions = new List<KnowledgeBasePermission>
                {
                    new() { DepartmentId = cnttId, DepartmentName = "Phòng CNTT", CreatedAt = now, UpdatedAt = now },
                    new() { DepartmentId = aiId, DepartmentName = "Tổ AI & Tự động hóa", CreatedAt = now, UpdatedAt = now }
                },
                Files = new List<KnowledgeFile>
                {
                    new() { FileName = "Kiến trúc hệ thống FoxAI.docx", FileType = FileType.Word, FileSizeMb = 4.5m, UploadedAt = new DateTime(2026,5,8,0,0,0,DateTimeKind.Utc), CreatedAt = now, UpdatedAt = now, Permissions = new List<KnowledgeFilePermission>() },
                    new() { FileName = "API Reference v2.xlsx", FileType = FileType.Excel, FileSizeMb = 1.1m, UploadedAt = new DateTime(2026,4,20,0,0,0,DateTimeKind.Utc), CreatedAt = now, UpdatedAt = now, Permissions = new List<KnowledgeFilePermission>() },
                    new() { FileName = "Hướng dẫn cấu hình OCR.pdf", FileType = FileType.PDF, FileSizeMb = 2.3m, UploadedAt = new DateTime(2026,3,15,0,0,0,DateTimeKind.Utc), CreatedAt = now, UpdatedAt = now, Permissions = new List<KnowledgeFilePermission>() },
                    new() { FileName = "Screenshot demo chatbot.png", FileType = FileType.Image, FileSizeMb = 0.8m, UploadedAt = new DateTime(2026,5,1,0,0,0,DateTimeKind.Utc), CreatedAt = now, UpdatedAt = now, Permissions = new List<KnowledgeFilePermission>() }
                }
            },
            new KnowledgeBase
            {
                Id = Guid.NewGuid(),
                Code = "KB004",
                Name = "Tri thức Kinh doanh & Bán hàng",
                Description = "Chính sách giá, hợp đồng mẫu, tài liệu giới thiệu sản phẩm và kịch bản bán hàng.",
                ManagingDepartmentId = kdId,
                ManagingDepartmentName = "Phòng Kinh doanh",
                CreatedAt = new DateTime(2026, 4, 30, 0, 0, 0, DateTimeKind.Utc),
                UpdatedAt = new DateTime(2026, 4, 30, 0, 0, 0, DateTimeKind.Utc),
                Permissions = new List<KnowledgeBasePermission>
                {
                    new() { DepartmentId = kdId, DepartmentName = "Phòng Kinh doanh", CreatedAt = now, UpdatedAt = now },
                    new() { DepartmentId = bgdId, DepartmentName = "Ban Giám đốc", CreatedAt = now, UpdatedAt = now }
                },
                Files = new List<KnowledgeFile>
                {
                    new() { FileName = "Bảng giá sản phẩm Q2-2026.docx", FileType = FileType.Word, FileSizeMb = 1.4m, UploadedAt = new DateTime(2026,4,30,0,0,0,DateTimeKind.Utc), CreatedAt = now, UpdatedAt = now, Permissions = new List<KnowledgeFilePermission>() },
                    new() { FileName = "Hợp đồng dịch vụ mẫu.xlsx", FileType = FileType.Excel, FileSizeMb = 0.7m, UploadedAt = new DateTime(2026,4,10,0,0,0,DateTimeKind.Utc), CreatedAt = now, UpdatedAt = now, Permissions = new List<KnowledgeFilePermission>() },
                    new() { FileName = "Catalogue sản phẩm 2026.pdf", FileType = FileType.PDF, FileSizeMb = 8.2m, UploadedAt = new DateTime(2026,3,20,0,0,0,DateTimeKind.Utc), CreatedAt = now, UpdatedAt = now, Permissions = new List<KnowledgeFilePermission>() },
                    new() { FileName = "Infographic giải pháp AI.png", FileType = FileType.Image, FileSizeMb = 1.5m, UploadedAt = new DateTime(2026,4,25,0,0,0,DateTimeKind.Utc), CreatedAt = now, UpdatedAt = now, Permissions = new List<KnowledgeFilePermission>() }
                }
            },
            new KnowledgeBase
            {
                Id = Guid.NewGuid(),
                Code = "KB005",
                Name = "Quy định & Pháp lý",
                Description = "Văn bản pháp luật, quy định thuế, nghị định, thông tư liên quan đến hoạt động doanh nghiệp.",
                ManagingDepartmentId = bgdId,
                ManagingDepartmentName = "Ban Giám đốc",
                CreatedAt = new DateTime(2026, 5, 1, 0, 0, 0, DateTimeKind.Utc),
                UpdatedAt = new DateTime(2026, 5, 1, 0, 0, 0, DateTimeKind.Utc),
                Permissions = new List<KnowledgeBasePermission>(),
                Files = new List<KnowledgeFile>
                {
                    new() { FileName = "Luật doanh nghiệp 2020.pdf", FileType = FileType.PDF, FileSizeMb = 6.1m, UploadedAt = new DateTime(2026,5,1,0,0,0,DateTimeKind.Utc), CreatedAt = now, UpdatedAt = now, Permissions = new List<KnowledgeFilePermission>() },
                    new() { FileName = "Nghị định 13 BVDL cá nhân.pdf", FileType = FileType.PDF, FileSizeMb = 2.4m, UploadedAt = new DateTime(2026,4,15,0,0,0,DateTimeKind.Utc), CreatedAt = now, UpdatedAt = now, Permissions = new List<KnowledgeFilePermission>() },
                    new() { FileName = "Thông tư 78 thuế TNDN.pdf", FileType = FileType.PDF, FileSizeMb = 3.7m, UploadedAt = new DateTime(2026,3,10,0,0,0,DateTimeKind.Utc), CreatedAt = now, UpdatedAt = now, Permissions = new List<KnowledgeFilePermission>() }
                }
            }
        };

        await db.KnowledgeBases.AddRangeAsync(kbs);
        await db.SaveChangesAsync();
        logger.LogInformation("Knowledge seed completed: {Count} knowledge bases seeded.", kbs.Count);

        await SeedDocumentsAsync(db, kbs, logger);
    }

    private static async Task SeedDocumentsAsync(
        KnowledgeDbContext db, List<KnowledgeBase> kbs, ILogger logger)
    {
        if (await db.KnowledgeDocuments.AnyAsync()) return;

        var kb001 = kbs[0]; // Kế toán – Tài chính
        var kb002 = kbs[1]; // Nhân sự & Lao động
        var kb003 = kbs[2]; // Công nghệ & AI
        var kb004 = kbs[3]; // Kinh doanh & Bán hàng
        var kb005 = kbs[4]; // Quy định & Pháp lý

        var userId1 = Guid.Parse("20000001-0000-0000-0000-000000000001");
        var userId2 = Guid.Parse("20000001-0000-0000-0000-000000000002");
        var userId3 = Guid.Parse("20000001-0000-0000-0000-000000000003");

        var docs = new List<KnowledgeDocument>
        {
            CreateSeededDocument(
                kb001.Id, kb001.Name,
                "Quy trinh ke toan noi bo 2025", FileType.PDF, 2.1m,
                "Quy trinh ke toan noi bo 2025\n\n1. Nguyen tac chung\n   - Tuan thu chuan muc ke toan Viet Nam\n   - Bao cao dinh ky\n2. Quy trinh phan bon chi phi\n3. Phê duyệt chứng từ",
                "Cap nhat quy trinh Q1-2026", DocumentStatus.Review, "v1.3",
                userId1, new DateTime(2026, 5, 10, 0, 0, 0, DateTimeKind.Utc), 3),

            CreateSeededDocument(
                kb002.Id, kb002.Name,
                "Quy che tien luong 2026", FileType.PDF, 1.8m,
                "Quy che tien luong 2026 - Phien ban 2.0\n\nDieu 1: Nguyen tac tra luong\n   - Luong co ban theo vi tri cong viec\n   - Phu cap chuc vu, phu cap tham nien\n   - Thuong KPI hang quy\n   - Thuong cuoi nam theo doanh thu\n\nDieu 2: Bang luong\n   - Chuyen vien: 15-25 trieu\n   - Truong phong: 30-45 trieu\n   - Pho giam doc: 50-70 trieu",
                "Cap nhat bang luong moi theo NQ HDQT Q1-2026", DocumentStatus.Approved, "v2.0",
                userId2, new DateTime(2026, 3, 11, 0, 0, 0, DateTimeKind.Utc), 2),

            CreateSeededDocument(
                kb003.Id, kb003.Name,
                "Tai lieu API he thong FOXAI v2", FileType.PDF, 3.4m,
                "API Documentation FOXAI v2 - Draft 0.2\n\n1. Authentication\n   - POST /auth/login\n   - POST /auth/refresh\n   - Bearer Token (JWT)\n\n2. OCR Endpoints\n   - POST /ocr/process\n   - GET /ocr/status/{id}\n   - GET /ocr/result/{id}\n\n3. Knowledge Base\n   - GET /kb/list\n   - POST /kb/create\n   - PUT /kb/{id}/update",
                "Ban nhap - cap nhat endpoint moi", DocumentStatus.Draft, "v0.2",
                userId3, new DateTime(2026, 5, 8, 0, 0, 0, DateTimeKind.Utc), 2),

            CreateSeededDocument(
                kb004.Id, kb004.Name,
                "Chinh sach gia san pham 2026", FileType.Excel, 1.2m,
                "Bang gia san pham FOXAI 2026 - Q2\n\nGoi STARTER\n   - OCR Basic: 2.000.000 VND/thang\n   - Max 1.000 trang/thang\n   - Ho tro email\n\nGoi PROFESSIONAL\n   - OCR Advanced + AI: 8.000.000 VND/thang\n   - Max 10.000 trang/thang\n   - Ho tro 24/7\n   - Tich hop API\n\nGoi ENTERPRISE\n   - Khong gioi han\n   - Trien khai rieng\n   - SLA 99.9%",
                "Cap nhat gia theo bien dong thi truong Q2", DocumentStatus.Review, "v3.1",
                userId2, new DateTime(2026, 4, 30, 0, 0, 0, DateTimeKind.Utc), 2),

            CreateSeededDocument(
                kb005.Id, kb005.Name,
                "Luat doanh nghiep 2020 – tom tat", FileType.PDF, 5.8m,
                "Luat Doanh nghiep 2020 - Tom tat\n\nChuong I: Quy dinh chung\n   - Dieu 1: Pham vi dieu chinh\n   - Dieu 2: Doi tuong ap dung\n\nChuong II: Thanh lap doanh nghiep\n   - Thu tuc dang ky\n   - Von dieu le\n\nChuong III: Quan tri doanh nghiep",
                "Phien ban tom tat da duoc phap che xac nhan", DocumentStatus.Archived, "v1.0",
                userId1, new DateTime(2025, 8, 1, 0, 0, 0, DateTimeKind.Utc), 1),
        };

        await db.KnowledgeDocuments.AddRangeAsync(docs);
        await db.SaveChangesAsync();
        logger.LogInformation("Document seed completed: {Count} documents seeded.", docs.Count);
    }

    private static KnowledgeDocument CreateSeededDocument(
        Guid kbId, string kbName, string title, FileType fileType, decimal sizeMb,
        string contentSummary, string changeNote, DocumentStatus status,
        string currentVersion, Guid uploadedBy, DateTime uploadedAt, int versionCount)
    {
        var doc = new KnowledgeDocument
        {
            Id = Guid.NewGuid(),
            KnowledgeBaseId = kbId,
            KnowledgeBaseName = kbName,
            Title = title,
            FileType = fileType,
            FileSizeMb = sizeMb,
            UploadedBy = uploadedBy,
            UploadedAt = uploadedAt,
            Status = status,
            CurrentVersion = currentVersion,
            VersionCount = versionCount,
        };

        doc.Versions.Add(new KnowledgeDocumentVersion
        {
            Id = Guid.NewGuid(),
            DocumentId = doc.Id,
            VersionNumber = currentVersion,
            ChangeNote = changeNote,
            ContentSummary = contentSummary,
            Status = status,
            CreatedBy = uploadedBy,
        });

        return doc;
    }
}
