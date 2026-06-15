import { ApiProperty } from '@nestjs/swagger';

export class CreatePropertyDto {
  @ApiProperty({ example: 'Sunset Apartments' })
  name: string;

  @ApiProperty({ example: '123 Main St' })
  address: string;

  @ApiProperty({ example: 'Austin' })
  city: string;

  @ApiProperty({ example: 'TX' })
  state: string;
}
