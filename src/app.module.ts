import { BullModule } from '@nestjs/bull';
import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AccountModule } from './app/account/account.module';
import { AuthModule } from './app/auth/auth.module';
import { DataCenterModule } from './app/data-center/data-center.module';
import { EventModule } from './app/event/event.module';
import { HeartbeatModule } from './app/heartbeat/heartbeat.module';
import { MonitorModule } from './app/monitor/monitor.module';
import { SchedulerModule } from './app/scheduler/scheduler.module';
import { TagModule } from './app/tag/tag.module';
import { CommonModule } from './common/common.module';
import { typeOrmCOnfig } from './config/typeorm.config';
import { QueueModule } from './app/queue/queue.module';
import { ScheduleModule } from '@nestjs/schedule';
import { BullConfig } from './config/bull.config';
import { WorkerModule } from './app/worker/worker.module';
import { MessengerModule } from './app/messenger/messenger.module';
import { TransmitterModule } from './app/transmitter/transmitter.module';
import { AlertModule } from './app/alert/alert.module';
import { DeterminerModule } from './app/determiner/determiner.module';
import { MemdbModule } from './app/memdb/memdb.module';
import { LoggerMiddleware } from './middlewares/logger.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => typeOrmCOnfig(configService),
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => BullConfig(configService),
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    CommonModule,
    AccountModule,
    TagModule,
    MonitorModule,
    SchedulerModule,
    EventModule,
    DataCenterModule,
    HeartbeatModule,
    QueueModule,
    WorkerModule,
    MessengerModule,
    TransmitterModule,
    AlertModule,
    MemdbModule,
    DeterminerModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(LoggerMiddleware).forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
