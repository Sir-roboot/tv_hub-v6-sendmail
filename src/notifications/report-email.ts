import nodemailer, { type SendMailOptions, type Transporter } from 'nodemailer';
import { env } from '../config/env.js';

type ReportEmailData = {
  reason: string;
  description: string;
  status: string;
  createdAt: Date;
  evidenceUrls: string[];
  resolvedAt?: Date | null;
};

let transporterPromise: Promise<Transporter> | undefined;
let usesEthereal = false;

async function getTransporter(): Promise<Transporter> {
  if (transporterPromise) return transporterPromise;

  transporterPromise = (async () => {
    if (env.nodeEnv === 'test') {
      return nodemailer.createTransport({ jsonTransport: true });
    }

    if (env.smtpHost) {
      usesEthereal = false;
      return nodemailer.createTransport({
        host: env.smtpHost,
        port: env.smtpPort,
        secure: env.smtpPort === 465,
        auth: env.smtpUser && env.smtpPass ? { user: env.smtpUser, pass: env.smtpPass } : undefined
      });
    }

    usesEthereal = true;
    const account = await nodemailer.createTestAccount();
    return nodemailer.createTransport({
      host: account.smtp.host,
      port: account.smtp.port,
      secure: account.smtp.secure,
      auth: { user: account.user, pass: account.pass }
    });
  })();

  return transporterPromise;
}

async function sendWithTransporter(message: SendMailOptions): Promise<void> {
  const transporter = await getTransporter();
  const info = await transporter.sendMail(message);

  if (usesEthereal) {
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) console.log(`Email preview: ${previewUrl}`);
  }
}

export async function sendReportCreatedEmail(report: ReportEmailData, channelName: string): Promise<void> {
  const createdAt = new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Mexico_City'
  }).format(report.createdAt);

  await sendWithTransporter({
    from: env.smtpFrom,
    to: env.reportNotificationEmail,
    subject: `[TV Hub] Nuevo reporte: ${channelName}`,
    text: [
      'Se creó un nuevo reporte de canal.',
      '',
      `Canal: ${channelName}`,
      `Razón: ${report.reason}`,
      `Descripción: ${report.description}`,
      `Estado: ${report.status}`,
      `Fecha de creación: ${createdAt}`
    ].join('\n')
  });
}

export async function sendReportResolvedEmail(report: ReportEmailData, channelName: string, recipient: string): Promise<void> {
  const createdAt = new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Mexico_City'
  }).format(report.createdAt);
  const resolvedAt = report.resolvedAt
    ? new Intl.DateTimeFormat('es-MX', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'America/Mexico_City'
      }).format(report.resolvedAt)
    : undefined;

  await sendWithTransporter({
    from: env.smtpFrom,
    to: recipient,
    subject: `[TV Hub] Tu reporte de ${channelName} fue resuelto`,
    text: [
      'El equipo de soporte resolvió tu reporte.',
      '',
      `Canal: ${channelName}`,
      `Razón: ${report.reason}`,
      `Descripción: ${report.description}`,
      `Estado final: ${report.status}`,
      `Fecha del reporte: ${createdAt}`,
      ...(resolvedAt ? [`Fecha de resolución: ${resolvedAt}`] : [])
    ].join('\n')
  });
}
