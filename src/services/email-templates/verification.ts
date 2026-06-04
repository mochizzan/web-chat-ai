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
            <td bgcolor="#FFFFFF" style="background-color:#FFFFFF; border-radius:0; box-shadow:0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06);">

              <!-- ─── Aksen Garis Sage Green ─── -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td height="4" style="height:4px; font-size:0; line-height:0; background:linear-gradient(90deg, #5E8A6E, #7BA88E);">&nbsp;</td>
                </tr>
              </table>

              <!-- ─── Header: Logo Brand ─── -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding:40px 40px 12px;">
                    <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFAAAABQCAYAAACOEfKtAAAACXBIWXMAAAsTAAALEwEAmpwYAAAgAElEQVR4nO2cCVxTZ773tbO8d6qVQAjgwuICVdlB29rNWte6smRPgCwQSAIJm4qgIhDCJgiKW62ybwECqLg7VtldW6/TO+073k47005n7G3ntvNOO8055/d+npNEaaf2tk7vvW2nz+fz/5wQzvZ8z397/s9zMmHCj+3H9mP7kgZgosAi+AkR8vnL9vmx3aflI/+hL35HQE6YMOFHkP8VOAeoCTdvj3juHs3ZV3tl28HbH9/0dP7/y+D+07d85D9kcYAj5tr4SqW6aCT5D5tvCLD5FSFMY7p3Gq7tVAFg4ZF98/N/BEnaRAIDsJtm96tHIiqGN/1yx3UVMi5voA1D6ynj0Doq43IUXfCKCpWjm8713KgLY4/EhIn/1GYtIFrkMMfX/vTa1N2Xt+0uvKz5ZMsNCTJHYmzZw3w6ayQWWSPRyByJpjOGN1Bbboiw40rSX3dfyaseb9ZO7f2naPn5pMMWp7n+rO5mhcE0mnwn5xUhDMMb6IyhaCprOAZZw9HjJAqZw9FIH9pAGUbXUZtfEaFoVPvH+ps7NQDYc5Fz/qDNGsBECyw/IaZH/u7/1+anykcyruTekCF1ZA2tH1xrMwxGMelDUcgY3oDM4ShkDUUhcygamY5t+mAU0gajmNTBDTbDyAZm2ysKVI5tGjz+q9bH2YvkT7j7cH5QzTLOXG/9ccxr79i2AwVjGir7qhBpg+sJONo4sAEGIoNRYCEObWCFwCPgjINRMAza90kfjEH6UCydPhRF5VwXoXAs+W97R7fXvPHudd5d9/BD0Mb8/HtpCTHX+hvlyaYx7Xt5r0iRPhxFZQzFUhlDBIYdmh2UHaJhIBppA1F0+mAMlT4QA+NANPs/u4bGIHMoFplDAmQMxVCGoWg697oMhUP639ffqFY6zfp7nYSDpBxOc/23hgVlY1kDW2/EwzCyjjEMbqAyBmOYjKFoZAxHOYT4OLumEXD6i2upjLFoZIzGIvVSlM14KYb4R2QOEXj2LauJA7EwXIplUi9FUYbhKCbvmgLlw9kXel5vZqN1fv6Eh/B9yx3hAHfrz7fcasfyq4suaz7ddFVEzJUyDETTRJuIVqWTLWuuDohD0UzawAYqbWgDk3tVjpLB9FfNI8abOdfjYCQBZjCaIpqXMRiL9MFou1ZeItppl/TBWNo4FG3bdF2EgjHNX2tHC0rf/PBNjv2mvmfpTt1Ylcw8kv7WtlcSSFpCOs52Pp0NBsQcHQAGN7BaZxyMotOGN1Cbb0hRMKy7s2+sJAvAv+AdPHzwmjmvYCTlP7OvCaEbXEcZLkXTxkvRMBB4l8iDiGGhZg7xkcVKDJUxEkNve1UB87Dh3+uvV/EnfB+axeHvLNcORRbfSIVxNIoxDrBawxCTyyLmNxxjN1c2EETDQMx1YA1lvByFbWMqVI3mNQ2/fm6604c6g8GZ3xzzLx/KOZo7qkDqSDSTenEDZbwUw9jBOYXAu/s3kz4YTaWPbkDxFT1juX54PnvO77I5WxwAG/+15sktownQDay12U0rGhmDMcggGjhMOkc+RzPG4WibcSyGzr0eh6LBtFdbbx5azp4IzhEKJhJ3MD5Rbr62N6ZgyPB63o14EC3LHIqhsob4jBMiuQa5lt0/xkB7aa0t77IS1tfrH/veAKy7WvNE3pgS2otrmdSBGKQRUyV+ajAGRgJxMJYhPi3vFTmKRvR39l8tMxJz/aoUZPyI486dO4/sGzXlF42mfpxzQ0Y0mXZCc7oGw0AMa+Lai+uYrWNqWG4einSeZ8J3tVkcHWx6dd8TWy8rob20jgXIyiU7yNQBonkx2DqaRFWPbD987d/OTPtiJear2njA/a/1B1SO5B3dOqZkE2yS+rDwLkUjjchANHQD65ntY4lovXkoxHmdCd/VZnGMApq" alt="MI-Labs" width="80" height="80" style="display:block; width:80px; height:80px;" />
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
                      Gunakan kode verifikasi berikut untuk menyelesaikan aksi Anda. Kode berlaku <strong>10 menit</strong>.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- ─── Kotak Kode OTP ─── -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding:28px 40px 0 40px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" bgcolor="#EFF5F0" style="background-color:#EFF5F0; border:1px solid #C5D5C0; border-radius:12px;">
                      <tr>
                        <td align="center" style="padding:24px 48px;">
                          <span style="font-family:'Courier New', monospace; font-size:38px; font-weight:700; letter-spacing:8px; color:#3D6B50; line-height:1.2; user-select:all; -webkit-user-select:all;">${otp}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- ─── Indikator Waktu Habis ─── -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding:14px 40px 0 40px;">
                    <span style="font-family:Arial, Helvetica, sans-serif; font-size:13px; color:#8B6B3D; line-height:1.4;">
                      🕐 Berlaku hingga ${expiryTime}
                    </span>
                  </td>
                </tr>
              </table>

              <!-- ─── Divider ─── -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:28px 40px 0 40px;">
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
                  <td align="center" style="padding:20px 40px 36px 40px;">
                    <p style="margin:0; font-family:Arial, Helvetica, sans-serif; font-size:12px; color:#8DA89A; line-height:1.5;">
                      Jika Anda tidak meminta kode ini, abaikan email ini. Akun Anda tetap aman.
                    </p>
                    <p style="margin:8px 0 0 0; font-family:Arial, Helvetica, sans-serif; font-size:12px; color:#8DA89A; line-height:1.5;">
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
