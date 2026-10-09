import cron from 'node-cron';
import { env } from '../config/env.js';
import { Report } from '../models/report.model.js';
import { emitReportUpdated } from '../realtime/socket.js';

export async function escalateOldReports(): Promise<number> {
  const threshold = new Date(Date.now() - env.reportEscalationMinutes * 60_000);
  const reports = await Report.find({ status: 'OPEN', createdAt: { $lte: threshold } });

  for (const report of reports) {
    const userId = report.userId.toString();
    report.status = 'ESCALATED';
    await report.save();
    await report.populate([
      { path: 'channelId', select: 'name' },
      { path: 'userId', select: 'email' }
    ]);
    emitReportUpdated(userId, report.toObject());
  }

  return reports.length;
}

export function startReportEscalationJob(): void {
  cron.schedule(env.reportEscalationCron, () => {
    void escalateOldReports().catch((error) => {
      console.error('Could not escalate old reports:', error);
    });
  });
}
