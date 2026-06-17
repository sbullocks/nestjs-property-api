import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsNotEmpty, IsEnum } from 'class-validator';
import { Role } from 'src/common/enums/role.enum';

export class LoginDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  tenantId: number;

  @ApiProperty({ example: 'admin' })
  @IsString()
  @IsNotEmpty()
  @IsEnum(Role)
  role: string;
}

