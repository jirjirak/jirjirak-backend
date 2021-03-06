import { Logger } from '@nestjs/common';
import { lookup } from 'dns';
import { InjectableService } from '../../../common/decorators/common.decorator';
import { Monitor } from '../../monitor/entity/monitor.entity';
import { HttpTiming } from '../interfaces/http.interface';
import * as https from 'https';
import { EventService } from '../../event/services/event.service';
import { Event } from '../../event/entities/event.entity';
import { TransmitterService } from 'src/app/transmitter/services/transmitter.service';
import { v4 as uuid4 } from 'uuid';
@InjectableService()
export class HttpHealthCheckService {
  logger = new Logger();

  constructor(private transmitterService: TransmitterService, private eventService: EventService) {}

  private getDuration(t1: number, t2: number): number {
    return t2 - t1;
  }

  private http(
    params: https.RequestOptions,
  ): Promise<{ body?: any; timings: HttpTiming; error?: Error; statusCode?: number }> {
    const timings: HttpTiming = {
      startAt: +new Date(),
      dnsLookupAt: undefined,
      tcpConnectionAt: undefined,
      tlsHandshakeAt: undefined,
      firstByteAt: undefined,
      endAt: undefined,
    };

    return new Promise((resolve) => {
      const req = https.request({ ...params, lookup, ...{ maxRedirects: 5 } }, (res) => {
        const chunks = [];

        res.once('readable', () => {
          timings.firstByteAt = +new Date();
        });

        res.on('data', (chunk) => {
          chunks.push(chunk);
        });

        res.on('error', (error) => {
          return resolve({ error, timings });
        });

        res.on('end', function () {
          timings.endAt = +new Date();
          const body = Buffer.concat(chunks).toString('utf8');

          return resolve({ body, timings, statusCode: this.statusCode });
        });
      });

      req.on('error', (error) => {
        resolve({ error, timings });
      });

      req.on('socket', (socket) => {
        socket.on('lookup', () => {
          timings.dnsLookupAt = +new Date();
        });

        socket.on('connect', () => {
          timings.tcpConnectionAt = +new Date();
        });

        socket.on('secureConnect', () => {
          timings.tlsHandshakeAt = +new Date();
        });

        // socket.on('ready', () => {});
      });

      req.setTimeout(params.timeout || 15 * 1000, function () {
        this.abort();
      });

      // req.on('timeout', () => {});

      req.end();
    });
  }

  private async sendHttpRequest(monitor: Monitor, triggeredAt: Date): Promise<void> {
    const { body, timings, error, statusCode } = await this.http({
      hostname: 'api.doctop.com',
      path: '/ali',
      method: 'get',
    });

    const { dnsLookupAt, endAt, firstByteAt, startAt, tcpConnectionAt, tlsHandshakeAt } = timings;

    const dnsLookup: number = dnsLookupAt !== undefined ? this.getDuration(startAt, dnsLookupAt) : undefined;
    const tcpConnection = this.getDuration(dnsLookupAt || startAt, tcpConnectionAt);
    const tlsHandshake = tlsHandshakeAt !== undefined ? this.getDuration(tcpConnectionAt, tlsHandshakeAt) : undefined;
    const firstByte = this.getDuration(tlsHandshakeAt || tcpConnectionAt, firstByteAt);
    const contentTransfer = this.getDuration(firstByteAt, endAt);

    const data: Partial<Event> = {
      triggeredAt,
      monitor,
      resBody: JSON.stringify(body),
      statusCode,
      errorMessage: error?.message,
      startAt: new Date(startAt),
      endAt: new Date(endAt),
      dnsLookup,
      uuid: uuid4(),
      tcpConnection,
      tlsHandshake,
      firstByte,
      contentTransfer,
      errorCode: error?.['code'],
    };

    await this.transmitterService.sendEvent(data as any);
  }

  private checkStatusCode(monitor: Monitor, event: Event): boolean {
    const statusCode = event.statusCode;

    const minStatusCode = monitor.ExpectedMinStatusCode || 200;
    const maxStatueCode = monitor.ExpectedMaxStatusCode || 299;

    if (statusCode >= minStatusCode && statusCode <= maxStatueCode) {
      return true;
    }

    return false;
  }

  private checkError(monitor: Monitor, event: Event): boolean {
    if (event.errorMessage || event.errorCode) {
      return false;
    }

    return true;
  }

  // chose a name better than this
  private async httpHealthCheckResultIsOk(monitor: Monitor, event: Event): Promise<boolean> {
    let isOk = true;

    isOk = this.checkError(monitor, event);
    if (!isOk) {
      return isOk;
    }

    isOk = this.checkStatusCode(monitor, event);
    if (!isOk) {
      return isOk;
    }

    return isOk;
  }

  async healthCheck(monitors: Monitor[], jobTriggeredAt: Date): Promise<void> {
    for (const monitor of monitors) {
      this.sendHttpRequest(monitor, jobTriggeredAt);
    }
  }

  async saveHttpHealthCheckResult(event: Event): Promise<Event> {
    const isOk = await this.httpHealthCheckResultIsOk(event.monitor, event);
    return await this.eventService.saveEvent({ ...event, isOk });
  }
}
