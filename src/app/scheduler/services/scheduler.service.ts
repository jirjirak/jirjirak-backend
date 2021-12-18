import { Logger } from '@nestjs/common';
import { isEmpty } from 'class-validator';
import { CronJob } from 'cron';
import { WorkerService } from 'src/app/worker/services/worker.service';
import { architecture, isMonolithArchitecture, isWorkerMode } from 'src/config/app.config';

import { InjectableService } from '../../../common/decorators/common.decorator';
import { UtilsService } from '../../../common/service/utils.service';
import { HealthCheckService } from '../../heartbeat/services/health-check.service';
import { Monitor } from '../../monitor/entity/monitor.entity';
import { MonitorStatus, MonitorType } from '../../monitor/enum/monitor.enum';
import { MonitorService } from '../../monitor/services/monitor.service';
import { JobStorage } from '../interface/scheduler.interface';

@InjectableService()
export class SchedulerService {
  logger = new Logger('Scheduler');

  constructor(
    private workerService: WorkerService,
    private utilsService: UtilsService,
    private monitorService: MonitorService,
  ) {}

  generateCronExpression(interval: number): string {
    // convert to second
    interval /= 1000;

    const min = 0;
    const max = interval - 1;

    const randomNumber = this.utilsService.generateRadomNumber(min, max);

    return `${randomNumber}/${interval} * * * * *`;
  }

  async assignCronExpressionToMonitor(monitor: Monitor): Promise<Monitor> {
    let cronExpression = monitor.cronExpression;

    if (isEmpty(monitor.cronExpression)) {
      cronExpression = this.generateCronExpression(monitor.interval);

      monitor = await this.monitorService.updateMonitorCron(monitor.id, cronExpression);
    }

    return monitor;
  }

  async assignLocalWorkerToMonitor(monitors: Monitor[]): Promise<void> {
    for (let monitor of monitors) {
      if (monitor.useLocalWorker !== true) {
        monitor = await this.monitorService.updateMonitorLocalWorker(monitor.id, true);
      }

      monitor = await this.assignCronExpressionToMonitor(monitor);

      await this.workerService.ProcessMonitor(monitor);

      if (monitor.status !== MonitorStatus.Enabled) {
        await this.monitorService.updateMonitorStatus(monitor.id, MonitorStatus.Enabled);
      }
    }
  }

  async assignWorkerToMonitor(monitors: Monitor[]): Promise<void> {
    if (isMonolithArchitecture) {
      await this.assignLocalWorkerToMonitor(monitors);
    } else {
      // do stuff
    }
  }
}
