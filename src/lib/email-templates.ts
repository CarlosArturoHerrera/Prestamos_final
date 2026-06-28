/**
 * Reusable HTML email templates for Préstamos Elicar.
 * Design tokens extracted from globals.css (Corporate light theme).
 *
 * Usage:
 *   const { subject, html, text } = recoveryPasswordEmail(actionLink)
 *   await resend.send({ subject, html, text, ... })
 *
 * Future templates follow the same pattern:
 *   export function welcomeEmail(name: string): EmailPayload
 *   export function invitationEmail(name: string, inviteLink: string): EmailPayload
 */

export type EmailPayload = {
  subject: string;
  html: string;
  text: string;
};

// ── Design tokens (mirrors globals.css :root) ──────────────────────────────
const T = {
  primary: "#0052CC",
  primaryLight: "#3385FF",
  background: "#F1F5F9",
  card: "#FFFFFF",
  foreground: "#0A0E17",
  muted: "#5C6B89",
  mutedLight: "#94A3B8",
  mutedXLight: "#CBD5E1",
  border: "#E2E8F0",
  footerBg: "#F8FAFC",
  accentBg: "#EFF4FF",
  accentText: "#0052CC",
  accentBorder: "rgba(0,82,204,0.15)",
  warningBg: "#FFFBEB",
  warningBorder: "#FDE68A",
  warningAccent: "#F59E0B",
  warningText: "#92400E",
} as const;

// ── Base email shell (reuse for any template) ──────────────────────────────
function baseLayout({
  preheader,
  headerContent,
  bodyContent,
  footerContent,
  year,
}: {
  preheader: string;
  headerContent: string;
  bodyContent: string;
  footerContent: string;
  year: number;
}): string {
  return `<!DOCTYPE html>
<html lang="es" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="x-apple-disable-message-reformatting">
  <meta http-equiv="x-ua-compatible" content="ie=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
  <!--[if mso]>
  <xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
  <![endif]-->
  <style>
    /* ── Dark mode overrides ── */
    @media (prefers-color-scheme: dark) {
      body, .bg-outer      { background-color: #0A0E17 !important; }
      .bg-card             { background-color: #161F30 !important; border-color: #1E2A40 !important; }
      .bg-footer           { background-color: #0D1525 !important; border-color: #1E2A40 !important; }
      .bg-accent-badge     { background-color: #1A2C4A !important; border-color: rgba(0,210,255,0.2) !important; }
      .bg-warning          { background-color: #1A2540 !important; border-color: #1E2A40 !important; border-left-color: #3385FF !important; }
      .text-heading        { color: #E8EDF5 !important; }
      .text-body           { color: #8FA3BF !important; }
      .text-muted          { color: #5C6B89 !important; }
      .text-muted-x        { color: #3D5166 !important; }
      .text-badge          { color: #00D2FF !important; }
      .text-link           { color: #3385FF !important; }
      .text-warning        { color: #94A3B8 !important; }
      .text-warning strong { color: #E8EDF5 !important; }
      .divider             { border-top-color: #1E2A40 !important; }
      .text-security-label { color: #8FA3BF !important; }
    }
    /* ── Responsive ── */
    @media only screen and (max-width: 600px) {
      .outer-wrapper { padding: 16px !important; }
      .card-body     { padding: 36px 24px 32px !important; }
      .card-footer   { padding: 24px !important; }
      .card-header   { padding: 32px 24px !important; }
      .btn-cta       { display: block !important; width: 100% !important; box-sizing: border-box !important; }
      .h1            { font-size: 22px !important; line-height: 30px !important; }
    }
  </style>
</head>
<body class="bg-outer" style="margin:0;padding:0;background-color:${T.background};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

  <!-- Preheader text (invisible — shows in inbox preview) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:${T.background};">
    ${preheader}
    &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>

  <!-- Outer table -->
  <table class="outer-wrapper" role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
    style="background-color:${T.background};padding:48px 16px;">
    <tr>
      <td align="center">

        <!-- Container (max 600 px) -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600"
          style="max-width:600px;width:100%;">

          <!-- ── HEADER ── -->
          <tr>
            <td class="card-header"
              style="border-radius:20px 20px 0 0;background:linear-gradient(135deg,${T.primary} 0%,${T.primaryLight} 100%);padding:36px 48px;"
              align="left">
              ${headerContent}
            </td>
          </tr>

          <!-- ── BODY ── -->
          <tr>
            <td class="bg-card card-body"
              style="background-color:${T.card};border:1px solid ${T.border};border-top:none;padding:44px 48px 36px;">
              ${bodyContent}
            </td>
          </tr>

          <!-- ── FOOTER ── -->
          <tr>
            <td class="bg-footer card-footer"
              style="background-color:${T.footerBg};border:1px solid ${T.border};border-top:none;border-radius:0 0 20px 20px;padding:28px 48px;"
              align="center">
              ${footerContent}
              <p class="text-muted-x" style="margin:6px 0 0;color:${T.mutedXLight};font-size:11px;text-align:center;line-height:1.5;">
                © ${year} Préstamos Elicar · Todos los derechos reservados.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Password Recovery Email ────────────────────────────────────────────────
export function recoveryPasswordEmail(actionLink: string): EmailPayload {
  const year = new Date().getFullYear();

  const header = `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="left">
      <tr>
        <!-- Logo mark -->
        <td style="width:52px;height:52px;background:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.28);border-radius:14px;text-align:center;vertical-align:middle;color:#FFFFFF;font-size:16px;font-weight:700;letter-spacing:-0.3px;"
            align="center">
          PE
        </td>
        <td style="padding-left:14px;vertical-align:middle;">
          <p style="margin:0;color:#FFFFFF;font-size:18px;font-weight:700;letter-spacing:-0.3px;line-height:1.2;">
            Préstamos Elicar
          </p>
          <p style="margin:3px 0 0;color:rgba(255,255,255,0.68);font-size:11px;font-weight:400;letter-spacing:0.6px;text-transform:uppercase;">
            Microfinanzas
          </p>
        </td>
      </tr>
    </table>`;

  const body = `
    <!-- Security badge -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td class="bg-accent-badge"
          style="background-color:${T.accentBg};border:1px solid ${T.accentBorder};border-radius:999px;padding:5px 14px;">
          <span class="text-badge" style="color:${T.accentText};font-size:12px;font-weight:600;letter-spacing:0.2px;">
            🔐&nbsp; Solicitud de seguridad
          </span>
        </td>
      </tr>
    </table>

    <!-- Title -->
    <h1 class="h1 text-heading"
      style="margin:22px 0 12px;color:${T.foreground};font-size:26px;font-weight:700;letter-spacing:-0.5px;line-height:1.25;">
      Recupera tu contraseña
    </h1>

    <!-- Body copy -->
    <p class="text-body"
      style="margin:0 0 28px;color:${T.muted};font-size:15px;line-height:1.7;">
      Hemos recibido una solicitud para restablecer la contraseña de tu cuenta.
      Haz clic en el botón de abajo para elegir una nueva contraseña.
    </p>

    <!-- CTA button -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 28px;">
      <tr>
        <td align="left">
          <!--[if mso]>
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
            href="${actionLink}"
            style="height:52px;v-text-anchor:middle;width:260px;"
            arcsize="14%" stroke="f" fillcolor="${T.primary}">
            <w:anchorlock/>
            <center style="color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;">
              Restablecer contraseña
            </center>
          </v:roundrect>
          <![endif]-->
          <!--[if !mso]><!-->
          <a href="${actionLink}" class="btn-cta"
            style="display:inline-block;background:linear-gradient(135deg,${T.primary} 0%,${T.primaryLight} 100%);color:#FFFFFF;font-size:15px;font-weight:600;text-decoration:none;padding:15px 36px;border-radius:10px;letter-spacing:-0.1px;line-height:1;-webkit-text-size-adjust:none;mso-hide:all;">
            Restablecer contraseña &rarr;
          </a>
          <!--<![endif]-->
        </td>
      </tr>
    </table>

    <!-- Expiry warning -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:0 0 32px;">
      <tr>
        <td class="bg-warning"
          style="background-color:${T.warningBg};border:1px solid ${T.warningBorder};border-left:3px solid ${T.warningAccent};border-radius:8px;padding:14px 16px;">
          <p class="text-warning"
            style="margin:0;color:${T.warningText};font-size:13px;line-height:1.6;">
            ⏱&nbsp; <strong>Este enlace expira en 1 hora.</strong>
            Si no lo usas a tiempo, solicita uno nuevo al administrador del sistema.
          </p>
        </td>
      </tr>
    </table>

    <!-- Divider -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:0 0 28px;">
      <tr>
        <td class="divider" style="border-top:1px solid ${T.border};height:0;line-height:0;font-size:0;">&nbsp;</td>
      </tr>
    </table>

    <!-- Security notes -->
    <p class="text-muted"
      style="margin:0 0 12px;color:${T.muted};font-size:13px;line-height:1.7;">
      Si no solicitaste el restablecimiento de tu contraseña, puedes ignorar
      este correo. Tu contraseña actual permanece sin cambios.
    </p>
    <p class="text-muted"
      style="margin:0 0 28px;color:${T.muted};font-size:13px;line-height:1.7;">
      🔒&nbsp; <strong class="text-security-label" style="color:${T.foreground};">No compartas este enlace</strong>
      con nadie. El equipo de Préstamos Elicar nunca te pedirá tu contraseña por correo electrónico.
    </p>

    <!-- Plain-text fallback URL -->
    <p class="text-muted"
      style="margin:0;color:${T.mutedLight};font-size:12px;line-height:1.6;">
      Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
      <a href="${actionLink}" class="text-link"
        style="color:${T.primary};text-decoration:underline;word-break:break-all;font-size:11px;line-height:1.8;">
        ${actionLink}
      </a>
    </p>`;

  const footer = `
    <p class="text-muted"
      style="margin:0 0 4px;color:${T.mutedLight};font-size:12px;text-align:center;line-height:1.5;">
      Correo enviado por razones de seguridad · No respondas a este mensaje.
    </p>`;

  const html = baseLayout({
    preheader:
      "Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en Préstamos Elicar.",
    headerContent: header,
    bodyContent: body,
    footerContent: footer,
    year,
  });

  const text = [
    "PRÉSTAMOS ELICAR — Recuperación de contraseña",
    "─".repeat(50),
    "",
    "Hemos recibido una solicitud para restablecer la contraseña de tu cuenta.",
    "",
    "Para continuar, visita el siguiente enlace:",
    "",
    actionLink,
    "",
    "⏱  Este enlace expira en 1 hora.",
    "",
    "─".repeat(50),
    "Si no solicitaste este cambio, ignora este correo.",
    "No compartas este enlace con nadie.",
    "",
    `© ${year} Préstamos Elicar. Todos los derechos reservados.`,
  ].join("\n");

  return {
    subject: "Recupera tu contraseña — Préstamos Elicar",
    html,
    text,
  };
}
