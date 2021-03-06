import { IsReferenceField, IsStringField } from '../../../../common/decorators/common.decorator';
import { Session } from '../../../auth/entities/session.entity';
import { Team } from '../../entities/team.entity';
import { User } from '../../entities/user.entity';

export class RegisterBodyDto {
  @IsStringField()
  email: string;

  @IsStringField()
  firstName: string;

  @IsStringField()
  lastName: string;

  @IsStringField()
  password: string;
}

export class RegisterResDto extends User {
  @IsStringField()
  firstName: string;

  @IsStringField()
  lastName: string;

  @IsStringField()
  displayName: string;

  @IsReferenceField({ type: Team })
  teams: Team[];

  @IsReferenceField({ type: Session })
  sessions: Session[];

  @IsStringField()
  jwt: string;
}
