import { forwardRef, Inject, Logger } from '@nestjs/common';
import { SchedulerService } from 'src/app/scheduler/services/scheduler.service';
import { In } from 'typeorm';

import { InjectableService } from '../../../common/decorators/common.decorator';
import { User } from '../../account/entities/user.entity';
import { CreateMonitorBodyDto } from '../dto/monitor/create-monitor.dto';
import { Monitor } from '../entity/monitor.entity';
import { MonitorStatus } from '../enum/monitor.enum';
import { MonitorRepository } from '../repositories/monitor.repository';

@InjectableService()
export class MonitorService {
  logger = new Logger('Monitor');

  constructor(
    @Inject(forwardRef(() => SchedulerService)) private schedulerService: SchedulerService,
    private monitorRepository: MonitorRepository,
  ) {}

  async createMonitor(creator: User, data: CreateMonitorBodyDto): Promise<Monitor> {
    const { address, directory, type } = data;

    const status = data.status === MonitorStatus.Enabled ? MonitorStatus.Waiting : MonitorStatus.Disabled;

    const MonitorAlreadyExist = await this.monitorRepository.count({
      where: {
        address,
        directory,
        type,
      },
    });

    if (MonitorAlreadyExist) {
      throw new Error('Monitor already exist');
    }

    const monitor = await this.monitorRepository.createAndSave({ ...data, creator, status });

    return monitor;
  }

  async deleteMonitor(monitorId: number): Promise<boolean> {
    const monitor = await this.monitorRepository.findOne({ where: { id: monitorId } });

    await this.schedulerService.removeWorkerFromMonitor(monitor);

    await this.monitorRepository.softDelete(monitorId);

    return true;
  }

  async countMonitors(): Promise<number> {
    return await this.monitorRepository.count({
      where: {
        status: In([MonitorStatus.Enabled, MonitorStatus.Waiting]),
      },
    });
  }

  async bootstrapLoadMonitor(page: number, limit?: number): Promise<Monitor[]> {
    const monitors = await this.monitorRepository.find({
      page,
      limit: limit || 1000,
      where: {
        status: In([MonitorStatus.Enabled, MonitorStatus.Waiting]),
      },
    });

    return monitors;
  }

  async updateMonitorCron(monitorId: number, cronExpression: string): Promise<Monitor> {
    return await this.monitorRepository.updateById(monitorId, { cronExpression });
  }

  async updateMonitorLocalWorker(monitorId: number, useLocalWorker: boolean): Promise<Monitor> {
    return await this.monitorRepository.updateById(monitorId, { useLocalWorker });
  }

  async updateMonitorStatus(monitorId: number, status: MonitorStatus): Promise<Monitor> {
    return await this.monitorRepository.updateById(monitorId, { status });
  }
}
