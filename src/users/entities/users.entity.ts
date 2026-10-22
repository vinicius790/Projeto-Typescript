import { ApiProperty } from '@nestjs/swagger';
import { UserEntity } from '../../auth/entities/auth.entity';
import { PaginationMeta } from '../../common/pagination';

export class PaginatedUsersEntity {
  @ApiProperty({ type: () => [UserEntity] })
  data!: UserEntity[];

  @ApiProperty({ type: () => PaginationMeta })
  meta!: PaginationMeta;
}
