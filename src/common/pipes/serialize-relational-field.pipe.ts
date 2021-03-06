import { Injectable, PipeTransform, ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { isArray, isEmpty } from 'lodash';
import { getManager, In } from 'typeorm';

import { relationalFieldMetaData, RelationalFieldMetaDataKey } from '../decorators/common.decorator';

@Injectable()
export class SerializeRelationalFieldPipe implements PipeTransform {
  private transferData(ids: any): { id: number } | { id: number }[] {
    if (isArray(ids)) {
      return ids.flatMap((i) => [{ id: +i }]);
    } else {
      return { id: +ids };
    }
  }

  async transform(value: any, metadata: ArgumentMetadata): Promise<unknown> {
    // if (metadata.type !== 'body') return value;

    const body = isArray(value) ? [...value] : [{ ...value }];

    //TODO: recursive or nested

    const relationalFields: relationalFieldMetaData[] = Reflect.getMetadata(
      RelationalFieldMetaDataKey,
      metadata.metatype,
    );

    if (!relationalFields) return value;

    const entityManager = getManager();

    for (const field of relationalFields) {
      /**
       *
       */
      for (const data of body) {
        /**
         *
         */

        if (isEmpty(data[field?.property]) && !data[field?.property]) continue;

        const numbers = data[field?.property];

        if (field?.isArray && !isArray(data[field?.property])) {
          data[field?.property] = [data[field?.property]];
        }

        const isMany = isArray(numbers);
        const ids = isMany ? [...numbers] : [{ ...numbers }];

        if (field.entity) {
          const repository = entityManager.getRepository(field.entity);

          const condition = isMany ? ids : [numbers];

          const entityData = await repository.find({ select: ['id'], where: { id: In(condition) }, withDeleted: true });

          if (entityData?.length !== ids?.length) {
            throw new BadRequestException('there is an id that dose not exist');
          }

          data[field?.property] = field.isArray ? entityData : entityData[0];
        } else {
          /**
           *
           */
          data[field?.property] = this.transferData(isMany ? ids : numbers);
        }
      }
    }

    return isArray(value) ? value : body[0];
  }
}
