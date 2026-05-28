namespace SystemService.Infrastructure.Persistence.Seeding;

/// <summary>
/// Demo users aligned with the role distribution shown in the UI screenshot:
/// Kế toán trưởng ×1, Nhân viên kế toán ×3, Trưởng phòng ×3,
/// Nhân viên OCR ×4, Nhân viên ×8.
/// </summary>
internal static class DemoUserSeedData
{
    public const string DefaultPassword = "Demo@12345";

    public static readonly UserSeed[] All =
    {
        // ── Kế toán trưởng (1) ────────────────────────────────────────────────
        new("tran.thi.lan",    "tran.thi.lan@foxai.local",    "Trần Thị Lan",      "0901234001", DemoOrgSeedData.PhongKeToan,    DemoRoleSeedData.KeToanTruong),

        // ── Nhân viên kế toán (3) ─────────────────────────────────────────────
        new("le.minh.tuan",    "le.minh.tuan@foxai.local",    "Lê Minh Tuấn",      "0901234002", DemoOrgSeedData.PhongKeToan,    DemoRoleSeedData.NhanVienKeToan),
        new("pham.thi.hoa",    "pham.thi.hoa@foxai.local",    "Phạm Thị Hoa",      "0901234003", DemoOrgSeedData.PhongKeToan,    DemoRoleSeedData.NhanVienKeToan),
        new("nguyen.van.duc",  "nguyen.van.duc@foxai.local",  "Nguyễn Văn Đức",    "0901234004", DemoOrgSeedData.PhongKeToan,    DemoRoleSeedData.NhanVienKeToan),

        // ── Trưởng phòng (3) ──────────────────────────────────────────────────
        new("hoang.anh.khoa",  "hoang.anh.khoa@foxai.local",  "Hoàng Anh Khoa",    "0901234005", DemoOrgSeedData.PhongOcr,       DemoRoleSeedData.TruongPhong),
        new("vu.thi.bich",     "vu.thi.bich@foxai.local",     "Vũ Thị Bích",       "0901234006", DemoOrgSeedData.PhongKeToan,    DemoRoleSeedData.TruongPhong),
        new("do.quang.hung",   "do.quang.hung@foxai.local",   "Đỗ Quang Hùng",     "0901234007", DemoOrgSeedData.PhongKinhDoanh, DemoRoleSeedData.TruongPhong),

        // ── Nhân viên OCR (4) ─────────────────────────────────────────────────
        new("bui.thi.lan",     "bui.thi.lan@foxai.local",     "Bùi Thị Lan",       "0901234008", DemoOrgSeedData.PhongOcr,       DemoRoleSeedData.NhanVienOcr),
        new("ly.van.minh",     "ly.van.minh@foxai.local",     "Lý Văn Minh",       "0901234009", DemoOrgSeedData.PhongOcr,       DemoRoleSeedData.NhanVienOcr),
        new("ngo.thi.thu",     "ngo.thi.thu@foxai.local",     "Ngô Thị Thu",       "0901234010", DemoOrgSeedData.PhongOcr,       DemoRoleSeedData.NhanVienOcr),
        new("trinh.van.nam",   "trinh.van.nam@foxai.local",   "Trịnh Văn Nam",     "0901234011", DemoOrgSeedData.PhongOcr,       DemoRoleSeedData.NhanVienOcr),

        // ── Nhân viên (8) ─────────────────────────────────────────────────────
        new("dinh.thi.mai",    "dinh.thi.mai@foxai.local",    "Đinh Thị Mai",      "0901234012", DemoOrgSeedData.PhongKinhDoanh, DemoRoleSeedData.NhanVien),
        new("phan.van.long",   "phan.van.long@foxai.local",   "Phan Văn Long",     "0901234013", DemoOrgSeedData.PhongKinhDoanh, DemoRoleSeedData.NhanVien),
        new("cao.thi.nga",     "cao.thi.nga@foxai.local",     "Cao Thị Nga",       "0901234014", DemoOrgSeedData.PhongCongNghe,  DemoRoleSeedData.NhanVien),
        new("luong.van.tung",  "luong.van.tung@foxai.local",  "Lương Văn Tùng",    "0901234015", DemoOrgSeedData.PhongCongNghe,  DemoRoleSeedData.NhanVien),
        new("ha.thi.linh",     "ha.thi.linh@foxai.local",     "Hà Thị Linh",       "0901234016", DemoOrgSeedData.BanGiamDoc,     DemoRoleSeedData.NhanVien),
        new("vuong.van.toan",  "vuong.van.toan@foxai.local",  "Vương Văn Toàn",    "0901234017", DemoOrgSeedData.PhongKinhDoanh, DemoRoleSeedData.NhanVien),
        new("dang.thi.hang",   "dang.thi.hang@foxai.local",   "Đặng Thị Hằng",     "0901234018", DemoOrgSeedData.PhongCongNghe,  DemoRoleSeedData.NhanVien),
        new("truong.van.binh", "truong.van.binh@foxai.local", "Trương Văn Bình",   "0901234019", DemoOrgSeedData.PhongCongNghe,  DemoRoleSeedData.NhanVien),
    };

    public sealed record UserSeed(
        string Username,
        string Email,
        string FullName,
        string? Phone,
        string OrgCode,
        string RoleCode
    );
}
