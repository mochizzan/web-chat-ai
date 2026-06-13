/**
 * Verification email HTML template
 * Table-based layout for maximum email client compatibility (Outlook, Gmail, Apple Mail, etc.)
 * Sage green palette matching MI-Labs app theme (Material Design 3, Hue 155)
 */

/**
 * Build verification email HTML with table-based layout
 *
 * @param otp - 6-digit OTP string (e.g. "482391")
 * @param expiryTime - Expiry time in HH:MM format (e.g. "09:59")
 * @param name - User's display name (optional, falls back to "Pengguna")
 * @returns Complete HTML email string
 */
export function buildVerificationEmailHtml(otp: string, expiryTime: string, name?: string): string {
  const displayName = name?.trim() || 'Pengguna';

  return `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Kode Verifikasi MI-Labs</title>
</head>
<body style="margin:0; padding:0; background-color:#F2F6F3; font-family:Arial, Helvetica, sans-serif; -webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F2F6F3" style="background-color:#F2F6F3;">
    <tr>
      <td align="center" style="padding:40px 16px;">

        <!-- ─── White Card Container ─── -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; width:100%;">
          <tr>
            <td bgcolor="#FFFFFF" style="background-color:#FFFFFF; border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06); overflow:hidden;">

              <!-- ─── Aksen Garis Sage Green ─── -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td height="4" style="height:4px; font-size:0; line-height:0; background:linear-gradient(90deg, #5E8A6E, #7BA88E);">&nbsp;</td>
                </tr>
              </table>

              <!-- ─── Header: Logo Brand ─── -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding:40px 40px 20px;">
                    <img src="https://m-i.id/logo.png" width="80" height="80" alt="MI-Labs Logo" style="display:block; width:80px; height:80px; border:0;" />
                  </td>
                </tr>
              </table>

              <!-- ─── Salam ─── -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding:24px 40px 0 40px;">
                    <h1 style="margin:0; font-family:Arial, Helvetica, sans-serif; font-size:22px; font-weight:700; color:#1A2E1F; line-height:1.4;">Halo ${displayName}</h1>
                  </td>
                </tr>
              </table>

              <!-- ─── Teks Instruksi ─── -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding:12px 40px 0 40px;">
                    <p style="margin:0; font-family:Arial, Helvetica, sans-serif; font-size:15px; color:#3D5A4A; line-height:1.6;">
                      Gunakan kode verifikasi berikut untuk menyelesaikan aksi Anda. Kode berlaku sampai pukul <strong>${expiryTime}</strong>.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- ─── Kotak Kode OTP ─── -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding:32px 40px 0 40px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" bgcolor="#EFF5F0" style="background-color:#EFF5F0; border:1px solid #C5D5C0; border-radius:12px;">
                      <tr>
                        <td align="center" style="padding:24px 48px;">
                          <span style="font-family:'Courier New', monospace; font-size:42px; font-weight:bold; color:#1A2E1F; letter-spacing:8px;">${otp}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- ─── Garis Pemisah ─── -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:36px 40px 0 40px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td height="1" bgcolor="#DDE5DE" style="height:1px; font-size:0; line-height:0; background-color:#DDE5DE;">&nbsp;</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- ─── Footer ─── -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding:24px 40px 40px 40px;">
                    <p style="margin:0; font-family:Arial, Helvetica, sans-serif; font-size:13px; color:#8DA89A; line-height:1.5;">
                      Jika Anda tidak meminta kode ini, abaikan email ini. Akun Anda tetap aman.
                    </p>
                    <p style="margin:12px 0 0 0; font-family:Arial, Helvetica, sans-serif; font-size:13px; color:#5E8A6E; font-weight:bold; line-height:1.5;">
                      🔒 MI-Labs &middot; Platform AI Chat Terpercaya
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>
        </table>
        <!-- ─── End White Card ─── -->

      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}
