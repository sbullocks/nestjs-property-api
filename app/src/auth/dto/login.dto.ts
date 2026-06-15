import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 1 })
  tenantId: number;

  @ApiProperty({ example: 'admin' })
  role: string;
}
