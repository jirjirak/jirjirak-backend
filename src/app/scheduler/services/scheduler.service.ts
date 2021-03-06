import { forwardRef, Inject, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { isEmpty } from 'class-validator';
import { SocketServerService } from 'src/app/transmitter/services/socket-server.service';
import { Worker } from 'src/app/worker/entities/worker.entity';
import { WorkerStatus } from 'src/app/worker/enum/worker.enum';
import { ManageWorkerService } from 'src/app/worker/services/manage-worker.service';
import { WorkerService } from 'src/app/worker/services/worker.service';
import { isMonolithArchitecture } from 'src/config/app.config';

import { InjectableService } from '../../../common/decorators/common.decorator';
import { UtilsService } from '../../../common/service/utils.service';
import { Monitor } from '../../monitor/entity/monitor.entity';
import { MonitorStatus } from '../../monitor/enum/monitor.enum';
import { MonitorService } from '../../monitor/services/monitor.service';
import { ActiveWorkers } from '../interface/scheduler.interface';

@InjectableService()
export class SchedulerService {
  private logger = new Logger('SchedulerService');
  private activeWorkers: ActiveWorkers[] = [];

  constructor(
    private workerService: WorkerService,
    private manageWorkerService: ManageWorkerService,
    private utilsService: UtilsService,
    private monitorService: MonitorService,
    @Inject(forwardRef(() => SocketServerService))
    private socketServerService: SocketServerService,
  ) {}

  async isWorkerAlive(data: ActiveWorkers): Promise<void> {
    const { socketId, worker } = data;
    const isAlive = await this.socketServerService.ping(socketId);
    if (isAlive) {
      // this.logger.verbose(`Worker ${worker.uuid} is alive`);
    } else {
      this.logger.verbose(`Worker ${worker.uuid} is not alive`);
    }

    await this.manageWorkerService.updateLastCheckIn(worker.id);
  }

  @Cron(CronExpression.EVERY_5_SECONDS)
  async checkWorkerStatus(): Promise<void> {
    this.activeWorkers.forEach((worker) => {
      this.isWorkerAlive(worker);
    });
  }

  appendWorker(data: ActiveWorkers): void {
    this.activeWorkers.push(data);
  }

  removeWorker(socketId: string): void {
    this.activeWorkers = this.activeWorkers.filter((worker) => worker.socketId !== socketId);
  }

  private generateCronExpression(interval: number): string {
    // convert to second
    interval /= 1000;

    const min = 0;
    const max = interval - 1;

    const randomNumber = this.utilsService.generateRadomNumber(min, max);

    return `${randomNumber}/${interval} * * * * *`;
  }

  private async assignCronExpressionToMonitor(monitor: Monitor): Promise<Monitor> {
    let cronExpression = monitor.cronExpression;

    if (isEmpty(monitor.cronExpression)) {
      cronExpression = this.generateCronExpression(monitor.interval);

      monitor = await this.monitorService.updateMonitorCron(monitor.id, cronExpression);
    }

    return monitor;
  }

  async findWorkerByUUID(uuid: string): Promise<Worker> {
    return await this.manageWorkerService.findWorkerByUUID(uuid);
  }

  async isWorkerConnected(uuid: string): Promise<boolean> {
    const worker = await this.manageWorkerService.findWorkerByUUID(uuid);

    if (!worker) {
      throw new Error('Worker not found');
    }

    return worker.connected;
  }

  async workerConnected(uuid: string, identifier: string): Promise<void> {
    // if (isMonolithArchitecture) {
    //   return;
    // }

    const worker = await this.manageWorkerService.findWorkerByUUID(uuid);

    if (!worker) {
      throw new Error('Worker not found');
    }

    if (worker.status !== WorkerStatus.Active || worker.identifier !== identifier) {
      await this.manageWorkerService.updateWorkerConnectionStatus(worker.id, { connected: true, identifier });
    }
  }

  async workerDisconnected(uuid: string): Promise<void> {
    // if (isMonolithArchitecture) {
    //   return;
    // }

    const worker = await this.manageWorkerService.findWorkerByUUID(uuid);

    if (!worker) {
      throw new Error('Worker not found');
    }

    if (worker.status !== WorkerStatus.Inactive) {
      await this.manageWorkerService.updateWorkerConnectionStatus(worker.id, { connected: false });
    }
  }

  private async removeLocalWorkerFromMonitor(monitor: Monitor): Promise<boolean> {
    const { cronExpression, id } = monitor;
    const status = this.workerService.removeMonitorFromJob(cronExpression, id);
    return status;
  }

  async removeWorkerFromMonitor(monitor: Monitor): Promise<boolean> {
    if (isMonolithArchitecture) {
      return await this.removeLocalWorkerFromMonitor(monitor);
    } else {
      // do stuff
    }
  }

  async assignLocalWorkerToMonitors(monitors: Monitor[]): Promise<void> {
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
      await this.assignLocalWorkerToMonitors(monitors);
    } else {
      // do stuff
    }
  }
}
