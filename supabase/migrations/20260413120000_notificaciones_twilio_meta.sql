-- Metadatos de envío Twilio / email para auditoría y depuración
alter table public.notificaciones
  add column if not exists twilio_from text,
  add column if not exists twilio_to text,
  add column if not exists twilio_message_sid text,
  add column if not exists email_to text;

comment on column public.notificaciones.twilio_from is 'Remitente Twilio WhatsApp usado (ej. whatsapp:+14155238886)';
comment on column public.notificaciones.twilio_to is 'Destino Twilio WhatsApp (ej. whatsapp:+1829...)';
comment on column public.notificaciones.twilio_message_sid is 'SID del mensaje Twilio (SM...) si hubo envío exitoso';
comment on column public.notificaciones.email_to is 'Correo destino Resend cuando aplica';
